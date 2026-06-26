import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { fabric } from 'fabric';
import { useFabricCanvas } from '../hooks/useFabricCanvas';
import { ActiveSettings } from '../types';
import { renderPDFPage } from '../utils/pdfRenderer';
import {
  Bold,
  Italic,
  Underline,
  Trash2,
  Copy,
  AlignLeft,
  AlignCenter,
  AlignRight,
  X,
} from 'lucide-react';

interface PageCanvasProps {
  pageIndex: number;
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  width: number;
  height: number;
  zoom: number;
  activeSettings: ActiveSettings;
  savedState: any;
  onSaveState: (pageIndex: number, state: any) => void;
  onUndoRedoAvailable: (pageIndex: number, canUndo: boolean, canRedo: boolean) => void;
  registerMethods: (
    pageIndex: number,
    methods: { undo: () => void; redo: () => void; clear: () => void; deleteActive?: () => void; removeObjectById?: (id: string) => void } | null
  ) => void;
  getFontForPdfjsName?: (rawName: string) => {
    fontFamily: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
  };
  // Reports the font of whichever line/text object the user just clicked/selected
  // (or null when deselected), purely for display — does NOT feed back into
  // activeSettings, so clicking around different lines never changes what font
  // gets applied to anything.
  onActiveFontChange?: (font: {
    fontFamily: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
  } | null) => void;
}

export function PageCanvas({
  pageIndex,
  pdfDoc,
  width,
  height,
  zoom,
  activeSettings,
  savedState,
  onSaveState,
  onUndoRedoAvailable,
  registerMethods,
  getFontForPdfjsName,
  onActiveFontChange,
}: PageCanvasProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Logical responsive dimensions at current zoom scale
  const displayWidth = width * zoom;
  const displayHeight = height * zoom;

  // Render original vector PDF to the background canvas
  useEffect(() => {
    let active = true;
    if (!bgCanvasRef.current || !pdfDoc) return;

    setRendering(true);
    setRenderError(null);

    // Stagger page renders: each page waits (pageIndex * 100ms) before starting
    // This prevents all 20 pages from hitting pdfjs at the same time
    // Page 0 renders immediately, page 1 waits 100ms, page 2 waits 200ms, etc.
    const delay = pageIndex * 80;
    const timer = setTimeout(() => {
      if (!active || !bgCanvasRef.current) return;

      const renderObj = renderPDFPage(pdfDoc, pageIndex, bgCanvasRef.current, zoom);

      renderObj.promise
        .then(() => {
          if (active) setRendering(false);
        })
        .catch((err: any) => {
          const isCancelled =
            err?.name === 'RenderingCancelledException' ||
            err?.message === 'Cancelled' ||
            err?.message === 'Rendering cancelled';
          if (active && !isCancelled) {
            console.error('Failed rendering background PDF page:', pageIndex, err);
            setRenderError('Error drawing page background.');
            setRendering(false);
          }
        });
    }, delay);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [pdfDoc, pageIndex, zoom, width, height]);

  const [textItems, setTextItems] = useState<any[]>([]);
  const [editedItemIds, setEditedItemIds] = useState<Set<string>>(new Set());

  // Extract text nodes from the original PDF page
  useEffect(() => {
    let active = true;
    if (!pdfDoc) return;

    async function loadText() {
      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        const textContent = await page.getTextContent();
        const styles = textContent.styles || {};

        const logicalViewport = page.getViewport({ scale: 1.0 });
        const [a, b, c, d, e, f] = logicalViewport.transform;

        const items = textContent.items
          .filter((item: any) => item.str && item.str.trim().length > 0)
          .map((item: any, idx: number) => {
            const tx = item.transform[4];
            const ty = item.transform[5];

            // Transform PDF space coordinates [tx, ty] to logical viewport [vx, vy]
            const vx = a * tx + c * ty + e;
            const vy = b * tx + d * ty + f;

            const scaleFactor = Math.abs(item.transform[3] || item.transform[0] || 12);

            // pdf.js computes this directly from the PDF's own FontDescriptor
            // flags (serif/sans-serif/monospace) — synchronous, always available,
            // no name-guessing involved. Used as a reliable fallback family bucket
            // when the Python font server hasn't extracted an exact match.
            const fontFallbackCategory = (styles as any)[item.fontName]?.fontFamily || 'sans-serif';

            return {
              id: `${pageIndex}-${tx}-${ty}-${idx}-${item.str.slice(0, 5)}`,
              str: item.str,
              width: item.width || (item.str.length * scaleFactor * 0.5),
              height: item.height || scaleFactor,
              fontSize: scaleFactor,
              x: vx,
              y: vy,
              fontName: item.fontName,
              fontFallbackCategory,
            };
          });

        if (active) {
          setTextItems(items);
        }
      } catch (err) {
        console.warn('Failed to load text elements for inline editing:', err);
      }
    }

    loadText();
    return () => {
      active = false;
    };
  }, [pdfDoc, pageIndex]);

  // Establish fabric.js overlay canvas
  const {
    canvasRef,
    fbCanvasInstance,
    undo,
    redo,
    clearObjects,
    deleteActive,
    removeObjectById,
    canUndo,
    canRedo,
  } = useFabricCanvas({
    pageIndex,
    width,
    height,
    zoom,
    activeSettings,
    savedState,
    onSaveState,
    onUndoRedoAvailable,
  });

  // When font panel changes activeSettings font → apply to currently selected object
  useEffect(() => {
    const fbCanvas = fbCanvasInstance.current;
    if (!fbCanvas) return;
    const active = fbCanvas.getActiveObject();
    if (!active || (active.type !== 'i-text' && active.type !== 'text')) return;
    (active as fabric.IText).set({
      fontFamily: activeSettings.fontFamily,
      fontWeight: activeSettings.fontWeight as any,
      fontStyle: activeSettings.fontStyle as any,
    });
    fbCanvas.renderAll();
    // Trigger state save via onSaveState so the change persists
    onSaveState(pageIndex, fbCanvas.toJSON(['id', 'selectable', 'evented', 'changeType']));
  }, [activeSettings.fontFamily, activeSettings.fontWeight, activeSettings.fontStyle]);

  const [activeTextObj, setActiveTextObj] = useState<fabric.IText | null>(null);
  const [activeCoords, setActiveCoords] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const [textProps, setTextProps] = useState({
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: 'normal',
    fontStyle: 'normal',
    fill: '#000000',
    textAlign: 'left',
    underline: false,
  });

  // Track selection and state of active editing/selected text
  useEffect(() => {
    const fbCanvas = fbCanvasInstance.current;
    if (!fbCanvas) return;

    const updateTextPropsState = (obj: fabric.IText) => {
      const fontFamily = obj.get('fontFamily') || 'Inter';
      const fontWeight = (obj.get('fontWeight') as 'normal' | 'bold') || 'normal';
      const fontStyle = (obj.get('fontStyle') as 'normal' | 'italic') || 'normal';
      setTextProps({
        fontFamily,
        fontSize: Math.round(obj.get('fontSize') || 16),
        fontWeight,
        fontStyle,
        fill: (obj.get('fill') as string) || '#000000',
        textAlign: obj.get('textAlign') || 'left',
        underline: !!obj.get('underline'),
      });
      // Tell the Font Panel what font this specific line is using, so the user
      // can see it at a glance and re-apply it (or a different one) to this line.
      onActiveFontChange?.({ fontFamily, fontWeight, fontStyle });
    };

    const updateCoords = (target: fabric.Object) => {
      const left = (target.left || 0) * zoom;
      const top = (target.top || 0) * zoom;
      const height = (target.height || 0) * (target.scaleY || 1) * zoom;
      const width = (target.width || 0) * (target.scaleX || 1) * zoom;
      
      setActiveCoords({
        left,
        top,
        height,
        width,
      });
    };

    const handleSelection = (options: fabric.IEvent & { selected?: fabric.Object[] }) => {
      // 'selection:created'/'selection:updated' canvas events carry a `selected`
      // array, not `target` (target is only present on per-object events like
      // 'object:moving') — fall back to the canvas's own active object too.
      const target = options.selected?.[0] || fbCanvas.getActiveObject();
      if (target && target.type === 'i-text') {
        setActiveTextObj(target as fabric.IText);
        updateTextPropsState(target as fabric.IText);
        updateCoords(target);
      } else {
        setActiveTextObj(null);
        setActiveCoords(null);
      }
    };

    const handleCleared = () => {
      setActiveTextObj(null);
      setActiveCoords(null);
      onActiveFontChange?.(null);
    };

    const handleMovingScaling = (options: fabric.IEvent) => {
      const target = options.target;
      if (target && target.type === 'i-text') {
        updateCoords(target);
      }
    };

    fbCanvas.on('selection:created', handleSelection);
    fbCanvas.on('selection:updated', handleSelection);
    fbCanvas.on('selection:cleared', handleCleared);
    fbCanvas.on('object:moving', handleMovingScaling);
    fbCanvas.on('object:scaling', handleMovingScaling);
    
    const handleTextChanged = (options: fabric.IEvent) => {
      const target = options.target;
      if (target && target.type === 'i-text') {
        updateTextPropsState(target as fabric.IText);
        updateCoords(target);
      }
    };
    fbCanvas.on('text:changed', handleTextChanged);

    const handleObjectRemoved = (e: fabric.IEvent) => {
      const obj = e.target;
      if (obj) {
        const id = (obj as any).id;
        if (typeof id === 'string' && id.startsWith('edited-item-')) {
          const matchingCoverId = `cover-${id}`;
          const matchingCover = fbCanvas.getObjects().find(o => (o as any).id === matchingCoverId);
          if (matchingCover) {
            fbCanvas.remove(matchingCover);
          }
        }
      }
    };
    fbCanvas.on('object:removed', handleObjectRemoved);

    return () => {
      fbCanvas.off('selection:created', handleSelection);
      fbCanvas.off('selection:updated', handleSelection);
      fbCanvas.off('selection:cleared', handleCleared);
      fbCanvas.off('object:moving', handleMovingScaling);
      fbCanvas.off('object:scaling', handleMovingScaling);
      fbCanvas.off('text:changed', handleTextChanged);
      fbCanvas.off('object:removed', handleObjectRemoved);
    };
  }, [fbCanvasInstance, zoom]);

  const handleEditTextItem = (item: any) => {
    const fbCanvas = fbCanvasInstance.current;
    if (!fbCanvas) return;

    setEditedItemIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });

    // Provide micro-padding to guarantee coverage of any anti-aliasing edges of the background PDF font
    const paddingX = 2;
    const paddingY = 2;

    const targetId = `edited-item-${item.id}`;

    // Covering original text inclusive of descenders
    const coverRect = new fabric.Rect({
      left: item.x - paddingX,
      top: item.y - item.fontSize - paddingY,
      width: item.width + (paddingX * 2),
      height: item.fontSize * 1.25 + (paddingY * 2),
      fill: '#ffffff',
      stroke: 'transparent',
      strokeWidth: 0,
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
    });
    (coverRect as any).id = `cover-${targetId}`;
    (coverRect as any).changeType = 'deletion';

    // Use Python-extracted font if available (exact match from PDF).
    // BUT if user has manually selected a font from the Font Panel, use that instead.
    // If neither is available, fall back to the serif/sans-serif/monospace bucket
    // pdf.js itself computed from the PDF's FontDescriptor flags (item.fontFallbackCategory)
    // instead of always defaulting to Helvetica — e.g. a Times New Roman line will
    // correctly fall back to a serif family instead of a sans-serif one.
    const userSelectedFont = activeSettings.fontFamily !== 'Inter' && activeSettings.fontFamily !== 'Editorial Serif';
    const extractedFont = !userSelectedFont ? getFontForPdfjsName?.(item.fontName) : null;

    const categoryFallbackFamily =
      item.fontFallbackCategory === 'monospace' ? 'Courier New, monospace' :
      item.fontFallbackCategory === 'serif' ? 'Georgia, Times New Roman, serif' :
      'Helvetica, Arial, sans-serif';

    const fontDetails = userSelectedFont
      ? { fontFamily: activeSettings.fontFamily, fontWeight: activeSettings.fontWeight, fontStyle: activeSettings.fontStyle }
      : extractedFont
        ? extractedFont
        : { fontFamily: categoryFallbackFamily, fontWeight: 'normal' as const, fontStyle: 'normal' as const };

    const fontSource = userSelectedFont ? 'user-selected' : extractedFont ? 'pdf-extracted' : 'category-fallback';
    console.log(`[Font] "${item.str}" → family="${fontDetails.fontFamily}" weight="${fontDetails.fontWeight}" (${fontSource}, category="${item.fontFallbackCategory}")`);


    // Fabric text baseline is aligned perfectly by placing top at (item.y - item.fontSize * 0.88)
    const editField = new fabric.IText(item.str, {
      left: item.x,
      top: item.y - item.fontSize * 0.88,
      fontSize: item.fontSize,
      fontFamily: fontDetails.fontFamily,
      fontWeight: fontDetails.fontWeight as any,
      fontStyle: fontDetails.fontStyle as any,
      fill: activeSettings.color || '#000000',
      transparentCorners: true,
      cornerColor: '#3b82f6',
      cornerSize: 6,
      cornerStyle: 'circle',
      borderColor: '#3b82f6',
      borderDashArray: undefined,
      hasControls: false, // Disable scale controls to feel like a proper paragraph inline text input instead of a vector handle
      hasBorders: true,
      lineHeight: 1.15,
      padding: 0, // Using 0 padding aligns the text insertion point perfectly with the layout background
      editingBorderColor: '#3b82f6',
    });
    (editField as any).id = targetId;
    (editField as any).changeType = 'addition';

    fbCanvas.add(coverRect);
    fbCanvas.add(editField);
    fbCanvas.setActiveObject(editField);
    
    // Automatically trigger focused text insertion point immediately
    editField.enterEditing();
    editField.selectAll(); // Select all to allow quick replacement
    fbCanvas.renderAll();
  };

  // Expose undo/redo/clear triggers to parent editor
  useEffect(() => {
    registerMethods(pageIndex, {
      undo,
      redo,
      clear: clearObjects,
      deleteActive,
      removeObjectById,
    });

    return () => {
      registerMethods(pageIndex, null);
    };
  }, [pageIndex, undo, redo, clearObjects, deleteActive, removeObjectById, registerMethods]);

  // Prefer placing the floating toolbar above the text being edited; if there
  // isn't enough room (text near the top of the page, or the toolbar wraps to
  // two rows), place it below instead of letting it overlap the text itself.
  // The gap is measured from the toolbar's real rendered height (it can wrap
  // to a second row depending on content), not a guessed fixed number.
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [toolbarHeight, setToolbarHeight] = useState(58);

  useLayoutEffect(() => {
    if (activeCoords && activeTextObj && toolbarRef.current) {
      const measured = toolbarRef.current.offsetHeight;
      if (measured && measured !== toolbarHeight) {
        setToolbarHeight(measured);
      }
    }
  }, [activeCoords, activeTextObj, textProps]);

  const toolbarGap = toolbarHeight + 8;
  const toolbarTop = activeCoords
    ? activeCoords.top - toolbarGap >= 10
      ? activeCoords.top - toolbarGap
      : activeCoords.top + activeCoords.height + 10
    : 0;
  const closeFloatingToolbar = () => {
    fbCanvasInstance.current?.discardActiveObject();
    fbCanvasInstance.current?.renderAll();
    setActiveTextObj(null);
    setActiveCoords(null);
  };

  return (
    <div
      id={`pdf-page-container-${pageIndex}`}
      className="relative mx-auto bg-white shadow-xl rounded-md border border-slate-200/65 overflow-hidden select-none transition-shadow hover:shadow-2xl"
      style={{
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
      }}
    >
      {/* 1. Vector PDF Render Background Canvas */}
      <canvas
        ref={bgCanvasRef}
        className="absolute top-0 left-0 z-0 bg-white"
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          pointerEvents: 'none', // background is read-only
        }}
      />

      {/* 2. Interactive Fabric Annotation Overlay layer */}
      <div
        className="absolute top-0 left-0 z-10"
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
        }}
      >
        <canvas ref={canvasRef} />
      </div>

      {/* 3. Text Overlay items to edit existing PDF text block elements directly */}
      {activeSettings.tool === 'edit_pdf_text' && (
        <div className="absolute inset-0 z-25 pointer-events-none">
          {textItems
            .filter((item) => !editedItemIds.has(item.id))
            .map((item) => (
              <button
                key={item.id}
                onClick={() => handleEditTextItem(item)}
                id={`btn-edit-item-${item.id}`}
                className="absolute border border-transparent hover:border-dashed hover:border-blue-400 hover:bg-blue-400/5 pointer-events-auto rounded-[2px] transition-all cursor-text flex items-center justify-center group/item"
                style={{
                  left: `${(item.x - 2) * zoom}px`,
                  top: `${(item.y - item.fontSize * 0.88) * zoom}px`,
                  width: `${(item.width + 4) * zoom}px`,
                  height: `${(item.fontSize * 1.15) * zoom}px`,
                }}
                title={`Click to edit: "${item.str}"`}
              >
                <span className="opacity-0 group-hover/item:opacity-100 transition-opacity bg-blue-600 text-white text-[9px] font-sans px-1.5 py-0.5 rounded shadow absolute bottom-full left-[2px] mb-1 leading-tight pointer-events-none whitespace-nowrap z-40">
                  Edit Text
                </span>
              </button>
            ))}
        </div>
      )}

      {/* RENDER LOADERS */}
      {rendering && (
        <div className="absolute inset-0 bg-slate-55/40 backdrop-blur-xs flex items-center justify-center z-20">
          <div className="flex items-center gap-2 bg-white/90 shadow-sm border border-slate-100 rounded-full py-2 px-4">
            <span className="w-3.5 h-3.5 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></span>
            <span className="text-xs font-semibold text-slate-500">
              Drawing high fidelity PDF vectors...
            </span>
          </div>
        </div>
      )}

      {/* RENDER ERROR */}
      {renderError && (
        <div className="absolute inset-0 bg-red-50/90 flex flex-col items-center justify-center p-4 z-20 text-center">
          <p className="text-xs font-bold text-red-600">{renderError}</p>
          <p className="text-[10px] text-slate-400 mt-1">Please try reloading the file.</p>
        </div>
      )}

      {/* Floating inline typography and style editor toolbar (Sejda / PSPDFKit standard) */}
      {activeCoords && activeTextObj && (
        <div
          ref={toolbarRef}
          id="editor-floating-toolbar"
          className="absolute z-50 pointer-events-auto bg-white/95 backdrop-blur-md shadow-2xl border border-slate-200 rounded-xl p-2 flex items-center gap-1.5 transition-all text-slate-700 select-none flex-wrap"
          style={{
            left: `${Math.min(displayWidth - 380 - 10, Math.max(10, activeCoords.left))}px`,
            top: `${Math.min(displayHeight - 50 - 10, Math.max(10, toolbarTop))}px`,
            width: '380px',
          }}
        >
          {/* Close button — dismiss the toolbar without losing the edit */}
          <button
            onClick={closeFloatingToolbar}
            id="floating-btn-close-toolbar"
            title="Close toolbar"
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all order-last"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Font Family selector */}
          <select
            value={textProps.fontFamily}
            onChange={(e) => {
              const val = e.target.value;
              activeTextObj.set('fontFamily', val);
              fbCanvasInstance.current?.renderAll();
              setTextProps(prev => ({ ...prev, fontFamily: val }));
              fbCanvasInstance.current?.fire('object:modified', { target: activeTextObj });
            }}
            id="floating-font-select"
            className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-2 py-1 font-medium cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-all text-slate-700 max-w-[110px]"
          >
            <option value="Inter">Inter (Sans)</option>
            <option value="Arial">Arial</option>
            <option value="Playfair Display">Editorial Serif</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier Mono</option>
            <option value="JetBrains Mono">JetBrains Mono</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Georgia">Georgia</option>
          </select>

          {/* Font Size Selector */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5 mr-0.5">
            <input
              type="number"
              value={textProps.fontSize}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (isNaN(val) || val < 1) return;
                activeTextObj.set('fontSize', val);
                fbCanvasInstance.current?.renderAll();
                setTextProps(prev => ({ ...prev, fontSize: val }));
                fbCanvasInstance.current?.fire('object:modified', { target: activeTextObj });
              }}
              min="6"
              max="120"
              id="floating-fontsize-input"
              className="w-10 text-xs bg-slate-50 border border-slate-200 rounded py-0.5 text-center font-semibold text-slate-700 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            />
            <span className="text-[9px] text-slate-400 font-bold uppercase select-none">px</span>
          </div>

          {/* Format triggers */}
          <div className="flex items-center gap-0.5 border-l border-slate-200 pl-1.5">
            <button
              onClick={() => {
                const nextVal = textProps.fontWeight === 'bold' ? 'normal' : 'bold';
                activeTextObj.set('fontWeight', nextVal);
                fbCanvasInstance.current?.renderAll();
                setTextProps(prev => ({ ...prev, fontWeight: nextVal }));
                fbCanvasInstance.current?.fire('object:modified', { target: activeTextObj });
              }}
              id="floating-btn-bold"
              className={`p-1 rounded transition-all ${
                textProps.fontWeight === 'bold'
                  ? 'bg-emerald-50 text-emerald-600 font-bold border border-emerald-200'
                  : 'hover:bg-slate-100 text-slate-600 border border-transparent'
              }`}
              title="Bold"
            >
              <Bold className="w-3 h-3" />
            </button>

            <button
              onClick={() => {
                const nextVal = textProps.fontStyle === 'italic' ? 'normal' : 'italic';
                activeTextObj.set('fontStyle', nextVal);
                fbCanvasInstance.current?.renderAll();
                setTextProps(prev => ({ ...prev, fontStyle: nextVal }));
                fbCanvasInstance.current?.fire('object:modified', { target: activeTextObj });
              }}
              id="floating-btn-italic"
              className={`p-1 rounded transition-all ${
                textProps.fontStyle === 'italic'
                  ? 'bg-emerald-50 text-emerald-600 font-bold border border-emerald-200'
                  : 'hover:bg-slate-100 text-slate-600 border border-transparent'
              }`}
              title="Italic"
            >
              <Italic className="w-3 h-3" />
            </button>

            <button
              onClick={() => {
                const nextVal = !textProps.underline;
                activeTextObj.set('underline', nextVal);
                fbCanvasInstance.current?.renderAll();
                setTextProps(prev => ({ ...prev, underline: nextVal }));
                fbCanvasInstance.current?.fire('object:modified', { target: activeTextObj });
              }}
              id="floating-btn-underline"
              className={`p-1 rounded transition-all ${
                textProps.underline
                  ? 'bg-emerald-50 text-emerald-600 font-bold border border-emerald-200'
                  : 'hover:bg-slate-100 text-slate-600 border border-transparent'
              }`}
              title="Underline"
            >
              <Underline className="w-3 h-3" />
            </button>
          </div>

          {/* Align triggers */}
          <div className="flex items-center gap-0.5 border-l border-slate-200 pl-1.5">
            <button
              onClick={() => {
                activeTextObj.set('textAlign', 'left');
                fbCanvasInstance.current?.renderAll();
                setTextProps(prev => ({ ...prev, textAlign: 'left' }));
                fbCanvasInstance.current?.fire('object:modified', { target: activeTextObj });
              }}
              id="floating-btn-align-left"
              className={`p-1 rounded transition-all ${
                textProps.textAlign === 'left'
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'hover:bg-slate-100 text-slate-600 border border-transparent'
              }`}
              title="Align Left"
            >
              <AlignLeft className="w-3 h-3" />
            </button>

            <button
              onClick={() => {
                activeTextObj.set('textAlign', 'center');
                fbCanvasInstance.current?.renderAll();
                setTextProps(prev => ({ ...prev, textAlign: 'center' }));
                fbCanvasInstance.current?.fire('object:modified', { target: activeTextObj });
              }}
              id="floating-btn-align-center"
              className={`p-1 rounded transition-all ${
                textProps.textAlign === 'center'
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'hover:bg-slate-100 text-slate-600 border border-transparent'
              }`}
              title="Align Center"
            >
              <AlignCenter className="w-3 h-3" />
            </button>

            <button
              onClick={() => {
                activeTextObj.set('textAlign', 'right');
                fbCanvasInstance.current?.renderAll();
                setTextProps(prev => ({ ...prev, textAlign: 'right' }));
                fbCanvasInstance.current?.fire('object:modified', { target: activeTextObj });
              }}
              id="floating-btn-align-right"
              className={`p-1 rounded transition-all ${
                textProps.textAlign === 'right'
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'hover:bg-slate-100 text-slate-600 border border-transparent'
              }`}
              title="Align Right"
            >
              <AlignRight className="w-3 h-3" />
            </button>
          </div>

          {/* Color Presets */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5">
            {['#000000', '#ef4444', '#3b82f6', '#10b981', '#eab308'].map((c) => (
              <button
                key={c}
                onClick={() => {
                  activeTextObj.set('fill', c);
                  fbCanvasInstance.current?.renderAll();
                  setTextProps(prev => ({ ...prev, fill: c }));
                  fbCanvasInstance.current?.fire('object:modified', { target: activeTextObj });
                }}
                id={`floating-btn-color-${c.replace('#', '')}`}
                className={`w-3.5 h-3.5 rounded-full border transition-all ${
                  textProps.fill.toLowerCase() === c.toLowerCase()
                    ? 'ring-2 ring-offset-1 ring-emerald-500 scale-110'
                    : 'border-slate-300 hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                title={`Text Color: ${c}`}
              />
            ))}
            {/* Custom hex text picker */}
            <input
              type="color"
              value={textProps.fill}
              onChange={(e) => {
                const val = e.target.value;
                activeTextObj.set('fill', val);
                fbCanvasInstance.current?.renderAll();
                setTextProps(prev => ({ ...prev, fill: val }));
                fbCanvasInstance.current?.fire('object:modified', { target: activeTextObj });
              }}
              id="floating-color-picker"
              className="w-4 h-4 border-0 rounded-md cursor-pointer ml-0.5 p-0 bg-transparent"
              title="Custom Color"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 border-l border-slate-200 pl-1.5 ml-auto">
            <button
              onClick={() => {
                activeTextObj.clone((cloned: fabric.Object) => {
                  cloned.set({
                    left: (cloned.left || 0) + 15,
                    top: (cloned.top || 0) + 15,
                    evented: true,
                    selectable: true,
                  });
                  fbCanvasInstance.current?.add(cloned);
                  fbCanvasInstance.current?.setActiveObject(cloned);
                  fbCanvasInstance.current?.renderAll();
                  fbCanvasInstance.current?.fire('object:added', { target: cloned });
                });
              }}
              id="floating-btn-duplicate"
              className="p-1 rounded hover:bg-slate-100 text-slate-600 transition-all"
              title="Duplicate Block"
            >
              <Copy className="w-3 h-3" />
            </button>

            <button
              onClick={() => {
                fbCanvasInstance.current?.remove(activeTextObj);
                fbCanvasInstance.current?.renderAll();
                setActiveTextObj(null);
                setActiveCoords(null);
              }}
              id="floating-btn-trash"
              className="p-1 rounded hover:bg-red-50 text-red-600 transition-all"
              title="Delete Editing Block"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Page indicator pill (bottom corner of element) */}
      <div className="absolute bottom-3 right-3 z-20 px-2.5 py-1 bg-slate-800/80 hover:bg-slate-900 border border-slate-700/50 backdrop-blur-xs text-[10px] text-white font-bold rounded-md uppercase tracking-wider select-none">
        p. {pageIndex + 1}
      </div>
    </div>
  );
}
