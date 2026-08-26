import React, { useState, useEffect, useRef } from "react";
import {
  Link2,
  FolderOpen,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Clock,
  Instagram,
  Facebook,
  FileVideo,
  Video,
  AlertTriangle,
  Moon,
  Sun,
  X,
  Upload,
  Bot,
  MessageSquare,
  Globe2,
  Lock,
  Layers,
  Sparkles,
  Plus
} from "lucide-react";

import PreviewCard from "./components/PreviewCard";
import AIWidget from "./components/AIWidget";
import HistoryPanel from "./components/HistoryPanel";
import BatchProcessor from "./components/BatchProcessor";
import BatchProgressBar from "./components/BatchProgressBar";
import BatchToast, { BatchToastData } from "./components/BatchToast";
import { VideoMetadata, VideoFormat, DownloadHistoryItem, BatchItem } from "./types";

export default function App() {
  const [url, setUrl] = useState("");
  const [inputMode, setInputMode] = useState<"single" | "batch">("single");
  const [batchText, setBatchText] = useState("");
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchToast, setBatchToast] = useState<BatchToastData | null>(null);
  const cancelBatchRef = useRef(false);
  const batchSectionRef = useRef<HTMLDivElement>(null);

  const scrollToBatchSection = () => {
    batchSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [showAiFloat, setShowAiFloat] = useState(false);

  // Dynamic Theme State (stored and resolved)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("downloader_theme");
    return saved === "dark";
  });

  // History State
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>(() => {
    const saved = localStorage.getItem("downloader_history_logs");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  // Manage body theme changes
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("downloader_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Persist history records
  useEffect(() => {
    localStorage.setItem("downloader_history_logs", JSON.stringify(downloadHistory));
  }, [downloadHistory]);

  // Extract valid URLs from multi-line text
  const extractUrlsFromText = (text: string): string[] => {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && (line.startsWith("http://") || line.startsWith("https://")));
  };

  // Quick clipboard paste listener
  const handlePasteFromClipboard = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText) return;

      const detectedUrls = extractUrlsFromText(clipboardText);

      if (detectedUrls.length > 1 || clipboardText.includes("\n")) {
        setInputMode("batch");
        setBatchText(clipboardText);
        setError(null);
      } else if (clipboardText.trim().startsWith("http")) {
        if (inputMode === "batch") {
          setBatchText((prev) => (prev ? prev + "\n" + clipboardText.trim() : clipboardText.trim()));
        } else {
          setUrl(clipboardText.trim());
        }
        setError(null);
      }
    } catch (e) {
      setError("Please allow clipboard reading access, or manually paste the URL.");
    }
  };

  // Load Sample Batch URLs for testing
  const handleLoadSampleBatch = () => {
    const samples = [
      "https://www.instagram.com/reel/C123456789/",
      "https://www.facebook.com/watch/?v=987654321",
      "https://www.pinterest.com/pin/555666777/"
    ].join("\n");
    setInputMode("batch");
    setBatchText(samples);
    setError(null);
  };

  // Drag and drop URLs onto input section
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedText = e.dataTransfer.getData("text");
    if (!droppedText) return;

    const urlsDetected = extractUrlsFromText(droppedText);

    if (urlsDetected.length > 1 || droppedText.includes("\n")) {
      setInputMode("batch");
      setBatchText(droppedText);
      setError(null);
    } else if (droppedText.trim().startsWith("http")) {
      if (inputMode === "batch") {
        setBatchText((prev) => (prev ? prev + "\n" + droppedText.trim() : droppedText.trim()));
      } else {
        setUrl(droppedText.trim());
      }
      setError(null);
    }
  };

  // Process Batch Sequence sequentially
  const handleProcessBatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const urlsToProcess = extractUrlsFromText(batchText);

    if (urlsToProcess.length === 0) {
      setError("No valid HTTP/HTTPS URLs found. Please paste links starting with http:// or https:// (one per line).");
      return;
    }

    setError(null);
    setMetadata(null);
    cancelBatchRef.current = false;
    setIsProcessingBatch(true);

    const initialQueue: BatchItem[] = urlsToProcess.map((u, i) => ({
      id: `batch_${Date.now()}_${i}`,
      url: u,
      status: "pending",
    }));

    setBatchItems(initialQueue);

    for (let i = 0; i < initialQueue.length; i++) {
      if (cancelBatchRef.current) break;

      const currentItem = initialQueue[i];

      setBatchItems((prev) =>
        prev.map((item) =>
          item.id === currentItem.id ? { ...item, status: "processing" } : item
        )
      );

      try {
        const response = await fetch("/api/fetch-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: currentItem.url }),
        });

        const data = await response.json();

        if (response.ok) {
          setBatchItems((prev) =>
            prev.map((item) =>
              item.id === currentItem.id
                ? { ...item, status: "success", metadata: data }
                : item
            )
          );
        } else {
          setBatchItems((prev) =>
            prev.map((item) =>
              item.id === currentItem.id
                ? {
                    ...item,
                    status: "error",
                    error: data.error || "Direct extraction failed for this link.",
                  }
                : item
            )
          );
        }
      } catch (err: any) {
        setBatchItems((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? {
                  ...item,
                  status: "error",
                  error: "Network error when attempting to extract media URL.",
                }
              : item
          )
        );
      }
    }

    setIsProcessingBatch(false);

    // Show visual notification/toast summarizing batch finish
    setBatchItems((finalItems) => {
      const total = finalItems.length;
      const successCount = finalItems.filter((i) => i.status === "success").length;
      const errorCount = finalItems.filter((i) => i.status === "error").length;

      if (total > 0) {
        setBatchToast({
          id: `toast_${Date.now()}`,
          total,
          successCount,
          errorCount,
          timestamp: Date.now(),
        });
      }

      return finalItems;
    });
  };

  const handleRetryBatchItem = async (id: string) => {
    const targetItem = batchItems.find((item) => item.id === id);
    if (!targetItem) return;

    setBatchItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "processing", error: undefined } : item
      )
    );

    try {
      const response = await fetch("/api/fetch-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetItem.url }),
      });

      const data = await response.json();

      if (response.ok) {
        setBatchItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: "success", metadata: data } : item
          )
        );
      } else {
        setBatchItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: "error", error: data.error || "Retry failed." }
              : item
          )
        );
      }
    } catch (err: any) {
      setBatchItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "error", error: "Network error during retry." }
            : item
        )
      );
    }
  };

  const handleRetryFailedBatch = async () => {
    const failedItems = batchItems.filter((item) => item.status === "error");
    for (const item of failedItems) {
      await handleRetryBatchItem(item.id);
    }
  };

  const handleCancelBatch = () => {
    cancelBatchRef.current = true;
    setIsProcessingBatch(false);
  };

  const handleBatchDownloadStarted = (format: VideoFormat, meta: VideoMetadata) => {
    const newItem: DownloadHistoryItem = {
      id: "hist_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
      title: meta.title,
      thumbnail: meta.thumbnail,
      source: meta.source,
      originalUrl: meta.originalUrl,
      downloadUrl: `/api/proxy?url=${encodeURIComponent(format.url)}&filename=${encodeURIComponent(
        (meta.title || "video").substring(0, 30) + "." + format.ext
      )}`,
      quality: format.quality,
      size: format.size,
      timestamp: new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setDownloadHistory((prev) => [newItem, ...prev.filter((x) => x.originalUrl !== newItem.originalUrl)]);
  };

  // Resolve matching signatures as users type
  const detectPlatform = (inputUrl: string) => {
    if (!inputUrl) return null;
    const lower = inputUrl.toLowerCase();
    if (lower.includes("instagram.com")) return "instagram";
    if (lower.includes("facebook.com") || lower.includes("fb.watch") || lower.includes("fb.com")) return "facebook";
    if (lower.includes("pinterest.com") || lower.includes("pin.it")) return "pinterest";
    if (lower.includes("tiktok.com")) return "tiktok";
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
    return "generic";
  };

  const matchedPlatform = detectPlatform(url);

  // Parse and harvest video stream setup
  const handleFetchVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);
    setMetadata(null);

    try {
      const response = await fetch("/api/fetch-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setMetadata(data);
      } else {
        setError(data.error || "The link could not be parsed dynamically. Check alternative methods with the AI assistant.");
      }
    } catch (err: any) {
      setError("Server connection block. Verify your backend configuration operates properly.");
    } finally {
      setIsLoading(false);
    }
  };

  // Add items into History List once downloading commences
  const handleDownloadStarted = (format: VideoFormat) => {
    if (!metadata) return;

    // Create a history item
    const newItem: DownloadHistoryItem = {
      id: "hist_" + Date.now(),
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      source: metadata.source,
      originalUrl: metadata.originalUrl,
      downloadUrl: `/api/proxy?url=${encodeURIComponent(format.url)}&filename=${encodeURIComponent(
        (metadata.title || "video").substring(0, 30) + "." + format.ext
      )}`,
      quality: format.quality,
      size: format.size,
      timestamp: new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setDownloadHistory((prev) => [newItem, ...prev.filter((x) => x.originalUrl !== newItem.originalUrl)]);
  };

  const handleRemoveHistoryItem = (id: string) => {
    setDownloadHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearHistory = () => {
    setDownloadHistory([]);
  };

  const handleReplayUrl = (historicalUrl: string) => {
    setUrl(historicalUrl);
    setError(null);
    // Scroll smoothly to top parser
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] dark:bg-zinc-950 text-[#1D1D1F] dark:text-zinc-100 transition-colors duration-300 pb-20">
      
      {/* Header bar */}
      <nav className="border-b border-black/5 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/85 backdrop-blur-xl sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 via-indigo-600 to-rose-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 ring-2 ring-white dark:ring-zinc-800">
              <div className="w-4 h-4 border-2 border-white rounded-xs transform rotate-45 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-extrabold tracking-tight text-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600 bg-clip-text text-transparent">
                  FluxDown
                </p>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                  v2.5
                </span>
              </div>
              <p className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono font-medium tracking-wider">
                UNIVERSAL MEDIA EXTRACTOR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Quick sample link chip */}
            <button
              onClick={() => {
                setInputMode("single");
                setUrl("https://www.instagram.com/reel/C123456789/");
                setError(null);
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100/80 dark:hover:bg-rose-900/40 transition-all cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              <span>Try Demo</span>
            </button>

            {/* Disclaimer view trigger closer */}
            <button
              onClick={() => setShowDisclaimer(!showDisclaimer)}
              className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                showDisclaimer
                  ? "border-blue-600 bg-blue-600 text-white shadow-xs shadow-blue-500/25"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              }`}
            >
              Legal Terms
            </button>

            {/* Dark & Light toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer select-none shadow-xs"
              title="Toggle Light/Dark theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Ambient background glow orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-48 -right-32 w-96 h-96 bg-rose-500/10 dark:bg-rose-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-indigo-500/5 dark:bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Main downloading panels (col-span-8) */}
        <main className="lg:col-span-8 space-y-8">
          
          {/* Global Batch Progress Bar Component */}
          <BatchProgressBar
            batchItems={batchItems}
            isProcessing={isProcessingBatch}
            onRetryFailed={handleRetryFailedBatch}
            onCancelBatch={handleCancelBatch}
            onClearBatch={() => setBatchItems([])}
            onScrollToBatch={scrollToBatchSection}
          />

          {/* Legal Compliance Disclaimer panel */}
          {showDisclaimer && (
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-[#D2D2D7]/50 dark:border-zinc-800/80 shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="p-2 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl text-black dark:text-white shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#1D1D1F] dark:text-zinc-100">
                      Legal Compliance & Ethical Code Guidelines
                    </h4>
                    <p className="text-xs text-[#86868B] dark:text-zinc-400 mt-1.5 leading-relaxed">
                      This conversion utility operates strictly in compliance with digital rights, copyright bounds, and platform terms of service. 
                      <strong> Private accounts and DRM-locked media content are not targeted</strong>, ensuring direct support only for user-owned, royalty-free, or shared open license contents.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDisclaimer(false)}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Hero Input box */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-[32px] border p-6 md:p-8 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(37,99,235,0.06)] transition-all duration-300 relative overflow-hidden ${
              isDragging
                ? "border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 scale-[1.01] ring-4 ring-blue-500/20"
                : "border-slate-200/80 dark:border-zinc-800"
            }`}
          >
            {/* Ambient Background subtle gradient orbs */}
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-gradient-to-br from-blue-500/15 via-rose-500/10 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-gradient-to-tr from-rose-500/10 via-indigo-500/10 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

            {isDragging && (
              <div className="absolute inset-0 bg-white/95 dark:bg-zinc-900/95 flex flex-col items-center justify-center gap-3 text-blue-600 dark:text-blue-400 animate-fade-in z-20 p-4">
                <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                  <Upload className="w-10 h-10 animate-bounce text-blue-600 dark:text-blue-400" />
                </div>
                <p className="font-bold text-base text-center">Drop video URL to begin dynamic extraction!</p>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-blue-500/10 to-rose-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40">
                    <Sparkles className="w-3 h-3 text-rose-500" />
                    Ultra Fast & Lossless
                  </span>
                </div>
                <h1 className="text-3xl md:text-[38px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                  Download <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600 bg-clip-text text-transparent">everything.</span>
                </h1>
                <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed font-medium">
                  Universal media extractor with precision and speed. Single or multi-link batch extraction.
                </p>
              </div>

              {/* Mode Selector Tabs */}
              <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/80 dark:bg-zinc-950/80 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shrink-0 self-start md:self-auto shadow-inner">
                <button
                  type="button"
                  onClick={() => setInputMode("single")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    inputMode === "single"
                      ? "bg-white dark:bg-zinc-850 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-500/20"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Single Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInputMode("batch")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    inputMode === "batch"
                      ? "bg-gradient-to-r from-blue-600 to-rose-600 text-white shadow-sm shadow-blue-500/25"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Batch Mode</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                    inputMode === "batch" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                  }`}>
                    BULK
                  </span>
                </button>
              </div>
            </div>

            {/* SINGLE LINK FORM */}
            {inputMode === "single" ? (
              <form onSubmit={handleFetchVideo} className="space-y-4">
                <div className="relative flex flex-col sm:flex-row gap-2.5 items-stretch bg-slate-50/90 dark:bg-zinc-950/90 p-2.5 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-inner focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  {/* Inputs area */}
                  <div className="relative flex-1 flex items-center gap-2.5 px-3">
                    <Link2 className="w-5 h-5 text-blue-500 shrink-0" />
                    <input
                      type="url"
                      required
                      value={url}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.includes("\n")) {
                          setInputMode("batch");
                          setBatchText(val);
                        } else {
                          setUrl(val);
                        }
                      }}
                      placeholder="Paste Instagram Reel, Facebook Video, Pinterest Pin, TikTok URL..."
                      className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-zinc-100 focus:outline-none placeholder-slate-400 dark:placeholder-zinc-500 py-3 disabled:opacity-50"
                    />

                    {url && (
                      <button
                        type="button"
                        onClick={() => setUrl("")}
                        className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Direct clipboard Paste buttons */}
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="sm:px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/80 hover:text-blue-600 dark:hover:text-blue-400 shrink-0 transition-all cursor-pointer shadow-xs"
                  >
                    Paste URL
                  </button>

                  {/* Trigger button */}
                  <button
                    type="submit"
                    disabled={isLoading || !url.trim()}
                    className="px-7 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600 hover:from-blue-500 hover:via-indigo-500 hover:to-rose-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none shrink-0 transition-all select-none cursor-pointer shadow-md shadow-blue-500/25"
                  >
                    <span>{isLoading ? "Extracting..." : "Fetch Video"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Interactive Demo Link Pills */}
                <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-rose-500" /> Fast Test:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setUrl("https://www.instagram.com/reel/C123456789/");
                      setError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 border border-rose-200/70 dark:border-rose-900/50 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Instagram className="w-3 h-3 text-rose-500" />
                    <span>Instagram Reel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUrl("https://www.facebook.com/watch/?v=987654321");
                      setError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 border border-blue-200/70 dark:border-blue-900/50 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Facebook className="w-3 h-3 text-blue-500" />
                    <span>Facebook Reel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUrl("https://www.pinterest.com/pin/555666777/");
                      setError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-300 border border-red-200/70 dark:border-red-900/50 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Globe2 className="w-3 h-3 text-red-500" />
                    <span>Pinterest Video</span>
                  </button>
                </div>

                {/* Real-time Dynamic Platform matching feedback tags */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-850">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-zinc-500">Auto Detect:</span>

                  {/* Instagram badge */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                      matchedPlatform === "instagram"
                        ? "border-rose-500 bg-gradient-to-r from-rose-500/15 via-pink-500/15 to-purple-500/15 text-rose-600 dark:text-rose-400 scale-[1.05] shadow-xs shadow-rose-500/20"
                        : "border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 bg-slate-50/50 dark:bg-zinc-950/50"
                    }`}
                  >
                    <Instagram className="w-3 h-3 text-rose-500" />
                    <span>Instagram</span>
                  </div>

                  {/* Facebook badge */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                      matchedPlatform === "facebook"
                        ? "border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-400 scale-[1.05] shadow-xs shadow-blue-500/20"
                        : "border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 bg-slate-50/50 dark:bg-zinc-950/50"
                    }`}
                  >
                    <Facebook className="w-3 h-3 text-blue-500" />
                    <span>Facebook</span>
                  </div>

                  {/* Pinterest badge */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                      matchedPlatform === "pinterest"
                        ? "border-red-500 bg-red-500/15 text-red-600 dark:text-red-400 scale-[1.05] shadow-xs shadow-red-500/20"
                        : "border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 bg-slate-50/50 dark:bg-zinc-950/50"
                    }`}
                  >
                    <Globe2 className="w-3 h-3 text-red-500" />
                    <span>Pinterest</span>
                  </div>

                  {/* TikTok badge */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                      matchedPlatform === "tiktok"
                        ? "border-teal-500 bg-teal-500/15 text-teal-600 dark:text-teal-400 scale-[1.05] shadow-xs shadow-teal-500/20"
                        : "border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 bg-slate-50/50 dark:bg-zinc-950/50"
                    }`}
                  >
                    <Video className="w-3 h-3 text-teal-500" />
                    <span>TikTok</span>
                  </div>

                  {/* YouTube Policy disclaimer badge */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                      matchedPlatform === "youtube"
                        ? "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 bg-slate-50/50 dark:bg-zinc-950/50"
                    }`}
                    title="YouTube Policy restrictions limits DRM bypass"
                  >
                    <Lock className="w-3 h-3 text-amber-500" />
                    <span>YouTube</span>
                  </div>
                </div>
              </form>
            ) : (
              /* BATCH MODE FORM */
              <form onSubmit={handleProcessBatch} className="space-y-4">
                <div className="bg-slate-50/90 dark:bg-zinc-950/90 p-4 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-inner space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-slate-900 dark:text-zinc-200">Paste Multiple Links (One URL per line)</span>
                    </div>

                    {/* Detected count badge */}
                    {extractUrlsFromText(batchText).length > 0 && (
                      <span className="px-3 py-1 rounded-full text-[10px] font-black bg-gradient-to-r from-blue-600 to-rose-600 text-white shadow-xs">
                        ⚡ {extractUrlsFromText(batchText).length} Links Detected
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={5}
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    disabled={isProcessingBatch}
                    placeholder={`https://www.instagram.com/reel/C123...\nhttps://www.facebook.com/watch/?v=456...\nhttps://www.pinterest.com/pin/789...`}
                    className="w-full bg-white dark:bg-zinc-900 text-xs md:text-sm font-mono text-slate-900 dark:text-zinc-200 focus:outline-none placeholder-slate-400 dark:placeholder-zinc-500 resize-y p-3 rounded-xl border border-slate-200 dark:border-zinc-800 focus:border-blue-500 dark:focus:border-blue-500 transition-all leading-relaxed shadow-xs"
                  />

                  {/* Quick helper action bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePasteFromClipboard}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-[11px] font-semibold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
                      >
                        Paste Clipboard
                      </button>

                      <button
                        type="button"
                        onClick={handleLoadSampleBatch}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <Sparkles className="w-3 h-3 text-rose-500" />
                        <span>Try Sample Batch (3 Links)</span>
                      </button>
                    </div>

                    {batchText && (
                      <button
                        type="button"
                        onClick={() => setBatchText("")}
                        className="text-[11px] text-slate-400 hover:text-rose-500 font-semibold transition-colors cursor-pointer"
                      >
                        Clear Text
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isProcessingBatch || extractUrlsFromText(batchText).length === 0}
                    className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600 hover:from-blue-500 hover:via-indigo-500 hover:to-rose-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    <Layers className="w-4 h-4" />
                    <span>
                      {isProcessingBatch
                        ? "Processing Batch Sequence..."
                        : `Process Batch Sequence (${extractUrlsFromText(batchText).length})`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Batch Processing Queue & Results */}
          <div ref={batchSectionRef}>
            <BatchProcessor
              batchItems={batchItems}
              isProcessing={isProcessingBatch}
              onRetryItem={handleRetryBatchItem}
              onRetryFailed={handleRetryFailedBatch}
              onClearBatch={() => setBatchItems([])}
              onDownloadStarted={handleBatchDownloadStarted}
              onCancelBatch={handleCancelBatch}
            />
          </div>

          {/* Loader skeleton screen when extraction is in progress */}
          {isLoading && (
            <div className="bg-white dark:bg-zinc-900 border border-[#D2D2D7]/50 dark:border-zinc-800 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.03)] animate-pulse space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="h-4 bg-zinc-100 dark:bg-zinc-850 rounded w-1/3" />
                <div className="h-4 bg-zinc-100 dark:bg-zinc-850 rounded w-16" />
              </div>
              <div className="aspect-video bg-[#F5F5F7] dark:bg-zinc-850 rounded-2xl w-full flex items-center justify-center">
                <p className="text-[#86868B] text-xs font-mono">Resolving metadata structures...</p>
              </div>
              <div className="space-y-3">
                <div className="h-6 bg-zinc-100 dark:bg-zinc-850 rounded w-3/4" />
                <div className="h-3 bg-zinc-100 dark:bg-zinc-850 rounded w-1/2" />
              </div>
            </div>
          )}

          {/* Action error alerts */}
          {error && (
            <div className="p-5 rounded-3xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-red-800 dark:text-red-400">Video Extraction Interrupted</h4>
                <p className="text-xs text-red-600/95 dark:text-red-400/90 mt-1.5 leading-relaxed">
                  {error}
                </p>
                <div className="flex gap-2 mt-3.5">
                  <button
                    onClick={() => {
                      setUrl("");
                      setError(null);
                    }}
                    className="px-3.5 py-1.5 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/45 text-red-700 dark:text-red-400 font-semibold text-xs rounded-lg hover:bg-red-100/40 dark:hover:bg-red-950/50 transition-colors"
                  >
                    Clear Input
                  </button>
                  <button
                    onClick={() => {
                      setShowAiFloat(true);
                      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                    }}
                    className="px-3.5 py-1.5 bg-brand-blue text-white font-semibold text-xs rounded-lg transition-colors"
                  >
                    Troubleshoot with AI Assistant
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Resolved video preview dashboard */}
          {metadata && !isLoading && !error && (
            <div className="animate-fade-in">
              <PreviewCard metadata={metadata} onDownloadStarted={handleDownloadStarted} />
            </div>
          )}

          {/* Localized lists histories */}
          <HistoryPanel
            history={downloadHistory}
            onRemoveItem={handleRemoveHistoryItem}
            onClearHistory={handleClearHistory}
            onReplayItem={handleReplayUrl}
          />
        </main>

        {/* RIGHT COLUMN: AI Guide & FAQs widget (col-span-4) */}
        <aside className="lg:col-span-4 space-y-8">
          
          {/* Static informational Q&A */}
          <div className="bg-white dark:bg-zinc-900 border border-[#D2D2D7]/50 dark:border-zinc-850 rounded-[32px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.03)]">
            <h4 className="font-bold text-xs text-[#1D1D1F] dark:text-zinc-100 uppercase tracking-widest flex items-center gap-2 pb-3.5 border-b border-zinc-100 dark:border-zinc-800">
              <HelpCircle className="w-4 h-4 text-[#86868B]" />
              <span>General FAQs</span>
            </h4>
            
            <div className="mt-5 space-y-5">
              <div>
                <h5 className="text-xs font-bold text-[#1D1D1F] dark:text-zinc-350">
                  How does the High-Speed bypass proxy work?
                </h5>
                <p className="text-[11px] text-[#86868B] leading-relaxed mt-1">
                  Many video streams are CORS-restricted to stop downloads in standard browsers. 
                  Our service proxies the requests natively on the server, serving standard download file headers bypass.
                </p>
              </div>

              <div>
                <h5 className="text-xs font-bold text-[#1D1D1F] dark:text-zinc-350">
                  Can I download videos from private accounts?
                </h5>
                <p className="text-[11px] text-[#86868B] leading-relaxed mt-1">
                  No, video platforms require verified session logins to reach private user assets. 
                  Ensuring fair use and permission, our crawler respects robots.txt permissions and restricts private access.
                </p>
              </div>

              <div>
                <h5 className="text-xs font-bold text-[#1D1D1F] dark:text-zinc-350">
                  How to download on iOS or Android directly?
                </h5>
                <p className="text-[11px] text-[#86868B] leading-relaxed mt-1">
                  Toggle the "Mobile QR" trigger on your parsed result. 
                  Scan the QR code with your phone camera, and the direct download begins in your device browser immediately.
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic AI Companion widget box */}
          <div className="relative">
            <AIWidget onSuggestUrl={(suggested) => setUrl(suggested)} />
          </div>
        </aside>
      </div>

      {/* Modern minimal disclaimer footer */}
      <footer className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-black/5 dark:border-zinc-800/40 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-[10px] text-[#86868B] max-w-xl leading-relaxed text-center md:text-left">
          <span className="font-bold uppercase tracking-wider mr-1 text-[#1D1D1F] dark:text-zinc-300">Disclaimer:</span> This tool is for educational and personal use only. We do not support downloading copyrighted content without permission. By using FluxDown, you agree to our Fair Use Policy.
        </p>
        <div className="flex items-center gap-6">
          <a href="#" className="text-[10px] font-bold text-[#86868B] hover:text-black dark:hover:text-white uppercase tracking-wider">Privacy Policy</a>
          <a href="#" className="text-[10px] font-bold text-[#86868B] hover:text-black dark:hover:text-white uppercase tracking-wider">Terms of Service</a>
        </div>
      </footer>
      {/* Batch Finish Toast Alert Notification */}
      <BatchToast
        toast={batchToast}
        onClose={() => setBatchToast(null)}
        onScrollToBatch={scrollToBatchSection}
      />
    </div>
  );
}
