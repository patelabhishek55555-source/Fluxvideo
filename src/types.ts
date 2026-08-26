export interface VideoFormat {
  url: string;
  quality: string;
  ext: string;
  size?: string;
  type: "video" | "audio" | "both";
}

export interface VideoMetadata {
  title: string;
  thumbnail: string;
  duration?: string;
  source: string; // "facebook" | "pinterest" | "instagram" | "tiktok" | "youtube" | "generic"
  originalUrl: string;
  formats: VideoFormat[];
  isDemo?: boolean;
  demoReason?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
}

export interface DownloadHistoryItem {
  id: string;
  title: string;
  thumbnail: string;
  source: string;
  originalUrl: string;
  downloadUrl: string;
  quality: string;
  size?: string;
  timestamp: string;
}

export interface BatchItem {
  id: string;
  url: string;
  status: "pending" | "processing" | "success" | "error";
  metadata?: VideoMetadata;
  error?: string;
  downloadStatus?: "idle" | "downloading" | "downloaded" | "error";
  downloadProgress?: number;
}
