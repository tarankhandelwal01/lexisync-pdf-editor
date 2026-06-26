import { useState } from 'react';
import { Type, ChevronDown, ChevronsLeft, ChevronsRight, Check, AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface DetectedFont {
  name: string;
  weight: 'normal' | 'bold';
  style: 'normal' | 'italic';
  isStandard: boolean;
  originalName: string;
  cacheKey: string;
}

interface FontPanelProps {
  detectedFonts: DetectedFont[];
  serverAvailable: boolean | null;
  loading: boolean;
  selectedFont: string;
  selectedWeight: 'normal' | 'bold';
  selectedStyle: 'normal' | 'italic';
  onFontSelect: (font: string, weight: 'normal' | 'bold', style: 'normal' | 'italic') => void;
  // Read-only: the actual font of whichever line the user last clicked/selected
  // on the canvas (null when nothing is selected). Shown separately from
  // selectedFont so just looking at a line never changes what gets applied.
  clickedLineFont?: {
    fontFamily: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
  } | null;
  // Track changes stats
  addedWords: number;
  removedWords: number;
  totalChanges: number;
}

// Additional curated fonts user can pick from even if not in PDF.
// Google Fonts entries here are also @import-ed in index.css so they
// actually render instead of silently falling back to a default font.
const EXTRA_FONTS = [
  // System fonts — always available, no loading needed
  { name: 'Inter',              weight: 'normal' as const, style: 'normal' as const },
  { name: 'Arial',              weight: 'normal' as const, style: 'normal' as const },
  { name: 'Helvetica',          weight: 'normal' as const, style: 'normal' as const },
  { name: 'Times New Roman',    weight: 'normal' as const, style: 'normal' as const },
  { name: 'Georgia',            weight: 'normal' as const, style: 'normal' as const },
  { name: 'Courier New',        weight: 'normal' as const, style: 'normal' as const },
  { name: 'Verdana',            weight: 'normal' as const, style: 'normal' as const },
  { name: 'Tahoma',             weight: 'normal' as const, style: 'normal' as const },
  { name: 'Trebuchet MS',       weight: 'normal' as const, style: 'normal' as const },
  { name: 'Garamond',           weight: 'normal' as const, style: 'normal' as const },
  { name: 'Palatino Linotype',  weight: 'normal' as const, style: 'normal' as const },
  { name: 'Book Antiqua',       weight: 'normal' as const, style: 'normal' as const },
  { name: 'Century Gothic',     weight: 'normal' as const, style: 'normal' as const },
  { name: 'Calibri',            weight: 'normal' as const, style: 'normal' as const },
  { name: 'Cambria',            weight: 'normal' as const, style: 'normal' as const },
  { name: 'Impact',             weight: 'normal' as const, style: 'normal' as const },
  { name: 'Comic Sans MS',      weight: 'normal' as const, style: 'normal' as const },
  // Google Fonts — loaded via index.css @import
  { name: 'Roboto',             weight: 'normal' as const, style: 'normal' as const },
  { name: 'Open Sans',          weight: 'normal' as const, style: 'normal' as const },
  { name: 'Lato',               weight: 'normal' as const, style: 'normal' as const },
  { name: 'Montserrat',         weight: 'normal' as const, style: 'normal' as const },
  { name: 'Poppins',            weight: 'normal' as const, style: 'normal' as const },
  { name: 'Nunito',             weight: 'normal' as const, style: 'normal' as const },
  { name: 'Raleway',            weight: 'normal' as const, style: 'normal' as const },
  { name: 'Merriweather',       weight: 'normal' as const, style: 'normal' as const },
  { name: 'PT Serif',           weight: 'normal' as const, style: 'normal' as const },
  { name: 'PT Sans',            weight: 'normal' as const, style: 'normal' as const },
  { name: 'Oswald',             weight: 'normal' as const, style: 'normal' as const },
  { name: 'Source Sans 3',      weight: 'normal' as const, style: 'normal' as const },
  { name: 'EB Garamond',        weight: 'normal' as const, style: 'normal' as const },
  { name: 'Work Sans',          weight: 'normal' as const, style: 'normal' as const },
  { name: 'DM Sans',            weight: 'normal' as const, style: 'normal' as const },
  { name: 'Noto Sans',          weight: 'normal' as const, style: 'normal' as const },
  { name: 'Ubuntu',             weight: 'normal' as const, style: 'normal' as const },
  { name: 'Libre Baskerville',  weight: 'normal' as const, style: 'normal' as const },
  { name: 'Crimson Text',       weight: 'normal' as const, style: 'normal' as const },
  { name: 'Josefin Sans',       weight: 'normal' as const, style: 'normal' as const },
  { name: 'Fira Sans',          weight: 'normal' as const, style: 'normal' as const },
  { name: 'Inconsolata',        weight: 'normal' as const, style: 'normal' as const },
  { name: 'JetBrains Mono',     weight: 'normal' as const, style: 'normal' as const },
  { name: 'Playfair Display',   weight: 'normal' as const, style: 'normal' as const },
  { name: 'Space Grotesk',      weight: 'normal' as const, style: 'normal' as const },
];

export function FontPanel({
  detectedFonts,
  serverAvailable,
  loading,
  selectedFont,
  selectedWeight,
  selectedStyle,
  onFontSelect,
  clickedLineFont,
  addedWords,
  removedWords,
  totalChanges,
}: FontPanelProps) {
  const [showAllFonts, setShowAllFonts] = useState(false);
  const [tab, setTab] = useState<'detected' | 'all'>('detected');
  const [collapsed, setCollapsed] = useState(false);

  const displayFonts = tab === 'detected' ? detectedFonts : EXTRA_FONTS;

  function fontLabel(f: { name: string; weight: string; style: string }) {
    const parts = [];
    if (f.weight === 'bold') parts.push('Bold');
    if (f.style === 'italic') parts.push('Italic');
    return parts.length ? `${f.name} — ${parts.join(', ')}` : f.name;
  }

  // Collapsed: shrink to a thin strip so the PDF page gets its full width back
  if (collapsed) {
    return (
      <div className="w-9 bg-white border-l border-slate-200 flex flex-col items-center pt-3 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          title="Show Font Panel"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5" /> Font Panel
          </span>
          <div className="flex items-center gap-2">
            {/* Server status indicator */}
            {serverAvailable === true && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                <Wifi className="w-3 h-3" /> Live
              </span>
            )}
            {serverAvailable === false && (
              <span className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            )}
            <button
              onClick={() => setCollapsed(true)}
              title="Hide Font Panel"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          {serverAvailable
            ? 'Click a font to apply it. Select text first to change existing text.'
            : 'Start Python server to detect PDF fonts.'}
        </p>
      </div>

      {/* Track Changes Stats */}
      {totalChanges > 0 && (
        <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Track Changes</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-green-50 border border-green-200 rounded-lg px-2.5 py-2 text-center">
              <div className="text-lg font-bold text-green-600">{addedWords}</div>
              <div className="text-[9px] text-green-500 font-semibold uppercase">Added</div>
            </div>
            <div className="flex-1 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2 text-center">
              <div className="text-lg font-bold text-red-500">{removedWords}</div>
              <div className="text-[9px] text-red-400 font-semibold uppercase">Removed</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setTab('detected')}
          className={`flex-1 py-2 text-[11px] font-semibold transition-all ${
            tab === 'detected'
              ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          PDF Fonts ({detectedFonts.length})
        </button>
        <button
          onClick={() => setTab('all')}
          className={`flex-1 py-2 text-[11px] font-semibold transition-all ${
            tab === 'all'
              ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          All Fonts
        </button>
      </div>

      {/* Font List */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
            <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-xs">Detecting fonts...</span>
          </div>
        )}

        {!loading && displayFonts.length === 0 && tab === 'detected' && (
          <div className="px-4 py-6 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400 leading-relaxed">
              {serverAvailable === false
                ? 'Start the Python server to detect fonts from your PDF.'
                : 'No fonts detected yet. Upload a PDF to begin.'}
            </p>
          </div>
        )}

        {displayFonts.map((font, i) => {
          const isSelected = selectedFont === font.name &&
            selectedWeight === (font.weight as 'normal' | 'bold') &&
            selectedStyle === (font.style as 'normal' | 'italic');

          return (
            <div key={i} className={`border-b border-slate-50 last:border-b-0 ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'}`}>
              <button
                onClick={() => onFontSelect(font.name, font.weight as 'normal' | 'bold', font.style as 'normal' | 'italic')}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all hover:bg-slate-50"
              >
                {/* Font preview */}
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm text-slate-800 truncate"
                    style={{
                      fontFamily: font.name,
                      fontWeight: font.weight === 'bold' ? 700 : 400,
                      fontStyle: font.style,
                    }}
                  >
                    The quick brown fox
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-medium">{font.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {font.weight === 'bold' && (
                      <span className="bg-slate-100 px-1 py-0.5 rounded text-slate-500 font-bold text-[9px]">B</span>
                    )}
                    {font.style === 'italic' && (
                      <span className="bg-slate-100 px-1 py-0.5 rounded text-slate-500 italic text-[9px]">I</span>
                    )}
                    {tab === 'detected' && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
                        (font as DetectedFont).isStandard
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-purple-50 text-purple-600'
                      }`}>
                        {(font as DetectedFont).isStandard ? 'Standard' : 'Embedded'}
                      </span>
                    )}
                  </div>
                </div>
                {isSelected
                  ? <Check className="w-4 h-4 text-blue-500 shrink-0" />
                  : <span className="text-[10px] text-slate-400 shrink-0">Apply</span>
                }
              </button>
            </div>
          );
        })}
      </div>

      {/* Compact footer — combines "font of the line you just clicked" (read-only,
          doesn't change just by looking at other lines) and the default font that
          applies to brand-new text, into one row each instead of two separate
          boxes, so they take up less fixed height and the scrollable font list
          above keeps most of the panel's vertical space. */}
      <div className="border-t border-slate-200 bg-slate-50 divide-y divide-slate-200/70 shrink-0">
        {clickedLineFont && (
          <div className="px-4 py-1.5 flex items-center justify-between gap-2">
            <span className="text-[9px] text-blue-600 font-semibold uppercase tracking-wider shrink-0">Selected line</span>
            <span
              className="text-xs text-slate-800 truncate"
              style={{
                fontFamily: clickedLineFont.fontFamily,
                fontWeight: clickedLineFont.fontWeight === 'bold' ? 700 : 400,
                fontStyle: clickedLineFont.fontStyle,
              }}
              title={`${clickedLineFont.fontFamily} — ${clickedLineFont.fontWeight}, ${clickedLineFont.fontStyle}`}
            >
              {clickedLineFont.fontFamily}
            </span>
          </div>
        )}
        <div className="px-4 py-1.5 flex items-center justify-between gap-2">
          <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider shrink-0">New text</span>
          <span
            className="text-xs text-slate-800 truncate"
            style={{
              fontFamily: selectedFont,
              fontWeight: selectedWeight === 'bold' ? 700 : 400,
              fontStyle: selectedStyle,
            }}
            title={`${selectedFont || 'None selected'} — ${selectedWeight}, ${selectedStyle}`}
          >
            {selectedFont || 'None selected'}
          </span>
        </div>
      </div>
    </div>
  );
}
