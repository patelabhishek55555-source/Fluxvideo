import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  FolderArchive,
  ArrowRight,
  Sparkles
} from "lucide-react";

export interface BatchToastData {
  id: string;
  total: number;
  successCount: number;
  errorCount: number;
  timestamp: number;
}

interface BatchToastProps {
  toast: BatchToastData | null;
  onClose: () => void;
  onDownloadZip?: () => void;
  onScrollToBatch?: () => void;
}

export default function BatchToast({
  toast,
  onClose,
  onDownloadZip,
  onScrollToBatch,
}: BatchToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // Allow exit animation to play
      }, 10000); // 10 seconds auto dismiss

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  const isFullSuccess = toast.errorCount === 0 && toast.successCount > 0;
  const isPartialSuccess = toast.successCount > 0 && toast.errorCount > 0;
  const isAllFailed = toast.successCount === 0 && toast.errorCount > 0;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-md w-full px-4 transition-all duration-300 transform ${
        visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95 pointer-events-none"
      }`}
    >
      <div className="bg-zinc-900 text-white border border-zinc-700/80 rounded-2xl p-4 md:p-5 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        {/* Top Accent Line */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${
            isFullSuccess
              ? "bg-emerald-500"
              : isPartialSuccess
              ? "bg-gradient-to-r from-emerald-500 to-amber-500"
              : "bg-red-500"
          }`}
        />

        <div className="flex items-start justify-between gap-3">
          {/* Status Icon */}
          <div className="mt-0.5 p-2 rounded-xl bg-zinc-800 border border-zinc-700 shrink-0">
            {isFullSuccess && <CheckCircle2 className="w-6 h-6 text-emerald-400" />}
            {isPartialSuccess && <AlertTriangle className="w-6 h-6 text-amber-400" />}
            {isAllFailed && <XCircle className="w-6 h-6 text-red-400" />}
          </div>

          {/* Toast Message Body */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-zinc-100">
                {isFullSuccess
                  ? "Batch Extraction Complete!"
                  : isPartialSuccess
                  ? "Batch Extraction Finished"
                  : "Batch Extraction Failed"}
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-950 text-blue-300 border border-blue-800">
                {toast.total} Links
              </span>
            </div>

            <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
              {isFullSuccess && (
                <span>
                  Successfully processed all <strong className="text-emerald-400">{toast.successCount} of {toast.total}</strong> videos with no errors.
                </span>
              )}
              {isPartialSuccess && (
                <span>
                  Completed with <strong className="text-emerald-400">{toast.successCount} succeeded</strong> and <strong className="text-amber-400">{toast.errorCount} failed</strong> out of {toast.total} total links.
                </span>
              )}
              {isAllFailed && (
                <span>
                  Failed to extract any media streams from <strong className="text-red-400">{toast.total}</strong> links. Please verify link privacy or permissions.
                </span>
              )}
            </p>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-zinc-800">
              {toast.successCount > 0 && onDownloadZip && (
                <button
                  type="button"
                  onClick={() => {
                    onDownloadZip();
                    setVisible(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <FolderArchive className="w-3.5 h-3.5 text-amber-600" />
                  <span>Download ZIP</span>
                </button>
              )}

              {onScrollToBatch && (
                <button
                  type="button"
                  onClick={() => {
                    onScrollToBatch();
                    setVisible(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              setTimeout(onClose, 300);
            }}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
            title="Dismiss Notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
