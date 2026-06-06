"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "./auth-provider";
import { useChat } from "./chat-provider";
import { createClient } from "@/lib/supabase";
import { convertToWebP } from "@/lib/image-utils";
import UserAvatar from "./user-avatar";
import LoadingSpinner from "./loading-spinner";
import { Send, Image as ImageIcon, X, ArrowLeft, MessageSquare, Search, Sparkles } from "lucide-react";
import { format } from "date-fns";

interface DBMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
}

export default function ChatWindow() {
  const { user } = useAuth();
  const { isOpen, setIsOpen, activePartner, setActivePartner, friends, friendsStatuses } = useChat();

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle opening/creating conversation when activePartner changes
  useEffect(() => {
    if (!user || !activePartner) {
      setActiveConversationId(null);
      setMessages([]);
      return;
    }

    const initChat = async () => {
      setLoadingMessages(true);
      try {
        // Find existing conversation
        const { data: userConvs, error: userConvsErr } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", user.id);

        if (userConvsErr) throw userConvsErr;

        const convIds = (userConvs || []).map((c) => c.conversation_id);
        let foundConvId: string | null = null;

        if (convIds.length > 0) {
          const { data: partnerConv, error: partnerConvErr } = await supabase
            .from("conversation_participants")
            .select("conversation_id")
            .neq("user_id", user.id)
            .eq("user_id", activePartner.id)
            .in("conversation_id", convIds)
            .maybeSingle();

          if (partnerConvErr) throw partnerConvErr;

          if (partnerConv) {
            foundConvId = partnerConv.conversation_id;
          }
        }

        // If not found, create new conversation
        if (!foundConvId) {
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
            { conversation_id: newConvId, user_id: activePartner.id },
          ];

          const { error: partErr } = await supabase
            .from("conversation_participants")
            .insert(participantRows);

          if (partErr) throw partErr;
          foundConvId = newConvId;
        }

        setActiveConversationId(foundConvId);

        // Fetch messages for active conversation
        const { data: msgData, error: msgError } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", foundConvId)
          .order("created_at", { ascending: true });

        if (msgError) throw msgError;
        setMessages((msgData as DBMessage[]) || []);

      } catch (err: any) {
        console.error("Failed to load chat thread:", err);
        if (err && typeof err === "object") {
          console.error("Error details:", {
            message: err.message,
            details: err.details,
            hint: err.hint,
            code: err.code,
          });
        }
      } finally {
        setLoadingMessages(false);
      }
    };

    initChat();
  }, [activePartner, user, supabase]);

  // Real-time subscription to active conversation messages
  useEffect(() => {
    if (!activeConversationId) return;

    let channel = supabase.channel(`floating-chat-${activeConversationId}`);

    channel = channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeConversationId}`,
      },
      (payload) => {
        const newMsg = payload.new as DBMessage;
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
          // Avoid duplicates
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, supabase]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSend = async (e: React.FormEvent) => {
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
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setImageFile(null);
    setImagePreview(null);
    setSending(true);

    try {
      let imageUrl = null;

      if (imageFile) {
        const converted = await convertToWebP(imageFile);
        const ext = converted.name.split(".").pop();
        const path = `${user!.id}/chat-widget-${activeConversationId}-${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("posts")
          .upload(path, converted);

        if (uploadErr) throw uploadErr;

        const { data } = supabase.storage.from("posts").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: activeConversationId,
        sender_id: user!.id,
        content: textToSend || null,
        image_url: imageUrl,
      });

      if (error) throw error;

      // Trigger notification to partner
      await supabase.from("notifications").insert({
        user_id: activePartner!.id,
        sender_id: user!.id,
        type: "message",
        target_type: "message",
        target_id: activeConversationId,
      });

      if (previewToSend) {
        URL.revokeObjectURL(previewToSend);
      }
    } catch (err) {
      console.error("Failed to send floating message:", err);
      // Remove optimistic message if insert fails
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const filteredFriends = friends.filter((f) =>
    f.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed bottom-20 right-4 sm:right-6 md:bottom-6 w-80 sm:w-96 h-[480px] bg-card border border-border rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden glass animate-in slide-in-from-bottom-5 duration-200">
      
      {/* HEADER SECTION */}
      <div className="p-3 border-b border-border/40 shrink-0 flex items-center justify-between bg-card/60 backdrop-blur-md">
        {activePartner ? (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setActivePartner(null)}
              className="p-1 rounded-lg hover:bg-secondary text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <UserAvatar
              src={activePartner.profile_picture_url}
              name={activePartner.full_name}
              size={30}
              showOnlineStatus
              onlineStatus={friendsStatuses[activePartner.id]}
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground truncate max-w-[120px] leading-tight">
                {activePartner.full_name}
              </span>
              <span className="text-[8px] text-muted capitalize leading-none mt-0.5">
                {friendsStatuses[activePartner.id] || "offline"}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-primary" />
            <span className="text-xs font-bold text-foreground">Friends Chat</span>
          </div>
        )}

        <button
          onClick={() => setIsOpen(false)}
          className="p-1 rounded-lg hover:bg-secondary text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* BODY SECTION */}
      {activePartner ? (
        // Message thread view
        <div className="flex-1 flex flex-col min-h-0 bg-background/5">
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {loadingMessages ? (
              <div className="flex justify-center items-center h-full">
                <LoadingSpinner size={20} />
              </div>
            ) : messages.length > 0 ? (
              messages.map((m) => {
                const isMe = m.sender_id === user!.id;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[80%] ${
                      isMe ? "ml-auto items-end" : "mr-auto items-start"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-2xl border text-xs shadow-sm ${
                        isMe
                          ? "bg-primary text-primary-foreground border-primary/20 rounded-br-none"
                          : "bg-secondary border-border/30 rounded-bl-none"
                      }`}
                    >
                      {m.image_url && (
                        <div className="relative aspect-video rounded-lg overflow-hidden mb-1.5 max-w-[180px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.image_url} alt="Chat attachment" className="w-full h-full object-cover" />
                        </div>
                      )}
                      {m.content && <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>}
                    </div>
                    <span className="text-[8px] text-muted/80 mt-1 leading-none">
                      {format(new Date(m.created_at), "h:mm a")}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted p-4 text-center">
                <Sparkles size={24} className="text-muted/40 mb-2" />
                <p className="text-[10px] font-semibold">Start chatting with {activePartner.full_name}</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Attachment preview */}
          {imagePreview && (
            <div className="px-3 py-1.5 bg-secondary/30 border-t border-border/20 flex gap-2 items-center shrink-0">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 hover:bg-rose-500 rounded-full text-white cursor-pointer"
                >
                  <X size={8} />
                </button>
              </div>
              <span className="text-[9px] text-muted truncate">Image ready to send</span>
            </div>
          )}

          {/* Form input footer */}
          <form onSubmit={handleSend} className="p-2.5 border-t border-border/40 shrink-0 bg-card/40 flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 border border-border/50 rounded-xl hover:bg-secondary text-muted hover:text-foreground cursor-pointer transition-colors"
              title="Attach Image"
            >
              <ImageIcon size={14} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <input
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 h-8 border border-border/50 focus:border-primary/50 focus:outline-none rounded-xl px-3 text-[11px] bg-secondary text-foreground"
            />
            <button
              type="submit"
              disabled={sending || (!inputText.trim() && !imageFile)}
              className="p-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center shrink-0"
            >
              <Send size={12} />
            </button>
          </form>
        </div>
      ) : (
        // Friends list view
        <div className="flex-1 flex flex-col min-h-0 bg-background/5">
          {/* Search friends bar */}
          <div className="p-2 border-b border-border/30 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 bg-secondary border border-border/30 rounded-xl pl-8 pr-3 text-[11px] focus:outline-none focus:border-primary/30"
              />
            </div>
          </div>

          {/* Friends list container */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredFriends.length > 0 ? (
              filteredFriends.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => setActivePartner(friend)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-secondary transition-colors cursor-pointer"
                >
                  <UserAvatar
                    src={friend.profile_picture_url}
                    name={friend.full_name}
                    size={32}
                    showOnlineStatus
                    onlineStatus={friendsStatuses[friend.id]}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-foreground truncate">
                      {friend.full_name}
                    </p>
                    <p className="text-[9px] text-muted truncate">
                      @{friend.username}
                    </p>
                  </div>
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      friendsStatuses[friend.id] === "online"
                        ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                        : friendsStatuses[friend.id] === "busy"
                        ? "bg-rose-500 shadow-sm shadow-rose-500/50"
                        : "bg-gray-400"
                    }`}
                  />
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center text-muted p-8 text-center h-full">
                <MessageSquare size={24} className="text-muted/40 mb-2" />
                <p className="text-[10px] font-medium">No friends found</p>
                <p className="text-[9px] text-muted mt-0.5">Connect with people in Friends tab first.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
