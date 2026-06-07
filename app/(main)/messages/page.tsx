"use client";

import React, { use, useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { useNotifications } from "@/components/notification-provider";
import { createClient } from "@/lib/supabase";
import { convertToWebP } from "@/lib/image-utils";
import UserAvatar from "@/components/user-avatar";
import EmptyState from "@/components/empty-state";
import LoadingSpinner from "@/components/loading-spinner";
import { Send, Image as ImageIcon, MessageSquare, ArrowLeft, X, Pencil, Trash2, Check, Mail } from "lucide-react";
import { format } from "date-fns";

interface MessagesPageProps {
  searchParams: Promise<{ chat?: string }>;
}

interface ChatParticipant {
  conversation_id: string;
  user_id: string;
  profiles: {
    id: string;
    full_name: string;
    username: string;
    profile_picture_url: string | null;
  };
}

interface DBMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
    profile_picture_url: string | null;
  };
}

type ReactionEmoji = "Like" | "Love" | "Care" | "Haha" | "Wow" | "Sad" | "Angry";

const EMOJIS: Record<ReactionEmoji, string> = {
  Like: "👍",
  Love: "❤️",
  Care: "🤗",
  Haha: "😂",
  Wow: "😮",
  Sad: "😢",
  Angry: "😡",
};

interface MessageReaction {
  message_id: string;
  user_id: string;
  type: ReactionEmoji;
}

export default function MessagesPage({ searchParams }: MessagesPageProps) {
  const { chat: targetUserId } = use(searchParams);
  const { user, profile } = useAuth();
  const { chatNotifications, markChatAsRead, markChatAsUnread } = useNotifications();

  const [conversations, setConversations] = useState<ChatParticipant[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activePartner, setActivePartner] = useState<ChatParticipant["profiles"] | null>(null);
  
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>({});
  const [inputText, setInputText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeMsgHoverId, setActiveMsgHoverId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Fetch conversations list
  const fetchConversationsList = useCallback(async () => {
    if (!user) return;
    setLoadingChats(true);
    try {
      // Find conversations user participates in
      const { data: participations, error: partErr } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (partErr) throw partErr;

      const conversationIds = (participations || []).map((p) => p.conversation_id);

      if (conversationIds.length === 0) {
        setConversations([]);
        setLoadingChats(false);
        return;
      }

      const { data: partners, error: partnersErr } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id, profiles(*)")
        .neq("user_id", user.id)
        .in("conversation_id", conversationIds);

      if (partnersErr) throw partnersErr;
      setConversations((partners as unknown as ChatParticipant[]) || []);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingChats(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConversationsList();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchConversationsList]);

  // 2. Handle ?chat=targetUserId route parameter logic to open/create conversation
  useEffect(() => {
    if (!user || !targetUserId || loadingChats) return;

    const initializeChatWithPartner = async () => {
      try {
        // Check if conversation already exists with this partner
        const existingPartnerChat = conversations.find((c) => c.user_id === targetUserId);

        if (existingPartnerChat) {
          setActiveConversationId(existingPartnerChat.conversation_id);
          setActivePartner(existingPartnerChat.profiles);
          return;
        }

        // Check database directly just in case (e.g. if list is empty or loading delay)
        const { data: userConvs } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", user.id);

        const convIds = (userConvs || []).map((c) => c.conversation_id);

        if (convIds.length > 0) {
          const { data: partnerConv } = await supabase
            .from("conversation_participants")
            .select("conversation_id, user_id, profiles(*)")
            .neq("user_id", user.id)
            .eq("user_id", targetUserId)
            .in("conversation_id", convIds)
            .maybeSingle();

          if (partnerConv) {
            setActiveConversationId(partnerConv.conversation_id);
            setActivePartner(partnerConv.profiles as unknown as ChatParticipant["profiles"]);
            await fetchConversationsList();
            return;
          }
        }

        // If not found, create new conversation
        const newConvId = typeof window !== "undefined" && window.crypto && window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
              const r = (Math.random() * 16) | 0;
              const v = c === "x" ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });

        const { error: newConvErr } = await supabase
          .from("conversations")
          .insert({ id: newConvId });

        if (newConvErr) throw newConvErr;

        // Add participants
        const participantRows = [
          { conversation_id: newConvId, user_id: user.id },
          { conversation_id: newConvId, user_id: targetUserId },
        ];

        const { error: partErr } = await supabase
          .from("conversation_participants")
          .insert(participantRows);

        if (partErr) throw partErr;

        setActiveConversationId(newConvId);

        // Fetch partner details to set partner state
        const { data: partnerProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", targetUserId)
          .single();

        setActivePartner(partnerProfile);
        await fetchConversationsList();
      } catch (err) {
        console.error("Failed to initialize chat:", err);
      }
    };

    initializeChatWithPartner();
  }, [targetUserId, user, conversations, loadingChats, supabase, fetchConversationsList]);

  // 3. Fetch messages for active conversation
  useEffect(() => {
    if (!activeConversationId) {
      const timer = setTimeout(() => {
        setMessages([]);
        setReactions({});
      }, 0);
      return () => clearTimeout(timer);
    }

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        // Fetch messages
        const { data: msgData, error: msgError } = await supabase
          .from("messages")
          .select("*, profiles(*)")
          .eq("conversation_id", activeConversationId)
          .order("created_at", { ascending: true });

        if (msgError) throw msgError;
        setMessages((msgData as unknown as DBMessage[]) || []);

        // Fetch message reactions
        const messageIds = (msgData || []).map((m) => m.id);
        if (messageIds.length > 0) {
          const { data: rxData } = await supabase
            .from("message_reactions")
            .select("*")
            .in("message_id", messageIds);

          const grouped: Record<string, MessageReaction[]> = {};
          (rxData || []).forEach((r: MessageReaction) => {
            if (!grouped[r.message_id]) {
              grouped[r.message_id] = [];
            }
            grouped[r.message_id].push(r);
          });
          setReactions(grouped);
        }

        // Mark as read in DB and local state
        if (activePartner) {
          markChatAsRead(activePartner.id);
        }
      } catch (err) {
        console.error("Error loading chat messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();

    // 4. Real-time subscription to active conversation messages
    let channel = supabase.channel(`active-chat-${activeConversationId}`);

    channel = channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeConversationId}`,
      },
      async (payload: { new: Record<string, unknown> }) => {
        const newRow = payload.new as {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string | null;
          image_url: string | null;
          created_at: string;
        };

        // Fetch sender details to append to message bubble
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("full_name, profile_picture_url")
          .eq("id", newRow.sender_id)
          .single();

        const newMsg: DBMessage = {
          id: newRow.id,
          conversation_id: newRow.conversation_id,
          sender_id: newRow.sender_id,
          content: newRow.content,
          image_url: newRow.image_url,
          created_at: newRow.created_at,
          profiles: senderProfile || {
            full_name: "Someone",
            profile_picture_url: null,
          },
        };

        setMessages((prev) => {
          // Check if there is an optimistic match to replace
          const optimisticIndex = prev.findIndex(
            (m) =>
              m.id.startsWith("optimistic-") &&
              (m.content === newMsg.content || (m.image_url && newMsg.image_url))
          );
          if (optimisticIndex > -1) {
            const next = [...prev];
            next[optimisticIndex] = newMsg;
            return next;
          }
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        // Mark as read in real-time if it's from our active chat partner
        if (activePartner && newMsg.sender_id === activePartner.id) {
          markChatAsRead(activePartner.id);
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeConversationId}`,
      },
      (payload) => {
        const updatedMsg = payload.new as DBMessage;
        setMessages((prev) =>
          prev.map((m) => (m.id === updatedMsg.id ? { ...m, content: updatedMsg.content } : m))
        );
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeConversationId}`,
      },
      (payload) => {
        const deletedMsg = payload.old as { id: string };
        setMessages((prev) => prev.filter((m) => m.id !== deletedMsg.id));
      }
    );

    channel = channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "message_reactions",
      },
      (payload: { new: Record<string, unknown> }) => {
        const newRx = payload.new as unknown as MessageReaction;
        setReactions((prev) => ({
          ...prev,
          [newRx.message_id]: [...(prev[newRx.message_id] || []), newRx],
        }));
      }
    );

    channel = channel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "message_reactions",
      },
      (payload: { old: Record<string, unknown> }) => {
        const oldRx = payload.old as unknown as MessageReaction;
        setReactions((prev) => {
          const list = prev[oldRx.message_id] || [];
          return {
            ...prev,
            [oldRx.message_id]: list.filter((r) => r.user_id !== oldRx.user_id),
          };
        });
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, supabase, activePartner, markChatAsRead]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationId || (!inputText.trim() && !imageFile) || sending) return;
    
    const textToSend = inputText.trim();
    const previewToSend = imagePreview;

    // Create optimistic message to show immediately
    const optimisticMsg: DBMessage = {
      id: `optimistic-${Date.now()}`,
      conversation_id: activeConversationId,
      sender_id: user!.id,
      content: textToSend || null,
      image_url: previewToSend || null,
      created_at: new Date().toISOString(),
      profiles: {
        full_name: profile?.full_name || "Me",
        profile_picture_url: profile?.profile_picture_url || null,
      },
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setImageFile(null);
    setImagePreview(null);
    setSending(true);

    try {
      let imageUrl = null;

      // Upload image attachment if any
      if (imageFile) {
        const converted = await convertToWebP(imageFile);
        const ext = converted.name.split(".").pop();
        const path = `${user!.id}/chat-${activeConversationId}-${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("posts") // using same bucket for messages attachments
          .upload(path, converted);

        if (uploadErr) throw uploadErr;

        const { data } = supabase.storage.from("posts").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }

      // Insert message
      const { error } = await supabase.from("messages").insert({
        conversation_id: activeConversationId,
        sender_id: user!.id,
        content: textToSend || null,
        image_url: imageUrl,
      });

      if (error) throw error;

      // Trigger notification to partner
      if (activePartner) {
        await supabase.from("notifications").insert({
          user_id: activePartner.id,
          sender_id: user!.id,
          type: "message",
          target_type: "message",
          target_id: activeConversationId,
        });
      }

      if (previewToSend) {
        URL.revokeObjectURL(previewToSend);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      // Remove optimistic message if insert fails
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleReactToMessage = async (messageId: string, emoji: ReactionEmoji) => {
    if (!user) return;

    try {
      const existingReaction = reactions[messageId]?.find((r) => r.user_id === user.id);

      if (existingReaction && existingReaction.type === emoji) {
        // Delete reaction if clicking same emoji
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Add or change reaction
        const { error } = await supabase.from("message_reactions").upsert(
          {
            message_id: messageId,
            user_id: user.id,
            type: emoji,
          },
          { onConflict: "message_id,user_id" }
        );

        if (error) throw error;
      }
    } catch (err) {
      console.error("Failed to react to message:", err);
    }
  };

  const handleEditMessage = async (msgId: string) => {
    if (!editingText.trim()) return;
    try {
      const { error } = await supabase
        .from("messages")
        .update({ content: editingText.trim() })
        .eq("id", msgId);
      
      if (error) throw error;
      setEditingMessageId(null);
      setEditingText("");
    } catch (err) {
      console.error("Failed to edit message:", err);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", msgId);
      
      if (error) throw error;
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  return (
    <div className="bg-card border border-border/40 rounded-3xl overflow-hidden glass shadow-sm h-[calc(100vh-8rem)] flex animate-in fade-in duration-300">
      {/* 1. Left Conversation Sidebar List */}
      <div
        className={`${
          activeConversationId ? "hidden md:flex" : "flex"
        } w-full md:w-80 border-r border-border/40 flex-col shrink-0 bg-background/20`}
      >
        <div className="p-4 border-b border-border/40 shrink-0 flex items-center justify-between">
          <h2 className="text-md font-bold text-foreground">Conversations</h2>
        </div>

        {loadingChats ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size={24} />
          </div>
        ) : conversations.length > 0 ? (
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
            {conversations.map((c) => {
              const isActive = activeConversationId === c.conversation_id;
              const partnerUnreadCount = chatNotifications.filter((n) => n.sender_id === c.profiles.id).length;
              return (
                <div
                  key={c.conversation_id}
                  onClick={() => {
                    setActiveConversationId(c.conversation_id);
                    setActivePartner(c.profiles);
                    markChatAsRead(c.profiles.id);
                  }}
                  className={`group w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-colors cursor-pointer ${
                    isActive ? "bg-primary text-primary-foreground shadow-sm shadow-primary/15" : "hover:bg-secondary"
                  }`}
                >
                  <UserAvatar
                    src={c.profiles.profile_picture_url}
                    name={c.profiles.full_name}
                    size={38}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-bold leading-normal truncate ${isActive ? "text-primary-foreground" : "text-foreground"}`}>
                        {c.profiles.full_name}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {partnerUnreadCount > 0 ? (
                          <span className="bg-rose-500 text-white rounded-full text-[9px] px-2 py-0.5 font-bold leading-none shrink-0 animate-pulse">
                            {partnerUnreadCount}
                          </span>
                        ) : (
                          <button
                            title="Mark as Unread"
                            onClick={(e) => {
                              e.stopPropagation();
                              markChatAsUnread(c.profiles.id, c.conversation_id);
                            }}
                            className={`p-1 rounded-lg hover:bg-secondary border border-transparent transition-colors text-muted hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 shrink-0 ${
                              isActive ? "hover:bg-primary-foreground/10 text-primary-foreground/60 hover:text-primary-foreground" : ""
                            }`}
                          >
                            <Mail size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className={`text-[10px] truncate leading-none mt-1 ${isActive ? "text-primary-foreground/70" : "text-muted"}`}>
                      @{c.profiles.username}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 p-6">
            <EmptyState
              icon={MessageSquare}
              title="No Active Chats"
              description="Click message on a friend's profile to start a conversation."
            />
          </div>
        )}
      </div>

      {/* 2. Right Conversation Window */}
      <div
        className={`${
          !activeConversationId ? "hidden md:flex" : "flex"
        } flex-1 flex-col h-full bg-background/10`}
      >
        {activeConversationId && activePartner ? (
          <>
            {/* Header bar */}
            <div className="p-4 border-b border-border/40 shrink-0 flex items-center justify-between bg-card/40 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveConversationId(null);
                    setActivePartner(null);
                  }}
                  className="p-1.5 border border-border/50 rounded-xl hover:bg-secondary text-foreground md:hidden transition-colors cursor-pointer mr-1"
                >
                  <ArrowLeft size={14} />
                </button>
                <UserAvatar
                  src={activePartner.profile_picture_url}
                  name={activePartner.full_name}
                  size={36}
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">
                    {activePartner.full_name}
                  </span>
                  <span className="text-[9px] text-muted">
                    @{activePartner.username}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages body thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/5">
              {loadingMessages ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size={24} />
                </div>
              ) : messages.length > 0 ? (
                messages.map((m) => {
                  const isMe = m.sender_id === user!.id;
                  const isEditing = editingMessageId === m.id;
                  const msgRx = reactions[m.id] || [];

                  return (
                    <div
                      key={m.id}
                      className={`flex gap-2.5 items-end max-w-[85%] ${
                        isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                      }`}
                    >
                      {!isMe && (
                        <UserAvatar
                          src={m.profiles?.profile_picture_url}
                          name={m.profiles?.full_name}
                          size={28}
                        />
                      )}

                      <div
                        className="relative group"
                        onMouseEnter={() => setActiveMsgHoverId(m.id)}
                        onMouseLeave={() => setActiveMsgHoverId(null)}
                      >
                        {/* Bubble */}
                        <div
                          className={`p-3.5 rounded-2xl border text-xs shadow-sm ${
                            isMe
                              ? "bg-primary text-primary-foreground border-primary/20 rounded-br-none"
                              : "bg-secondary border-border/30 rounded-bl-none"
                          }`}
                        >
                          {/* Image Attachment */}
                          {m.image_url && (
                            <div className="relative aspect-video rounded-xl overflow-hidden mb-2 max-w-[240px]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.image_url}
                                alt="Chat attachment"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          {isEditing ? (
                            <div className="flex items-center gap-1.5 min-w-[200px]">
                              <input
                                type="text"
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="flex-1 bg-background text-foreground border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
                                autoFocus
                              />
                              <button
                                onClick={() => handleEditMessage(m.id)}
                                className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded cursor-pointer"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={() => setEditingMessageId(null)}
                                className="p-1 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            m.content && <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                          )}
                          
                          <span
                            className={`block text-[9px] mt-1.5 leading-none ${
                              isMe ? "text-primary-foreground/60 text-right" : "text-muted"
                            }`}
                          >
                            {format(new Date(m.created_at), "h:mm a")}
                          </span>
                        </div>

                        {/* Reaction summary on bubble */}
                        {msgRx.length > 0 && (
                          <div
                            className={`absolute bottom-[-10px] flex -space-x-1.5 bg-card border border-border/60 rounded-full px-1.5 py-0.5 shadow-sm text-[10px] leading-none ${
                              isMe ? "left-2" : "right-2"
                            }`}
                          >
                            {msgRx.map((rx) => (
                              <span key={rx.user_id} title={rx.type}>
                                {EMOJIS[rx.type]}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Hover emoji reactions and message actions overlay */}
                        {activeMsgHoverId === m.id && !isEditing && (
                          <div
                            className={`absolute top-[-36px] bg-card border border-border rounded-full px-2.5 py-1 shadow-md flex items-center gap-1 z-10 glass animate-in fade-in slide-in-from-bottom-1 duration-150 ${
                              isMe ? "right-2" : "left-2"
                            }`}
                          >
                            {Object.keys(EMOJIS).map((emojiName) => (
                              <button
                                key={emojiName}
                                onClick={() =>
                                  handleReactToMessage(m.id, emojiName as ReactionEmoji)
                                }
                                className="hover:scale-135 transition-transform text-sm cursor-pointer select-none"
                              >
                                {EMOJIS[emojiName as ReactionEmoji]}
                              </button>
                            ))}
                            <div className="w-[1px] h-3.5 bg-border/80 mx-1 shrink-0" />
                            {isMe && (
                              <button
                                onClick={() => {
                                  setEditingMessageId(m.id);
                                  setEditingText(m.content || "");
                                  setActiveMsgHoverId(null);
                                }}
                                className="p-0.5 rounded text-muted hover:text-foreground cursor-pointer hover:bg-secondary shrink-0"
                                title="Edit"
                              >
                                <Pencil size={11} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteMessage(m.id)}
                              className="p-0.5 rounded text-muted hover:text-rose-500 cursor-pointer hover:bg-rose-500/10 shrink-0"
                              title="Delete"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  icon={MessageSquare}
                  title="No Messages"
                  description="Send a message to start the conversation."
                />
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input message form footer */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-border/40 shrink-0 bg-card/30 flex flex-col gap-3">
              {/* Image Previews */}
              {imagePreview && (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-border bg-secondary shrink-0 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Image attachment" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-rose-500 rounded-full text-white cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}

              <div className="flex gap-2 items-center">
                {/* File attachment upload button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 border border-border/50 rounded-xl hover:bg-secondary text-muted hover:text-foreground cursor-pointer transition-colors"
                  title="Attach Image"
                >
                  <ImageIcon size={18} />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                <input
                  type="text"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 h-10 border border-border/50 focus:border-primary/50 focus:outline-none rounded-xl px-4 text-xs bg-secondary text-foreground"
                />

                <button
                  type="submit"
                  disabled={sending || (!inputText.trim() && !imageFile)}
                  className="p-3 bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl transition-all cursor-pointer disabled:opacity-50 active:scale-95 flex items-center justify-center shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyState
              icon={MessageSquare}
              title="No Conversation Selected"
              description="Pick a conversation from the sidebar or connect with friends to begin chat messages."
            />
          </div>
        )}
      </div>
    </div>
  );
}
