import React from "react";
import {
  Layers,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  ArrowDown,
  RefreshCw,
  X,
  Sparkles
} from "lucide-react";
import { BatchItem } from "../types";

interface BatchProgressBarProps {
  batchItems: BatchItem[];
  isProcessing: boolean;
  onRetryFailed?: () => void;
  onCancelBatch?: () => void;
  onClearBatch?: () => void;
  onScrollToBatch?: () => void;
}

export default function BatchProgressBar({
  batchItems,
  isProcessing,
  onRetryFailed,
  onCancelBatch,
  onClearBatch,
  onScrollToBatch,
}: BatchProgressBarProps) {
  if (batchItems.length === 0) return null;

  const total = batchItems.length;
  const successCount = batchItems.filter((i) => i.status === "success").length;
  const errorCount = batchItems.filter((i) => i.status === "error").length;
  const processingCount = batchItems.filter((i) => i.status === "processing").length;
  const completedCount = successCount + errorCount;
  
  const percentage = Math.min(100, Math.max(0, Math.round((completedCount / total) * 100)));
  const isFinished = completedCount === total && total > 0;

  return (
    <div className="w-full bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-xl border border-blue-500/20 transition-all duration-300 animate-fade-in relative overflow-hidden my-4 ring-1 ring-white/10">
      {/* Background ambient pulse glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        {/* Title & Status Summary */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-rose-600 rounded-2xl shrink-0 flex items-center justify-center shadow-md shadow-blue-500/25 ring-2 ring-white/20">
            {isProcessing ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : isFinished && errorCount === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-white" />
            ) : errorCount > 0 ? (
              <AlertTriangle className="w-5 h-5 text-amber-200" />
            ) : (
              <Layers className="w-5 h-5 text-white" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm md:text-base text-white flex items-center gap-2">
                <span>Batch Sequence Progress</span>
                <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-gradient-to-r from-blue-500/30 to-rose-500/30 text-rose-300 border border-rose-400/30 shadow-xs">
                  {percentage}%
                </span>
              </h3>
            </div>

            <p className="text-xs text-slate-300 mt-1 font-medium flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white">
                Completed {completedCount} of {total} items
              </span>
              {isProcessing && (
                <span className="text-rose-400 flex items-center gap-1 font-semibold animate-pulse">
                  • Extracting video {completedCount + 1}...
                </span>
              )}
              {isFinished && (
                <span className={errorCount > 0 ? "text-amber-300 font-bold" : "text-emerald-400 font-bold"}>
                  • {errorCount > 0 ? `Completed with ${errorCount} errors` : "All video streams ready!"}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Dynamic Badges & Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <div className="flex items-center gap-2 text-[11px] font-bold bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-inner">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {successCount}
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1 text-rose-400">
              <XCircle className="w-3.5 h-3.5" />
              {errorCount}
            </span>
            {processingCount > 0 && (
              <>
                <span className="text-slate-600">|</span>
                <span className="flex items-center gap-1 text-blue-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {processingCount}
                </span>
              </>
            )}
          </div>

          {errorCount > 0 && !isProcessing && onRetryFailed && (
            <button
              type="button"
              onClick={onRetryFailed}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Failed</span>
            </button>
          )}

          {onScrollToBatch && (
            <button
              type="button"
              onClick={onScrollToBatch}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-rose-600 hover:from-blue-500 hover:to-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/30"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>View Batch</span>
            </button>
          )}

          {isProcessing && onCancelBatch && (
            <button
              type="button"
              onClick={onCancelBatch}
              className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer"
            >
              Stop
            </button>
          )}

          {!isProcessing && onClearBatch && (
            <button
              type="button"
              onClick={onClearBatch}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              title="Clear Batch"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Progress Bar Track */}
      <div className="mt-4 space-y-1">
        <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5 shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-300 relative ${
              isFinished
                ? errorCount > 0
                  ? "bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                  : "bg-gradient-to-r from-emerald-400 to-teal-500"
                : "bg-gradient-to-r from-blue-500 via-indigo-500 to-rose-500"
            }`}
            style={{ width: `${percentage}%` }}
          >
            {/* Fluid shimmer highlight */}
            <div className="absolute inset-0 bg-white/20 animate-shimmer rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
