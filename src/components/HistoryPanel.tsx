import React from "react";
import { Download, Trash2, Calendar, FileVideo, ExternalLink, RefreshCw, Sparkles, Clock } from "lucide-react";
import { DownloadHistoryItem } from "../types";

interface HistoryPanelProps {
  history: DownloadHistoryItem[];
  onRemoveItem: (id: string) => void;
  onClearHistory: () => void;
  onReplayItem: (originalUrl: string) => void;
}

export default function HistoryPanel({ history, onRemoveItem, onClearHistory, onReplayItem }: HistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-[32px] p-8 shadow-[0_20px_50px_rgba(37,99,235,0.03)] text-center select-none">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-rose-500/10 dark:bg-zinc-800/80 flex items-center justify-center border border-blue-500/20 text-rose-500 mb-4">
          <FileVideo className="w-7 h-7 text-blue-600 dark:text-rose-400 animate-pulse" />
        </div>
        <h4 className="font-extrabold text-slate-800 dark:text-zinc-200">No Download History Yet</h4>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 max-w-sm mx-auto leading-relaxed">
          Your extracted, converted, or completed video downloads will appear here for high-speed offline access anytime.
        </p>
      </div>
    );
  }

  // Platform badge coloring
  const getBadgeStyles = (source: string) => {
    switch (source.toLowerCase()) {
      case "instagram":
        return "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-900/50";
      case "facebook":
        return "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-900/50";
      case "pinterest":
        return "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-900/50";
      case "tiktok":
        return "bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400 border-teal-200 dark:border-teal-900/50";
      case "youtube":
        return "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900/50";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200 dark:border-zinc-800";
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-[32px] p-6 md:p-8 shadow-[0_20px_50px_rgba(37,99,235,0.04)] transition-all">
      {/* Header operations */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-rose-600 text-white rounded-xl shadow-xs">
            <Clock className="w-4 h-4" />
          </div>
          <h3 className="font-extrabold text-sm md:text-base text-slate-900 dark:text-zinc-100">Local Download History</h3>
          <span className="text-xs font-mono font-black bg-gradient-to-r from-blue-500/20 to-rose-500/20 text-rose-600 dark:text-rose-400 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-900/50">
            {history.length}
          </span>
        </div>
        <button
          onClick={onClearHistory}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-500 transition-colors cursor-pointer px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
          title="Clear all download history logs"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear All</span>
        </button>
      </div>

      {/* History scroll overflow container */}
      <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
        {history.map((item) => (
          <div
            key={item.id}
            className="flex gap-4 p-3.5 bg-slate-50/70 dark:bg-zinc-950/40 rounded-2xl border border-slate-200/70 dark:border-zinc-800 group hover:border-blue-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-850/60 transition-all justify-between items-center shadow-xs"
          >
            {/* Left part metadata */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-16 h-12 bg-slate-200 dark:bg-zinc-800 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-zinc-700 shadow-xs">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="min-w-0">
                <h4 className="font-bold text-xs md:text-sm text-slate-900 dark:text-zinc-100 truncate pr-2 group-hover:text-blue-600 dark:group-hover:text-rose-400 transition-colors">
                  {item.title}
                </h4>
                
                {/* badges list info row */}
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span
                    className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getBadgeStyles(
                      item.source
                    )}`}
                  >
                    {item.source}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono font-bold">
                    {item.size || "Unknown size"}
                  </span>
                  <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono hidden sm:inline font-bold">
                    • {item.quality}
                  </span>
                </div>
              </div>
            </div>

            {/* Right part actions bundle */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Load URL back into input parser */}
              <button
                onClick={() => onReplayItem(item.originalUrl)}
                className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-xl transition-all cursor-pointer shadow-xs"
                title="Reparse/Refresh direct download configuration"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              {/* Direct redownload proxy linkage */}
              <a
                href={item.downloadUrl}
                className="p-2 text-slate-500 hover:text-white hover:bg-gradient-to-r hover:from-blue-600 hover:to-rose-600 dark:hover:text-white rounded-xl transition-all shadow-xs"
                title="Instantly download local asset file"
              >
                <Download className="w-3.5 h-3.5" />
              </a>

              {/* Delete record log */}
              <button
                onClick={() => onRemoveItem(item.id)}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer shadow-xs"
                title="Delete history log"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
