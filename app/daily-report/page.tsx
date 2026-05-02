"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// 환경변수를 사용하여 Supabase 클라이언트 초기화
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CEO_EMAIL = "nigimiz@naver.com"; // TODO: 임원님의 실제 이메일 주소로 변경하세요

type DailyReport = {
  id: number;
  author_email: string;
  today_work: string;
  tomorrow_plan: string;
  issues: string;
  manager_comment?: string;
  created_at: string;
  profiles?: {
    full_name: string;
    department: string;
  };
};

export default function DailyReportPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);

  const [todayWork, setTodayWork] = useState("");
  const [tomorrowPlan, setTomorrowPlan] = useState("");
  const [issues, setIssues] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [isSavingComment, setIsSavingComment] = useState<number | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoadingList(true);

    // 1. 현재 로그인한 사용자 정보 가져오기
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email, department, full_name")
        .eq("id", session.user.id)
        .single();

      if (profiles) {
        setCurrentUserProfile(profiles);
        fetchMyReports(profiles.email);
      } else {
        setIsLoadingList(false);
      }
    } else {
      setIsLoadingList(false);
    }
  };

  const fetchMyReports = async (email: string) => {
    let query = supabase
      .from("daily_reports")
      .select("*")
      .order("created_at", { ascending: false });

    // 사장님 계정이 아니면 본인 것만 조회 (공백 및 대소문자 방어 로직 추가)
    const isCEO = email.trim().toLowerCase() === CEO_EMAIL.trim().toLowerCase();
    
    if (!isCEO) {
      query = query.eq("author_email", email);
    }

    const { data: reportsData, error } = await query;

    if (error) {
      console.error("에러 상세:", JSON.stringify(error, null, 2));
      alert(`데이터 조회 에러: ${error.message || "자세한 사항은 콘솔 확인"}`);
      setIsLoadingList(false);
      return;
    }

    if (reportsData) {
      // 1. 작성자 이메일 추출 및 중복 제거
      const emails = Array.from(new Set(reportsData.map(r => r.author_email)));
      
      // 2. profiles 수동 JOIN
      let profilesMap: Record<string, any> = {};
      if (emails.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("email, full_name, department")
          .in("email", emails);
          
        if (profilesError) {
          console.error("프로필 JOIN 에러 상세:", JSON.stringify(profilesError, null, 2));
        } else if (profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.email] = p;
          });
        }
      }

      // 3. 데이터 병합
      const mergedReports = reportsData.map(report => ({
        ...report,
        profiles: profilesMap[report.author_email] || null
      }));

      setReports(mergedReports);
      
      const initialComments: Record<number, string> = {};
      mergedReports.forEach((r: DailyReport) => {
        if (r.manager_comment) {
          initialComments[r.id] = r.manager_comment;
        }
      });
      setCommentInputs(initialComments);
    }
    setIsLoadingList(false);
  };

  const handleSaveComment = async (id: number) => {
    const comment = commentInputs[id] || "";
    setIsSavingComment(id);

    const { error } = await supabase
      .from("daily_reports")
      .update({ manager_comment: comment })
      .eq("id", id);

    if (error) {
      console.error("코멘트 저장 에러:", error);
      alert("코멘트 저장에 실패했습니다.");
    } else {
      // 알림 생성 로직
      const targetReport = reports.find(r => r.id === id);
      if (targetReport && targetReport.author_email !== currentUserProfile?.email) {
        await supabase.from("notifications").insert([
          {
            user_email: targetReport.author_email,
            message: "사장님이 일상보고에 코멘트를 남겼습니다.",
            is_read: false,
            link: "/daily-report"
          }
        ]);
      }

      alert("코멘트가 저장되었습니다.");
      setReports(reports.map(r => r.id === id ? { ...r, manager_comment: comment } : r));
    }
    setIsSavingComment(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 예외 처리: 오늘 한 일이 비어있으면 아예 API 호출을 막음
    if (!todayWork.trim()) {
      alert("오늘 한 일을 입력해 주세요");
      return;
    }

    if (!currentUserProfile) {
      alert("사용자 정보를 불러올 수 없습니다. 다시 로그인해 주세요.");
      return;
    }

    setIsSubmitting(true);

    const newReport = {
      author_email: currentUserProfile.email,
      today_work: todayWork.trim(),
      tomorrow_plan: tomorrowPlan.trim(),
      issues: issues.trim()
    };

    const { data, error } = await supabase
      .from("daily_reports")
      .insert([newReport])
      .select();

    if (error) {
      console.error("보고서 제출 에러:", error.message || error);
      alert("보고서 제출 중 오류가 발생했습니다.");
      setIsSubmitting(false);
      return;
    }

    // 성공 시 로컬 리스트에 방금 작성한 보고서 추가 (새로고침 없이 반영)
    if (data && data.length > 0) {
      const insertedReport = {
        ...data[0],
        profiles: {
          full_name: currentUserProfile.full_name,
          department: currentUserProfile.department
        }
      };
      setReports([insertedReport, ...reports]);
    }

    // 폼 초기화 및 제출 버튼 활성화
    setTodayWork("");
    setTomorrowPlan("");
    setIssues("");
    setIsSubmitting(false);
    alert("일상보고가 성공적으로 제출되었습니다.");
  };

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in flex flex-col min-h-[calc(100vh-6rem)] py-6">
      <div className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">일상보고 작성</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">오늘 진행한 업무와 내일 계획, 이슈 사항을 공유해 주세요.</p>
      </div>

      {/* 입력 폼 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 mb-10">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              오늘 한 일 <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white min-h-[120px] resize-y"
              placeholder="오늘 진행한 업무 내용을 상세히 입력해 주세요."
              value={todayWork}
              onChange={(e) => setTodayWork(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              내일 할 일
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white min-h-[100px] resize-y"
              placeholder="내일 진행할 예정인 업무 내용을 입력해 주세요."
              value={tomorrowPlan}
              onChange={(e) => setTomorrowPlan(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              이슈 사항
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white min-h-[80px] resize-y"
              placeholder="업무 진행 중 발생한 이슈나 도움이 필요한 사항을 입력해 주세요."
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all flex items-center justify-center gap-2 ${isSubmitting
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900"
                }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  제출 중...
                </>
              ) : (
                "보고서 제출"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 내가 작성한 보고서 리스트 */}
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
          {currentUserProfile?.email === CEO_EMAIL ? "전사 일상보고 현황" : "나의 작성 내역"}
        </h3>
        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs py-0.5 px-2 rounded-full font-medium">
          최근 작성순
        </span>
      </div>

      <div className="space-y-4 mb-10">
        {isLoadingList ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500">
            <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p>목록을 불러오는 중입니다...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400">아직 작성한 일상보고가 없습니다.</p>
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.id} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-all hover:shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                    {((Array.isArray(report.profiles) ? report.profiles[0]?.full_name : report.profiles?.full_name) || report.author_email)?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">{(Array.isArray(report.profiles) ? report.profiles[0]?.full_name : report.profiles?.full_name) || report.author_email}</h4>
                    <p className="text-xs text-slate-500">{(Array.isArray(report.profiles) ? report.profiles[0]?.department : report.profiles?.department) || "소속 없음"}</p>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(report.created_at).toLocaleString('ko-KR', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <h5 className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 오늘 한 일
                  </h5>
                  <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap pl-3 border-l-2 border-slate-100 dark:border-slate-800">{report.today_work}</p>
                </div>

                {report.tomorrow_plan && (
                  <div>
                    <h5 className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 내일 할 일
                    </h5>
                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap pl-3 border-l-2 border-slate-100 dark:border-slate-800">{report.tomorrow_plan}</p>
                  </div>
                )}

                {report.issues && (
                  <div>
                    <h5 className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> 이슈 사항
                    </h5>
                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap pl-3 border-l-2 border-slate-100 dark:border-slate-800">{report.issues}</p>
                  </div>
                )}
              </div>

              {/* 사장님 코멘트 영역 */}
              {currentUserProfile?.email === CEO_EMAIL ? (
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h5 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> 사장님 코멘트
                  </h5>
                  <div className="flex gap-2 items-start">
                    <textarea
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:text-white min-h-[60px] resize-y"
                      placeholder="코멘트를 입력하세요..."
                      value={commentInputs[report.id] || ""}
                      onChange={(e) => setCommentInputs({ ...commentInputs, [report.id]: e.target.value })}
                      disabled={isSavingComment === report.id}
                    />
                    <button
                      onClick={() => handleSaveComment(report.id)}
                      disabled={isSavingComment === report.id}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:bg-purple-400"
                    >
                      {isSavingComment === report.id ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              ) : report.manager_comment ? (
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h5 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> 사장님 코멘트
                  </h5>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800/30">
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm">{report.manager_comment}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
