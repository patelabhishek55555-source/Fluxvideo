import React, { useState } from "react";
import {
  Layers,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Download,
  Trash2,
  Copy,
  Check,
  FolderArchive,
  AlertCircle,
  PlayCircle,
  FileCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import JSZip from "jszip";
import { BatchItem, VideoFormat, VideoMetadata } from "../types";

interface BatchProcessorProps {
  batchItems: BatchItem[];
  isProcessing: boolean;
  onRetryItem: (id: string) => void;
  onRetryFailed: () => void;
  onClearBatch: () => void;
  onDownloadStarted: (format: VideoFormat, metadata: VideoMetadata) => void;
  onCancelBatch?: () => void;
}

export default function BatchProcessor({
  batchItems,
  isProcessing,
  onRetryItem,
  onRetryFailed,
  onClearBatch,
  onDownloadStarted,
  onCancelBatch,
}: BatchProcessorProps) {
  const [filter, setFilter] = useState<"all" | "success" | "error" | "downloaded">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [allLinksCopied, setAllLinksCopied] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<Record<string, VideoFormat>>({});
  
  // Download states
  const [itemDownloadStatuses, setItemDownloadStatuses] = useState<Record<string, "idle" | "downloading" | "downloaded" | "error">>({});
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number; percent: number; text: string }>({
    current: 0,
    total: 0,
    percent: 0,
    text: "",
  });
  const [isSequentialDownloading, setIsSequentialDownloading] = useState(false);
  const [seqProgress, setSeqProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  if (batchItems.length === 0) return null;

  const totalCount = batchItems.length;
  const successItems = batchItems.filter((item) => item.status === "success");
  const errorItems = batchItems.filter((item) => item.status === "error");
  const pendingItems = batchItems.filter((item) => item.status === "pending" || item.status === "processing");
  const downloadedCount = Object.values(itemDownloadStatuses).filter((s) => s === "downloaded").length;

  const completedCount = successItems.length + errorItems.length;
  const extractionProgressPercent = Math.round((completedCount / totalCount) * 100);

  const filteredItems = batchItems.filter((item) => {
    if (filter === "success") return item.status === "success";
    if (filter === "error") return item.status === "error";
    if (filter === "downloaded") return itemDownloadStatuses[item.id] === "downloaded";
    return true;
  });

  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAllExtractedLinks = () => {
    const urls = successItems.map((item) => {
      const fmt = getFormatForMeta(item);
      return fmt?.url || item.url;
    }).join("\n");

    if (urls) {
      navigator.clipboard.writeText(urls);
      setAllLinksCopied(true);
      setTimeout(() => setAllLinksCopied(false), 2500);
    }
  };

  const getFormatForMeta = (item: BatchItem): VideoFormat | null => {
    if (!item.metadata || !item.metadata.formats.length) return null;
    return selectedFormats[item.id] || item.metadata.formats[0];
  };

  // Helper to trigger single direct file download
  const handleDownloadSingleItem = (item: BatchItem) => {
    if (!item.metadata) return;
    const format = getFormatForMeta(item);
    if (!format) return;

    onDownloadStarted(format, item.metadata);

    const safeTitle = (item.metadata.title || "video").replace(/[/\\?%*:|"<>]/g, "_").substring(0, 35);
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(format.url)}&filename=${encodeURIComponent(
      `${safeTitle}.${format.ext}`
    )}`;

    setItemDownloadStatuses((prev) => ({ ...prev, [item.id]: "downloaded" }));

    const a = document.createElement("a");
    a.href = proxyUrl;
    a.download = `${safeTitle}.${format.ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ZIP ARCHIVE DOWNLOAD ALL (Fixes browser multi-download blocking!)
  const handleDownloadAllAsZip = async () => {
    if (successItems.length === 0 || isZipping) return;

    setIsZipping(true);
    const totalToZip = successItems.length;
    const zip = new JSZip();

    try {
      for (let i = 0; i < successItems.length; i++) {
        const item = successItems[i];
        if (!item.metadata) continue;

        const format = getFormatForMeta(item);
        if (!format) continue;

        const itemNum = i + 1;
        setZipProgress({
          current: itemNum,
          total: totalToZip,
          percent: Math.round(((itemNum - 0.5) / totalToZip) * 100),
          text: `Fetching video ${itemNum} of ${totalToZip}: "${item.metadata.title.substring(0, 25)}..."`,
        });

        setItemDownloadStatuses((prev) => ({ ...prev, [item.id]: "downloading" }));

        const safeTitle = (item.metadata.title || `video_${itemNum}`)
          .replace(/[/\\?%*:|"<>]/g, "_")
          .substring(0, 40);
        const filename = `${itemNum}_${safeTitle}.${format.ext}`;

        const proxyUrl = `/api/proxy?url=${encodeURIComponent(format.url)}`;

        try {
          const resp = await fetch(proxyUrl);
          if (!resp.ok) throw new Error("Fetch failed");
          const blob = await resp.blob();
          zip.file(filename, blob);
          setItemDownloadStatuses((prev) => ({ ...prev, [item.id]: "downloaded" }));
        } catch (e) {
          // Fallback: create shortcut file or note
          zip.file(`${filename}.url.txt`, `Direct Video Link:\n${format.url}`);
          setItemDownloadStatuses((prev) => ({ ...prev, [item.id]: "error" }));
        }
      }

      setZipProgress({
        current: totalToZip,
        total: totalToZip,
        percent: 95,
        text: "Compressing ZIP archive...",
      });

      const zipBlob = await zip.generateAsync({ type: "blob" }, (metadata) => {
        setZipProgress((prev) => ({
          ...prev,
          percent: 90 + Math.round(metadata.percent * 0.1),
        }));
      });

      // Save ZIP file
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = zipUrl;
      a.download = `Batch_Videos_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(zipUrl);

      setZipProgress({
        current: totalToZip,
        total: totalToZip,
        percent: 100,
        text: "ZIP file generated successfully!",
      });

      setTimeout(() => {
        setIsZipping(false);
      }, 2000);
    } catch (err) {
      console.error("Zipping error:", err);
      setIsZipping(false);
    }
  };

  // SEQUENTIAL FILE DOWNLOADER
  const handleSequentialDownload = async () => {
    if (successItems.length === 0 || isSequentialDownloading) return;

    setIsSequentialDownloading(true);
    setSeqProgress({ current: 0, total: successItems.length });

    for (let i = 0; i < successItems.length; i++) {
      const item = successItems[i];
      setSeqProgress({ current: i + 1, total: successItems.length });
      handleDownloadSingleItem(item);
      // Stagger downloads by 1000ms to avoid browser blocking
      await new Promise((res) => setTimeout(res, 1000));
    }

    setIsSequentialDownloading(false);
  };

  const getPlatformBadge = (source?: string) => {
    switch (source?.toLowerCase()) {
      case "instagram":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/50">Instagram</span>;
      case "facebook":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/70 dark:border-blue-900/50">Facebook</span>;
      case "pinterest":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 border border-red-200/70 dark:border-red-900/50">Pinterest</span>;
      case "tiktok":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 border border-teal-200/70 dark:border-teal-900/50">TikTok</span>;
      case "youtube":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/70 dark:border-amber-900/50">YouTube</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">Web Video</span>;
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-[32px] p-6 md:p-8 shadow-[0_20px_50px_rgba(37,99,235,0.05)] space-y-6 animate-fade-in relative overflow-hidden">
      {/* Header & Overall Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-rose-600 text-white rounded-2xl shadow-md shadow-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base md:text-lg text-slate-900 dark:text-zinc-100">
                  Batch Extraction Dashboard
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-gradient-to-r from-blue-500/20 to-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                  {completedCount}/{totalCount} Processed
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
                {isProcessing
                  ? `Extracting link ${completedCount + 1} of ${totalCount}...`
                  : `${successItems.length} Extracted Successfully • ${errorItems.length} Failed • ${downloadedCount} Saved`}
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Copy All Extracted Links */}
          {successItems.length > 0 && (
            <button
              type="button"
              onClick={handleCopyAllExtractedLinks}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Copy all direct video stream URLs to clipboard"
            >
              {allLinksCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{allLinksCopied ? "All Links Copied!" : "Copy Stream URLs"}</span>
            </button>
          )}

          {/* Retry Failed Links */}
          {errorItems.length > 0 && !isProcessing && (
            <button
              type="button"
              onClick={onRetryFailed}
              className="px-3.5 py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Failed ({errorItems.length})</span>
            </button>
          )}

          {/* ZIP Archive Download All Button */}
          {successItems.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadAllAsZip}
              disabled={isZipping || isSequentialDownloading}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold shadow-md shadow-rose-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {isZipping ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <FolderArchive className="w-4 h-4 text-white" />
              )}
              <span>{isZipping ? "Creating ZIP..." : `Download All as ZIP (${successItems.length})`}</span>
            </button>
          )}

          {/* Sequential Individual Downloads */}
          {successItems.length > 0 && (
            <button
              type="button"
              onClick={handleSequentialDownload}
              disabled={isZipping || isSequentialDownloading}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {isSequentialDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>
                {isSequentialDownloading
                  ? `Downloading ${seqProgress.current}/${seqProgress.total}`
                  : `Sequential Download`}
              </span>
            </button>
          )}

          {/* Cancel/Clear */}
          {isProcessing ? (
            <button
              type="button"
              onClick={onCancelBatch}
              className="px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
            >
              Stop Sequence
            </button>
          ) : (
            <button
              type="button"
              onClick={onClearBatch}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-xs"
              title="Clear Batch Queue"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ZIP Compiling Progress Bar Banner */}
      {isZipping && (
        <div className="bg-rose-50/90 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-2xl p-4 space-y-2 animate-fade-in shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-rose-900 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-rose-600 animate-bounce" />
              <span>{zipProgress.text}</span>
            </div>
            <span>{zipProgress.percent}%</span>
          </div>
          <div className="w-full bg-rose-200/80 dark:bg-rose-900/50 rounded-full h-2.5 overflow-hidden p-0.5">
            <div
              className="bg-gradient-to-r from-rose-500 to-pink-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${zipProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Detailed Status Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-slate-50/80 dark:bg-zinc-850/50 rounded-2xl border border-slate-200/70 dark:border-zinc-800 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Total Links</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-zinc-100 mt-1">{totalCount}</p>
        </div>

        <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Extracted Ready</p>
          <p className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-1">{successItems.length}</p>
        </div>

        <div className="p-4 bg-rose-50/70 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400">Failed Links</p>
          <p className="text-2xl font-extrabold text-rose-800 dark:text-rose-300 mt-1">{errorItems.length}</p>
        </div>

        <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/50 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400">Files Saved</p>
          <p className="text-2xl font-extrabold text-blue-800 dark:text-blue-300 mt-1">{downloadedCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filter === "all"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"
            }`}
          >
            All ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter("success")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filter === "success"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"
            }`}
          >
            Extracted ({successItems.length})
          </button>

          <button
            type="button"
            onClick={() => setFilter("error")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filter === "error"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"
            }`}
          >
            Failed ({errorItems.length})
          </button>

          <button
            type="button"
            onClick={() => setFilter("downloaded")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filter === "downloaded"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"
            }`}
          >
            Downloaded ({downloadedCount})
          </button>
        </div>
      </div>

      {/* Item List with per-item status & error diagnosis */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
        {filteredItems.map((item, index) => {
          const format = getFormatForMeta(item);
          const downloadState = itemDownloadStatuses[item.id] || "idle";

          return (
            <div
              key={item.id}
              className={`border rounded-2xl p-4 transition-all ${
                item.status === "processing"
                  ? "border-blue-500/80 bg-blue-50/40 dark:bg-blue-950/30 shadow-md ring-1 ring-blue-500/20"
                  : item.status === "success"
                  ? "border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-blue-300 dark:hover:border-zinc-700"
                  : item.status === "error"
                  ? "border-rose-300 dark:border-rose-950/70 bg-rose-50/40 dark:bg-rose-950/25"
                  : "border-slate-200/60 dark:border-zinc-850 bg-slate-50/50 dark:bg-zinc-950/20"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Status Icon */}
                <div className="mt-0.5 shrink-0">
                  {item.status === "processing" && (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  )}
                  {item.status === "success" && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  )}
                  {item.status === "error" && (
                    <XCircle className="w-5 h-5 text-rose-500" />
                  )}
                  {item.status === "pending" && (
                    <div className="w-5 h-5 rounded-full border-2 border-dashed border-slate-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 font-extrabold">
                      #{index + 1}
                    </span>
                    {getPlatformBadge(item.metadata?.source)}

                    {/* Download status pill */}
                    {downloadState === "downloaded" && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                        <FileCheck className="w-3 h-3" />
                        <span>Downloaded</span>
                      </span>
                    )}

                    {downloadState === "downloading" && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 flex items-center gap-1 animate-pulse border border-blue-200 dark:border-blue-800">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Saving...</span>
                      </span>
                    )}

                    <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono truncate max-w-[280px]">
                      {item.url}
                    </span>
                  </div>

                  {/* Status Specific Messages */}
                  {item.status === "processing" && (
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 animate-pulse mt-1">
                      Extracting video formats and metadata streams...
                    </p>
                  )}

                  {item.status === "pending" && (
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      Queued in batch sequence
                    </p>
                  )}

                  {item.status === "error" && (
                    <div className="mt-2 p-3 bg-rose-100/70 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-rose-900 dark:text-rose-300">
                            Extraction Failed
                          </p>
                          <p className="text-[11px] text-rose-800 dark:text-rose-400 mt-0.5">
                            {item.error || "The URL could not be resolved directly. It may be private, deleted, or geo-restricted."}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRetryItem(item.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0 shadow-xs"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry Link</span>
                      </button>
                    </div>
                  )}

                  {item.status === "success" && item.metadata && (
                    <div className="mt-2.5 space-y-3">
                      <div className="flex gap-3 items-center">
                        <img
                          src={item.metadata.thumbnail}
                          alt={item.metadata.title}
                          className="w-16 h-12 rounded-xl object-cover border border-slate-200 dark:border-zinc-800 shrink-0 bg-slate-100 shadow-xs"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs md:text-sm text-slate-900 dark:text-zinc-100 truncate">
                            {item.metadata.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
                            Duration: {item.metadata.duration || "N/A"} • Available Formats: {item.metadata.formats.length}
                          </p>
                        </div>
                      </div>

                      {/* Format selector & Individual Download Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {item.metadata.formats.length > 1 ? (
                          <select
                            value={format?.quality}
                            onChange={(e) => {
                              const matched = item.metadata?.formats.find(
                                (f) => f.quality === e.target.value
                              );
                              if (matched) {
                                setSelectedFormats((prev) => ({
                                  ...prev,
                                  [item.id]: matched,
                                }));
                              }
                            }}
                            className="text-xs bg-slate-100 dark:bg-zinc-800 border border-slate-300/80 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 dark:text-zinc-200 cursor-pointer focus:outline-none"
                          >
                            {item.metadata.formats.map((f, fIdx) => (
                              <option key={fIdx} value={f.quality}>
                                {f.quality} ({f.ext.toUpperCase()}) {f.size ? `• ${f.size}` : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 px-2.5 py-1 rounded-lg">
                            {format?.quality} ({format?.ext.toUpperCase()})
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDownloadSingleItem(item)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 ${
                            downloadState === "downloaded"
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20"
                          }`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{downloadState === "downloaded" ? "Re-Download" : "Download File"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleCopyLink(
                              item.id,
                              format?.url ? format.url : item.url
                            )
                          }
                          className="p-1.5 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          title="Copy Direct Video Link"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
