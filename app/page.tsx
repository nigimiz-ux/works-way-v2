"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Clock, FileText, CreditCard, CheckCircle,
  Megaphone, Plus, X, Trash2,
} from "lucide-react";
import WritePostModal from "./components/WritePostModal";

// ── Supabase 클라이언트 (page-old.tsx 4~10번 줄과 동일한 방식) ──────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── 차트 색상 (DashboardCharts.tsx 원본) ───────────────────────────────
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

// ── 애니메이션 숫자 카드 (DashboardCharts.tsx 원본 StatCard) ───────────
function StatCard({
  label, value, unit, icon, color,
}: {
  label: string; value: number; unit: string;
  icon: React.ReactNode; color: string;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cur = 0;
    const step = Math.ceil(value / 30);
    const t = setInterval(() => {
      cur += step;
      if (cur >= value) { setCount(value); clearInterval(t); }
      else setCount(cur);
    }, 20);
    return () => clearInterval(t);
  }, [value]);

  return (
    <div className="bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:shadow-md transition-shadow group">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
          {count}
          <span className="text-base font-medium text-slate-400 ml-1">{unit}</span>
        </h3>
      </div>
      <div className={`w-11 h-11 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${color}`}>
        {icon}
      </div>
    </div>
  );
}

// ── 공지사항 타입 ───────────────────────────────────────────────────────
type Notice = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

// ── 메인 페이지 ────────────────────────────────────────────────────────
export default function Home() {

  // ── 게시글 상태 ──
  const [posts, setPosts] = useState<any[]>([]);
  const [postsError, setPostsError] = useState<any>(null);
  const [postsCount, setPostsCount] = useState(0);

  // ── 차트 데이터 상태 (DashboardCharts.tsx 원본) ──
  const [leaveByDept, setLeaveByDept] = useState<any[]>([]);
  const [expenseByCategory, setExpenseByCategory] = useState<any[]>([]);
  const [projectStatus, setProjectStatus] = useState<any[]>([]);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [pendingExpense, setPendingExpense] = useState(0);
  const [approvedToday, setApprovedToday] = useState(0);
  const [isChartLoading, setIsChartLoading] = useState(true);

  // ── 공지사항 상태 (NoticeWidget 원본) ──
  const [isAdmin, setIsAdmin] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── 데이터 패치 ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {

      // 1. 게시글
      const { data: postData, error: postErr, count: pCount } = await supabase
        .from("posts")
        .select("*", { count: "exact" })
        .order("id", { ascending: false });
      setPosts(postData || []);
      setPostsError(postErr);
      setPostsCount(pCount || 0);

      // 2. 미결재 연차 건수
      const { count: pendingLeaves } = await supabase
        .from("leaves")
        .select("*", { count: "exact", head: true })
        .or("status.is.null,status.eq.대기,status.eq.대기중");
      setPendingLeaveCount(pendingLeaves || 0);

      // 3. 부서별 연차 현황 (DashboardCharts.tsx 원본)
      const { data: leaves } = await supabase
        .from("leaves")
        .select("applicant_email, status");
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email, department");

      if (leaves && profiles) {
        const deptMap: Record<string, { 대기: number; 승인: number; 반려: number }> = {};
        const emailToDept: Record<string, string> = {};
        profiles.forEach((p: any) => { emailToDept[p.email] = p.department || "미분류"; });
        leaves.forEach((l: any) => {
          const dept = emailToDept[l.applicant_email] || "미분류";
          if (!deptMap[dept]) deptMap[dept] = { 대기: 0, 승인: 0, 반려: 0 };
          const s = l.status === "1차승인" ? "대기" : (l.status || "대기");
          if (s in deptMap[dept]) deptMap[dept][s as keyof typeof deptMap[string]]++;
        });
        setLeaveByDept(Object.entries(deptMap).map(([dept, v]) => ({ dept, ...v })));
      }

      // 4. 법인카드 지출 카테고리 (DashboardCharts.tsx 원본)
      const { data: expenses } = await supabase
        .from("expenses")
        .select("category, status");
      if (expenses) {
        const catMap: Record<string, number> = {};
        let pending = 0;
        expenses.forEach((e: any) => {
          const cat = e.category || "기타";
          catMap[cat] = (catMap[cat] || 0) + 1;
          if (e.status === "대기") pending++;
        });
        setExpenseByCategory(Object.entries(catMap).map(([name, value]) => ({ name, value })));
        setPendingExpense(pending);
      }

      // 5. 프로젝트 현황 (DashboardCharts.tsx 원본)
      const { data: projects } = await supabase.from("projects").select("status");
      if (projects) {
        const statusMap: Record<string, number> = {};
        projects.forEach((p: any) => {
          const s = p.status || "진행중";
          statusMap[s] = (statusMap[s] || 0) + 1;
        });
        setProjectStatus(Object.entries(statusMap).map(([name, value]) => ({ name, value })));
      }

      // 6. 오늘 처리 완료 건수 (DashboardCharts.tsx 원본)
      const today = new Date().toISOString().split("T")[0];
      const { count: todayCount } = await supabase
        .from("leaves")
        .select("*", { count: "exact", head: true })
        .eq("status", "승인")
        .gte("approved_at", `${today}T00:00:00`);
      setApprovedToday(todayCount || 0);

      setIsChartLoading(false);

      // 7. 관리자 여부 확인 (NoticeWidget 원본)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role === "admin" || profile?.role === "대표이사") {
          setIsAdmin(true);
        }
      }

      // 8. 공지사항
      fetchNotices();
    };

    load();
  }, []);

  // ── 공지사항 함수들 (NoticeWidget 원본) ────────────────────────────
  const fetchNotices = async () => {
    const { data, error } = await supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3);
    if (!error && data) setNotices(data);
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setIsSubmitting(true);
    const { error } = await supabase
      .from("notices")
      .insert([{ title: newTitle, content: newContent }]);
    setIsSubmitting(false);
    if (!error) {
      setIsWriteModalOpen(false);
      setNewTitle("");
      setNewContent("");
      fetchNotices();
    }
  };

  const handleDeleteNotice = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("이 공지사항을 정말 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (!error) fetchNotices();
  };

  // ── 렌더 ───────────────────────────────────────────────────────────
  return (
    <div className="w-full animate-fade-in flex flex-col min-h-[calc(100vh-6rem)]">

      {/* ① 제목 & 글쓰기 버튼 (page-old.tsx 원본) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">사내 대시보드</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">사내 주요 현황과 공지사항을 한눈에 확인하세요.</p>
        </div>
        <WritePostModal />
      </div>


      {/* ③ 숫자 스탯 카드 4개 (DashboardCharts.tsx 원본) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="미결재 연차" value={pendingLeaveCount} unit="건"
          icon={<Clock size={20} className="text-amber-500" />}
          color="bg-amber-50 dark:bg-amber-500/10" />
        <StatCard label="미결재 경비" value={pendingExpense} unit="건"
          icon={<CreditCard size={20} className="text-orange-500" />}
          color="bg-orange-50 dark:bg-orange-500/10" />
        <StatCard label="전체 게시글" value={postsCount} unit="건"
          icon={<FileText size={20} className="text-blue-500" />}
          color="bg-blue-50 dark:bg-blue-500/10" />
        <StatCard label="오늘 처리 완료" value={approvedToday} unit="건"
          icon={<CheckCircle size={20} className="text-green-500" />}
          color="bg-green-50 dark:bg-green-500/10" />
      </div>

      {/* ④ 차트 2개 (DashboardCharts.tsx 원본) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* 부서별 연차 현황 — 막대 차트 */}
        <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">📊 부서별 연차 현황</h3>
          {isChartLoading ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">불러오는 중...</div>
          ) : leaveByDept.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={leaveByDept} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="dept" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "var(--color-bg, #1e293b)", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="대기" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="승인" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="반려" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 법인카드 지출 카테고리 — 도넛 차트 */}
        <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">💳 법인카드 지출 카테고리</h3>
          {isChartLoading ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">불러오는 중...</div>
          ) : expenseByCategory.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {expenseByCategory.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ⑤ 프로젝트 현황 진행 바 (DashboardCharts.tsx 원본) */}
      {!isChartLoading && projectStatus.length > 0 && (
        <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">📋 프로젝트 현황</h3>
          <div className="space-y-3">
            {projectStatus.map((item: any, i: number) => {
              const total = projectStatus.reduce((s: number, x: any) => s + x.value, 0);
              const pct = Math.round((item.value / total) * 100);
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.value}개 ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ⑥ 공지사항 위젯 (NoticeWidget 원본 + 상세보기/삭제 포함) */}
      <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Megaphone size={16} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">전임직원 확인사항 공지</h3>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsWriteModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus size={13} /> 공지 작성
            </button>
          )}
        </div>

        <div className="space-y-2">
          {notices.length === 0 ? (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-6">등록된 공지사항이 없습니다.</p>
          ) : (
            notices.map((notice) => (
              <div
                key={notice.id}
                onClick={() => setSelectedNotice(notice)}
                className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800 hover:border-blue-200 dark:hover:border-slate-600 transition-all group"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                    {notice.title}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {new Date(notice.created_at).toLocaleString("ko-KR")}
                  </span>
                </div>
                {isAdmin && (
                  <button
                    onClick={(e) => handleDeleteNotice(notice.id, e)}
                    className="ml-3 flex-shrink-0 p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ⑧ 푸터 (page-old.tsx 원본) */}
      <footer className="mt-auto pt-10 pb-4 text-center text-slate-400 dark:text-slate-500 text-sm">
        &copy; 2026 Work&apos;s Way. All rights reserved.
      </footer>

      {/* ── 공지 상세보기 모달 (NoticeWidget 원본) ── */}
      {selectedNotice && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedNotice(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-amber-500 flex-shrink-0" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white break-words line-clamp-2">
                  {selectedNotice.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNotice(null)}
                className="ml-4 flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {new Date(selectedNotice.created_at).toLocaleString("ko-KR")}
              </span>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed text-sm">
              {selectedNotice.content || "내용이 없습니다."}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedNotice(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 공지 작성 모달 — 관리자 전용 (NoticeWidget 원본) ── */}
      {isWriteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsWriteModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">새 공지사항 작성</h3>
              <button
                onClick={() => setIsWriteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateNotice} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">제목</label>
                <input
                  type="text" required value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="공지 제목을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">내용</label>
                <textarea
                  required rows={6} value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="공지 내용을 입력하세요"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsWriteModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                  취소
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                  {isSubmitting ? "등록 중..." : "등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}