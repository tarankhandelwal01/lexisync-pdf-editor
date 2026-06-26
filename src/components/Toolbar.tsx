import {
  MousePointer,
  Type,
  Edit2,
  Square,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Bold,
  Italic,
  EyeOff,
  FileEdit,
  Plus,
  Minus,
  Sparkles,
  Link,
  ChevronDown,
} from 'lucide-react';
import { ActiveSettings, EditTool } from '../types';

interface ToolbarProps {
  activeSettings: ActiveSettings;
  onChangeSettings: (settings: Partial<ActiveSettings>) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearPage: () => void;
  currentPage: number;
  totalPageCount: number;
}

const COLOR_PRESETS = [
  '#000000', // Black
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#eab308', // Gold
  '#a855f7', // Purple
  '#ffffff', // White (for eraser backgrounds)
];

const FONT_FAMILIES = [
  { id: 'Inter', name: 'Inter (Sans)' },
  { id: 'Arial', name: 'Arial' },
  { id: 'Playfair Display', name: 'Editorial Serif' },
  { id: 'Times New Roman', name: 'Times New Roman' },
  { id: 'Courier New', name: 'Courier Mono' },
  { id: 'JetBrains Mono', name: 'JetBrains Mono' },
  { id: 'Helvetica', name: 'Helvetica' },
  { id: 'Georgia', name: 'Georgia' },
];

export function Toolbar({
  activeSettings,
  onChangeSettings,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearPage,
  currentPage,
  totalPageCount,
}: ToolbarProps) {
  const currentTool = activeSettings.tool;
  const isWhiteoutMode = currentTool === 'rect' && activeSettings.redact && activeSettings.color === '#ffffff';
  const isShapeRectMode = currentTool === 'rect' && !isWhiteoutMode;

  const setTool = (tool: EditTool, customSettings: Partial<ActiveSettings> = {}) => {
    onChangeSettings({ tool, ...customSettings });
  };

  return (
    <div className="w-full bg-white border-b border-slate-200 shadow-sm flex flex-col shrink-0 select-none z-30">
      
      {/* Primary Horizontal Toolbar (Sejda Modern Palette) */}
      <div className="px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap bg-slate-50/70 border-b border-slate-100">
        
        {/* Left Side: Segmented controls for Tools in a cohesive rounded group */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-xs flex-wrap">
          
          <button
            onClick={() => setTool('select')}
            id="tool-select"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none transition-all cursor-pointer ${
              currentTool === 'select'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Interact with drawings or annotations"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Select</span>
          </button>

          <button
            onClick={() => setTool('edit_pdf_text')}
            id="tool-edit-pdf-text"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold select-none transition-all cursor-pointer ${
              currentTool === 'edit_pdf_text'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20'
            }`}
            title="Modify the background PDF text content on-the-fly"
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Edit Text</span>
          </button>

          <button
            onClick={() => setTool('text')}
            id="tool-text"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none transition-all cursor-pointer ${
              currentTool === 'text'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Place text anywhere on document"
          >
            <Type className="w-3.5 h-3.5" />
            <span>Add Text</span>
          </button>

          <button
            onClick={() => setTool('rect', { redact: true, color: '#ffffff' })}
            id="tool-whiteout"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none transition-all cursor-pointer ${
              isWhiteoutMode
                ? 'bg-sky-500 text-white shadow-xs animate-pulse'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Erase background elements with a solid white cover"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Whiteout</span>
          </button>

          <button
            onClick={() => setTool('draw')}
            id="tool-draw"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none transition-all cursor-pointer ${
              currentTool === 'draw'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Draw freely on top of pages"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Draw</span>
          </button>

          <button
            onClick={() => setTool('highlight')}
            id="tool-highlight"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none transition-all cursor-pointer ${
              currentTool === 'highlight'
                ? 'bg-yellow-500 text-slate-900 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Highlight important text items"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span>Highlight</span>
          </button>

          <button
            onClick={() => setTool('rect', { redact: false, color: '#ef4444' })}
            id="tool-rect"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none transition-all cursor-pointer ${
              isShapeRectMode
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Draw red/black vector rectangle borders or shape blocks"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Shapes</span>
          </button>

          <button
            onClick={() => setTool('eraser')}
            id="tool-eraser"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold select-none transition-all cursor-pointer ${
              currentTool === 'eraser'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Delete added annotations by clicking on them"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eraser</span>
          </button>

        </div>

        {/* Right Side: Page Tracker, Undo/Redo/Reset Actions */}
        <div className="flex items-center gap-3">
          
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Workspace</span>
            <span className="text-xs font-bold text-slate-600">Page {currentPage + 1} / {totalPageCount}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              id="btn-undo-horizontal"
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-all cursor-pointer"
              title="Undo Action"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              onClick={onRedo}
              disabled={!canRedo}
              id="btn-redo-horizontal"
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-all cursor-pointer"
              title="Redo Action"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>

            <button
              onClick={onClearPage}
              id="btn-clear-page-horizontal"
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100/80 border border-red-100/60 transition-all shrink-0 cursor-pointer"
              title="Remove all custom annotations on current page only"
            >
              Clear Annotations
            </button>
          </div>

        </div>

      </div>

      {/* Dynamic Contextual Options Bar (only renders when the active tool has configurations) */}
      <div className="px-6 py-2 bg-white flex items-center justify-center gap-6 text-xs flex-wrap border-t border-slate-100">
        
        {/* TEXT ADD/SELECT SETTINGS */}
        {(currentTool === 'text' || currentTool === 'select' || currentTool === 'edit_pdf_text') && (
          <div className="flex items-center gap-4 flex-wrap select-none animate-fadeIn">
            
            {currentTool === 'edit_pdf_text' && (
              <span className="inline-flex items-center gap-1.5 py-1 px-2.5 bg-emerald-50 text-emerald-800 rounded-full font-bold text-[11px]">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Format bar links directly to interactive components below</span>
              </span>
            )}

            {/* Font family selection dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Font:</span>
              <select
                value={activeSettings.fontFamily}
                onChange={(e) => onChangeSettings({ fontFamily: e.target.value })}
                id="font-family-select"
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Font size selectors */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mr-1">Size:</span>
              <button
                onClick={() => onChangeSettings({ fontSize: Math.max(8, activeSettings.fontSize - 2) })}
                className="p-1 rounded bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="number"
                min={8}
                max={96}
                value={activeSettings.fontSize}
                onChange={(e) => onChangeSettings({ fontSize: parseInt(e.target.value, 10) || 12 })}
                className="w-10 text-center text-xs font-bold border border-slate-200 rounded py-0.5"
              />
              <button
                onClick={() => onChangeSettings({ fontSize: Math.min(96, activeSettings.fontSize + 2) })}
                className="p-1 rounded bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Bold/Italic formatting styles */}
            <div className="flex items-center gap-1 border-l border-slate-200 pl-4">
              <button
                type="button"
                onClick={() => onChangeSettings({ fontWeight: activeSettings.fontWeight === 'bold' ? 'normal' : 'bold' })}
                className={`p-1 rounded border transition-all ${
                  activeSettings.fontWeight === 'bold'
                    ? 'bg-blue-50 text-blue-600 border-blue-200 font-bold'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
                title="Toggle Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onChangeSettings({ fontStyle: activeSettings.fontStyle === 'italic' ? 'normal' : 'italic' })}
                className={`p-1 rounded border transition-all ${
                  activeSettings.fontStyle === 'italic'
                    ? 'bg-blue-50 text-blue-600 border-blue-200 italic'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
                title="Toggle Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Text Color selections */}
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mr-1">Color:</span>
              <div className="flex items-center gap-1">
                {COLOR_PRESETS.filter(c => c !== '#ffffff').map((col) => {
                  const match = col.toLowerCase() === activeSettings.color.toLowerCase();
                  return (
                    <button
                      key={col}
                      onClick={() => onChangeSettings({ color: col })}
                      className={`w-4 h-4 rounded-full border transition-all ${
                        match ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-105 border-slate-300'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  );
                })}
                <input
                  type="color"
                  value={activeSettings.color?.startsWith('rgb') ? '#ef4444' : activeSettings.color}
                  onChange={(e) => onChangeSettings({ color: e.target.value })}
                  className="w-4 h-4 border-0 rounded cursor-pointer p-0 bg-transparent"
                  title="Custom Color"
                />
              </div>
            </div>

          </div>
        )}

        {/* WHITEOUT HELPER MESSAGE */}
        {isWhiteoutMode && (
          <div className="text-slate-500 text-[11px] font-semibold flex items-center gap-2 animate-fadeIn py-0.5">
            <span className="w-2.5 h-2.5 rounded bg-sky-400 animate-pulse inline-block border border-sky-500"></span>
            <span>Whiteout Active: Click and drag on your document pages to wipeout background text, logos, or marks.</span>
          </div>
        )}

        {/* DRAWING / BRUSH SETTINGS */}
        {(currentTool === 'draw' || currentTool === 'highlight') && (
          <div className="flex items-center gap-5 flex-wrap animate-fadeIn select-none">
            
            {/* Stroke line weight input */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Brush Size:</span>
              <input
                type="range"
                min={2}
                max={28}
                value={activeSettings.strokeWidth}
                onChange={(e) => onChangeSettings({ strokeWidth: parseInt(e.target.value, 10) || 5 })}
                className="w-28 accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="font-semibold text-slate-600 w-10 text-[11px]">{activeSettings.strokeWidth} px</span>
            </div>

            {/* Brush Colors */}
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mr-1">Brush Color:</span>
              <div className="flex items-center gap-1">
                {COLOR_PRESETS.map((col) => {
                  const match = col.toLowerCase() === activeSettings.color.toLowerCase();
                  return (
                    <button
                      key={col}
                      onClick={() => onChangeSettings({ color: col })}
                      className={`w-4 h-4 rounded-full border transition-all ${
                        match ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-105 border-slate-300'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* SHAPE SETTINGS */}
        {isShapeRectMode && (
          <div className="flex items-center gap-5 flex-wrap animate-fadeIn select-none">
            
            {/* Line Weight */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Border Line:</span>
              <input
                type="range"
                min={1}
                max={15}
                value={activeSettings.strokeWidth}
                onChange={(e) => onChangeSettings({ strokeWidth: parseInt(e.target.value, 10) || 2 })}
                className="w-24 accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="font-semibold text-slate-500 w-10 text-[11px]">{activeSettings.strokeWidth} px</span>
            </div>

            {/* Border Colors */}
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mr-1">Shape Color:</span>
              <div className="flex items-center gap-1">
                {COLOR_PRESETS.map((col) => {
                  const match = col.toLowerCase() === activeSettings.color.toLowerCase();
                  return (
                    <button
                      key={col}
                      onClick={() => onChangeSettings({ color: col })}
                      className={`w-4 h-4 rounded-full border transition-all ${
                        match ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-105 border-slate-300'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Redact/Censor Block Toggle (Solid Fill) */}
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-5">
              <input
                type="checkbox"
                id="shape-solid-fill"
                checked={activeSettings.redact}
                onChange={(e) => onChangeSettings({ redact: e.target.checked })}
                className="h-3.5 w-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="shape-solid-fill" className="text-[11px] font-bold text-slate-600 select-none cursor-pointer flex items-center gap-1">
                <EyeOff className="w-3 h-3 text-slate-500" />
                <span>Solid Opaque Redaction Block</span>
              </label>
            </div>

          </div>
        )}

        {/* ERASER HELPER INFO */}
        {currentTool === 'eraser' && (
          <div className="text-red-600 text-[11px] font-semibold flex items-center gap-1.5 animate-fadeIn py-0.5">
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Eraser Active: Click on any custom drawing, highlight, or custom textbox on the page to wipe it out.</span>
          </div>
        )}

        {/* SELECT HELPER INFO */}
        {currentTool === 'select' && (
          <div className="text-slate-500 text-[11px] font-semibold flex items-center gap-1.5 animate-fadeIn py-0.5">
            <MousePointer className="w-3.5 h-3.5 shrink-0 text-blue-500" />
            <span>Select Active: Click, size, or drag existing annotated blocks and drawings on the page canvas.</span>
          </div>
        )}

      </div>

    </div>
  );
}
