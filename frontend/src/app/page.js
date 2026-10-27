"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search,
  Sparkles,
  Paperclip,
  FileText,
  Play,
  Share2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  BarChart3,
  X,
  UploadCloud,
  Check,
  Copy,
  Layout,
  Network
} from "lucide-react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null); // 'idle' | 'uploading' | 'success' | 'error'
  const [uploadMessage, setUploadMessage] = useState("");
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [backendHealth, setBackendHealth] = useState(null);
  const [copied, setCopied] = useState(false);
  const [chatId, setChatId] = useState("");

  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const resultsRef = useRef(null);

  const startNewChat = () => {
    setChatId(crypto.randomUUID());
    setResponse(null);
    setSelectedFile(null);
    setUploadStatus(null);
    setUploadMessage("");
    setQuery("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Exact prompt chips from the design reference image
  const promptChipsRow1 = [
    {
      icon: FileText,
      label: "Summarize this contract",
      query: "Can you provide a concise executive summary of the uploaded contract, outlining key terms, obligations, and deadlines?",
    },
    {
      icon: Search,
      label: 'Find every customer mentioning "renewal"',
      query: 'Find every customer interaction, ticket, or contract mentioning renewal terms, timelines, or renewal negotiations.',
    },
  ];

  const promptChipsRow2 = [
    {
      icon: Globe,
      label: "Explain our onboarding process",
      query: "Explain our standard onboarding process, step-by-step checklist, and required departmental documentation.",
    },
    {
      icon: BarChart3,
      label: "Show last month's sales insights",
      query: "Show key performance indicators, revenue milestones, and top sales insights from last month's business reports.",
    },
  ];

  // Check backend health on mount
  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setBackendHealth({ online: true, ...data });
      })
      .catch(() => setBackendHealth({ online: false }));
  }, []);

  // Handle Query Submission
  const handleSearch = async (overrideQuery) => {
    const textToSearch = overrideQuery || query;
    if (!textToSearch.trim() || isLoading) return;

    const activeChatId = chatId || crypto.randomUUID();
    if (!chatId) setChatId(activeChatId);

    setIsLoading(true);
    setResponse(null);

    // Scroll to results
    setTimeout(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 150);

    try {
      const res = await fetch(`/api/chat/${activeChatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: textToSearch.trim(), message: textToSearch.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      setResponse({
        question: textToSearch,
        answer: data.answer || "No response received.",
        sources: data.sources || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err) {
      setResponse({
        question: textToSearch,
        answer: `Notice: ${err.message}. If no documents are attached in this chat, you can still ask general questions or attach a PDF using "+ Attach Documents".`,
        sources: [],
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle PDF File Upload to Backend
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadStatus("error");
      setUploadMessage("Please select a valid PDF file.");
      return;
    }

    const activeChatId = chatId || crypto.randomUUID();
    if (!chatId) setChatId(activeChatId);

    setSelectedFile(file);
    setUploadStatus("uploading");
    setUploadMessage(`Ingesting "${file.name}" for this chat session...`);

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const res = await fetch(`/api/chat/${activeChatId}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process PDF.");
      }

      setUploadStatus("success");
      setUploadMessage(`Successfully indexed ${data.pagesCount || data.pages || 1} pages (${data.chunksCount || data.chunks || 1} chunks) into Qdrant! You can now query this document.`);
    } catch (err) {
      setUploadStatus("error");
      setUploadMessage(err.message || "Upload failed. Please check backend connection.");
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setUploadStatus(null);
    setUploadMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ambient-bg min-h-screen relative flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:p-10 font-sans selection:bg-[#38624a] selection:text-white">
      {/* Precision Corner Registration Crosshairs */}
      <div className="corner-bracket corner-tl" aria-hidden="true" />
      <div className="corner-bracket corner-tr" aria-hidden="true" />
      <div className="corner-bracket corner-bl" aria-hidden="true" />
      <div className="corner-bracket corner-br" aria-hidden="true" />

      {/* Top Header Label */}
      <header className="w-full text-center py-2.5 z-10">
        <p className="text-[10px] sm:text-[11px] font-mono tracking-[0.24em] text-[#d6e8dc]/75 uppercase font-medium">
          AI KNOWLEDGE MANAGEMENT &amp; ENTERPRISE SEARCH PLATFORM
        </p>
      </header>

      {/* Main Showcase Canvas Card */}
      <main className="w-full max-w-[1240px] mx-auto hero-card rounded-[32px] sm:rounded-[40px] md:rounded-[44px] p-6 sm:p-9 md:p-12 relative overflow-hidden my-auto border border-white/10 z-10 shadow-2xl">
        {/* Concentric Radar Rings */}
        <div className="radar-ring w-[380px] h-[380px] sm:w-[480px] sm:h-[480px]" />
        <div className="radar-ring w-[660px] h-[660px] sm:w-[800px] sm:h-[800px]" />
        <div className="radar-ring w-[980px] h-[980px] sm:w-[1140px] sm:h-[1140px]" />
        <div className="radar-ring w-[1300px] h-[1300px] sm:w-[1500px] sm:h-[1500px]" />

        {/* Interior Navigation Bar */}
        <nav className="relative z-20 flex items-center justify-between pb-8 sm:pb-12 border-b border-white/[0.06]">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
              {/* HelpOS Intersecting Ribbon / Loop glyph */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4.5 h-4.5 shrink-0 text-[#eaf4ee]"
              >
                <circle cx="12" cy="12" r="3.5" />
                <path d="M12 2a10 10 0 0 0-10 10c0 5.52 4.48 10 10 10s10-4.48 10-10A10 10 0 0 0 12 2z" strokeOpacity="0.3" />
                <path d="M12 5v14M5 12h14" strokeOpacity="0.5" />
              </svg>
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">HelpOS</span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-sm text-[#d4e6db]/80 font-normal">
            <button
              onClick={() => setShowVaultModal(true)}
              className="hover:text-white transition cursor-pointer"
            >
              Platform
            </button>
            <button
              onClick={() => setShowVaultModal(true)}
              className="hover:text-white transition cursor-pointer"
            >
              Solutions
            </button>
            <button
              onClick={() => setShowDemoModal(true)}
              className="hover:text-white transition cursor-pointer"
            >
              Resources
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={startNewChat}
              className="flex items-center gap-1.5 text-xs sm:text-sm bg-white/10 hover:bg-white/20 active:scale-95 text-[#eaf4ee] font-medium px-3.5 py-1.5 rounded-full border border-white/20 transition shadow-sm cursor-pointer"
              title={chatId ? `Session ID: ${chatId}` : "Start a new chat"}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>New Chat</span>
            </button>
            <button
              onClick={() => setShowDemoModal(true)}
              className="text-xs sm:text-sm text-[#d4e6db]/85 hover:text-white transition px-2 py-1 font-medium cursor-pointer"
            >
              Book Demo
            </button>
            <button
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.click();
              }}
              className="bg-[#435e4e] hover:bg-[#4d6a59] active:scale-95 text-white text-xs sm:text-sm font-medium px-4 sm:px-5 py-2 rounded-full border border-white/10 transition shadow-sm cursor-pointer"
            >
              Attach PDF
            </button>
          </div>
        </nav>

        {/* Hero Section Container */}
        <div className="relative z-20 pt-8 sm:pt-14 pb-2">
          {/* Left Micro-Copy Editorial Annotation */}
          <div className="hidden lg:block absolute left-4 xl:left-8 top-[36%] -translate-y-1/2 text-left z-10 pointer-events-none">
            <p className="text-xs xl:text-[13px] leading-relaxed text-[#bad4c4]/70 max-w-[155px]">
              AI that understands your business - not just your prompts
            </p>
          </div>

          {/* Right Micro-Copy Editorial Annotation */}
          <div className="hidden lg:block absolute right-4 xl:right-8 top-[36%] -translate-y-1/2 text-right z-10 pointer-events-none">
            <p className="text-xs xl:text-[13px] leading-relaxed text-[#bad4c4]/70 max-w-[180px] ml-auto">
              Connect every document, conversation, and workflow into one intelligent workspace
            </p>
          </div>

          {/* Central Master Headline */}
          <div className="max-w-3xl mx-auto text-center px-4">
            <h1 className="text-3xl sm:text-5xl lg:text-[64px] font-semibold text-white tracking-[-0.03em] leading-[1.12]">
              <span className="block">Find answers across</span>
              <span className="block mt-1 sm:mt-2.5">
                your{" "}
                <span className="inline-flex items-center px-4 sm:px-5 py-0.5 rounded-full border border-white/50 text-white font-normal mx-1 align-middle backdrop-blur-xs">
                  entire
                </span>{" "}
                company
              </span>
            </h1>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8">
              <button
                onClick={() => {
                  if (searchInputRef.current) {
                    searchInputRef.current.focus();
                  }
                }}
                className="bg-white hover:bg-[#f5f8f6] active:scale-95 text-[#142a1f] px-5 sm:px-6 py-2.5 rounded-full font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
              >
                <span>Start Searching</span>
                <Play className="w-3 h-3 fill-current ml-0.5" />
              </button>

              <button
                onClick={() => setShowDemoModal(true)}
                className="bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 border border-white/15 text-[#e5f2ea] px-5 sm:px-6 py-2.5 rounded-full font-medium text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer"
              >
                <span>Watch Live Demo</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5 opacity-80"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </button>
            </div>
          </div>

          {/* Central Interactive Search Box */}
          <div className="mt-10 sm:mt-12 max-w-2xl mx-auto w-full">
            <div className="bg-white rounded-[24px] sm:rounded-[28px] p-4 sm:p-5 shadow-2xl shadow-black/40 border border-white/30 transition-all focus-within:ring-2 focus-within:ring-[#4e9471]/40">
              {/* Query Input */}
              <div className="relative">
                <textarea
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  rows={2}
                  placeholder="Ask anything about your business..."
                  className="w-full resize-none border-0 bg-transparent p-1 text-sm sm:text-base text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
                />
              </div>

              {/* Uploaded File Badge Preview */}
              {selectedFile && (
                <div className="my-2 flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 truncate text-neutral-700">
                    <FileText className="w-4 h-4 text-[#3b7457] shrink-0" />
                    <span className="truncate font-medium">{selectedFile.name}</span>
                    <span className="text-neutral-400 text-[11px]">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadStatus === "uploading" && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Loader2 className="w-3 h-3 animate-spin" /> Ingesting...
                      </span>
                    )}
                    {uploadStatus === "success" && (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Indexed in Qdrant
                      </span>
                    )}
                    {uploadStatus === "error" && (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertCircle className="w-3.5 h-3.5" /> Error
                      </span>
                    )}
                    <button
                      onClick={clearFile}
                      className="text-neutral-400 hover:text-neutral-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Message Feedback */}
              {uploadMessage && !selectedFile && (
                <div className="mb-2 text-xs text-neutral-500 italic">
                  {uploadMessage}
                </div>
              )}

              {/* Bottom Controls Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100 mt-1">
                {/* Left: Attach Documents Pill */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-medium px-3 sm:px-3.5 py-1.5 rounded-full border border-neutral-200 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Paperclip className="w-3 h-3 text-neutral-500" />
                    <span>+ Attach Documents</span>
                  </button>
                </div>

                {/* Right: Mode & Green Action Button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowVaultModal(true)}
                    title="Knowledge Base Vault"
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg transition cursor-pointer"
                  >
                    {/* Document / Card icon */}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDemoModal(true)}
                    title="Enterprise RAG Graph"
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg transition cursor-pointer"
                  >
                    {/* Node / Network connectivity icon */}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="6" cy="6" r="3" />
                      <circle cx="18" cy="18" r="3" />
                      <path d="M8.5 8.5l7 7" />
                      <circle cx="18" cy="6" r="3" />
                      <path d="M15.5 8.5l-7 7" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    disabled={isLoading || !query.trim()}
                    onClick={() => handleSearch()}
                    className="bg-[#38624a] hover:bg-[#2e523e] disabled:opacity-40 disabled:hover:bg-[#38624a] text-white p-2 sm:p-2.5 rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      /* 4-point Sparkle Icon */
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Prompt Chips in 2 clean rows matching mockup */}
            <div className="mt-5 sm:mt-6 space-y-2.5">
              {/* Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {promptChipsRow1.map((chip, idx) => {
                  const IconComponent = chip.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setQuery(chip.query);
                        handleSearch(chip.query);
                      }}
                      className="bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-[#d8eae0] text-xs sm:text-[13px] px-3.5 sm:px-4 py-2.5 rounded-full flex items-center gap-2.5 backdrop-blur-xs transition text-left cursor-pointer truncate active:scale-[0.98]"
                    >
                      <IconComponent className="w-3.5 h-3.5 opacity-75 shrink-0" />
                      <span className="truncate">{chip.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {promptChipsRow2.map((chip, idx) => {
                  const IconComponent = chip.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setQuery(chip.query);
                        handleSearch(chip.query);
                      }}
                      className="bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-[#d8eae0] text-xs sm:text-[13px] px-3.5 sm:px-4 py-2.5 rounded-full flex items-center gap-2.5 backdrop-blur-xs transition text-left cursor-pointer truncate active:scale-[0.98]"
                    >
                      <IconComponent className="w-3.5 h-3.5 opacity-75 shrink-0" />
                      <span className="truncate">{chip.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Live Answer Section (Appears when user searches) */}
        {(isLoading || response) && (
          <div ref={resultsRef} className="relative z-20 mt-10 pt-8 border-t border-white/10">
            <div className="bg-[#12241b]/95 border border-white/10 rounded-2xl p-5 sm:p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
                  <span className="text-xs font-mono uppercase tracking-wider text-[#9fc2ab]">
                    {isLoading ? "Querying Qdrant Vector Store..." : "Intelligence Retrieval"}
                  </span>
                </div>
                {response && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(response.answer)}
                      className="text-xs text-[#bad4c4]/70 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 border border-white/10 transition cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                    <button
                      onClick={() => setResponse(null)}
                      className="text-[#bad4c4]/70 hover:text-white p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* User Question */}
              <div className="text-xs font-medium text-[#bad4c4]/60 mb-2">
                Question: &ldquo;{response?.question || query}&rdquo;
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-[#d2e5da]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#4ade80]" />
                  <p className="text-sm font-medium">Synthesizing context from document embeddings...</p>
                  <p className="text-xs text-[#9fc2ab]/60">Scanning similarity chunks in LangChain &amp; Qdrant</p>
                </div>
              )}

              {/* Answer Content */}
              {!isLoading && response && (
                <div>
                  <div className={`text-sm sm:text-base leading-relaxed ${response.isError ? "text-amber-200" : "text-white"} whitespace-pre-wrap`}>
                    {response.answer}
                  </div>

                  {/* Sources Footnote */}
                  {response.sources && response.sources.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-white/[0.08]">
                      <div className="text-xs font-mono uppercase text-[#bad4c4]/70 mb-2">
                        Retrieved Sources ({response.sources.length}):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {response.sources.map((src, idx) => (
                          <div
                            key={idx}
                            className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-md text-[#d6e8dc] flex items-center gap-1.5"
                          >
                            <FileText className="w-3 h-3 text-[#4ade80]" />
                            <span>{src.source || "document.pdf"}</span>
                            {src.page && <span className="opacity-60">• Page {src.page}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Center Credit Label */}
      <footer className="w-full text-center py-2.5 z-10">
        <p className="text-[10px] sm:text-[11px] font-mono tracking-[0.24em] text-[#d6e8dc]/75 uppercase font-medium">
          WINGLY.AGENCY
        </p>
      </footer>

      {/* Architecture & Live Demo Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#152a20] border border-white/15 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl relative">
            <button
              onClick={() => setShowDemoModal(false)}
              className="absolute top-5 right-5 text-[#bad4c4]/70 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#4ade80]" />
              <h3 className="text-lg font-semibold tracking-tight">System &amp; RAG Architecture</h3>
            </div>
            <p className="text-xs text-[#bad4c4]/80 mb-5">
              Enterprise RAG engine built with LangGraph, Qdrant Vector Database, and Google GenAI.
            </p>

            <div className="space-y-3 text-xs">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="font-semibold text-white mb-1 flex items-center justify-between">
                  <span>1. Ingestion Pipeline</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    ACTIVE
                  </span>
                </div>
                <p className="text-[#bad4c4]/80">
                  PDF documents parsed with pdf-parse, chunked with RecursiveCharacterTextSplitter (1000 size, 200 overlap), and indexed with vector embeddings into Qdrant.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="font-semibold text-white mb-1 flex items-center justify-between">
                  <span>2. Semantic Retrieval</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    TOP-K = 4
                  </span>
                </div>
                <p className="text-[#bad4c4]/80">
                  Cosine similarity search over Qdrant collections retrieves the most relevant context chunks with page numbers and source metadata.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="font-semibold text-white mb-1 flex items-center justify-between">
                  <span>3. LLM Synthesis</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    ZERO-HALLUCINATION
                  </span>
                </div>
                <p className="text-[#bad4c4]/80">
                  Generates precise answers strictly grounded in context, referencing page numbers and preventing hallucination.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDemoModal(false)}
                className="bg-white text-[#142a1f] text-xs font-semibold px-4 py-2 rounded-full hover:bg-neutral-100 transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Vault Modal */}
      {showVaultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#152a20] border border-white/15 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl relative">
            <button
              onClick={() => setShowVaultModal(false)}
              className="absolute top-5 right-5 text-[#bad4c4]/70 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <UploadCloud className="w-5 h-5 text-[#4ade80]" />
              <h3 className="text-lg font-semibold tracking-tight">Enterprise Knowledge Vault</h3>
            </div>
            <p className="text-xs text-[#bad4c4]/80 mb-5">
              Ingest business policies, contracts, customer conversations, and internal wikis.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] text-[#bad4c4]/60 font-mono">VECTOR CLUSTER</div>
                <div className="font-semibold mt-1">Qdrant Cloud</div>
                <div className="text-[11px] text-emerald-400 mt-0.5">● Connected</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] text-[#bad4c4]/60 font-mono">EMBEDDING MODEL</div>
                <div className="font-semibold mt-1">Google GenAI</div>
                <div className="text-[11px] text-neutral-300 mt-0.5">text-embedding-004</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-dashed border-white/20 text-center bg-white/[0.02]">
              <UploadCloud className="w-8 h-8 text-[#bad4c4] mx-auto mb-2" />
              <p className="text-sm font-medium">Upload enterprise document</p>
              <p className="text-xs text-[#bad4c4]/70 mt-0.5">Drag and drop or select a PDF file</p>
              <button
                onClick={() => {
                  setShowVaultModal(false);
                  fileInputRef.current?.click();
                }}
                className="mt-3 bg-white text-[#142a1f] text-xs font-semibold px-4 py-2 rounded-full hover:bg-neutral-100 transition cursor-pointer"
              >
                Choose PDF
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowVaultModal(false)}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
