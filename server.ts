import express from "express";
import path from "path";
import { Readable } from "stream";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { extractVideo } from "./server/extractor";

// Lazy-initialized Gemini Client to prevent crash when key is missing on startup
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not defined in the environment. Please configure it in Settings > Secrets."
      );
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // 1. API: Fetch video metadata and direct links
  app.post("/api/fetch-video", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Video URL is required." });
    }

    try {
      const metadata = await extractVideo(url);
      res.json(metadata);
    } catch (error: any) {
      console.error("Extractor Error:", error.message || error);
      res.status(500).json({
        error: error.message || "Failed to parse video. Use the AI Chat for alternatives.",
      });
    }
  });

  // 2. API: Proxy direct file streams to bypass CORS restrictions & force download in browser
  app.get("/api/proxy", async (req, res) => {
    const videoUrl = req.query.url as string;
    const originalFileName = (req.query.filename as string) || "video.mp4";

    if (!videoUrl) {
      return res.status(400).json({ error: "Target video URL is required." });
    }

    try {
      // Safely decode the URL without crashing on already-decoded signature tokens
      let decodedUrl = videoUrl;
      try {
        if (videoUrl.startsWith("http%3A") || videoUrl.startsWith("https%3A")) {
          decodedUrl = decodeURIComponent(videoUrl);
        }
      } catch (e) {
        decodedUrl = videoUrl;
      }

      // Configure request headers tailored to destination CDN (Instagram, Facebook, Pinterest)
      const fetchHeaders: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "*/*",
      };

      if (
        decodedUrl.includes("instagram.com") ||
        decodedUrl.includes("cdninstagram.com") ||
        decodedUrl.includes("fbcdn.net")
      ) {
        fetchHeaders["Referer"] = "https://www.instagram.com/";
        fetchHeaders["Sec-Fetch-Mode"] = "no-cors";
        fetchHeaders["Sec-Fetch-Site"] = "cross-site";
      } else if (decodedUrl.includes("pinterest.com") || decodedUrl.includes("pinimg.com")) {
        fetchHeaders["Referer"] = "https://www.pinterest.com/";
      } else if (decodedUrl.includes("tiktok.com") || decodedUrl.includes("tiktokcdn.com")) {
        fetchHeaders["Referer"] = "https://www.tiktok.com/";
      }

      // Forward client Range header if present (crucial for smooth chunk streaming and seeking)
      if (req.headers.range) {
        fetchHeaders["Range"] = req.headers.range as string;
      }

      const response = await fetch(decodedUrl, {
        headers: fetchHeaders,
      });

      // Handle origin server response statuses
      if (!response.ok && response.status !== 206) {
        return res
          .status(response.status)
          .send(`Failed to fetch resources from raw server. Status: ${response.status}`);
      }

      // Enable CORS for client-side blob extraction & ZIP archiving
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Authorization");
      res.setHeader("Accept-Ranges", "bytes");

      // Set content type and disposition
      res.setHeader("Content-Type", response.headers.get("content-type") || "video/mp4");
      
      const sanitizedName = originalFileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      res.setHeader("Content-Disposition", `attachment; filename="${sanitizedName}"`);

      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }

      const contentRange = response.headers.get("content-range");
      if (contentRange) {
        res.setHeader("Content-Range", contentRange);
      }

      if (response.status === 206) {
        res.status(206);
      }

      // Read remote web body stream and pipe to Express response safely
      if (response.body) {
        Readable.fromWeb(response.body as any).pipe(res);
      } else {
        res.status(500).send("Source body stream is unavailable.");
      }
    } catch (error: any) {
      console.error("Downloader Stream Error:", error);
      res.status(500).send(`Downloader engine stream error: ${error.message}`);
    }
  });

  // 3. API: AI Assistant advice chat using Gemini SDK
  app.post("/api/assistant", async (req, res) => {
    const { messages } = req.body; // array of { role: 'user'|'model', text: '...' }
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required." });
    }

    try {
      // Lazy verify and get client
      const ai = getGeminiClient();

      // System Instructions
      const systemInstruction = `You are a helpful and polite AI Support Assistant embedded in the "Universal Video Downloader" web application.
Your roles:
1. Help users troubleshoot download errors (e.g., Instagram/Facebook logins, private profiles, expired links).
2. Answer Frequently Asked Questions (how the tool works, platform rules).
3. Provide manual alternatives for restrictive content, such as installing temporary browser extensions, inspecting web devtools, or installing local console apps like 'yt-dlp'.
4. Politely explain that copyrighted and restricted material (like premium YouTube/Vevo tracks) cannot be bypassed for ethical and legal compliance, and emphasize user responsibility for fair personal use.

Guidelines:
- Keep answers structured with simple markdown.
- Be friendly, respectful, and objective.
- Keep responses short and sweet (less than 250 words) to save resources.`;

      // Structure contents from standard conversation history
      const contents = messages.map((m: any) => ({
        role: m.role || "user",
        parts: [{ text: m.text || "" }],
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("AI Assistant API Error:", error.message || error);
      res.status(500).json({
        error: error.message || "The Gemini AI Assistant is temporarily unavailable because the API key is not configured.",
      });
    }
  });

  // 4. Vite integration for Full-Stack structure
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Universal Video Downloader server running on port ${PORT}`);
  });
}

startServer();
