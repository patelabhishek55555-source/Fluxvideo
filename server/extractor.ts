// Node 18+ natively supports global fetch, so we do not need external dependencies.
async function safeFetch(url: string, options?: any): Promise<any> {
  return fetch(url, options);
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

export interface VideoFormat {
  url: string;
  quality: string;
  ext: string;
  size?: string; // e.g. "12.4 MB"
  type: "video" | "audio" | "both";
}

/**
 * Clean up strings from escaped unicode format and HTML entities commonly found in HTML script tags
 */
function cleanEscapedUrl(url: string): string {
  if (!url) return "";
  let decoded = url.trim();

  // Replace HTML entities
  decoded = decoded
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x2F;/g, "/");

  // Replace escaped backslashes with forward slashes
  decoded = decoded.replace(/\\\//g, "/");

  try {
    if (decoded.includes("\\u")) {
      // Decode unicode escapes
      decoded = JSON.parse(`"${decoded.replace(/"/g, '\\"')}"`);
    }
  } catch (e) {
    decoded = decoded
      .replace(/\\u0025/g, "%")
      .replace(/\\u0026/g, "&")
      .replace(/\\u002f/g, "/")
      .replace(/\\u003d/g, "=")
      .replace(/\\u003f/g, "?")
      .replace(/\\/g, "");
  }

  decoded = decoded.replace(/\\\//g, "/").replace(/\\/g, "");
  return decoded;
}

/**
 * Resolves short links (like pin.it, fb.watch, dynamic shorts) or returns original url
 */
async function resolveShortUrl(url: string): Promise<string> {
  try {
    const response = await safeFetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    return response.url || url;
  } catch (e) {
    return url;
  }
}

/**
 * Try to determine size of a remote asset via Content-Length header or return mock estimate
 */
async function estimateSize(url: string, defaultMb: number = 5.2): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await safeFetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timeout);
    const len = res.headers.get("content-length");
    if (len) {
      const bytes = parseInt(len, 10);
      if (!isNaN(bytes) && bytes > 0) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      }
    }
  } catch (e) {
    // Ignore error
  }
  return `${defaultMb.toFixed(1)} MB`;
}

/**
 * Helper to download HTML content of a public URL
 */
async function fetchHtml(url: string): Promise<string> {
  const response = await safeFetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  return response.text();
}

/**
 * Pinterest Extractor Logic
 */
async function extractPinterest(url: string): Promise<VideoMetadata> {
  let html = "";
  try {
    html = await fetchHtml(url);
  } catch (e) {
    console.warn("Pinterest direct request unsuccessful, employing rescue sandbox stream mode.", e);
  }
  
  // Method 1: Locate JSON-LD blocks
  let title = "Pinterest Pin Media";
  let thumbnail = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&auto=format&fit=crop";
  let directVideoUrl = "";

  if (html) {
    // Regex 1: Search for Pin schema/json
    const schemaRegex = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = schemaRegex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed["@type"] === "SocialMediaPosting" || parsed["@type"] === "VideoObject" || parsed.video) {
          if (parsed.name) title = parsed.name;
          if (parsed.image) thumbnail = (typeof parsed.image === "string") ? parsed.image : (parsed.image.url || thumbnail);
          if (parsed.video && parsed.video.contentUrl) {
            directVideoUrl = parsed.video.contentUrl;
            break;
          }
        }
      } catch (e) {
        // JSON parse fail or non-standard format, try next
      }
    }

    // Method 2: Fallback to scanning page metadata & script bodies regex
    if (!directVideoUrl) {
      const ogVideoRegex = /<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i;
      const ogMatch = html.match(ogVideoRegex);
      if (ogMatch && ogMatch[1]) {
        directVideoUrl = ogMatch[1];
      }
    }

    // Method 3: Search raw pinimg mp4 links inside JavaScript bundle state or HTML source
    if (!directVideoUrl) {
      const pinimgRegex = /(https:\/\/v1\.pinimg\.com\/videos\/mc\/[^\s"',\\]+\.mp4)/i;
      const pinimgMatch = html.match(pinimgRegex);
      if (pinimgMatch && pinimgMatch[1]) {
        directVideoUrl = cleanEscapedUrl(pinimgMatch[1]);
      }
    }

    // Method 4: Scan for general Pin video link structures
    if (!directVideoUrl) {
      const generalPinimgRegex = /(https:\/\/v1\.pinimg\.com\/videos\/[^\s"',\\]+\.mp4)/gi;
      const generalMatch = html.match(generalPinimgRegex);
      if (generalMatch && generalMatch.length > 0) {
        directVideoUrl = generalMatch[0];
      }
    }

    // Get titles & images if still missing
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim().replace(" | Pinterest", "");
    }

    const ogImgMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    if (ogImgMatch && ogImgMatch[1]) {
      thumbnail = ogImgMatch[1];
    }
  }

  let isDemo = false;
  let demoReason = "";
  
  if (!directVideoUrl) {
    isDemo = true;
    demoReason = "This PIN appears private, lacks a public video node, or Pinterest server rate limits prevented extracting the raw stream. Try copying other public Pin URLs.";
    
    // Fall back to a beautiful public drone/scenery landscape stream that works perfectly for direct conversion and download simulations
    directVideoUrl = "https://assets.mixkit.co/videos/preview/mixkit-beautiful-landscape-of-mountains-with-snow-and-pines-42111-large.mp4";
    
    // Parse simulated details
    const pinIdMatch = url.match(/pin\/(\d+)/i);
    const pinId = pinIdMatch ? pinIdMatch[1] : "Active";
    
    if (title === "Pinterest Pin Media" || title.includes("Pinterest")) {
      title = `Scenic Nature Drone Footage (Pin #${pinId})`;
    } else {
      title = `[Demo] ${title}`;
    }
    thumbnail = thumbnail || "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800";
  }

  const videoUrl = cleanEscapedUrl(directVideoUrl);
  const sizeHD = await estimateSize(videoUrl, 8.4);

  return {
    title,
    thumbnail,
    source: "pinterest",
    originalUrl: url,
    isDemo,
    demoReason,
    formats: [
      {
        url: videoUrl,
        quality: isDemo ? "Demo Stream Fallback (HD)" : "High Quality (MP4)",
        ext: "mp4",
        size: sizeHD,
        type: "both",
      },
    ],
  };
}

/**
 * Facebook Video URL Extractor Logic
 */
async function extractFacebook(url: string): Promise<VideoMetadata> {
  const html = await fetchHtml(url);

  let title = "Facebook Video";
  let thumbnail = "https://images.unsplash.com/photo-1562577309-4932fdd64cd1?w=600&auto=format&fit=crop";
  let videoHD = "";
  let videoSD = "";

  // Title Extraction
  const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
  if (ogTitle && ogTitle[1]) title = ogTitle[1];
  else {
    const pageTitle = html.match(/<title>([^<]+)<\/title>/i);
    if (pageTitle && pageTitle[1]) title = pageTitle[1].replace(" | Facebook", "");
  }

  // Thumbnail Extraction
  const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  if (ogImage && ogImage[1]) thumbnail = cleanEscapedUrl(ogImage[1]);

  // Facebook video links often stored in JSON formats:
  // "browser_native_hd_url":"..."
  // "browser_native_sd_url":"..."
  // "playable_url":"..."
  // "playable_url_quality_hd":"..."
  const hdRegex = /"browser_native_hd_url"\s*:\s*"([^"]+)"/i;
  const sdRegex = /"browser_native_sd_url"\s*:\s*"([^"]+)"/i;
  const playUrlRegex = /"playable_url"\s*:\s*"([^"]+)"/i;
  const playHDRegex = /"playable_url_quality_hd"\s*:\s*"([^"]+)"/i;

  const hdMatch = html.match(hdRegex);
  const sdMatch = html.match(sdRegex);
  const playMatch = html.match(playUrlRegex);
  const playHDMatch = html.match(playHDRegex);

  if (hdMatch && hdMatch[1]) videoHD = cleanEscapedUrl(hdMatch[1]);
  else if (playHDMatch && playHDMatch[1]) videoHD = cleanEscapedUrl(playHDMatch[1]);

  if (sdMatch && sdMatch[1]) videoSD = cleanEscapedUrl(sdMatch[1]);
  else if (playMatch && playMatch[1]) videoSD = cleanEscapedUrl(playMatch[1]);

  // Fallback to og:video
  if (!videoHD && !videoSD) {
    const ogVideo = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i);
    if (ogVideo && ogVideo[1]) {
      videoSD = cleanEscapedUrl(ogVideo[1]);
    }
  }

  // Fallback 2: Check for direct .mp4 links in FB stream script data blocks
  if (!videoHD && !videoSD) {
    const anyMp4Regex = /(https:\\[^\^"']+\.mp4\?[^\^"']+)/;
    const mp4Match = html.match(anyMp4Regex);
    if (mp4Match && mp4Match[1]) {
      videoSD = cleanEscapedUrl(mp4Match[1]);
    }
  }

  if (!videoHD && !videoSD) {
    throw new Error("Unable to locate a direct Facebook video stream. The video might be private, deleted, or requires a Facebook session to view.");
  }

  const formats: VideoFormat[] = [];
  if (videoHD) {
    const sizeHD = await estimateSize(videoHD, 12.8);
    formats.push({
      url: videoHD,
      quality: "High Definition (HD)",
      ext: "mp4",
      size: sizeHD,
      type: "both",
    });
  }
  if (videoSD) {
    const sizeSD = await estimateSize(videoSD, 4.5);
    formats.push({
      url: videoSD,
      quality: "Standard Definition (SD)",
      ext: "mp4",
      size: sizeSD,
      type: "both",
    });
  }

  return {
    title,
    thumbnail,
    source: "facebook",
    originalUrl: url,
    formats,
  };
}

/**
 * Instagram Video Extractor Logic
 */
/**
 * Instagram Video Extractor Logic
 * Implements a multi-layer waterfall strategy:
 * 1. Shortcode extraction from diverse Instagram URL patterns (Reels, Posts, TV, Shares)
 * 2. Instagram public Embed endpoint parser (bypasses standard login-wall)
 * 3. Instagram Web GraphQL / Info endpoints with X-IG-App-ID
 * 4. Bot User-Agent crawler simulation (WhatsApp / FacebookExternalHit)
 * 5. Open mirror gateway fallback (DDInstagram / VXInstagram)
 * 6. High-fidelity Sandbox Demo stream fallback if post is strictly private or DRM locked
 */
function extractInstagramShortcode(url: string): string | null {
  const match = url.match(/(?:p|reel|reels|tv|share\/reel|share\/p)\/([A-Za-z0-9_-]+)/i);
  if (match && match[1]) return match[1];

  // Try matching directly after instagram.com/ if path is shortcode
  const pathMatch = url.match(/instagram\.com\/([A-Za-z0-9_-]{9,25})/i);
  if (pathMatch && pathMatch[1] && !["explore", "reels", "direct", "accounts", "stories"].includes(pathMatch[1].toLowerCase())) {
    return pathMatch[1];
  }
  return null;
}

async function extractInstagram(url: string): Promise<VideoMetadata> {
  const shortcode = extractInstagramShortcode(url);

  let title = "Instagram Reel / Video";
  let thumbnail = "https://images.unsplash.com/photo-1611262588024-d12430b98920?w=600&auto=format&fit=crop";
  let videoUrl = "";
  const extraFormats: { url: string; quality: string; ext: string }[] = [];

  // ==========================================
  // Strategy 1: Instagram Official Embed Endpoint
  // ==========================================
  if (shortcode) {
    try {
      const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
      const embedRes = await safeFetch(embedUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Sec-Fetch-Dest": "iframe",
          "Referer": "https://www.instagram.com/",
        },
      });

      if (embedRes.ok) {
        const embedHtml = await embedRes.text();

        // 1. Direct HTML5 <video> tag
        const videoTagRegex = /<video[^>]*class="[^"]*EmbeddedMediaImage[^"]*"[^>]*src="([^"]+)"/i;
        const genVideoTagRegex = /<video[^>]*src="([^"]+)"/i;
        const vMatch = embedHtml.match(videoTagRegex) || embedHtml.match(genVideoTagRegex);
        if (vMatch && vMatch[1]) {
          videoUrl = cleanEscapedUrl(vMatch[1]);
        }

        // 2. Look for "video_url" in JS state blocks
        if (!videoUrl) {
          const videoUrlRegex = /"video_url"\s*:\s*"([^"]+)"/i;
          const vuMatch = embedHtml.match(videoUrlRegex);
          if (vuMatch && vuMatch[1]) {
            videoUrl = cleanEscapedUrl(vuMatch[1]);
          }
        }

        // 3. Look for escaped \"video_url\":\"...\"
        if (!videoUrl) {
          const escVideoRegex = /\\"video_url\\"\s*:\s*\\"([^"]+)\\"/i;
          const evMatch = embedHtml.match(escVideoRegex);
          if (evMatch && evMatch[1]) {
            videoUrl = cleanEscapedUrl(evMatch[1]);
          }
        }

        // 4. Look for direct cdninstagram mp4 links in embed scripts
        if (!videoUrl) {
          const mp4Regex = /(https:\/\/[^"'\s\\]+?\.cdninstagram\.com\/[^"'\s\\]+?\.mp4[^"'\s\\]*)/i;
          const mp4Match = embedHtml.match(mp4Regex);
          if (mp4Match && mp4Match[1]) {
            videoUrl = cleanEscapedUrl(mp4Match[1]);
          }
        }

        // Extract thumbnail from embed
        const imgRegex = /<img[^>]*class="[^"]*EmbeddedMediaImage[^"]*"[^>]*src="([^"]+)"/i;
        const imgMatch = embedHtml.match(imgRegex);
        if (imgMatch && imgMatch[1]) {
          thumbnail = cleanEscapedUrl(imgMatch[1]);
        } else {
          const displayUrlRegex = /"display_url"\s*:\s*"([^"]+)"/i;
          const duMatch = embedHtml.match(displayUrlRegex);
          if (duMatch && duMatch[1]) {
            thumbnail = cleanEscapedUrl(duMatch[1]);
          }
        }

        // Extract caption / title
        const captionRegex = /<div class="Caption"[^>]*>([\s\S]*?)<\/div>/i;
        const cMatch = embedHtml.match(captionRegex);
        if (cMatch && cMatch[1]) {
          const cleanCaption = cMatch[1].replace(/<[^>]*>/g, "").trim();
          if (cleanCaption) title = cleanCaption.substring(0, 80);
        }
      }
    } catch (e) {
      console.warn("Instagram Embed extraction attempt failed:", e);
    }
  }

  // ==========================================
  // Strategy 2: Instagram Web API with X-IG-App-ID
  // ==========================================
  if (!videoUrl && shortcode) {
    try {
      const apiEndpoints = [
        `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`,
        `https://www.instagram.com/reel/${shortcode}/?__a=1&__d=dis`,
        `https://www.instagram.com/graphql/query/?doc_id=10015901848480474&variables=${encodeURIComponent(
          JSON.stringify({ shortcode })
        )}`,
      ];

      for (const endpoint of apiEndpoints) {
        try {
          const apiRes = await safeFetch(endpoint, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
              "X-IG-App-ID": "936619743392459",
              "X-Requested-With": "XMLHttpRequest",
              "X-ASBD-ID": "198387",
              "Accept": "*/*",
              "Sec-Fetch-Site": "same-origin",
              "Referer": `https://www.instagram.com/p/${shortcode}/`,
            },
          });

          if (apiRes.ok) {
            const data = await apiRes.json();
            const mediaItem =
              data?.items?.[0] ||
              data?.graphql?.shortcode_media ||
              data?.data?.xdt_shortcode_media ||
              data?.data?.shortcode_media;

            if (mediaItem) {
              // Video versions array (sorted highest to lowest resolution)
              if (mediaItem.video_versions && Array.isArray(mediaItem.video_versions) && mediaItem.video_versions.length > 0) {
                videoUrl = mediaItem.video_versions[0].url;
                for (let i = 1; i < mediaItem.video_versions.length; i++) {
                  const v = mediaItem.video_versions[i];
                  if (v.url) {
                    extraFormats.push({
                      url: cleanEscapedUrl(v.url),
                      quality: `${v.width || 720}p (${v.height || 1280})`,
                      ext: "mp4",
                    });
                  }
                }
              } else if (mediaItem.video_url) {
                videoUrl = mediaItem.video_url;
              }

              // Thumbnail
              if (mediaItem.image_versions2?.candidates?.[0]?.url) {
                thumbnail = mediaItem.image_versions2.candidates[0].url;
              } else if (mediaItem.display_url) {
                thumbnail = mediaItem.display_url;
              }

              // Title / Caption
              if (mediaItem.caption?.text) {
                title = mediaItem.caption.text.substring(0, 80);
              } else if (mediaItem.edge_media_to_caption?.edges?.[0]?.node?.text) {
                title = mediaItem.edge_media_to_caption.edges[0].node.text.substring(0, 80);
              }

              if (videoUrl) break;
            }
          }
        } catch (_) {}
      }
    } catch (e) {
      console.warn("Instagram API extraction attempt failed:", e);
    }
  }

  // ==========================================
  // Strategy 3: Bot Crawler User-Agent Simulation (WhatsApp / FacebookBot)
  // ==========================================
  if (!videoUrl) {
    try {
      const targetUrl = shortcode ? `https://www.instagram.com/reel/${shortcode}/` : url;
      const botRes = await safeFetch(targetUrl, {
        headers: {
          "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (botRes.ok) {
        const botHtml = await botRes.text();

        const ogVideoMatch =
          botHtml.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i) ||
          botHtml.match(/<meta[^>]*property="og:video:secure_url"[^>]*content="([^"]+)"/i) ||
          botHtml.match(/<meta[^>]*name="twitter:player:stream"[^>]*content="([^"]+)"/i);

        if (ogVideoMatch && ogVideoMatch[1]) {
          videoUrl = cleanEscapedUrl(ogVideoMatch[1]);
        }

        const ogTitleMatch = botHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
        if (ogTitleMatch && ogTitleMatch[1]) {
          title = ogTitleMatch[1].replace(/Instagram:\s*|on Instagram/gi, "").trim();
        }

        const ogImageMatch = botHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
        if (ogImageMatch && ogImageMatch[1]) {
          thumbnail = cleanEscapedUrl(ogImageMatch[1]);
        }
      }
    } catch (e) {
      console.warn("Instagram Bot Crawler attempt failed:", e);
    }
  }

  // ==========================================
  // Strategy 4: Direct DDInstagram / Open Mirror Gateway
  // ==========================================
  if (!videoUrl && shortcode) {
    try {
      const mirrors = [
        `https://ddinstagram.com/reel/${shortcode}`,
        `https://ddinstagram.com/p/${shortcode}`,
        `https://vxinstagram.com/reel/${shortcode}`,
      ];

      for (const mirror of mirrors) {
        try {
          const mirrorRes = await safeFetch(mirror, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
          });

          if (mirrorRes.ok) {
            const mirrorHtml = await mirrorRes.text();
            const mirrorVidMatch =
              mirrorHtml.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i) ||
              mirrorHtml.match(/<meta[^>]*name="twitter:player:stream"[^>]*content="([^"]+)"/i) ||
              mirrorHtml.match(/<source[^>]*src="([^"]+)"/i);

            if (mirrorVidMatch && mirrorVidMatch[1]) {
              videoUrl = cleanEscapedUrl(mirrorVidMatch[1]);
              const mTitle = mirrorHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
              if (mTitle && mTitle[1]) title = mTitle[1];
              const mImg = mirrorHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
              if (mImg && mImg[1]) thumbnail = cleanEscapedUrl(mImg[1]);
              break;
            }
          }
        } catch (_) {}
      }
    } catch (e) {
      console.warn("Instagram Mirror attempt failed:", e);
    }
  }

  // ==========================================
  // Strategy 5: Standard HTML Fallback Scan
  // ==========================================
  if (!videoUrl) {
    try {
      const html = await fetchHtml(url);
      const scriptRegex = /"video_url"\s*:\s*"([^"]+)"/gi;
      let sMatch = scriptRegex.exec(html);
      if (sMatch && sMatch[1]) {
        videoUrl = cleanEscapedUrl(sMatch[1]);
      }
    } catch (_) {}
  }

  // ==========================================
  // Fallback: Sandbox Demo Stream if strictly private or blocked
  // ==========================================
  let isDemo = false;
  let demoReason = "";

  if (!videoUrl) {
    isDemo = true;
    demoReason =
      "This Instagram Reel/Post is either private, from a restricted account, or protected by Instagram's login wall. A high-quality sample video has been loaded so you can test download functionality.";
    
    videoUrl = "https://assets.mixkit.co/videos/preview/mixkit-girl-walking-on-the-street-smiling-at-the-camera-42116-large.mp4";
    title = shortcode ? `Instagram Video (${shortcode})` : title;
    thumbnail = thumbnail || "https://images.unsplash.com/photo-1611262588024-d12430b98920?auto=format&fit=crop&q=80&w=800";
  }

  const cleanUrl = cleanEscapedUrl(videoUrl);
  const sizeHD = await estimateSize(cleanUrl, 7.5);

  const formats: VideoFormat[] = [
    {
      url: cleanUrl,
      quality: isDemo ? "Demo Stream Fallback (HD MP4)" : "High Quality (Original MP4)",
      ext: "mp4",
      size: sizeHD,
      type: "both",
    },
  ];

  for (const fmt of extraFormats) {
    formats.push({
      url: fmt.url,
      quality: fmt.quality,
      ext: fmt.ext,
      size: `${(parseFloat(sizeHD) * 0.75).toFixed(1)} MB`,
      type: "both",
    });
  }

  return {
    title,
    thumbnail,
    source: "instagram",
    originalUrl: url,
    isDemo,
    demoReason,
    formats,
  };
}

/**
 * TikTok Video Extractor Logic
 */
async function extractTikTok(url: string): Promise<VideoMetadata> {
  const html = await fetchHtml(url);

  let title = "TikTok Video";
  let thumbnail = "https://images.unsplash.com/photo-1596495578065-6e0763fa1141?w=600&auto=format&fit=crop";
  let videoUrl = "";

  // Regex selectors for TikTok OpenGraph
  const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
  if (ogTitle && ogTitle[1]) title = ogTitle[1];

  const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  if (ogImage && ogImage[1]) thumbnail = cleanEscapedUrl(ogImage[1]);

  const ogVideo = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i);
  if (ogVideo && ogVideo[1]) {
    videoUrl = cleanEscapedUrl(ogVideo[1]);
  }

  // Fallback regex inside javascript chunks
  if (!videoUrl) {
    const playAddrRegex = /"playAddr"\s*:\s*"([^"]+)"/i;
    const playMatch = html.match(playAddrRegex);
    if (playMatch && playMatch[1]) {
      videoUrl = cleanEscapedUrl(playMatch[1]);
    }
  }

  if (!videoUrl) {
    throw new Error("TikTok direct media crawler is restricted or the video sharing URL is invalid. Ensure the video is public.");
  }

  const size = await estimateSize(videoUrl, 4.8);

  return {
    title,
    thumbnail,
    source: "tiktok",
    originalUrl: url,
    formats: [
      {
        url: videoUrl,
        quality: "Original HD Stream",
        ext: "mp4",
        size,
        type: "both",
      },
    ],
  };
}

/**
 * Generic Fetcher / Extractor for other general platforms
 */
async function extractGeneric(url: string): Promise<VideoMetadata> {
  const html = await fetchHtml(url);

  let title = "Web Page Video";
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) title = titleMatch[1].trim();

  let thumbnail = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop";
  const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  if (ogImage && ogImage[1]) thumbnail = cleanEscapedUrl(ogImage[1]);

  let directVideoUrl = "";
  const ogVideo = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i);
  if (ogVideo && ogVideo[1]) directVideoUrl = cleanEscapedUrl(ogVideo[1]);

  // Method 2: Scan for standard HTML5 `<video>` tags source inside HTML
  if (!directVideoUrl) {
    const videoTagRegex = /<video[^>]*src="([^"]+)"/i;
    const tagMatch = html.match(videoTagRegex);
    if (tagMatch && tagMatch[1]) {
      directVideoUrl = cleanEscapedUrl(tagMatch[1]);
    } else {
      const sourceTagRegex = /<source[^>]*src="([^"]+)"[^>]*type="video\/mp4"/i;
      const srcMatch = html.match(sourceTagRegex);
      if (srcMatch && srcMatch[1]) {
        directVideoUrl = cleanEscapedUrl(srcMatch[1]);
      }
    }
  }

  // Method 3: Scan raw source for single matching MP4 file URL
  if (!directVideoUrl) {
    const anyMp4 = html.match(/(https?:\/\/[^\s"'`<>]+?\.(?:mp4|webm))/gi);
    if (anyMp4 && anyMp4.length > 0) {
      // Find the first clean url that looks real
      directVideoUrl = anyMp4[0];
    }
  }

  if (!directVideoUrl) {
    throw new Error("Standard HTML5 direct video links or standard video meta tags could not be resolved on this page. Check if the page contains a nested iframe.");
  }

  // Resolve absolute path if relative
  if (directVideoUrl.startsWith("/")) {
    try {
      const parsed = new URL(url);
      directVideoUrl = `${parsed.protocol}//${parsed.host}${directVideoUrl}`;
    } catch (_) {}
  }

  const size = await estimateSize(directVideoUrl, 7.8);

  return {
    title,
    thumbnail,
    source: "generic",
    originalUrl: url,
    formats: [
      {
        url: directVideoUrl,
        quality: "Standard Direct Video",
        ext: "mp4",
        size,
        type: "both",
      },
    ],
  };
}

/**
 * Orchestrator dispatcher mapping matching URLs securely
 */
export async function extractVideo(url: string): Promise<VideoMetadata> {
  // Validate basic URL structures
  if (!url || !url.startsWith("http")) {
    throw new Error("Please enter a valid URL beginning with http:// or https://");
  }

  // Clean the URL structure
  const resolved = await resolveShortUrl(url.trim());
  const parsedUrl = new URL(resolved);
  const hostname = parsedUrl.hostname.toLowerCase();

  // Route URL queries based on hostname signature
  if (hostname.includes("facebook.com") || hostname.includes("fb.watch") || hostname.includes("fb.com")) {
    return extractFacebook(resolved);
  } else if (hostname.includes("pinterest.com") || hostname.includes("pin.it")) {
    return extractPinterest(resolved);
  } else if (hostname.includes("instagram.com")) {
    return extractInstagram(resolved);
  } else if (hostname.includes("tiktok.com")) {
    return extractTikTok(resolved);
  } else if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
    // YouTube legal policy compliance check
    throw new Error("Downloading standard copyright YouTube videos violates Google Platform TOS and is restricted. Use standard permitted Open-Source tools locally, or ask the AI assistant for instructions.");
  } else {
    // Attempt standard generic parse
    return extractGeneric(resolved);
  }
}
