import { createClient } from "@supabase/supabase-js";
import WritePostModal from "./components/WritePostModal";
import PostTable from "./components/PostTable";
import SummaryCards from "./components/SummaryCards";
import DashboardCharts from "./components/DashboardCharts";
import NoticeWidget from "./components/NoticeWidget";

// 환경변수를 사용하여 Supabase 클라이언트 초기화 (빈 문자열이 들어가면 next dev가 터지므로 플레이스홀더 추가)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function Home() {
  // 게시글 데이터 및 총 개수 패치
  const { data: posts, error, count: postsCount } = await supabase
    .from("posts")
    .select("*", { count: "exact" })
    .order("id", { ascending: false });

  // 미결재 건수 패치 (status가 없거나 '대기', '대기중'인 데이터)
  const { count: pendingLeavesCount } = await supabase
    .from("leaves")
    .select("*", { count: "exact", head: true })
    .or("status.is.null,status.eq.대기,status.eq.대기중");

  return (
    <div className="w-full animate-fade-in flex flex-col min-h-[calc(100vh-6rem)]">
      {/* Title & Write Button Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">사내 대시보드</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">사내 주요 현황과 공지사항을 한눈에 확인하세요.</p>
        </div>
        <WritePostModal />
      </div>

      {/* Summary Cards */}
      <SummaryCards
        pendingLeaveCount={pendingLeavesCount || 0}
        totalPostCount={postsCount || 0}
      />

      {/* Charts: 부서별 연차 현황 + 법인카드 지출 차트 */}
      <DashboardCharts
        pendingLeaveCount={pendingLeavesCount || 0}
        totalPostCount={postsCount || 0}
      />

      {/* Notice Widget: 최신 공지 3개 + 관리자 작성/삭제 기능 */}
      <div className="mb-6">
        <NoticeWidget />
      </div>

      {/* Board Table */}
      <div className="bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <PostTable posts={posts} error={error} />
      </div>

      {/* Footer */}
      <footer className="mt-auto pt-10 pb-4 text-center text-slate-400 dark:text-slate-500 text-sm">
        &copy; 2026 Work&apos;s Way. All rights reserved.
      </footer>
    </div>
  );
}