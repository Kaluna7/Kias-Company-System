// src/app/Page/dashboard/ChatSidebar.js
"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useToast } from "@/app/contexts/ToastContext";

const MODULES = [
  { value: "sop-review", label: "SOP Review" },
  { value: "worksheet", label: "Worksheet" },
  { value: "audit-finding", label: "Audit Finding" },
  { value: "evidence", label: "Evidence" },
];

const DEPARTMENTS = [
  { value: "finance", label: "Finance" },
  { value: "accounting", label: "Accounting" },
  { value: "hrd", label: "HRD" },
  { value: "g&a", label: "G&A" },
  { value: "sdp", label: "SDP" },
  { value: "tax", label: "Tax" },
  { value: "l&p", label: "L&P" },
  { value: "mis", label: "MIS" },
  { value: "merch", label: "Merchandise" },
  { value: "ops", label: "Operational" },
  { value: "whs", label: "Warehouse" },
];

export default function ChatSidebar({ currentUser }) {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);

  // Create group chat form
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(false);
  const [groupSelectedUserIds, setGroupSelectedUserIds] = useState(() => new Set());
  const [groupModule, setGroupModule] = useState("");
  const [groupDepartment, setGroupDepartment] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [lastSeenId, setLastSeenId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState("all"); // 'all' or sender name

  const role = (currentUser?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "reviewer";
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

  // Prevent background page scroll when chat is open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  const hasLoadedUsersRef = useRef(false);

  // Load users only when sidebar is opened (saves request on initial dashboard load, especially on mobile)
  useEffect(() => {
    if (!isOpen) return;
    if (hasLoadedUsersRef.current) return;
    hasLoadedUsersRef.current = true;
    let mounted = true;
    async function loadUsers() {
      try {
        setLoadingUsers(true);
        const res = await fetch("/api/users?page=1&pageSize=100", { cache: "no-store" });
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
    return () => { mounted = false; };
  }, [isOpen]);

  const sortedUsers = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [users]);

  // Load chat messages and poll only when sidebar is open (saves network/CPU on mobile when chat closed)
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  // Normalisasi recipients untuk key group (urut dan gabung)
  const groupKeyFromRecipients = (recips) => {
    if (!Array.isArray(recips) || recips.length === 0) return null;
    const sorted = [...recips].map((n) => String(n || "").trim()).filter(Boolean).sort();
    return sorted.length ? "group:" + sorted.join("|") : null;
  };

  const recipientsFromGroupKey = (key) => {
    if (!key || !key.startsWith("group:")) return [];
    return key.replace("group:", "").split("|").filter(Boolean);
  };

  const sameGroupRecipients = (msgRecipients, keyRecipients) => {
    if (!Array.isArray(msgRecipients) || !Array.isArray(keyRecipients)) return false;
    const a = [...msgRecipients].map((n) => String(n || "").trim().toLowerCase()).sort();
    const b = [...keyRecipients].map((n) => String(n || "").trim().toLowerCase()).sort();
    return a.length === b.length && a.every((v, i) => v === b[i]);
  };

  // Bangun daftar percakapan: Broadcast + group (satu entry per group, bukan per sender)
  const conversations = useMemo(() => {
    const map = new Map();

    for (const m of messages) {
      const mode = String(m.recipient_mode || "all").toLowerCase();
      const sender = String(m.sender_name || "").trim();

      let key, label, recipients = null;
      if (mode === "all") {
        key = "all";
        label = "Broadcast";
      } else if (mode === "selected" && Array.isArray(m.recipients) && m.recipients.length > 0) {
        key = groupKeyFromRecipients(m.recipients);
        recipients = [...m.recipients].map((n) => String(n || "").trim()).filter(Boolean).sort();
        const desc = (m.message || "").startsWith("📋 Group Chat") ? m.message.slice(0, 50) + "…" : null;
        label = desc || `Group (${recipients.length} participants)`;
      } else {
        key = sender || `unknown-${m.id || Math.random().toString(36)}`;
        label = sender || "Unknown";
      }

      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, { key, label, lastMessage: m, recipients });
      } else {
        const conv = map.get(key);
        if (!conv.lastMessage || m.id > conv.lastMessage.id) {
          conv.lastMessage = m;
          if ((m.message || "").startsWith("📋 Group Chat") && !conv.label?.startsWith("📋")) {
            conv.label = m.message.slice(0, 50) + "…";
          }
        }
        if (recipients) conv.recipients = recipients;
        map.set(key, conv);
      }
    }

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const ad = new Date(a.lastMessage?.created_at || 0).getTime();
      const bd = new Date(b.lastMessage?.created_at || 0).getTime();
      return bd - ad;
    });
    list.sort((a, b) => {
      if (a.key === "all") return -1;
      if (b.key === "all") return 1;
      return 0;
    });

    return list;
  }, [messages]);

  // Message IDs untuk percakapan yang sedang dipilih (untuk hapus group)
  const selectedConversationMessageIds = useMemo(() => {
    return messages
      .filter((m) => {
        const mode = String(m.recipient_mode || "all").toLowerCase();
        const sender = String(m.sender_name || "").trim();
        if (selectedConversation === "all") return mode === "all";
        if (selectedConversation?.startsWith("group:")) {
          if (mode !== "selected" || !Array.isArray(m.recipients)) return false;
          return sameGroupRecipients(m.recipients, recipientsFromGroupKey(selectedConversation));
        }
        if (sender === selectedConversation) return true;
        if (sender === currentName && mode !== "all") return true;
        return false;
      })
      .map((m) => m.id)
      .filter(Boolean);
  }, [messages, selectedConversation, currentName]);

  const selectedConvObj = useMemo(() => conversations.find((c) => c.key === selectedConversation), [conversations, selectedConversation]);

  // Group description for current conversation (shown in info bar when viewing a group)
  const groupDescriptionText = useMemo(() => {
    if (!selectedConversation?.startsWith("group:")) return null;
    const filtered = messages.filter((m) => {
      if (m.recipient_mode !== "selected" || !Array.isArray(m.recipients)) return false;
      return sameGroupRecipients(m.recipients, recipientsFromGroupKey(selectedConversation));
    });
    const sorted = [...filtered].sort((a, b) => (a.id || 0) - (b.id || 0));
    const first = sorted[0];
    return first?.message?.startsWith("📋 Group Chat") ? first.message : null;
  }, [messages, selectedConversation]);

  const canDeleteGroup = useMemo(() => {
    if (!selectedConversation || selectedConversation === "all" || selectedConversationMessageIds.length === 0) return false;
    if (!selectedConversation.startsWith("group:")) return false;
    const groupMsgs = messages.filter((m) => {
      if (m.recipient_mode !== "selected" || !Array.isArray(m.recipients)) return false;
      return sameGroupRecipients(m.recipients, recipientsFromGroupKey(selectedConversation));
    });
    const firstById = groupMsgs.sort((a, b) => (a.id || 0) - (b.id || 0))[0];
    return firstById && String(firstById.sender_name || "").trim() === currentName;
  }, [selectedConversation, selectedConversationMessageIds.length, messages, currentName]);

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

  const toggleGroupUser = (id) => {
    setGroupSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateGroupSave = async (e) => {
    e.preventDefault();
    const selectedNames = Array.from(groupSelectedUserIds)
      .map((id) => {
        const u = users.find((x) => String(x.id) === String(id));
        return (u?.name || "").trim();
      })
      .filter(Boolean);
    if (selectedNames.length === 0 || !groupModule || !groupDepartment) {
      toast.show("Please select at least one user, module, and department.", "error");
      return;
    }
    // Include creator in recipients so participant messages are visible to admin
    const recipientNames = Array.from(new Set([...selectedNames, currentName].filter(Boolean)));
    const moduleLabel = MODULES.find((m) => m.value === groupModule)?.label || groupModule;
    const deptLabel = DEPARTMENTS.find((d) => d.value === groupDepartment)?.label || groupDepartment;
    const description = `📋 Group Chat | Module: ${moduleLabel} | Department: ${deptLabel} | Participants: ${recipientNames.join(", ")}`;

    try {
      setSavingGroup(true);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: description,
          recipientMode: "selected",
          recipients: recipientNames,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.show("Failed to create group chat: " + (json?.error || `HTTP ${res.status}`), "error");
        return;
      }
      setShowCreateGroupForm(false);
      setGroupSelectedUserIds(new Set());
      setGroupModule("");
      setGroupDepartment("");
      const res2 = await fetch("/api/chat", { cache: "no-store" });
      const j2 = await res2.json().catch(() => null);
      if (res2.ok && j2?.success && Array.isArray(j2.messages)) {
        const sorted = [...j2.messages].sort((a, b) => a.id - b.id);
        setMessages(sorted);
        const maxId = sorted.reduce((acc, m) => (m.id && m.id > acc ? m.id : acc), 0);
        if (maxId) setLastSeenId(maxId);
      }
      const newGroupKey = groupKeyFromRecipients(recipientNames);
      setSelectedConversation(newGroupKey || "all");
    } catch (err) {
      toast.show("Failed to create group chat: " + (err?.message || String(err)), "error");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!canDeleteGroup || selectedConversationMessageIds.length === 0) return;
    if (!confirm("Delete this entire group conversation? This cannot be undone.")) return;
    try {
      setDeletingGroup(true);
      const res = await fetch("/api/chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: selectedConversationMessageIds }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.show("Failed to delete group: " + (json?.error || `HTTP ${res.status}`), "error");
        return;
      }
      const res2 = await fetch("/api/chat", { cache: "no-store" });
      const j2 = await res2.json().catch(() => null);
      if (res2.ok && j2?.success && Array.isArray(j2.messages)) {
        const sorted = [...j2.messages].sort((a, b) => a.id - b.id);
        setMessages(sorted);
        // Select another remaining conversation (prefer non-Broadcast)
        const keySet = new Map();
        for (const m of sorted) {
          const mode = String(m.recipient_mode || "all").toLowerCase();
          let key = mode === "all" ? "all" : null;
          if (!key && mode === "selected" && Array.isArray(m.recipients) && m.recipients.length > 0) {
            key = groupKeyFromRecipients(m.recipients);
          }
          if (!key) key = String(m.sender_name || "").trim();
          if (!key) continue;
          const last = keySet.get(key);
          if (!last || (m.id && m.id > (last?.id || 0))) keySet.set(key, m);
        }
        const keysByRecent = [...keySet.entries()]
          .sort((a, b) => (b[1]?.id || 0) - (a[1]?.id || 0))
          .map(([k]) => k);
        const nextConv = keysByRecent.find((k) => k !== "all") || keysByRecent[0] || "all";
        setSelectedConversation(nextConv);
      }
    } catch (err) {
      toast.show("Failed to delete group: " + (err?.message || String(err)), "error");
    } finally {
      setDeletingGroup(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const isGroupConv = selectedConversation && selectedConversation.startsWith("group:");
    let recipients = [];
    if (isGroupConv) {
      recipients = selectedConvObj?.recipients?.length
        ? selectedConvObj.recipients
        : recipientsFromGroupKey(selectedConversation);
      if (recipients.length === 0) {
        toast.show("Cannot send: this group has no recipients. Please select a valid group chat.", "error");
        return;
      }
    }
    const recipientMode = isGroupConv ? "selected" : "all";
    const recipientsPayload = recipientMode === "selected" ? recipients : [];

    try {
      setSending(true);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          recipientMode,
          recipients: recipientsPayload,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.show("Failed to send chat: " + (json?.error || `HTTP ${res.status}`), "error");
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
      toast.show("Failed to send chat: " + (err?.message || String(err)), "error");
    } finally {
      setSending(false);
    }
  };

  const [mobileShowChat, setMobileShowChat] = useState(false);

  const handleToggleChat = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setIsOpen((prev) => {
      if (!prev) setMobileShowChat(true);
      return !prev;
    });
    if (isOpen) setMobileShowChat(false);
  };

  const handleSelectConversation = (convKey) => {
    setSelectedConversation(convKey);
    const maxId = messages.reduce((acc, m) => (m.id && m.id > acc ? m.id : acc), lastSeenId || 0);
    if (maxId) setLastSeenId(maxId);
    setMobileShowChat(true);
  };

  const handleBackToList = () => {
    setMobileShowChat(false);
    setShowCreateGroupForm(false);
  };

  return (
    <>
      {/* Floating Chat Button - responsive position & size */}
      <button
        type="button"
        onClick={handleToggleChat}
        className="fixed left-4 bottom-4 sm:left-6 sm:bottom-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#141D38] to-[#1a2647] text-white shadow-xl sm:shadow-2xl hover:shadow-2xl transition-shadow duration-200 hover:scale-105 active:scale-95 items-center justify-center group cursor-pointer flex z-[9999]"
        style={{ padding: "env(safe-area-inset-bottom, 0) env(safe-area-inset-right, 0)" }}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        <span className="text-xl sm:text-2xl pointer-events-none">💬</span>
        {hasUnreadByConv.size > 0 && (
          <div className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] sm:w-5 sm:h-5 px-1 sm:px-0 flex items-center justify-center bg-red-500 rounded-full border-2 border-white shadow pointer-events-none">
            <span className="text-[10px] text-white font-bold">{hasUnreadByConv.size > 9 ? "9+" : hasUnreadByConv.size}</span>
          </div>
        )}
        <span className="absolute left-full ml-2 sm:ml-3 px-2 sm:px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg hidden sm:block">
          {isOpen ? "Close Chat" : "Open Chat"}
        </span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 sm:bg-black/10 overflow-hidden overscroll-none z-[9997]"
          onClick={() => { setIsOpen(false); setMobileShowChat(false); }}
          aria-hidden
        />
      )}

      {isOpen && (
        <aside
          className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 flex flex-col z-[9998] bg-white sm:rounded-2xl sm:shadow-2xl sm:max-w-[95vw] sm:w-[840px] sm:max-h-[90vh] sm:border sm:border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full h-full sm:max-h-[90vh] bg-white flex flex-col overflow-hidden sm:rounded-2xl">
            {/* Header */}
            <div className="px-3 sm:px-5 pt-3 sm:pt-5 pb-2 sm:pb-3 border-b border-gray-200/60 flex items-center justify-between gap-2 bg-gradient-to-r from-[#141D38] to-[#1a2647] text-white flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {mobileShowChat && (
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="md:hidden w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center flex-shrink-0"
                    aria-label="Back to conversations"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center shadow flex-shrink-0">
                  <span className="text-base sm:text-lg">💬</span>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider truncate">
                    Team Chat
                  </div>
                  <div className="text-sm sm:text-base font-bold text-white truncate">
                    {mobileShowChat && selectedConvObj?.label ? selectedConvObj.label : isAdmin ? "Admin Broadcast" : "Channel"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setIsOpen(false); setMobileShowChat(false); }}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center flex-shrink-0 transition-colors"
                aria-label="Close chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Two columns: list (left) + chat (right). On mobile show one at a time via mobileShowChat */}
            <div className="flex flex-1 min-h-0 overflow-hidden border-b border-gray-100/60">
              {/* Left: conversations list - hidden on mobile when viewing chat */}
              <div
                className={`${mobileShowChat ? "hidden md:flex" : "flex"} w-full md:w-[220px] lg:w-[240px] border-r border-gray-200/60 flex-col bg-gradient-to-b from-gray-50/80 to-white flex-shrink-0 min-h-0`}
              >
                  {/* Create group chat */}
                  <div className="px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-200/60 bg-white/50">
                    <button
                      type="button"
                      onClick={() => { setShowCreateGroupForm(true); setMobileShowChat(true); }}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition-transform"
                    >
                      <span>➕</span>
                      <span>Create group chat</span>
                    </button>
                  </div>

                  {/* Conversations list */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="px-2 pt-3 pb-3 space-y-1">
                      {loadingMessages && (
                        <div className="text-xs text-gray-500 py-2 px-3 text-center">
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
                          <span className="ml-2">Loading messages...</span>
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
                              onClick={() => handleSelectConversation(conv.key)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors duration-200 ${
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
                          No messages yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Create group form + info + chat - on mobile only visible when conversation selected */}
                <div className={`${!mobileShowChat ? "hidden md:flex" : "flex"} flex-1 flex-col bg-white overflow-hidden min-h-0`}
                >
                  {/* Create group chat form */}
                  {showCreateGroupForm && (
                    <div className="px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-200/60 bg-gradient-to-r from-blue-50/50 to-white space-y-3 sm:space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-gray-800 uppercase tracking-wide truncate">
                          Create group chat
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateGroupForm(false);
                            setGroupSelectedUserIds(new Set());
                            setGroupModule("");
                            setGroupDepartment("");
                          }}
                          className="text-gray-500 hover:text-gray-700 text-xs flex-shrink-0 py-1"
                        >
                          ✕ Close
                        </button>
                      </div>
                      <form onSubmit={handleCreateGroupSave} className="space-y-2 sm:space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Select users</label>
                          <div className="max-h-24 sm:max-h-28 overflow-y-auto rounded-lg sm:rounded-xl border border-gray-200/60 bg-white px-2 sm:px-3 py-2 custom-scrollbar">
                            {loadingUsers ? (
                              <div className="text-xs text-gray-500 py-2 text-center">Loading users...</div>
                            ) : sortedUsers.length === 0 ? (
                              <div className="text-xs text-gray-400 py-2 text-center">No users yet.</div>
                            ) : (
                              sortedUsers.map((u) => (
                                <label key={u.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-blue-50/50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                    checked={groupSelectedUserIds.has(String(u.id))}
                                    onChange={() => toggleGroupUser(String(u.id))}
                                  />
                                  <span className="text-xs font-medium text-gray-800 truncate">{u.name}</span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Module</label>
                          <select
                            value={groupModule}
                            onChange={(e) => setGroupModule(e.target.value)}
                            className="w-full text-xs rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[36px]"
                          >
                            <option value="">— Select module —</option>
                            {MODULES.map((m) => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Department</label>
                          <select
                            value={groupDepartment}
                            onChange={(e) => setGroupDepartment(e.target.value)}
                            className="w-full text-xs rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[36px]"
                          >
                            <option value="">— Select department —</option>
                            {DEPARTMENTS.map((d) => (
                              <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="submit"
                          disabled={savingGroup || groupSelectedUserIds.size === 0 || !groupModule || !groupDepartment}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#141D38] to-[#1a2647] text-white text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingGroup ? "Saving..." : "Save"}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Pinned group description + Delete group button */}
                  <div className="sticky top-0 z-10 px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200/60 bg-gray-50/50 flex items-stretch gap-2 sm:gap-3 flex-wrap flex-shrink-0">
                    {groupDescriptionText ? (
                      <div className="flex-1 min-w-0 flex items-start gap-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/90 border border-amber-300/80 sm:border-2 shadow px-2.5 sm:px-3 py-2 sm:py-2.5">
                        <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500 flex items-center justify-center text-white" aria-hidden>
                          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2a2 2 0 01-2 2h-2v4l-2-2v-2H7a2 2 0 01-2-2V5z" />
                          </svg>
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700/90 mb-0.5">Pinned — Group info</div>
                          <div className="text-[11px] sm:text-xs text-gray-800 font-semibold leading-snug whitespace-pre-wrap break-words line-clamp-2 sm:line-clamp-none">
                            {groupDescriptionText}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0 min-h-[1.5rem] sm:min-h-[2rem]" />
                    )}
                    {canDeleteGroup && (
                      <button
                        type="button"
                        onClick={handleDeleteGroup}
                        disabled={deletingGroup}
                        className="self-center text-red-600 hover:text-red-700 font-semibold text-[11px] sm:text-xs disabled:opacity-50 flex-shrink-0 py-1.5 px-2"
                      >
                        {deletingGroup ? "Deleting..." : "Delete group"}
                      </button>
                    )}
                  </div>

                  {/* Chat messages: description sticky at top, rest scroll */}
                  <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-2 bg-gradient-to-b from-gray-50/50 via-white to-gray-50/30 custom-scrollbar min-h-0 flex flex-col"
                  >
                    {(() => {
                      const filtered = messages.filter((m) => {
                        const mode = String(m.recipient_mode || "all").toLowerCase();
                        const sender = String(m.sender_name || "").trim();
                        if (selectedConversation === "all") return mode === "all";
                        if (selectedConversation?.startsWith("group:")) {
                          if (mode !== "selected" || !Array.isArray(m.recipients)) return false;
                          return sameGroupRecipients(m.recipients, recipientsFromGroupKey(selectedConversation));
                        }
                        if (sender === selectedConversation) return true;
                        if (sender === currentName && mode !== "all") return true;
                        return false;
                      });
                      const sorted = [...filtered].sort((a, b) => (a.id || 0) - (b.id || 0));
                      const isGroup = selectedConversation?.startsWith("group:");
                      const descMsg = isGroup && sorted[0]?.message?.startsWith("📋 Group Chat") ? sorted[0] : null;
                      const restMsgs = descMsg ? sorted.slice(1) : sorted;

                      return (
                        <>
                          {restMsgs.map((m) => {
                            const sender = String(m.sender_name || "").trim();
                            const isMe = currentName && sender.toLowerCase() === currentName.toLowerCase();
                            return (
                              <div
                                key={m.id}
                                className={`flex mb-2 text-xs ${isMe ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`max-w-[85%] sm:max-w-[75%] px-3 py-2 rounded-2xl shadow-sm ${
                                    isMe
                                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white border border-blue-400/30"
                                      : "bg-white border border-gray-200 text-gray-800 shadow-sm"
                                  }`}
                                >
                                  {!isMe && (
                                    <div className={`font-bold text-[10px] mb-1 ${isMe ? "text-blue-100" : "text-gray-600"}`}>
                                      {sender || "Unknown"}
                                    </div>
                                  )}
                                  <div className={`whitespace-pre-wrap break-words leading-relaxed ${isMe ? "text-white" : "text-gray-800"}`}>
                                    {m.message}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                    {messages.filter((m) => {
                      const mode = String(m.recipient_mode || "all").toLowerCase();
                      const sender = String(m.sender_name || "").trim();
                      if (selectedConversation === "all") return mode === "all";
                      if (selectedConversation?.startsWith("group:")) {
                        if (mode !== "selected" || !Array.isArray(m.recipients)) return false;
                        return sameGroupRecipients(m.recipients, recipientsFromGroupKey(selectedConversation));
                      }
                      if (sender === selectedConversation) return true;
                      if (sender === currentName && mode !== "all") return true;
                      return false;
                    }).length === 0 && (
                      <div className="flex items-center justify-center h-full text-xs text-gray-400">
                        No messages in this conversation.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat input */}
              <form
                onSubmit={handleSend}
                className="px-3 sm:px-4 py-3 sm:py-4 border-t border-gray-200/60 flex flex-col gap-2 sm:gap-3 bg-gradient-to-r from-white to-gray-50/50 flex-shrink-0"
              >
                <textarea
                  rows={2}
                  className="w-full text-xs rounded-xl border-2 border-gray-200 px-3 sm:px-4 py-2 sm:py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-inner bg-white min-h-[44px]"
                  placeholder={
                    isAdmin
                      ? "Type a message to the team..."
                      : "Type a message to admin / team..."
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-[10px] text-gray-400 flex items-center gap-1 min-w-0 order-2 sm:order-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="truncate hidden sm:inline">Chat is stored in the database</span>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-[#141D38] to-[#1a2647] text-white text-xs font-bold shadow-lg hover:shadow-xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 ml-auto"
                    disabled={sending || !message.trim()}
                  >
                    {sending ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>Send</span>
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


