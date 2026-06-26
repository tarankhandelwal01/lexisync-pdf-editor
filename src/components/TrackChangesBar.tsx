import { useState } from 'react';
import { GitCompare, ChevronDown, ChevronUp, X, Check } from 'lucide-react';

export interface TrackChange {
  id: string;
  type: 'added' | 'removed' | 'modified';
  text: string;
  originalText?: string;
  pageIndex: number;
  timestamp: number;
}

interface TrackChangesBarProps {
  changes: TrackChange[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

export function TrackChangesBar({
  changes,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
}: TrackChangesBarProps) {
  const [expanded, setExpanded] = useState(true);

  const added   = changes.filter(c => c.type === 'added');
  const removed = changes.filter(c => c.type === 'removed');

  if (changes.length === 0) return null;

  return (
    <div className="border-t border-slate-200 bg-white shrink-0">
      {/* Header bar */}
      <div
        className="px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-all"
        onClick={() => setExpanded(e => !e)}
      >
        <GitCompare className="w-4 h-4 text-slate-500" />
        <span className="text-xs font-bold text-slate-700">Track Changes</span>

        {/* Stats pills */}
        <div className="flex items-center gap-2 ml-1">
          {added.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
              +{added.length} added
            </span>
          )}
          {removed.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"/>
              -{removed.length} removed
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onAcceptAll(); }}
            className="text-[10px] font-semibold text-white bg-green-500 hover:bg-green-600 px-2.5 py-1 rounded-md transition-all flex items-center gap-1"
          >
            <Check className="w-3 h-3" /> Accept All
          </button>
          <button
            onClick={e => { e.stopPropagation(); onRejectAll(); }}
            className="text-[10px] font-semibold text-white bg-red-400 hover:bg-red-500 px-2.5 py-1 rounded-md transition-all flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Reject All
          </button>
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </div>

      {/* Change list */}
      {expanded && (
        <div className="max-h-36 overflow-y-auto border-t border-slate-100">
          {changes.map(change => (
            <div
              key={change.id}
              className={`flex items-start gap-3 px-4 py-2 border-b border-slate-50 last:border-b-0 ${
                change.type === 'added'   ? 'bg-green-50/60' :
                change.type === 'removed' ? 'bg-red-50/60'   : 'bg-amber-50/60'
              }`}
            >
              {/* Type badge */}
              <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 ${
                change.type === 'added'    ? 'bg-green-500 text-white' :
                change.type === 'removed'  ? 'bg-red-400 text-white'   : 'bg-amber-400 text-white'
              }`}>
                {change.type}
              </span>

              {/* Text content */}
              <div className="flex-1 min-w-0">
                {change.type === 'removed' ? (
                  <span className="text-xs text-red-600 line-through break-words">{change.text}</span>
                ) : change.type === 'added' ? (
                  <span className="text-xs text-green-700 font-medium break-words">{change.text}</span>
                ) : (
                  <span className="text-xs text-amber-700 break-words">
                    <span className="line-through text-red-500">{change.originalText}</span>
                    {' → '}
                    <span className="text-green-600 font-medium">{change.text}</span>
                  </span>
                )}
                <span className="ml-2 text-[9px] text-slate-400">Page {change.pageIndex + 1}</span>
              </div>

              {/* Accept / Reject per change */}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => onAccept(change.id)}
                  className="w-5 h-5 rounded bg-green-100 hover:bg-green-500 text-green-600 hover:text-white flex items-center justify-center transition-all"
                  title="Accept"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onReject(change.id)}
                  className="w-5 h-5 rounded bg-red-100 hover:bg-red-400 text-red-500 hover:text-white flex items-center justify-center transition-all"
                  title="Reject"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
