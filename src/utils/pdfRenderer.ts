import * as pdfjsLib from 'pdfjs-dist';
// Import the compiled worker raw code to create a safe same-origin blob url
// @ts-ignore
import pdfjsWorkerCode from 'pdfjs-dist/build/pdf.worker.js?raw';

const blob = new Blob([pdfjsWorkerCode], { type: 'text/javascript' });
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);

export interface RenderedPageResult {
  width: number;       // Logical display width in points
  height: number;      // Logical display height in points
  canvas: HTMLCanvasElement;
}

/**
 * Loads a PDF from bytes and returns the pdfDoc proxy.
 */
export async function loadPDFDocument(bytes: Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  return await loadingTask.promise;
}

/**
 * Renders a PDF page to an HTML canvas at high DPI but styled at logical sizes.
 * Returns a promise paired with a cancel trigger function to clean up intermediate rendering states.
 */
export function renderPDFPage(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number, // 0-based
  canvas: HTMLCanvasElement,
  zoom: number = 1.0
): { promise: Promise<RenderedPageResult>; cancel: () => void } {
  let renderTask: any = null;
  let cancelled = false;

  const promise = (async () => {
    // pageIndex is 0-based in app but 1-based in pdf.js
    const page = await pdfDoc.getPage(pageIndex + 1);
    if (cancelled) {
      throw new Error('Cancelled');
    }
    
    // We calculate viewport based on the logical size (scale: 1.0)
    const logicalViewport = page.getViewport({ scale: 1.0 });
    const logicalWidth = logicalViewport.width * zoom;
    const logicalHeight = logicalViewport.height * zoom;
    
    // Render at 1.5x max for performance — good quality without being too slow
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const renderViewport = page.getViewport({ scale: zoom * pixelRatio });
    
    canvas.width = renderViewport.width;
    canvas.height = renderViewport.height;
    
    // Use CSS styles to size the canvas to display at logical points
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Render
    const renderContext = {
      canvasContext: ctx,
      viewport: renderViewport,
    };
    
    renderTask = page.render(renderContext);
    await renderTask.promise;
    
    return {
      width: logicalWidth,
      height: logicalHeight,
      canvas,
    };
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch (err) {
          // Ignore task already complete or cancelled
        }
      }
    }
  };
}
