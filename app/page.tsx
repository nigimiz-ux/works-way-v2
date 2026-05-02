import { createClient } from "@supabase/supabase-js";
import WritePostModal from "./components/WritePostModal";
import PostTable from "./components/PostTable";
import DashboardCharts from "./components/DashboardCharts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function Home() {
  const { data: posts, error, count: postsCount } = await supabase
    .from("posts")
    .select("*", { count: "exact" })
    .order("id", { ascending: false });

  const { count: pendingLeavesCount } = await supabase
    .from("leaves")
    .select("*", { count: "exact", head: true })
    .eq("status", "대기");

  return (
    <div className="w-full animate-fade-in flex flex-col min-h-[calc(100vh-6rem)]">

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">사내 대시보드</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">사내 주요 현황과 공지사항을 한눈에 확인하세요.</p>
        </div>
        <WritePostModal />
      </div>

      {/* 차트 + 숫자 카드 (SummaryCards 대체) */}
      <DashboardCharts
        pendingLeaveCount={pendingLeavesCount || 0}
        totalPostCount={postsCount || 0}
      />

      {/* 게시판 */}
      <div className="bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <PostTable posts={posts} error={error} />
      </div>

      <footer className="mt-auto pt-10 pb-4 text-center text-slate-400 dark:text-slate-500 text-sm">
        &copy; 2026 Work's Way. All rights reserved.
      </footer>
    </div>
  );
}
