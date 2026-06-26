import { PDFDocument } from 'pdf-lib';
import { fabric } from 'fabric';

/**
 * Merges high-resolution fabric overlays onto original PDF pages using pdf-lib.
 * Returns the edited PDF bytes.
 */
export async function exportMergedPDF(
  originalBytes: Uint8Array,
  pagesState: Record<number, any>, 
  pagesMeta: { width: number; height: number }[]
): Promise<Uint8Array> {
  // Load original PDF bytes (read-only in memory)
  const pdfDoc = await PDFDocument.load(originalBytes);
  const pdfPages = pdfDoc.getPages();

  for (let i = 0; i < pdfPages.length; i++) {
    const page = pdfPages[i];
    const pageMeta = pagesMeta[i];
    const fabricState = pagesState[i];

    // If there is no shape, text, or sketch on this page, don't overlay anything
    if (!fabricState || !fabricState.objects || fabricState.objects.length === 0) {
      continue;
    }

    // Extract natural page size inside the PDF
    const width = pageMeta.width;
    const height = pageMeta.height;

    // We render the fabric drawings using an offline static canvas in-memory
    const pngDataUrl = await new Promise<string>((resolve) => {
      const offscreenCanvasEl = document.createElement('canvas');
      offscreenCanvasEl.width = width;
      offscreenCanvasEl.height = height;

      const staticCanvas = new fabric.StaticCanvas(offscreenCanvasEl, {
        width: width,
        height: height,
        backgroundColor: 'transparent',
      });

      // Load fabric visual state
      staticCanvas.loadFromJSON(fabricState, () => {
        // Ensure no object has active borders or control states lingering
        staticCanvas.forEachObject((obj) => {
          obj.hasBorders = false;
          obj.hasControls = false;
          (obj as any).active = false;
          
          if (obj.type === 'rect') {
            const rect = obj as fabric.Rect;
            const fillStr = String(rect.fill || '').toLowerCase();
            const idStr = String((rect as any).id || '').toLowerCase();
            
            // Safeguard whiteout cover rects or any white filled rects from rendering borders/strokes
            if (
              idStr.includes('cover') || 
              fillStr === '#ffffff' || 
              fillStr === 'white' || 
              fillStr === 'rgb(255,255,255)' || 
              fillStr === 'rgba(255,255,255,1)'
            ) {
              rect.stroke = 'transparent';
              rect.strokeWidth = 0;
            }
          }

          if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
            // Guarantee exported text blocks have absolutely no selection borders, strokes or outlines
            obj.set({
              hasBorders: false,
              hasControls: false,
              borderColor: 'transparent',
              stroke: 'transparent',
              strokeWidth: 0,
            });
          }
        });

        staticCanvas.renderAll();
        // Export high resolution 2x so annotations are sharp on PDF prints
        const dataUrl = staticCanvas.toDataURL({
          format: 'png',
          multiplier: 2.0, 
        });
        staticCanvas.dispose();
        resolve(dataUrl);
      });
    });

    // Embed the transparent PNG layer as an image inside the PDF
    const overlayImage = await pdfDoc.embedPng(pngDataUrl);

    // Draw image over the entire page layer
    page.drawImage(overlayImage, {
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight(),
    });
  }

  // Save changes onto a new byte array
  return await pdfDoc.save();
}
