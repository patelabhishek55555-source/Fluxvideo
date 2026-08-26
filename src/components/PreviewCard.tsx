import React, { useState } from "react";
import { Download, Play, Video, Smartphone, Check, Copy, HelpCircle, AlertCircle } from "lucide-react";
import { VideoMetadata, VideoFormat } from "../types";

interface PreviewCardProps {
  metadata: VideoMetadata;
  onDownloadStarted: (format: VideoFormat) => void;
}

export default function PreviewCard({ metadata, onDownloadStarted }: PreviewCardProps) {
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat>(
    metadata.formats[0] || { url: "", quality: "Direct link", ext: "mp4", type: "both" }
  );
  const [showQr, setShowQr] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Securely get direct proxy download url
  const getProxyUrl = (format: VideoFormat) => {
    return `/api/proxy?url=${encodeURIComponent(format.url)}&filename=${encodeURIComponent(
      (metadata.title || "video").substring(0, 30) + "." + format.ext
    )}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(selectedFormat.url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Generate mobile QR code with the custom proxy url to download on smartphones directly
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    window.location.origin + getProxyUrl(selectedFormat)
  )}`;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-[32px] p-6 md:p-8 shadow-[0_20px_50px_rgba(37,99,235,0.06)] transition-all h-full flex flex-col justify-between relative overflow-hidden">
      {/* Subtle card ambient glows */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div>
        {/* Source Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gradient-to-r from-blue-600 to-rose-600"></span>
            </span>
            <p className="text-[10px] uppercase tracking-widest font-extrabold bg-gradient-to-r from-blue-600 to-rose-600 bg-clip-text text-transparent">
              Decoded source: {metadata.source}
            </p>
          </div>
          <span className={`text-[10px] px-3 py-1 rounded-full font-extrabold uppercase tracking-wider border shadow-xs ${
            metadata.isDemo
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/50"
              : "bg-gradient-to-r from-blue-50 to-rose-50 dark:from-blue-950/40 dark:to-rose-950/40 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-900/50"
          }`}>
            {metadata.isDemo ? "Sandbox Demo" : "Verified Stream"}
          </span>
        </div>

        {metadata.isDemo && (
          <div className="mb-4 p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-start gap-2.5 text-amber-800 dark:text-amber-300 animate-fade-in shadow-xs">
            <span className="text-sm shrink-0 mt-0.5">⚠️</span>
            <div>
              <p className="text-[11px] font-extrabold tracking-tight">Sandbox Demo Fallback Active</p>
              <p className="text-[10px] text-amber-700/95 dark:text-amber-400/90 mt-0.5 leading-normal font-medium">
                {metadata.demoReason || "This asset might be private or rate-limited. We have loaded a pristine, high-fidelity sample file so you can evaluate the high-speed stream players and direct device downloads right away."}
              </p>
            </div>
          </div>
        )}

        {/* Video Player or Thumbnail Preview */}
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-zinc-800 mb-6 group select-none shadow-md">
          {isPlaying && selectedFormat.url ? (
            <video
              src={selectedFormat.url}
              controls
              autoPlay
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <>
              <img
                src={metadata.thumbnail}
                alt={metadata.title}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-center justify-center opacity-100 group-hover:bg-black/40 transition-colors">
                <button
                  onClick={() => setIsPlaying(true)}
                  className="p-4 bg-gradient-to-r from-blue-600/90 to-rose-600/90 backdrop-blur-md text-white hover:from-blue-500 hover:to-rose-500 hover:scale-110 active:scale-95 rounded-full transition-all shadow-xl shadow-blue-500/30 ring-4 ring-white/30 cursor-pointer"
                  title="Play preview"
                >
                  <Play className="fill-current w-6 h-6 ml-0.5" />
                </button>
              </div>
            </>
          )}

          {metadata.duration && (
            <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md text-white px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider rounded-md uppercase border border-white/10 shadow-xs">
              {metadata.duration}
            </div>
          )}
        </div>

        {/* Video Details */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-50 line-clamp-2 leading-snug">
            {metadata.title || "Universal Decoded Stream"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 break-all font-medium flex items-center gap-1">
            <span className="font-semibold text-slate-700 dark:text-zinc-300">URL:</span>
            <span className="text-blue-600 dark:text-blue-400 hover:underline font-mono">{metadata.originalUrl}</span>
          </p>
        </div>

        {/* Formats and Quality Selector */}
        <div className="mb-6">
          <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-3 flex items-center justify-between">
            <span>Available Download Streams</span>
            <span className="text-rose-500 font-bold">Select Quality</span>
          </label>
          <div className="grid grid-cols-1 gap-2.5">
            {metadata.formats.map((format, index) => {
              const isSelected = selectedFormat.url === format.url;
              return (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedFormat(format);
                    setIsPlaying(false);
                  }}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer group ${
                    isSelected
                      ? "border-blue-500 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-rose-50/60 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-rose-950/30 text-slate-900 dark:text-zinc-100 ring-2 ring-blue-500/20 shadow-xs"
                      : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-zinc-950/50 text-slate-600 dark:text-zinc-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isSelected ? "bg-blue-600 text-white shadow-xs shadow-blue-500/30" : "bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"}`}>
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <p className={`font-bold text-sm transition-colors ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-zinc-200"}`}>
                        {format.quality}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5 uppercase tracking-wider">
                        {format.ext} • {format.type}
                      </p>
                    </div>
                  </div>
                  {format.size && (
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                      isSelected
                        ? "bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 shadow-xs"
                        : "bg-slate-200/80 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                    }`}>
                      {format.size}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action panel */}
      <div className="pt-6 border-t border-slate-100 dark:border-zinc-800/80">
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Direct stream link copier */}
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/60 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer shadow-xs"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-500 animate-scale" />
                <span className="text-emerald-500">Copied Link!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          {/* QR Code toggle helper */}
          <button
            onClick={() => setShowQr(!showQr)}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs ${
              showQr
                ? "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20"
                : "border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/60 hover:text-rose-600 dark:hover:text-rose-400"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Mobile QR</span>
          </button>
        </div>

        {/* QR Code Scan Drawdown */}
        {showQr && (
          <div className="my-5 p-5 bg-gradient-to-br from-blue-50/50 via-white to-rose-50/50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 rounded-2xl border border-rose-200/60 dark:border-rose-900/40 text-center animate-fade-in flex flex-col items-center shadow-md">
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-2.5">
              Scan with smartphone camera
            </h4>
            <div className="bg-white p-3 rounded-2xl inline-block border border-slate-200 shadow-md">
              <img
                src={qrCodeUrl}
                alt="Proxy direct download QR code"
                className="w-36 h-36"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                    selectedFormat.url
                  )}`;
                }}
              />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-2.5 max-w-xs leading-relaxed font-medium">
              Direct stream is proxied live through our service, ensuring zero CORS blocking on Apple iOS and Android devices.
            </p>
          </div>
        )}

        {/* Primary download initiator */}
        <a
          href={getProxyUrl(selectedFormat)}
          onClick={() => onDownloadStarted(selectedFormat)}
          className="flex items-center justify-center gap-2.5 w-full py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-600 hover:from-blue-500 hover:via-indigo-500 hover:to-rose-500 text-white font-bold rounded-xl transition-all text-center cursor-pointer select-none shadow-lg shadow-blue-500/25 active:scale-98 text-sm"
        >
          <Download className="w-4 h-4" />
          <span>Download Video Directly ({selectedFormat.quality})</span>
        </a>

        {/* Friendly Fair Use reminder */}
        <div className="flex gap-2 items-start mt-4 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/60 p-3 rounded-xl">
          <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed font-medium">
            Please make sure the download respects platform rights. Downloads are intended for educational and personal offline viewing only.
          </p>
        </div>
      </div>
    </div>
  );
}
