"use client";

import { useState, useEffect } from "react";
import { Megaphone, Clock, CreditCard, FileText, CheckCircle, Plus, X, Trash2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<any>(null); // 상세보기용 상태
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
    e.stopPropagation(); // 상세보기 팝업이 뜨지 않게 방지
    if (!confirm("이 공지사항을 정말 삭제하시겠습니까?")) return;

    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (!error) {
      fetchNotices();
    } else {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      {/* ... (상단 통계 및 차트 영역은 기존과 동일하게 유지하세요) ... */}
      {/* 5. 최근 공지사항 영역 */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Megaphone size={18} />
            <h2 className="font-semibold text-white text-sm">최근 공지사항</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">최신 3건</span>
            {isAdmin && (
              <button onClick={() => setIsWriteModalOpen(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg">
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
                onClick={() => setSelectedNotice(notice)} // 클릭 시 상세보기 팝업
                className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 flex justify-between items-center text-sm cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-slate-200 font-medium">{notice.title}</span>
                  <span className="text-[10px] text-slate-500 mt-1">{new Date(notice.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <button
                      onClick={(e) => handleDeleteNotice(notice.id, e)}
                      className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* [상세보기 모달] */}
      {selectedNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white leading-tight">{selectedNotice.title}</h3>
              <button onClick={() => setSelectedNotice(null)} className="p-1 text-slate-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedNotice.content}</p>
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button onClick={() => setSelectedNotice(null)} className="px-5 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors text-sm font-medium">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* [공지 작성 모달] - 기존과 동일하되 디자인 살짝 개선 */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          {/* ... (작성 모달 코드는 기존과 동일) ... */}
        </div>
      )}
    </div>
  );
}