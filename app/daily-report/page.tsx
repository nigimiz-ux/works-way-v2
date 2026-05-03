"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { ImagePlus, X } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CEO_EMAIL = "nigimiz@naver.com";

type DailyReport = {
  id: number;
  author_email: string;
  today_work: string;
  tomorrow_plan: string;
  issues: string;
  image_url?: string;       // ← 추가
  manager_comment?: string;
  created_at: string;
  profiles?: { full_name: string; department: string };
};

// ── 이미지 업로드 훅 ──────────────────────────────────────────
function useImageUpload() {
  const [preview, setPreview]   = useState<string | null>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 5 * 1024 * 1024) {
      alert("파일 크기는 5MB 이하만 가능합니다.");
      return;
    }
    setFile(selected);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selected);
  };

  const clearImage = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!file) return null;
    setUploading(true);
    const ext      = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const path     = `daily-reports/${fileName}`;

    const { error } = await supabase.storage
      .from("attachments")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (error) {
      alert("이미지 업로드 실패: " + error.message);
      setUploading(false);
      return null;
    }

    const { data } = supabase.storage.from("attachments").getPublicUrl(path);
    setUploading(false);
    return data.publicUrl;
  };

  return { preview, file, uploading, inputRef, handleFileChange, clearImage, uploadImage };
}

// ── 이미지 첨부 UI 컴포넌트 ──────────────────────────────────
function ImageAttachment({
  preview, uploading, inputRef, handleFileChange, clearImage,
}: ReturnType<typeof useImageUpload>) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        현장 사진 첨부 <span className="text-slate-400 font-normal">(선택, 최대 5MB)</span>
      </label>

      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="미리보기"
            className="w-40 h-40 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
          />
          <button
            type="button"
            onClick={clearImage}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow transition-colors"
          >
            <X size={12} />
          </button>
          {uploading && (
            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          )}
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-40 h-40 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
          <ImagePlus size={28} className="text-slate-400 mb-2" />
          <span className="text-xs text-slate-500 dark:text-slate-400 text-center px-2">
            클릭해서 사진 선택
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      )}
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────
export default function DailyReportPage() {
  const [reports, setReports]         = useState<DailyReport[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [todayWork, setTodayWork]     = useState("");
  const [tomorrowPlan, setTomorrowPlan] = useState("");
  const [issues, setIssues]           = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [isSavingComment, setIsSavingComment] = useState<number | null>(null);

  const imageUpload = useImageUpload();

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setIsLoadingList(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profiles } = await supabase
        .from("profiles").select("email, department, full_name").eq("id", session.user.id).single();
      if (profiles) { setCurrentUserProfile(profiles); fetchMyReports(profiles.email); }
      else setIsLoadingList(false);
    } else setIsLoadingList(false);
  };

  const fetchMyReports = async (email: string) => {
    const isCEO = email.trim().toLowerCase() === CEO_EMAIL.trim().toLowerCase();
    let query = supabase.from("daily_reports").select("*").order("created_at", { ascending: false });
    if (!isCEO) query = query.eq("author_email", email);
    const { data: reportsData, error } = await query;
    if (error) { alert(`데이터 조회 에러: ${error.message}`); setIsLoadingList(false); return; }
    if (reportsData) {
      const emails = Array.from(new Set(reportsData.map((r: any) => r.author_email)));
      let profilesMap: Record<string, any> = {};
      if (emails.length > 0) {
        const { data: profilesData } = await supabase.from("profiles").select("email, full_name, department").in("email", emails as string[]);
        (profilesData || []).forEach((p: any) => { profilesMap[p.email] = p; });
      }
      const merged = reportsData.map((r: any) => ({ ...r, profiles: profilesMap[r.author_email] || null }));
      setReports(merged);
      const initial: Record<number, string> = {};
      merged.forEach((r: any) => { if (r.manager_comment) initial[r.id] = r.manager_comment; });
      setCommentInputs(initial);
    }
    setIsLoadingList(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todayWork.trim()) { alert("오늘 한 일을 입력해 주세요"); return; }
    if (!currentUserProfile) { alert("사용자 정보를 불러올 수 없습니다."); return; }
    setIsSubmitting(true);

    // 이미지 업로드 먼저
    const imageUrl = await imageUpload.uploadImage();

    const { data, error } = await supabase
      .from("daily_reports")
      .insert([{
        author_email:  currentUserProfile.email,
        today_work:    todayWork.trim(),
        tomorrow_plan: tomorrowPlan.trim(),
        issues:        issues.trim(),
        image_url:     imageUrl || null,    // ← 이미지 URL 저장
      }])
      .select();

    if (error) { alert("보고서 제출 중 오류가 발생했습니다."); setIsSubmitting(false); return; }

    if (data?.length > 0) {
      setReports([{
        ...data[0],
        profiles: { full_name: currentUserProfile.full_name, department: currentUserProfile.department }
      }, ...reports]);
    }

    setTodayWork(""); setTomorrowPlan(""); setIssues("");
    imageUpload.clearImage();
    setIsSubmitting(false);
    alert("일상보고가 성공적으로 제출되었습니다.");
  };

  const handleSaveComment = async (id: number) => {
    const comment = commentInputs[id] || "";
    setIsSavingComment(id);
    const { error } = await supabase.from("daily_reports").update({ manager_comment: comment }).eq("id", id);
    if (error) { alert("코멘트 저장에 실패했습니다."); }
    else {
      const target = reports.find(r => r.id === id);
      if (target && target.author_email !== currentUserProfile?.email) {
        await supabase.from("notifications").insert([{
          user_email: target.author_email,
          message: "사장님이 일상보고에 코멘트를 남겼습니다.",
          is_read: false, link: "/daily-report"
        }]);
      }
      alert("코멘트가 저장되었습니다.");
      setReports(reports.map(r => r.id === id ? { ...r, manager_comment: comment } : r));
    }
    setIsSavingComment(null);
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
              value={todayWork} onChange={e => setTodayWork(e.target.value)} disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">내일 할 일</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white min-h-[100px] resize-y"
              placeholder="내일 진행할 예정인 업무 내용을 입력해 주세요."
              value={tomorrowPlan} onChange={e => setTomorrowPlan(e.target.value)} disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">이슈 사항</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white min-h-[80px] resize-y"
              placeholder="업무 진행 중 발생한 이슈나 도움이 필요한 사항을 입력해 주세요."
              value={issues} onChange={e => setIssues(e.target.value)} disabled={isSubmitting}
            />
          </div>

          {/* ── 이미지 첨부 ── */}
          <ImageAttachment {...imageUpload} />

          <div className="pt-2 flex justify-end">
            <button type="submit" disabled={isSubmitting || imageUpload.uploading}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  제출 중...
                </>
              ) : "보고서 제출"}
            </button>
          </div>
        </form>
      </div>

      {/* 보고서 리스트 */}
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
          {currentUserProfile?.email === CEO_EMAIL ? "전사 일상보고 현황" : "나의 작성 내역"}
        </h3>
        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs py-0.5 px-2 rounded-full font-medium">최근 작성순</span>
      </div>

      <div className="space-y-4 mb-10">
        {isLoadingList ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500">
            <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            목록을 불러오는 중입니다...
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <p className="text-slate-500 dark:text-slate-400">아직 작성한 일상보고가 없습니다.</p>
          </div>
        ) : (
          reports.map(report => (
            <div key={report.id} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                    {((Array.isArray(report.profiles) ? report.profiles[0]?.full_name : report.profiles?.full_name) || report.author_email)?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      {(Array.isArray(report.profiles) ? report.profiles[0]?.full_name : report.profiles?.full_name) || report.author_email}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {(Array.isArray(report.profiles) ? report.profiles[0]?.department : report.profiles?.department) || "소속 없음"}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(report.created_at).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <h5 className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> 오늘 한 일
                  </h5>
                  <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap pl-3 border-l-2 border-slate-100 dark:border-slate-800">{report.today_work}</p>
                </div>
                {report.tomorrow_plan && (
                  <div>
                    <h5 className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> 내일 할 일
                    </h5>
                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap pl-3 border-l-2 border-slate-100 dark:border-slate-800">{report.tomorrow_plan}</p>
                  </div>
                )}
                {report.issues && (
                  <div>
                    <h5 className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> 이슈 사항
                    </h5>
                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap pl-3 border-l-2 border-slate-100 dark:border-slate-800">{report.issues}</p>
                  </div>
                )}

                {/* ── 첨부 이미지 표시 ── */}
                {report.image_url && (
                  <div>
                    <h5 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> 첨부 사진
                    </h5>
                    <a href={report.image_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={report.image_url}
                        alt="첨부 사진"
                        className="w-48 h-48 object-cover rounded-xl border border-slate-200 dark:border-slate-700 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                      />
                    </a>
                  </div>
                )}
              </div>

              {/* 코멘트 */}
              {currentUserProfile?.email === CEO_EMAIL ? (
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h5 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> 사장님 코멘트
                  </h5>
                  <div className="flex gap-2 items-start">
                    <textarea
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:text-white min-h-[60px] resize-y"
                      placeholder="코멘트를 입력하세요..."
                      value={commentInputs[report.id] || ""}
                      onChange={e => setCommentInputs({ ...commentInputs, [report.id]: e.target.value })}
                      disabled={isSavingComment === report.id}
                    />
                    <button onClick={() => handleSaveComment(report.id)} disabled={isSavingComment === report.id}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:bg-purple-400">
                      {isSavingComment === report.id ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              ) : report.manager_comment ? (
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h5 className="font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> 사장님 코멘트
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
