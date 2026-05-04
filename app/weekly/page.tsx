"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Plus, X, CheckCircle2, PauseCircle, RotateCcw,
  MessageSquare, Calendar, User
} from "lucide-react";
import ChatSidebar from "../components/ChatSidebar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── 타입 ─────────────────────────────────────────────────────
type Task = {
  id: number;
  user_id: string;
  category: string;
  title: string;
  start_date: string;
  end_date: string;
  client: string;
  status: "지난주" | "이번주" | "완료" | "대기";
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string;
  role: string;
};

// ── 카테고리 색상 ─────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  "총무관련":  "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "일반용역":  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "영업":      "bg-green-500/20 text-green-300 border-green-500/30",
  "기획":      "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "행정":      "bg-slate-500/20 text-slate-300 border-slate-500/30",
  "기타":      "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

const CATEGORIES = Object.keys(CATEGORY_COLORS);

const getCategoryStyle = (cat: string) =>
  CATEGORY_COLORS[cat] ?? "bg-slate-500/20 text-slate-300 border-slate-500/30";

// ── 업무 카드 ─────────────────────────────────────────────────
function TaskCard({
  task,
  onStatusChange,
  onChatOpen,
  isAdmin,
  myId,
}: {
  task: Task;
  onStatusChange: (id: number, status: Task["status"]) => void;
  onChatOpen: (task: Task) => void;
  isAdmin: boolean;
  myId: string;
}) {
  const canEdit = task.user_id === myId || isAdmin;
  const isActive = task.status === "지난주" || task.status === "이번주";

  return (
    <div className="group bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl p-4 transition-all duration-200">

      {/* 상단: 카테고리 + 채팅 버튼 */}
      <div className="flex items-start justify-between mb-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getCategoryStyle(task.category)}`}>
          {task.category}
        </span>
        <button
          onClick={() => onChatOpen(task)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 transition-all"
          title="이 업무 채팅 열기"
        >
          <MessageSquare size={14} />
        </button>
      </div>

      {/* 제목 */}
      <p className="text-sm font-medium text-slate-100 leading-snug mb-3">
        {task.title}
      </p>

      {/* 메타 정보 */}
      <div className="space-y-1 mb-4">
        {task.client && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <User size={11} />
            <span>{task.client}</span>
          </div>
        )}
        {(task.start_date || task.end_date) && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar size={11} />
            <span>
              {task.start_date && task.start_date.slice(5)}
              {task.start_date && task.end_date && " ~ "}
              {task.end_date && task.end_date.slice(5)}
            </span>
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      {canEdit && (
        <div className="flex gap-1.5 flex-wrap">
          {isActive && (
            <>
              <button
                onClick={() => onStatusChange(task.id, "완료")}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 transition-colors"
              >
                <CheckCircle2 size={11} /> 완료
              </button>
              <button
                onClick={() => onStatusChange(task.id, "대기")}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors"
              >
                <PauseCircle size={11} /> 대기
              </button>
            </>
          )}
          {task.status === "대기" && (
            <button
              onClick={() => onStatusChange(task.id, "이번주")}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors"
            >
              <RotateCcw size={11} /> 이번 주 재개
            </button>
          )}
          {task.status === "완료" && (
            <span className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-700/50 text-slate-500 border border-slate-700">
              <CheckCircle2 size={11} /> 완료됨
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── 컬럼 헤더 ─────────────────────────────────────────────────
function ColumnHeader({
  title, count, color, emoji,
}: {
  title: string; count: number; color: string; emoji: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-base">{emoji}</span>
      <h3 className="text-sm font-bold text-slate-200">{title}</h3>
      <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
        {count}
      </span>
    </div>
  );
}

// ── 업무 추가 모달 ─────────────────────────────────────────────
function AddTaskModal({
  onClose, onAdd, userId,
}: {
  onClose: () => void;
  onAdd: (task: Partial<Task>) => Promise<void>;
  userId: string;
}) {
  const [category, setCategory]   = useState("일반용역");
  const [title, setTitle]         = useState("");
  const [client, setClient]       = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [status, setStatus]       = useState<Task["status"]>("이번주");
  const [isSaving, setIsSaving]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { alert("업무 내용을 입력해주세요."); return; }
    setIsSaving(true);
    await onAdd({ category, title, client, start_date: startDate, end_date: endDate, status, user_id: userId });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-sm font-bold text-white">새 업무 추가</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">분류</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">초기 상태</label>
              <select value={status} onChange={e => setStatus(e.target.value as Task["status"])}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="이번주">이번 주</option>
                <option value="지난주">지난 주</option>
                <option value="대기">대기</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">업무 내용 *</label>
            <textarea value={title} onChange={e => setTitle(e.target.value)} required rows={3} placeholder="업무 내용을 입력하세요"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">거래처 / 관련자</label>
            <input type="text" value={client} onChange={e => setClient(e.target.value)} placeholder="예: OO회사"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">시작일</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">종료 예정일</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
              취소
            </button>
            <button type="submit" disabled={isSaving}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {isSaving ? "저장 중..." : <><Plus size={14} /> 추가</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────
export default function WeeklyPage() {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // 채팅
  const [chatOpen, setChatOpen]     = useState(false);
  const [chatRoomId, setChatRoomId] = useState<number | undefined>();
  const [chatRoomName, setChatRoomName] = useState<string>("");

  useEffect(() => { init(); }, []);

  const init = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setIsLoading(false); return; }

    const { data: prof } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", session.user.id)
      .single();
    if (prof) setProfile(prof);

    await fetchTasks(session.user.id, prof?.role ?? "");
    setIsLoading(false);
  };

  const fetchTasks = async (userId: string, role: string) => {
    const isAdmin = ["admin", "director"].includes(role);
    let query = supabase.from("weekly_tasks").select("*").order("created_at", { ascending: false });
    if (!isAdmin) query = query.eq("user_id", userId);
    const { data } = await query;
    setTasks(data as Task[] || []);
  };

  // 상태 변경
  const handleStatusChange = async (id: number, newStatus: Task["status"]) => {
    const { error } = await supabase
      .from("weekly_tasks")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) { alert("변경 실패: " + error.message); return; }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  // 업무 추가
  const handleAddTask = async (taskData: Partial<Task>) => {
    const { data, error } = await supabase
      .from("weekly_tasks")
      .insert([taskData])
      .select()
      .single();
    if (error) { alert("추가 실패: " + error.message); return; }
    setTasks(prev => [data as Task, ...prev]);
  };

  // 업무별 채팅방 열기
  const handleChatOpen = async (task: Task) => {
    // 해당 업무의 채팅방 찾거나 새로 생성
    const { data: existing } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("ref_type", "task")
      .eq("ref_id", task.id)
      .single();

    if (existing) {
      setChatRoomId(existing.id);
    } else {
      const { data: newRoom } = await supabase
        .from("chat_rooms")
        .insert({ name: task.title.slice(0, 30), ref_type: "task", ref_id: task.id })
        .select()
        .single();
      setChatRoomId(newRoom?.id);
    }

    setChatRoomName(task.title.slice(0, 20) + (task.title.length > 20 ? "..." : ""));
    setChatOpen(true);
  };

  // 필터링
  const byStatus = (s: Task["status"]) => tasks.filter(t => t.status === s);
  const isAdmin = ["admin", "director"].includes(profile?.role ?? "");
  const myId = profile?.id ?? "";

  // 이번 주 날짜 범위
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
  const weekEnd   = new Date(now); weekEnd.setDate(weekStart.getDate() + 4);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

  return (
    <div className="w-full animate-fade-in min-h-screen">

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">주간 업무 현황</h2>
          <p className="text-sm text-slate-500 mt-1">
            {fmt(weekStart)} ~ {fmt(weekEnd)} · {profile?.full_name ?? ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            <MessageSquare size={15} />
            전체 채팅
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-sm"
          >
            <Plus size={15} />
            업무 추가
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-slate-500">
          <svg className="animate-spin h-6 w-6 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          불러오는 중...
        </div>
      ) : (
        /* ── 2×2 그리드 ── */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* 지난주 결과 */}
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5">
            <ColumnHeader title="지난주 결과" count={byStatus("지난주").length} color="bg-slate-700 text-slate-300" emoji="📋" />
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {byStatus("지난주").length === 0
                ? <p className="text-xs text-slate-600 text-center py-8">지난주 항목 없음</p>
                : byStatus("지난주").map(t => (
                  <TaskCard key={t.id} task={t} onStatusChange={handleStatusChange} onChatOpen={handleChatOpen} isAdmin={isAdmin} myId={myId} />
                ))}
            </div>
          </div>

          {/* 금주 예정 */}
          <div className="bg-slate-900/60 border border-blue-500/20 rounded-2xl p-5">
            <ColumnHeader title="금주 예정" count={byStatus("이번주").length} color="bg-blue-500/20 text-blue-400" emoji="🎯" />
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {byStatus("이번주").length === 0
                ? <p className="text-xs text-slate-600 text-center py-8">이번 주 업무를 추가하세요</p>
                : byStatus("이번주").map(t => (
                  <TaskCard key={t.id} task={t} onStatusChange={handleStatusChange} onChatOpen={handleChatOpen} isAdmin={isAdmin} myId={myId} />
                ))}
            </div>
          </div>

          {/* 완료 */}
          <div className="bg-slate-900/60 border border-green-500/20 rounded-2xl p-5">
            <ColumnHeader title="완료" count={byStatus("완료").length} color="bg-green-500/20 text-green-400" emoji="✅" />
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {byStatus("완료").length === 0
                ? <p className="text-xs text-slate-600 text-center py-8">완료된 항목 없음</p>
                : byStatus("완료").map(t => (
                  <TaskCard key={t.id} task={t} onStatusChange={handleStatusChange} onChatOpen={handleChatOpen} isAdmin={isAdmin} myId={myId} />
                ))}
            </div>
          </div>

          {/* 대기 / 홀딩 */}
          <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl p-5">
            <ColumnHeader title="대기 · 홀딩" count={byStatus("대기").length} color="bg-amber-500/20 text-amber-400" emoji="⏸️" />
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {byStatus("대기").length === 0
                ? <p className="text-xs text-slate-600 text-center py-8">대기 항목 없음</p>
                : byStatus("대기").map(t => (
                  <TaskCard key={t.id} task={t} onStatusChange={handleStatusChange} onChatOpen={handleChatOpen} isAdmin={isAdmin} myId={myId} />
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 업무 추가 모달 */}
      {showAddModal && (
        <AddTaskModal
          userId={myId}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddTask}
        />
      )}

      {/* 실시간 채팅 사이드바 */}
      <ChatSidebar
        isOpen={chatOpen}
        onClose={() => { setChatOpen(false); setChatRoomId(undefined); setChatRoomName(""); }}
        roomId={chatRoomId}
        roomName={chatRoomName || "전체 채팅"}
      />
    </div>
  );
}
