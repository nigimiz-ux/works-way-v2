"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// 환경변수를 사용하여 Supabase 클라이언트 초기화
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DeletePostButton({ id }: { id: number }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // row의 onClick 이벤트로 전파 방지
    
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    
    setIsDeleting(true);
    
    // Supabase에서 해당 id의 데이터 완전 삭제
    const { error } = await supabase.from("posts").delete().eq("id", id);
    
    setIsDeleting(false);
    
    if (error) {
      console.error("게시글 삭제 에러:", error);
      alert("게시글 삭제에 실패했습니다.");
    } else {
      // 서버 컴포넌트 데이터 새로고침
      router.refresh();
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className={`text-xs font-semibold px-3 py-1.5 rounded transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 dark:focus:ring-offset-slate-900 whitespace-nowrap ${
        isDeleting 
          ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed" 
          : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 active:bg-red-200 border border-red-100 dark:border-red-900/50 hover:border-red-200 dark:hover:border-red-800"
      }`}
    >
      {isDeleting ? "..." : "삭제"}
    </button>
  );
}
