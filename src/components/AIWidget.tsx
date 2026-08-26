import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Trash2, HelpCircle, Sparkles, MessageSquare, Loader2 } from "lucide-react";
import { ChatMessage } from "../types";

interface AIWidgetProps {
  onSuggestUrl: (url: string) => void;
}

export default function AIWidget({ onSuggestUrl }: AIWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("downloader_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return [
      {
        id: "msg_init_1",
        role: "model",
        text: "Hello! I'm your AI video extraction guide. Paste your video link above. \n\nIf you get an error or need alternate download directions, feel free to ask me!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Save history to localstorage
  useEffect(() => {
    localStorage.setItem("downloader_chat_history", JSON.stringify(messages));
  }, [messages]);

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || isSending) return;

    if (!customText) {
      setInputMessage("");
    }

    const newUserMessage: ChatMessage = {
      id: "msg_" + Date.now(),
      role: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setIsSending(true);

    try {
      // Map current list to match expected server api body format ({role, text})
      const apiMessages = [...messages, newUserMessage].map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data = await res.json();

      if (res.ok && data.text) {
        setMessages((prev) => [
          ...prev,
          {
            id: "msg_" + (Date.now() + 1),
            role: "model",
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        const errorMsg = data.error || "Failed to receive a response.";
        setMessages((prev) => [
          ...prev,
          {
            id: "msg_" + (Date.now() + 1),
            role: "model",
            text: `⚠️ **API Notice:** ${errorMsg}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: "msg_" + (Date.now() + 1),
          role: "model",
          text: "⚠️ **System Offline:** The Gemini AI endpoint is unavailable because the developer server has no active API key. Please check your secrets configurations.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "msg_init_" + Date.now(),
        role: "model",
        text: "Chat cleared successfully. How can I help you troubleshoot video link retrievals today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Helper shortcut chip options
  const quickFaqs = [
    { label: "Check Fair Use Limit", text: "What are the rules regarding Fair Use and copyright when downloading videos for personal use?" },
    { label: "Facebook SD vs HD", text: "How does the Facebook SD/HD picker select the streams? What if HD is unavailable?" },
    { label: "Instagram Wall", text: "Why am I facing extraction blocks on Instagram links? How do I download from private accounts?" },
    { label: "Local yt-dlp script", text: "Can you provide the command-line command for downloading videos locally using terminal and yt-dlp?" },
    { label: "Pinterest Extract", text: "How does Pinterest video URL crawling work?" },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-[32px] p-6 shadow-[0_20px_50px_rgba(37,99,235,0.04)] transition-all flex flex-col h-[580px] relative overflow-hidden">
      {/* Widget Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-rose-600 text-white rounded-2xl shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm md:text-base text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <span>AI Assistant Companion</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-gradient-to-r from-blue-500/20 to-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                Live
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono tracking-wider font-semibold">POWERED BY GEMINI 2.5 FLASH</p>
          </div>
        </div>
        <button
          onClick={handleClearChat}
          className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer shadow-xs"
          title="Clear chat log"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Suggestive FAQ chips */}
      <div className="py-3 flex gap-2 overflow-x-auto scrollbar-none border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
        {quickFaqs.map((faq, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(faq.text)}
            disabled={isSending}
            className="text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-gradient-to-r hover:from-blue-600 hover:to-rose-600 hover:text-white px-3.5 py-1.5 rounded-full transition-all shrink-0 select-none cursor-pointer disabled:opacity-50 border border-slate-200/60 dark:border-zinc-700"
          >
            {faq.label}
          </button>
        ))}
      </div>

      {/* Messages Sandbox overflow */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scrollbar-none">
        {messages.map((msg) => {
          const isModel = msg.role === "model";
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isModel ? "justify-start" : "justify-end"}`}
            >
              {isModel && (
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-rose-600 text-white rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-blue-500/20">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isModel
                    ? "bg-slate-50/80 dark:bg-zinc-950/40 text-slate-800 dark:text-zinc-200 border border-slate-200/70 dark:border-zinc-800"
                    : "bg-gradient-to-r from-blue-600 to-rose-600 text-white font-semibold shadow-md shadow-blue-500/20"
                }`}
              >
                {/* Simulated Markdown renderer */}
                <div className="whitespace-pre-wrap word-break">
                  {msg.text.split("\n").map((line, lineIdx) => {
                    let cleanLine = line;
                    // Catch bold markers **text**
                    if (cleanLine.includes("**")) {
                      const regex = /\*\*(.*?)\*\*/g;
                      let m;
                      const parts = [];
                      let lastIndex = 0;
                      while ((m = regex.exec(cleanLine)) !== null) {
                        parts.push(cleanLine.substring(lastIndex, m.index));
                        parts.push(<strong key={m.index} className="font-extrabold">{m[1]}</strong>);
                        lastIndex = regex.lastIndex;
                      }
                      parts.push(cleanLine.substring(lastIndex));
                      return <p key={lineIdx} className={lineIdx > 0 ? "mt-1.5" : ""}>{parts}</p>;
                    }
                    // Catch bullets starting with - or *
                    if (cleanLine.trim().startsWith("- ") || cleanLine.trim().startsWith("* ")) {
                      return (
                        <li key={lineIdx} className="ml-4 list-disc mt-1 text-slate-700 dark:text-zinc-300">
                          {cleanLine.replace(/^[\s-*]+/, "")}
                        </li>
                      );
                    }
                    return <p key={lineIdx} className={lineIdx > 0 ? "mt-1.5" : ""}>{cleanLine}</p>;
                  })}
                </div>
                <p
                  className={`text-[8px] mt-1.5 text-right font-mono font-bold ${
                    isModel ? "text-slate-400" : "text-white/80"
                  }`}
                >
                  {msg.timestamp}
                </p>
              </div>
              {!isModel && (
                <div className="w-8 h-8 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-start gap-2.5 justify-start">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-rose-600 text-white rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-blue-500/20">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-50/90 dark:bg-zinc-950/40 border border-slate-200/70 dark:border-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 dark:text-rose-400 animate-spin" />
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold">Assistant analyzing question...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input container */}
      <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isSending}
            placeholder="Ask questions, troubleshoot errors, get tips..."
            className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 dark:focus:border-rose-500 transition-colors disabled:opacity-50 font-medium"
          />
          <button
            type="submit"
            disabled={isSending || !inputMessage.trim()}
            className="p-3.5 bg-gradient-to-r from-blue-600 to-rose-600 hover:from-blue-500 hover:to-rose-500 disabled:opacity-50 rounded-xl text-white transition-all select-none cursor-pointer shadow-md shadow-blue-500/20 active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
