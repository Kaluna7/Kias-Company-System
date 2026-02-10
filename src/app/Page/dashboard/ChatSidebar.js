// src/app/Page/dashboard/ChatSidebar.js
"use client";

import { useEffect, useState, useMemo, useRef } from "react";

export default function ChatSidebar({ currentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [recipientMode, setRecipientMode] = useState("all"); // 'all' | 'selected'
  const [selectedUserIds, setSelectedUserIds] = useState(() => new Set());
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [lastSeenId, setLastSeenId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState("all"); // 'all' or sender name

  const isAdmin = (currentUser?.role || "").toLowerCase() === "admin";
  const currentName = (currentUser?.name || "").trim();

  // Ref untuk container chat messages
  const messagesContainerRef = useRef(null);

  // Auto-scroll ke bawah ketika messages berubah atau conversation berubah
  useEffect(() => {
    if (messagesContainerRef.current && isOpen) {
      // Scroll ke bawah dengan smooth behavior
      const scrollToBottom = () => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      };
      // Delay sedikit untuk memastikan DOM sudah ter-render
      const timeoutId = setTimeout(scrollToBottom, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, selectedConversation, isOpen]);

  // Debug: monitor isOpen state changes
  useEffect(() => {
    console.log('ChatSidebar isOpen state changed to:', isOpen);
  }, [isOpen]);

  // Load users from system accounts (backend /api/users)
  useEffect(() => {
    let mounted = true;
    async function loadUsers() {
      try {
        setLoadingUsers(true);
        const res = await fetch("/api/users", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!mounted) return;
        if (res.ok && json?.success && Array.isArray(json.users)) {
          setUsers(json.users);
        } else {
          setUsers([]);
        }
      } catch {
        if (!mounted) return;
        setUsers([]);
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    }
    loadUsers();
    return () => {
      mounted = false;
    };
  }, []);

  const sortedUsers = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [users]);

  // Load chat messages (simple polling)
  useEffect(() => {
    let mounted = true;
    let timer;

    async function loadMessages(initial = false) {
      try {
        if (initial) setLoadingMessages(true);
        const res = await fetch("/api/chat", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!mounted) return;
        if (!res.ok || !json?.success || !Array.isArray(json.messages)) return;

        const sorted = [...json.messages].sort((a, b) => a.id - b.id);
        setMessages(sorted);

        const maxId = sorted.reduce(
          (acc, m) => (m.id && m.id > acc ? m.id : acc),
          0
        );
        // Saat pertama kali load, anggap semua pesan sudah "dibaca"
        if (initial && maxId) setLastSeenId(maxId);
      } catch {
        // ignore
      } finally {
        if (initial && mounted) setLoadingMessages(false);
      }
    }

    loadMessages(true);
    timer = setInterval(() => loadMessages(false), 10000);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  // Bangun daftar percakapan (mirip WhatsApp): Broadcast + per-sender
  const conversations = useMemo(() => {
    const map = new Map();

    for (const m of messages) {
      const mode = String(m.recipient_mode || "all").toLowerCase();
      const sender = String(m.sender_name || "").trim();

      const key =
        mode === "all"
          ? "all"
          : sender || `unknown-${m.id || Math.random().toString(36)}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          label: key === "all" ? "Broadcast" : sender || "Unknown",
          lastMessage: m,
        });
      } else {
        const conv = map.get(key);
        if (!conv.lastMessage || m.id > conv.lastMessage.id) {
          conv.lastMessage = m;
        }
        map.set(key, conv);
      }
    }

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const ad = new Date(a.lastMessage?.created_at || 0).getTime();
      const bd = new Date(b.lastMessage?.created_at || 0).getTime();
      return bd - ad;
    });

    // Pastikan Broadcast di atas
    list.sort((a, b) => {
      if (a.key === "all") return -1;
      if (b.key === "all") return 1;
      return 0;
    });

    return list;
  }, [messages]);

  // Unread indicator per percakapan (green dot)
  const hasUnreadByConv = useMemo(() => {
    const map = new Map();
    if (!lastSeenId) return map;
    for (const conv of conversations) {
      const lm = conv.lastMessage;
      if (!lm) continue;
      if (lm.id > lastSeenId) {
        map.set(conv.key, true);
      }
    }
    return map;
  }, [conversations, lastSeenId]);

  const toggleUser = (id) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      setSending(true);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          recipientMode,
          recipients:
            recipientMode === "all"
              ? []
              : Array.from(selectedUserIds).map((id) => String(id)),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        alert("Gagal mengirim chat: " + (json?.error || `HTTP ${res.status}`));
        return;
      }
      setMessage("");
      // Setelah kirim pesan, refresh list segera (biar langsung muncul)
      try {
        const res2 = await fetch("/api/chat", { cache: "no-store" });
        const j2 = await res2.json().catch(() => null);
        if (res2.ok && j2?.success && Array.isArray(j2.messages)) {
          const sorted = [...j2.messages].sort((a, b) => a.id - b.id);
          setMessages(sorted);
          const maxId = sorted.reduce(
            (acc, m) => (m.id && m.id > acc ? m.id : acc),
            0
          );
          if (maxId) setLastSeenId(maxId);
          // Scroll ke bawah setelah pesan baru ditambahkan
          setTimeout(() => {
            messagesContainerRef.current?.scrollTo({
              top: messagesContainerRef.current.scrollHeight,
              behavior: 'smooth'
            });
          }, 200);
        }
      } catch {
        // ignore
      }
    } catch (err) {
      alert("Gagal mengirim chat: " + (err?.message || String(err)));
    } finally {
      setSending(false);
    }
  };

  const handleToggleChat = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    console.log('Chat button clicked, current isOpen:', isOpen);
    setIsOpen(prev => {
      console.log('Setting isOpen to:', !prev);
      return !prev;
    });
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        type="button"
        onClick={handleToggleChat}
        className="fixed left-6 bottom-6 w-14 h-14 rounded-full bg-gradient-to-br from-[#141D38] to-[#1a2647] text-white shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 items-center justify-center group cursor-pointer flex"
        style={{ 
          zIndex: 9999,
          pointerEvents: 'auto',
          position: 'fixed'
        }}
        aria-label={isOpen ? "Tutup chat" : "Buka chat"}
      >
        <span className="text-2xl pointer-events-none">💬</span>
        {/* Unread badge indicator */}
        {hasUnreadByConv.size > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white animate-pulse flex items-center justify-center shadow-lg pointer-events-none">
            <span className="text-[10px] text-white font-bold">{hasUnreadByConv.size > 9 ? '9+' : hasUnreadByConv.size}</span>
          </div>
        )}
        {/* Tooltip */}
        <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
          {isOpen ? "Tutup Chat" : "Buka Chat"}
        </span>
      </button>

      {/* Chat Panel Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/10"
          onClick={() => {
            console.log('Overlay clicked, closing chat');
            setIsOpen(false);
          }}
          style={{ zIndex: 9997 }}
        />
      )}

      {/* Chat Panel - Conditional rendering: hanya muncul saat isOpen true */}
      {isOpen && (
        <aside 
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex"
          onClick={(e) => {
            e.stopPropagation();
            console.log('Panel clicked, keeping open');
          }}
          style={{ 
            zIndex: 9998,
            backgroundColor: 'white',
            width: '840px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            boxShadow: '0 0 20px rgba(0,0,0,0.3)',
            borderRadius: '16px'
          }}
        >
        <div className="w-full bg-white flex flex-col shadow-2xl overflow-hidden rounded-2xl" style={{ height: '90vh', maxHeight: '90vh' }}>
              {/* Header */}
              <div className="px-5 pt-5 pb-3 border-b border-gray-200/60 flex items-center justify-between bg-gradient-to-r from-[#141D38] to-[#1a2647] text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-lg">
                    <span className="text-lg">💬</span>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider">
                      Team Chat
                    </div>
                    <div className="text-base font-bold text-white">
                      {isAdmin ? "Admin Broadcast" : "Channel"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                  aria-label="Tutup chat"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Recipient selector + conversations (like WhatsApp) */}
              <div className="flex flex-1 border-b border-gray-100/60 overflow-hidden min-h-0">
                {/* Left: recipient mode + conversations list */}
                <div className="w-[200px] border-r border-gray-200/60 flex flex-col bg-gradient-to-b from-gray-50/80 to-white flex-shrink-0">
                  {/* Recipient mode */}
                  <div className="px-4 py-4 border-b border-gray-200/60 space-y-3 bg-white/50">
                    <div className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                      Penerima
                    </div>
                    <div className="flex flex-col gap-2 text-xs text-gray-700">
                      <label className="inline-flex items-center gap-2.5 cursor-pointer group hover:bg-blue-50/50 px-2 py-1.5 rounded-lg transition-colors">
                        <input
                          type="radio"
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                          checked={recipientMode === "all"}
                          onChange={() => setRecipientMode("all")}
                        />
                        <span className="font-medium">All users</span>
                      </label>
                      <label className="inline-flex items-center gap-2.5 cursor-pointer group hover:bg-blue-50/50 px-2 py-1.5 rounded-lg transition-colors">
                        <input
                          type="radio"
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                          checked={recipientMode === "selected"}
                          onChange={() => setRecipientMode("selected")}
                        />
                        <span className="font-medium">Selected users</span>
                      </label>
                    </div>
                  </div>

                  {/* Conversations list */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="px-2 pt-3 pb-3 space-y-1">
                      {loadingMessages && (
                        <div className="text-xs text-gray-500 py-2 px-3 text-center">
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
                          <span className="ml-2">Memuat pesan...</span>
                        </div>
                      )}
                      {!loadingMessages &&
                        conversations.map((conv) => {
                          const isSelected = selectedConversation === conv.key;
                          const hasUnread = hasUnreadByConv.get(conv.key);
                          const lastText =
                            conv.lastMessage?.message?.slice(0, 40) || "";

                          return (
                            <button
                              key={conv.key}
                              type="button"
                              onClick={() => {
                                setSelectedConversation(conv.key);
                                const maxId = messages.reduce(
                                  (acc, m) =>
                                    m.id && m.id > acc ? m.id : acc,
                                  lastSeenId || 0
                                );
                                if (maxId) setLastSeenId(maxId);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                                isSelected
                                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                                  : "hover:bg-blue-50/70 text-gray-800 hover:shadow-sm"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className={`font-bold text-xs truncate ${isSelected ? "text-white" : "text-gray-900"}`}>
                                  {conv.label}
                                </div>
                                <div className={`text-[10px] truncate mt-0.5 ${isSelected ? "text-blue-100" : "text-gray-500"}`}>
                                  {lastText || "No message"}
                                </div>
                              </div>
                              {hasUnread && (
                                <span className={`ml-2 inline-block w-2.5 h-2.5 rounded-full ${isSelected ? "bg-white" : "bg-green-500"} shadow-sm`} />
                              )}
                            </button>
                          );
                        })}
                      {!loadingMessages && conversations.length === 0 && (
                        <div className="text-xs text-gray-400 py-4 px-3 text-center">
                          Belum ada pesan.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: (opsional) checklist user + info + isi chat */}
                <div className="flex-1 flex flex-col bg-white overflow-hidden min-h-0">
                  {/* Checklist user (hanya jika selected mode) */}
                  {recipientMode === "selected" && (
                    <div className="px-4 py-3 border-b border-gray-200/60 bg-gradient-to-r from-blue-50/50 to-white space-y-2">
                      <div className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                        Pilih user
                      </div>
                      <div className="mt-1 max-h-32 overflow-y-auto rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm px-3 py-2 shadow-inner custom-scrollbar">
                        {loadingUsers ? (
                          <div className="text-xs text-gray-500 py-2 text-center">
                            <div className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-blue-600"></div>
                            <span className="ml-2">Memuat daftar user...</span>
                          </div>
                        ) : sortedUsers.length === 0 ? (
                          <div className="text-xs text-gray-400 py-2 text-center">
                            Belum ada user terdaftar.
                          </div>
                        ) : (
                          sortedUsers.map((u) => (
                            <label
                              key={u.id}
                              className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-blue-50/50 cursor-pointer transition-colors group"
                            >
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                                checked={selectedUserIds.has(String(u.id))}
                                onChange={() => toggleUser(String(u.id))}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-gray-800 truncate group-hover:text-blue-700">
                                  {u.name}
                                </div>
                                <div className="text-[10px] text-gray-500 truncate">
                                  {u.email}
                                </div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Info kecil untuk user */}
                  <div className="px-4 py-2 text-[10px] text-gray-500 border-b border-gray-200/60 bg-gray-50/30 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>Bubble biru = pesan Anda</span>
                    <span className="mx-1">•</span>
                    <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                    <span>Bubble abu = pesan user lain</span>
                  </div>

                  {/* Riwayat chat untuk percakapan yang dipilih (mirip WhatsApp) */}
                  <div 
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-gradient-to-b from-gray-50/50 via-white to-gray-50/30 custom-scrollbar min-h-0"
                  >
                    {messages
                      .filter((m) => {
                        const mode = String(
                          m.recipient_mode || "all"
                        ).toLowerCase();
                        const sender = String(m.sender_name || "").trim();

                        // Global chat: hanya pesan broadcast
                        if (selectedConversation === "all") {
                          return mode === "all";
                        }

                        // Private: gunakan nama sender sebagai key percakapan
                        // (sederhana: semua pesan dari dia + semua pesan private yang Anda kirim)
                        if (selectedConversation) {
                          if (sender === selectedConversation) return true;
                          if (
                            sender === currentName &&
                            mode !== "all" // private atau selected
                          ) {
                            return true;
                          }
                        }
                        return false;
                      })
                      .map((m) => {
                        const sender = String(m.sender_name || "").trim();
                        const isMe =
                          currentName &&
                          sender.toLowerCase() === currentName.toLowerCase();
                        return (
                          <div
                            key={m.id}
                            className={`flex mb-2 text-xs ${
                              isMe ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[75%] px-3 py-2 rounded-2xl shadow-sm ${
                                isMe
                                  ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white border border-blue-400/30"
                                  : "bg-white border border-gray-200 text-gray-800 shadow-sm"
                              }`}
                            >
                              {!isMe && (
                                <div className={`font-bold text-[10px] mb-1 ${
                                  isMe ? "text-blue-100" : "text-gray-600"
                                }`}>
                                  {sender || "Unknown"}
                                </div>
                              )}
                              <div className={`whitespace-pre-wrap break-words leading-relaxed ${
                                isMe ? "text-white" : "text-gray-800"
                              }`}>
                                {m.message}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    {messages.filter((m) => {
                      const mode = String(m.recipient_mode || "all").toLowerCase();
                      const sender = String(m.sender_name || "").trim();
                      if (selectedConversation === "all") return mode === "all";
                      if (selectedConversation) {
                        if (sender === selectedConversation) return true;
                        if (sender === currentName && mode !== "all") return true;
                      }
                      return false;
                    }).length === 0 && (
                      <div className="flex items-center justify-center h-full text-xs text-gray-400">
                        Belum ada pesan dalam percakapan ini.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat input */}
              <form
                onSubmit={handleSend}
                className="px-4 py-4 border-t border-gray-200/60 flex flex-col gap-3 bg-gradient-to-r from-white to-gray-50/50 flex-shrink-0"
              >
                <textarea
                  rows={2}
                  className="w-full text-xs rounded-xl border-2 border-gray-200 px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-inner bg-white"
                  placeholder={
                    isAdmin
                      ? "Tulis pesan ke team..."
                      : "Tulis pesan singkat ke admin / team..."
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Backend chat tersimpan di DB</span>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#141D38] to-[#1a2647] text-white text-xs font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    disabled={
                      sending ||
                      !message.trim() ||
                      (recipientMode === "selected" &&
                        selectedUserIds.size === 0 &&
                        sortedUsers.length > 0)
                    }
                  >
                    {sending ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Mengirim...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>Kirim</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
        </div>
      </aside>
      )}
    </>
  );
}


