"use client";

import { useState, useEffect } from "react";
import { Megaphone, Plus, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import DashboardCharts from "./components/DashboardCharts";
import PostTable from "./components/PostTable";

// Supabase 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[] | null>(null);
  const [postsError, setPostsError] = useState<any>(null);
  const [postsCount, setPostsCount] = useState(0);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      // 세션 & 관리자 여부 확인
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

      // 공지사항 불러오기
      fetchNotices();

      // 게시글 불러오기 (Supabase)
      const { data, error, count } = await supabase
        .from("posts")
        .select("*", { count: "exact" })
        .order("id", { ascending: false });
      setPosts(data);
      setPostsError(error);
      setPostsCount(count || 0);

      // 미결재 연차 건수
      const { count: leavesCount } = await supabase
        .from("leaves")
        .select("*", { count: "exact", head: true })
        .or("status.is.null,status.eq.대기,status.eq.대기중");
      setPendingLeaveCount(leavesCount || 0);
    };

    fetchDashboardData();
  }, []);

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
    const { error } = await supabase.from("notices").insert([{ title: newTitle, content: newContent }]);
    setIsSubmitting(false);
    if (!error) {
      alert("공지사항이 등록되었습니다.");
      setIsModalOpen(false);
      setNewTitle("");
      setNewContent("");
      fetchNotices();
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">사내 대시보드</h1>
        <p className="text-slate-400 text-sm">사내 주요 현황과 공지사항을 한눈에 확인하세요.</p>
      </div>

      {/* 2. 실제 통계 카드 + 차트 (DashboardCharts 컴포넌트) */}
      <DashboardCharts
        pendingLeaveCount={pendingLeaveCount}
        totalPostCount={postsCount}
      />

      {/* 3. 최근 공지사항 */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Megaphone size={18} />
            <h2 className="font-semibold text-white text-sm">최근 공지사항</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">최신 3건</span>
            {isAdmin && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg"
              >
                <Plus size={14} /> 공지 작성
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {notices.length === 0 ? (
            <div className="py-4 text-center text-slate-500 text-sm">등록된 공지사항이 없습니다.</div>
          ) : (
            notices.map((notice) => (
              <div
                key={notice.id}
                className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 flex justify-between items-center text-sm"
              >
                <span className="text-slate-200">{notice.title}</span>
                <span className="text-xs text-slate-500">{new Date(notice.created_at).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. 전체 게시글 리스트 (Supabase 실데이터 + PostTable 컴포넌트) */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">📝 전체 게시글</h2>
        </div>
        <PostTable posts={posts} error={postsError} />
      </div>

      {/* 공지 작성 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-white">새 공지사항 작성</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateNotice} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">제목</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">내용</label>
                <textarea
                  required
                  rows={5}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-xs text-white disabled:opacity-50"
                >
                  {isSubmitting ? "등록 중..." : "등록하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}