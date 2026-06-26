import { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Eye, File } from 'lucide-react';

interface PageThumbnailsProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  numPages: number;
  activePageIndex: number;
  onPageClick: (index: number) => void;
}

export function PageThumbnails({
  pdfDoc,
  numPages,
  activePageIndex,
  onPageClick,
}: PageThumbnailsProps) {

  return (
    <div className="w-56 border-r border-slate-200 bg-slate-50 flex flex-col h-full select-none">
      
      {/* Title */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-slate-400" />
          Page Navigator
        </h3>
        <p className="text-[10.5px] text-slate-400 mt-0.5">
          {numPages} {numPages === 1 ? 'Page' : 'Pages'} detected
        </p>
      </div>

      {/* Thumbnails Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Array.from({ length: numPages }).map((_, index) => {
          const isActive = index === activePageIndex;
          return (
            <button
              key={index}
              onClick={() => onPageClick(index)}
              id={`thumbnail-card-${index}`}
              className={`w-full flex flex-col items-center p-2.5 rounded-xl transition-all cursor-pointer text-center group ${
                isActive
                  ? 'bg-blue-50/80 ring-2 ring-blue-500 shadow-sm'
                  : 'bg-white hover:bg-slate-100/50 border border-slate-200 shadow-xs'
              }`}
            >
              {/* Decorative mini PDF sketch representation */}
              <div className="relative w-28 aspect-[3/4] bg-white border border-slate-200 rounded shadow-xs flex items-center justify-center group-hover:scale-[1.02] transition-transform overflow-hidden">
                <ThumbnailCanvas pdfDoc={pdfDoc} pageIndex={index} />
                
                {/* Overlay indicating selection */}
                {isActive && (
                  <div className="absolute inset-0 bg-blue-500/5 flex items-center justify-center">
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                      ACTIVE
                    </span>
                  </div>
                )}
              </div>

              {/* Page indicator text */}
              <span className={`text-[11px] font-bold mt-2 ${
                isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'
              }`}>
                Page {index + 1}
              </span>
            </button>
          );
        })}
      </div>

    </div>
  );
}

// Child rendering hook and component for rendering page previews on-demand
interface ThumbnailCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageIndex: number;
}

function ThumbnailCanvas({ pdfDoc, pageIndex }: ThumbnailCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    
    let active = true;

    async function drawThumbnail() {
      try {
        if (!pdfDoc) return;
        const page = await pdfDoc.getPage(pageIndex + 1);
        
        // Thumbnail scale (cheap, very fast to draw)
        const viewport = page.getViewport({ scale: 0.17 });
        
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Render PDF contents onto local thumbnail canvas
        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };
        
        if (active) {
          await page.render(renderContext).promise;
        }
      } catch (err) {
        console.warn('Could not draw thumbnail for page index:', pageIndex, err);
      }
    }

    drawThumbnail();

    return () => {
      active = false;
    };
  }, [pdfDoc, pageIndex]);

  if (!pdfDoc) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-300">
        <File className="w-8 h-8" />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-contain bg-white"
    />
  );
}
