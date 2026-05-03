"use client";

import { useState, useEffect } from "react";
import { Megaphone, Clock, CreditCard, FileText, CheckCircle, Plus, X, Trash2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<any>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
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
      fetchNotices();
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

  return (
    <div className="space-y-6">
      {/* 1. 상단 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: "미결재 연차", count: "3", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          { title: "미결재 경비", count: "3", icon: CreditCard, color: "text-rose-500", bg: "bg-rose-500/10" },
          { title: "전체 게시글", count: "5", icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
          { title: "오늘 처리 완료", count: "0", icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" }
        ].map((stat, i) => (
          <div key={i} className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-1">{stat.title}</p>
              <p className="text-2xl font-bold text-white">{stat.count}<span className="text-sm font-normal text-slate-500 ml-1">건</span></p>
            </div>
            <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}><stat.icon size={20} /></div>
          </div>
        ))}
      </div>

      {/* 2. 기존 차트 영역 (소장님 원본 차트 UI) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 min-h-[300px]">
          <h2 className="text-sm font-semibold text-white mb-4">📊 부서별 연차 현황</h2>
          {/* 여기에 page-old의 Recharts 그래프 컴포넌트가 들어갑니다 */}
          <div className="flex items-center justify-center h-full text-slate-600">그래프 데이터 연동 중...</div>
        </div>
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 min-h-[300px]">
          <h2 className="text-sm font-semibold text-white mb-4">💳 법인카드 지출 카테고리</h2>
          <div className="flex items-center justify-center h-full text-slate-600">원형 차트 연동 중...</div>
        </div>
      </div>

      {/* 3. 공지사항 위젯 (상세보기 & 삭제 포함) */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Megaphone size={18} />
            <h2 className="font-semibold text-white text-sm">최근 공지사항</h2>
          </div>
          {isAdmin && (
            <button onClick={() => setIsWriteModalOpen(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg">
              <Plus size={14} /> 공지 작성
            </button>
          )}
        </div>
        <div className="space-y-2">
          {notices.map((notice) => (
            <div key={notice.id} onClick={() => setSelectedNotice(notice)} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 flex justify-between items-center text-sm cursor-pointer hover:bg-slate-800 transition-colors">
              <div className="flex flex-col">
                <span className="text-slate-200 font-medium">{notice.title}</span>
                <span className="text-[10px] text-slate-500 mt-1">{new Date(notice.created_at).toLocaleString()}</span>
              </div>
              {isAdmin && (
                <button onClick={(e) => handleDeleteNotice(notice.id, e)} className="p-1.5 text-slate-500 hover:text-rose-500"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4. 전체 게시글 리스트 */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto">
        <h2 className="text-sm font-semibold text-white mb-4">📝 전체 게시글</h2>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-400 border-b border-slate-800">
            <tr><th className="px-4 py-3">번호</th><th className="px-4 py-3">제목</th><th className="px-4 py-3">작성자</th><th className="px-4 py-3">작성일</th></tr>
          </thead>
          <tbody className="text-slate-300 divide-y divide-slate-800">
            <tr className="hover:bg-slate-800/50"><td className="px-4 py-3 text-xs">7</td><td className="px-4 py-3">새 프로젝트 스타트가 너무 느림</td><td className="px-4 py-3">대표이사</td><td className="px-4 py-3 text-xs">2026. 5. 2.</td></tr>
          </tbody>
        </table>
      </div>

      {/* 상세보기 모달 */}
      {selectedNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">{selectedNotice.title}</h3>
              <button onClick={() => setSelectedNotice(null)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto text-slate-300 whitespace-pre-wrap">{selectedNotice.content}</div>
          </div>
        </div>
      )}

      {/* 작성 모달 */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">새 공지사항 작성</h3>
            <form onSubmit={handleCreateNotice} className="space-y-4">
              <input type="text" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" placeholder="제목" />
              <textarea required rows={5} value={newContent} onChange={(e) => setNewContent(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" placeholder="내용" />
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setIsWriteModalOpen(false)} className="text-slate-400">취소</button><button type="submit" className="bg-blue-600 px-4 py-2 rounded-lg text-white">등록</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}