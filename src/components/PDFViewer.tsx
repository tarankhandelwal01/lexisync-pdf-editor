import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  FileDown,
  Plus,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Sparkles,
  CheckCircle,
  GitCompare,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { PageThumbnails } from './PageThumbnails';
import { Toolbar } from './Toolbar';
import { PageCanvas } from './PageCanvas';
import { FontPanel } from './FontPanel';
import { TrackChangesBar, TrackChange } from './TrackChangesBar';
import { usePDFExport } from '../hooks/usePDFExport';
import { useFontExtractor } from '../hooks/useFontExtractor';
import { getDiffRects, describeChangeObject } from '../utils/diffOverlay';
import { ActiveSettings, PDFFileState } from '../types';

interface PDFViewerProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pdfMeta: PDFFileState;
  onClearPDF: () => void;
  onUploadNewFile: (file: File) => void;
}

export function PDFViewer({
  pdfDoc,
  pdfMeta,
  onClearPDF,
  onUploadNewFile,
}: PDFViewerProps) {
  const [zoom, setZoom] = useState<number>(1.0);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  
  // High fidelity canvas settings state
  const [activeSettings, setActiveSettings] = useState<ActiveSettings>({
    tool: 'select',
    color: '#000000',
    strokeWidth: 4,
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: 'normal',
    fontStyle: 'normal',
    rectFill: 'transparent',
    redact: false,
  });

  // State recording drawings/draws for all pages
  const [pagesState, setPagesState] = useState<Record<number, any>>({});

  // History states for Toolbar enablement feedback
  const [undoRedoStates, setUndoRedoStates] = useState<Record<number, { canUndo: boolean; canRedo: boolean }>>({});

  // Save reference of active page method triggers to bridge right sidebar actions
  const pageMethodsRef = useRef<Record<number, { undo: () => void; redo: () => void; clear: () => void; deleteActive?: () => void; removeObjectById?: (id: string) => void }>>({});

  // Export hooks
  const { exporting, error: exportError, exportPDF } = usePDFExport();

  // Font extraction via Python server
  const { extractFonts, getFontForPdfjsName, serverAvailable, loading: fontLoading, result: fontResult } = useFontExtractor();

  // Auto-extract fonts when PDF loads
  useEffect(() => {
    if (pdfMeta?.name) {
      const blob = new Blob([pdfMeta.bytes], { type: 'application/pdf' });
      const file = new File([blob], pdfMeta.name, { type: 'application/pdf' });
      extractFonts(file).then(result => {
        if (result) console.log(`[PDFViewer] ${result.totalFonts} fonts loaded`);
      });
    }
  }, [pdfMeta?.name]);

  // Compare view mode (LexiSync style - left red, right green)
  const [compareMode, setCompareMode] = useState(false);

  // Track changes derived directly from each page's tagged annotation objects
  // (additions/deletions) — accept = keep the annotation & dismiss it from
  // this list, reject = actually remove the underlying annotation object
  // from its page's canvas. No PDF text extraction is involved.
  const [dismissedChangeIds, setDismissedChangeIds] = useState<Set<string>>(new Set());

  const changeItems: TrackChange[] = [];
  pdfMeta.pages.forEach((_, pageIndex) => {
    const objects = pagesState[pageIndex]?.objects || [];
    objects.forEach((obj: any, idx: number) => {
      if (obj.changeType !== 'addition' && obj.changeType !== 'deletion') return;
      const objId = obj.id || `auto-${idx}`;
      changeItems.push({
        id: `${pageIndex}::${objId}`,
        type: obj.changeType === 'addition' ? 'added' : 'removed',
        text: describeChangeObject(obj),
        pageIndex,
        timestamp: 0,
      });
    });
  });

  const visibleChanges = changeItems.filter(c => !dismissedChangeIds.has(c.id));

  function rejectChangeId(id: string) {
    const sep = id.indexOf('::');
    if (sep === -1) return;
    const pageIndex = parseInt(id.slice(0, sep), 10);
    const objId = id.slice(sep + 2);
    pageMethodsRef.current[pageIndex]?.removeObjectById?.(objId);
  }

  function handleAcceptChange(id: string) {
    setDismissedChangeIds(prev => new Set(prev).add(id));
  }

  function handleRejectChange(id: string) {
    rejectChangeId(id);
  }

  function handleAcceptAll() {
    setDismissedChangeIds(prev => {
      const next = new Set(prev);
      visibleChanges.forEach(c => next.add(c.id));
      return next;
    });
  }

  function handleRejectAll() {
    visibleChanges.forEach(c => rejectChangeId(c.id));
  }
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // File picker handler for "Upload New File"
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

  // Registry for page methods
  const registerPageMethods = useCallback((
    pageIndex: number,
    methods: { undo: () => void; redo: () => void; clear: () => void; deleteActive?: () => void; removeObjectById?: (id: string) => void } | null
  ) => {
    if (methods) {
      pageMethodsRef.current[pageIndex] = methods;
    } else {
      delete pageMethodsRef.current[pageIndex];
    }
  }, []);

  const handleSavePageState = useCallback((pageIndex: number, state: any) => {
    setPagesState((prev) => ({
      ...prev,
      [pageIndex]: state,
    }));
  }, []);

  const handleUndoRedoAvailable = useCallback((pageIndex: number, canUndo: boolean, canRedo: boolean) => {
    setUndoRedoStates((prev) => ({
      ...prev,
      [pageIndex]: { canUndo, canRedo },
    }));
  }, []);

  // Center workspace scroll alignment tracker
  const workspaceScrollRef = useRef<HTMLDivElement>(null);

  const handleWorkspaceScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const containerHeight = container.clientHeight;
    
    let closestPageIndex = 0;
    let minDiff = Infinity;

    for (let i = 0; i < pdfMeta.numPages; i++) {
      const pageEl = document.getElementById(`pdf-page-container-${i}`);
      if (pageEl) {
        const rect = pageEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top;
        const relativeMiddle = relativeTop + rect.height / 2;
        const centerDiff = Math.abs(relativeMiddle - containerHeight / 2);

        if (centerDiff < minDiff) {
          minDiff = centerDiff;
          closestPageIndex = i;
        }
      }
    }

    if (closestPageIndex !== activePageIndex) {
      setActivePageIndex(closestPageIndex);
    }
  };

  // Click on Thumbnail trigger
  const handlePageSelect = (index: number) => {
    setActivePageIndex(index);
    const targetEl = document.getElementById(`pdf-page-container-${index}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 2.0));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  // Undo / Redo active bridge
  const handleUndo = () => {
    const activeMethods = pageMethodsRef.current[activePageIndex];
    if (activeMethods) activeMethods.undo();
  };

  const handleRedo = () => {
    const activeMethods = pageMethodsRef.current[activePageIndex];
    if (activeMethods) activeMethods.redo();
  };

  const handleClearPage = () => {
    const activeMethods = pageMethodsRef.current[activePageIndex];
    if (activeMethods && window.confirm('Are you sure you want to clear all overlays drawn on this page?')) {
      activeMethods.clear();
    }
  };

  // Export & download handler
  const handleDownload = async () => {
    await exportPDF({
      originalBytes: pdfMeta.bytes,
      pagesState: pagesState,
      pagesMeta: pdfMeta.pages,
      fileName: pdfMeta.name,
    }, () => {
      // Trigger success toast
      setToastMessage('Success! Edited PDF generated and downloaded to your downloads folder.');
      setTimeout(() => setToastMessage(null), 5000);
    });
  };

  // Setting handlers
  const handleChangeSettings = (updated: Partial<ActiveSettings>) => {
    setActiveSettings((prev) => ({ ...prev, ...updated }));
  };

  // Read-only readout of "what font is the line I just clicked using" — kept
  // separate from activeSettings (which drives what gets newly created/applied)
  // so that merely clicking around different lines never changes what font
  // would get applied to anything else.
  const [clickedLineFont, setClickedLineFont] = useState<{
    fontFamily: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
  } | null>(null);

  const handleActiveFontChange = useCallback((font: {
    fontFamily: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
  } | null) => {
    setClickedLineFont(font);
  }, []);

  // Keyboard Shortcuts: Ctrl+Z (Undo), Ctrl+Y / Ctrl+Shift+Z (Redo), Backspace/Delete (Delete selection)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid hotkeys when editing inputs, textareas, contenteditable or active fabric text editing
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          activeEl.hasAttribute('contenteditable') ||
          activeEl.classList.contains('fabric-keydown-handler')
        ) {
          return;
        }
      }

      const isMac = typeof window !== 'undefined' && /macintosh|mac os x/i.test(navigator.userAgent);
      const isCmdOrCtrl = e.ctrlKey || (isMac && e.metaKey);

      // Redo: Ctrl+Y / Cmd+Y, or Ctrl+Shift+Z / Cmd+Shift+Z
      const isRedoShortcut =
        (isCmdOrCtrl && e.key.toLowerCase() === 'y') ||
        (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z');

      // Undo: Ctrl+Z / Cmd+Z
      const isUndoShortcut = isCmdOrCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey;

      // Delete action: Backspace or Delete
      const isDeleteShortcut = e.key === 'Delete' || e.key === 'Backspace';

      if (isUndoShortcut) {
        e.preventDefault();
        handleUndo();
      } else if (isRedoShortcut) {
        e.preventDefault();
        handleRedo();
      } else if (isDeleteShortcut) {
        const activeMethods = pageMethodsRef.current[activePageIndex];
        if (activeMethods && activeMethods.deleteActive) {
          e.preventDefault();
          activeMethods.deleteActive();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePageIndex, handleUndo, handleRedo]);

  // Diff stats for Compare View: counted directly from each page's annotation
  // objects (redactions = deletions, everything else added = additions) —
  // no PDF text extraction involved.
  const compareScale = zoom * 0.65;
  const totalDeletions = pdfMeta.pages.reduce(
    (sum, _, i) => sum + getDiffRects(pagesState[i], 'deletion').length,
    0
  );
  const totalAdditions = pdfMeta.pages.reduce(
    (sum, _, i) => sum + getDiffRects(pagesState[i], 'addition').length,
    0
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 font-sans">
      
      {/* 1. TOP NAVBAR CONTAINER */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-30 shadow-xs">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-blue-500 text-white rounded-xl p-2.5 shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="flex items-center gap-1.5 text-base font-extrabold text-slate-800 tracking-tight leading-none">
              Online PDF Editor
              <span className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded py-0.5 px-1.5 font-bold uppercase tracking-wider scale-90">Beta</span>
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 truncate max-w-xs font-medium">
              Secure, free client-side editor & filler
            </p>
          </div>
        </div>

        {/* Dynamic Zoom Actions & Zoom Label */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1 rounded-xl">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            id="btn-zoom-out"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <span className="text-xs font-bold text-slate-600 px-3 min-w-[50px] text-center select-none font-mono">
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            disabled={zoom >= 2.0}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            id="btn-zoom-in"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Global Toolbar Action buttons */}
        <div className="flex items-center gap-3">
          
          <button
            onClick={() => setCompareMode(m => !m)}
            id="btn-compare"
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border shadow-xs cursor-pointer transition-all ${
              compareMode
                ? 'text-white bg-purple-600 border-purple-600'
                : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            {compareMode ? 'Exit Compare' : 'Compare View'}
          </button>

          <button
            onClick={() => hiddenFileInputRef.current?.click()}
            id="btn-upload-new"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4 text-slate-500" />
            Upload New
          </button>
          <input
            ref={hiddenFileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onUploadNewFile(e.target.files[0]);
              }
            }}
          />

          <button
            onClick={handleDownload}
            disabled={exporting}
            id="btn-download"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-xl cursor-pointer shadow-md shadow-blue-500/10 hover:shadow-lg disabled:cursor-not-allowed transition-all"
          >
            {exporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Compiling...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                Download PDF
              </>
            )}
          </button>

        </div>
      </header>

      {/* 2. Horizontal Toolbar (Sejda Style) */}
      <Toolbar
        activeSettings={activeSettings}
        onChangeSettings={handleChangeSettings}
        currentPage={activePageIndex}
        totalPageCount={pdfMeta.numPages}
        canUndo={undoRedoStates[activePageIndex]?.canUndo || false}
        canRedo={undoRedoStates[activePageIndex]?.canRedo || false}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClearPage={handleClearPage}
      />

      {/* Main content body structure */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left sidebar directory layout */}
        <PageThumbnails
          pdfDoc={pdfDoc}
          numPages={pdfMeta.numPages}
          activePageIndex={activePageIndex}
          onPageClick={handlePageSelect}
        />

        {/* Center Canvas display workspace */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          
          {exportError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-rose-50 border border-rose-100 shadow-lg py-2.5 px-4 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2 animate-fadeIn max-w-lg">
              <span className="w-2 h-2 rounded-full bg-rose-600 inline-block shrink-0 animate-ping"></span>
              <span><strong>Export Failure:</strong> {exportError}</span>
            </div>
          )}

          {toastMessage && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-emerald-50 border border-emerald-100 shadow-xl py-3 px-5 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-bounce">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Centered Scrollable viewport */}
          <div
            ref={workspaceScrollRef}
            onScroll={handleWorkspaceScroll}
            className="flex-1 overflow-auto p-8 flex flex-col justify-start"
          >
            {compareMode ? (
              /* ── COMPARE MODE: LexiSync style left=red right=green ── */
              <div className="flex flex-col gap-6">
                {/* Header row */}
                <div className="flex gap-4 sticky top-0 z-10">
                  <div className="flex-1 bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"/>
                    <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Original Document</span>
                    <span className="ml-auto text-[10px] font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">{totalDeletions} deleted</span>
                  </div>
                  <div className="flex-1 bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"/>
                    <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Modified Document</span>
                    <span className="ml-auto text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">{totalAdditions} added</span>
                  </div>
                </div>

                {pdfMeta.pages.map((metadata, index) => {
                  const deletionRects = getDiffRects(pagesState[index], 'deletion');
                  const additionRects = getDiffRects(pagesState[index], 'addition');

                  return (
                  <div key={index} className="flex gap-4 items-start">
                    {/* Left: Original — red theme, read only */}
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-[10px] text-red-400 font-mono font-semibold mb-1.5 select-none flex items-center gap-1">
                        PAGE {index + 1} — ORIGINAL
                        {activeSettings.tool !== 'select' && (
                          <span className="text-slate-400 font-sans normal-case">(read-only — edit the Modified panel →)</span>
                        )}
                      </span>
                      <div className="relative border-2 border-red-200 rounded-md overflow-hidden shadow-md opacity-90">
                        <PageCanvas
                          pageIndex={index}
                          pdfDoc={pdfDoc}
                          width={metadata.width}
                          height={metadata.height}
                          zoom={compareScale}
                          activeSettings={{ ...activeSettings, tool: 'select' }}
                          savedState={null}
                          onSaveState={() => {}}
                          onUndoRedoAvailable={() => {}}
                          registerMethods={() => {}}
                          getFontForPdfjsName={getFontForPdfjsName}
                          onActiveFontChange={handleActiveFontChange}
                        />
                        {/* Red highlights showing where content was deleted */}
                        <div className="absolute inset-0 pointer-events-none">
                          {deletionRects.map((rect, i) => (
                            <div
                              key={i}
                              className="absolute bg-red-500/25 border border-red-500/70 rounded-xs"
                              style={{
                                left: `${rect.left * compareScale}px`,
                                top: `${rect.top * compareScale}px`,
                                width: `${rect.width * compareScale}px`,
                                height: `${rect.height * compareScale}px`,
                              }}
                            />
                          ))}
                        </div>
                        {deletionRects.length > 0 && (
                          <div className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                            {deletionRects.length} deleted
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="flex flex-col items-center pt-6 gap-1">
                      <div className="w-0.5 h-full bg-slate-200 min-h-[100px]" />
                    </div>

                    {/* Right: Edited — green theme, interactive */}
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-[10px] text-green-600 font-mono font-semibold mb-1.5 select-none">
                        PAGE {index + 1} — MODIFIED
                      </span>
                      <div className="relative border-2 border-green-200 rounded-md overflow-hidden shadow-md">
                        <PageCanvas
                          pageIndex={index}
                          pdfDoc={pdfDoc}
                          width={metadata.width}
                          height={metadata.height}
                          zoom={compareScale}
                          activeSettings={activeSettings}
                          savedState={pagesState[index] || null}
                          onSaveState={handleSavePageState}
                          onUndoRedoAvailable={handleUndoRedoAvailable}
                          registerMethods={registerPageMethods}
                          getFontForPdfjsName={getFontForPdfjsName}
                          onActiveFontChange={handleActiveFontChange}
                        />
                        {/* Green highlights showing where content was added */}
                        <div className="absolute inset-0 pointer-events-none">
                          {additionRects.map((rect, i) => (
                            <div
                              key={i}
                              className="absolute bg-green-500/20 border border-green-500/70 rounded-xs"
                              style={{
                                left: `${rect.left * compareScale}px`,
                                top: `${rect.top * compareScale}px`,
                                width: `${rect.width * compareScale}px`,
                                height: `${rect.height * compareScale}px`,
                              }}
                            />
                          ))}
                        </div>
                        {additionRects.length > 0 && (
                          <div className="absolute top-2 right-2 bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                            {additionRects.length} added
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}

                {/* Changes summary */}
                {visibleChanges.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 mt-2">
                    <p className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wider">Changes Summary</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {visibleChanges.map(change => (
                        <div key={change.id} className={`flex items-start gap-3 p-2 rounded-lg ${
                          change.type === 'added' ? 'bg-green-50' : change.type === 'removed' ? 'bg-red-50' : 'bg-amber-50'
                        }`}>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                            change.type === 'added' ? 'bg-green-500 text-white' :
                            change.type === 'removed' ? 'bg-red-400 text-white' : 'bg-amber-400 text-white'
                          }`}>{change.type}</span>
                          {change.type === 'removed'
                            ? <span className="text-xs text-red-600 line-through">{change.text}</span>
                            : <span className="text-xs text-green-700 font-medium">{change.text}</span>
                          }
                          <span className="text-[10px] text-slate-400 ml-auto shrink-0">p{change.pageIndex+1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ── NORMAL MODE: Single page editor ── */
              <div className="space-y-12 flex flex-col">
                {pdfMeta.pages.map((metadata, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <span className="text-[11px] text-slate-400 font-mono font-semibold mb-2 select-none">
                      PAGE {index + 1}
                    </span>
                    <PageCanvas
                      pageIndex={index}
                      pdfDoc={pdfDoc}
                      width={metadata.width}
                      height={metadata.height}
                      zoom={zoom}
                      activeSettings={activeSettings}
                      savedState={pagesState[index] || null}
                      onSaveState={handleSavePageState}
                      onUndoRedoAvailable={handleUndoRedoAvailable}
                      registerMethods={registerPageMethods}
                      getFontForPdfjsName={getFontForPdfjsName}
                      onActiveFontChange={handleActiveFontChange}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Track Changes Bar at bottom */}
          <TrackChangesBar
            changes={visibleChanges}
            onAccept={handleAcceptChange}
            onReject={handleRejectChange}
            onAcceptAll={handleAcceptAll}
            onRejectAll={handleRejectAll}
          />
        </main>

        {/* Right Font Panel */}
        <FontPanel
          detectedFonts={fontResult?.fonts?.map(f => ({
            name: f.name,
            weight: f.weight,
            style: f.style,
            isStandard: f.isStandard,
            originalName: f.originalName,
            cacheKey: f.cacheKey,
          })) || []}
          serverAvailable={serverAvailable}
          loading={fontLoading}
          selectedFont={activeSettings.fontFamily}
          selectedWeight={activeSettings.fontWeight}
          selectedStyle={activeSettings.fontStyle}
          clickedLineFont={clickedLineFont}
          onFontSelect={(family, weight, style) => {
            handleChangeSettings({ fontFamily: family, fontWeight: weight, fontStyle: style });
            // Keep the readout in sync: if a line is selected, this is now its font.
            setClickedLineFont((prev) => (prev ? { fontFamily: family, fontWeight: weight, fontStyle: style } : prev));
          }}
          addedWords={visibleChanges.filter(c => c.type === 'added').length}
          removedWords={visibleChanges.filter(c => c.type === 'removed').length}
          totalChanges={visibleChanges.length}
        />

      </div>

    </div>
  );
}
