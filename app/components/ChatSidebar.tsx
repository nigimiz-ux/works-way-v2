"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { X, Send, MessageSquare } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Message = {
  id: number;
  room_id: number;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
};

type ChatRoom = {
  id: number;
  name: string;
  ref_type: string;
  ref_id: number | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  roomId?: number;        // 특정 업무방 지정 시
  roomName?: string;      // 채팅방 제목
};

export default function ChatSidebar({ isOpen, onClose, roomId, roomName }: Props) {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState("");
  const [isSending, setIsSending]   = useState(false);
  const [myId, setMyId]             = useState("");
  const [myName, setMyName]         = useState("");
  const [currentRoomId, setCurrentRoomId] = useState<number | null>(roomId ?? null);
  const [rooms, setRooms]           = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading]   = useState(true);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);

  // ── 초기화 ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    initUser();
    fetchRooms();
  }, [isOpen]);

  // roomId prop 바뀌면 방 전환
  useEffect(() => {
    if (roomId) setCurrentRoomId(roomId);
  }, [roomId]);

  // 방 바뀌면 메시지 로드 + 실시간 구독
  useEffect(() => {
    if (!currentRoomId || !isOpen) return;
    fetchMessages(currentRoomId);
    subscribeRoom(currentRoomId);
    return () => { unsubscribe(); };
  }, [currentRoomId, isOpen]);

  // 새 메시지 올 때 스크롤 아래로
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    setMyId(session.user.id);
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .single();
    setMyName(profile?.full_name ?? session.user.email ?? "알 수 없음");
  };

  const fetchRooms = async () => {
    const { data } = await supabase
      .from("chat_rooms")
      .select("*")
      .order("id", { ascending: true });
    setRooms(data || []);
    // 방 지정 없으면 첫 번째 방(전체 채팅)으로
    if (!currentRoomId && data && data.length > 0) {
      setCurrentRoomId(data[0].id);
    }
  };

  const fetchMessages = async (rid: number) => {
    setIsLoading(true);
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("room_id", rid)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages(data || []);
    setIsLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
  };

  // ── Realtime 구독 ────────────────────────────────────────────
  const subscribeRoom = useCallback((rid: number) => {
    unsubscribe();
    channelRef.current = supabase
      .channel(`chat-room-${rid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${rid}` },
        (payload) => {
          setMessages(prev => {
            // 중복 방지
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();
  }, []);

  const unsubscribe = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  // ── 메시지 전송 ──────────────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !currentRoomId || !myId || isSending) return;
    setIsSending(true);
    setInput("");

    const { error } = await supabase.from("chat_messages").insert({
      room_id:     currentRoomId,
      sender_id:   myId,
      sender_name: myName,
      content:     text,
    });

    if (error) {
      alert("전송 실패: " + error.message);
      setInput(text);
    }
    setIsSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 시간 포맷
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

  // 날짜 구분선 표시 여부
  const showDateDivider = (idx: number) => {
    if (idx === 0) return true;
    const prev = new Date(messages[idx - 1].created_at).toDateString();
    const curr = new Date(messages[idx].created_at).toDateString();
    return prev !== curr;
  };

  if (!isOpen) return null;

  const currentRoom = rooms.find(r => r.id === currentRoomId);

  return (
    <>
      {/* 오버레이 (모바일) */}
      <div
        className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* 사이드바 본체 */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[420px] z-50 flex flex-col bg-slate-900 border-l border-slate-700/50 shadow-2xl animate-slide-in">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-900/95 backdrop-blur shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare size={16} className="text-blue-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">
                {roomName ?? currentRoom?.name ?? "채팅"}
              </h3>
              <p className="text-xs text-slate-500">
                {messages.length}개 메시지
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── 채팅방 탭 ── */}
        {rooms.length > 1 && (
          <div className="flex gap-1 px-3 py-2 border-b border-slate-700/50 overflow-x-auto shrink-0">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => setCurrentRoomId(room.id)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  currentRoomId === room.id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {room.name}
              </button>
            ))}
          </div>
        )}

        {/* ── 메시지 목록 ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              <svg className="animate-spin h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              불러오는 중...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <MessageSquare size={36} className="opacity-20 mb-3" />
              <p className="text-sm">첫 메시지를 보내보세요!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMine = msg.sender_id === myId;
              return (
                <div key={msg.id}>
                  {/* 날짜 구분선 */}
                  {showDateDivider(idx) && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-slate-700/50" />
                      <span className="text-xs text-slate-500 shrink-0 px-2">
                        {formatDate(msg.created_at)}
                      </span>
                      <div className="flex-1 h-px bg-slate-700/50" />
                    </div>
                  )}

                  {/* 말풍선 */}
                  <div className={`flex items-end gap-2 mb-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>

                    {/* 아바타 (타인만) */}
                    {!isMine && (
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0 mb-1">
                        {msg.sender_name?.charAt(0) ?? "?"}
                      </div>
                    )}

                    <div className={`flex flex-col gap-1 max-w-[75%] ${isMine ? "items-end" : "items-start"}`}>
                      {/* 이름 (타인만, 이전 메시지 같은 사람이면 생략) */}
                      {!isMine && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id) && (
                        <span className="text-xs text-slate-400 px-1">{msg.sender_name}</span>
                      )}

                      <div className="flex items-end gap-1.5">
                        {/* 시간 (내 메시지는 왼쪽) */}
                        {isMine && (
                          <span className="text-[10px] text-slate-500 mb-0.5 shrink-0">
                            {formatTime(msg.created_at)}
                          </span>
                        )}

                        {/* 말풍선 */}
                        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                          isMine
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-slate-700 text-slate-100 rounded-bl-sm"
                        }`}>
                          {msg.content}
                        </div>

                        {/* 시간 (타인 메시지는 오른쪽) */}
                        {!isMine && (
                          <span className="text-[10px] text-slate-500 mb-0.5 shrink-0">
                            {formatTime(msg.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── 입력창 ── */}
        <div className="px-3 py-3 border-t border-slate-700/50 bg-slate-900 shrink-0">
          <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2 border border-slate-700/50 focus-within:border-blue-500/50 transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요..."
              disabled={isSending}
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isSending}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-colors shrink-0"
            >
              {isSending ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5 text-center">Enter로 전송 · Shift+Enter 줄바꿈</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.25s ease-out; }
      `}</style>
    </>
  );
}
