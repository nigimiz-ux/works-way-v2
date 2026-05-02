"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import ExcelDownloadButton from "../components/ExcelDownloadButton";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Leave = {
  id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status?: string;
  applicant_email?: string;
  rejection_reason?: string;  // ← 추가
  created_at: string;
};

export default function LeaveApplicationPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState("full");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(true);
  const [userProfile, setUserProfile] = useState<{ full_name: string; department: string; leave_days: number } | null>(null);
  const [userEmail, setUserEmail] = useState("");

  const fetchLeavesAndProfile = async () => {
    setIsLoadingLeaves(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user?.email) {
      const email = session.user.email;
      setUserEmail(email);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, department, leave_days")
        .eq("email", email)
        .single();
      if (profile) setUserProfile(profile);

      // ── 핵심 수정: 본인 것만 + 전체 상태 조회 ──────────────
      const { data, error } = await supabase
        .from("leaves")
        .select("*")
        .eq("applicant_email", email)   // ← 본인 것만
        .order("created_at", { ascending: false });
        // ↑ 상태 필터 없음 → 승인/반려/대기 전부 표시

      if (error) console.error("연차 내역 로딩 에러:", error);
      else setLeaves(data || []);
    }
    setIsLoadingLeaves(false);
  };

  useEffect(() => { fetchLeavesAndProfile(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || (leaveType === "full" && !endDate) || !reason) {
      alert("모든 필수 항목을 입력해주세요.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email || "guest@unknown.com";

    let requestedDays = 0;
    if (leaveType === "half") {
      requestedDays = 0.5;
    } else {
      let curDate = new Date(startDate);
      const endD = new Date(endDate);
      while (curDate <= endD) {
        const d = curDate.getDay();
        if (d !== 0 && d !== 6) requestedDays++;
        curDate.setDate(curDate.getDate() + 1);
      }
    }

    if (requestedDays === 0) { alert("선택한 기간 중 평일이 없습니다."); return; }
    if (userProfile && requestedDays > userProfile.leave_days) {
      alert(`잔여 연차가 부족합니다. (잔여: ${userProfile.leave_days}일, 신청: ${requestedDays}일)`);
      return;
    }

    setIsSubmitting(true);
    const finalEndDate = leaveType === "half" ? startDate : endDate;

    const { error } = await supabase.from("leaves").insert([{
      applicant_email: email,
      leave_type: leaveType,
      start_date: startDate,
      end_date: finalEndDate,
      reason,
      status: "대기",
    }]);

    setIsSubmitting(false);

    if (error) { alert(`연차 신청에 실패했습니다: ${error.message}`); return; }

    if (userProfile) {
      fetch("/api/telegram-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantEmail: email, applicantName: userProfile.full_name,
          applicantDept: userProfile.department, startDate,
          endDate: finalEndDate, leaveType, reason, requestedDays,
        }),
      }).catch(err => console.error("텔레그램 알림 요청 에러:", err));
    }

    alert("연차 신청이 완료되었습니다.");
    setStartDate(""); setEndDate(""); setLeaveType("full"); setReason("");
    fetchLeavesAndProfile();
  };

  // 상태별 뱃지 스타일
  const statusStyle = (status?: string) => {
    if (status === "승인")   return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50";
    if (status === "반려")   return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50";
    if (status === "1차승인") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50";
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800/50";
  };

  return (
    <div className="w-full animate-fade-in flex flex-col min-h-[calc(100vh-6rem)]">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">연차 신청</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">개인 연차 및 반차 일정을 등록하고 결재를 요청합니다.</p>
        </div>
        {userProfile && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-2 rounded-lg flex items-center gap-2">
            <span className="text-blue-700 dark:text-blue-400 font-semibold text-sm">나의 잔여 연차:</span>
            <span className="text-blue-700 dark:text-blue-400 font-bold text-lg">{userProfile.leave_days}일</span>
          </div>
        )}
      </div>

      {/* 신청 폼 */}
      <div className="bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden w-full max-w-3xl mx-auto mt-4 mb-10">
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">연차 종류</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="leaveType" value="full" checked={leaveType === "full"} onChange={(e) => setLeaveType(e.target.value)}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">연차 (종일)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="leaveType" value="half" checked={leaveType === "half"} onChange={(e) => setLeaveType(e.target.value)}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">반차 (오전/오후)</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">시작일</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">종료일</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  required={leaveType === "full"} min={startDate} disabled={leaveType === "half"}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white disabled:opacity-50" />
                {leaveType === "half" && <p className="text-xs text-slate-500 mt-1">반차는 하루만 신청 가능합니다.</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">신청 사유</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} required
                placeholder="연차 신청 사유를 입력해주세요." rows={4}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white resize-none placeholder-slate-400" />
            </div>

            <div className="pt-2 flex justify-end">
              <button type="submit" disabled={isSubmitting}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {isSubmitting && (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                )}
                {isSubmitting ? "신청 중..." : "신청하기"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 내역 테이블 */}
      <div className="w-full max-w-5xl mx-auto mt-2">
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">내 연차 신청 내역</h3>
          <ExcelDownloadButton type="leave" data={leaves} />
        </div>

        <div className="bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mb-10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">연차 종류</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">시작일</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">종료일</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400">사유 / 반려사유</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 text-center whitespace-nowrap">결재 상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {isLoadingLeaves ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">신청 내역을 불러오는 중...</td>
                  </tr>
                ) : leaves.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">신청한 연차 내역이 없습니다.</td>
                  </tr>
                ) : (
                  leaves.map((leave) => (
                    <tr key={leave.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        leave.status === "반려" ? "bg-red-50/40 dark:bg-red-900/10" : ""
                      }`}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-slate-200">
                        {leave.leave_type === "half" ? "반차" : "연차"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-400">{leave.start_date}</td>
                      <td className="px-6 py-4 whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-400">{leave.end_date}</td>

                      {/* ── 사유 + 반려사유 표시 ── */}
                      <td className="px-6 py-4 max-w-xs">
                        <div className="text-slate-600 dark:text-slate-400">{leave.reason}</div>
                        {leave.status === "반려" && leave.rejection_reason && (
                          <div className="mt-1.5 flex items-start gap-1 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/50">
                            <span className="shrink-0 text-xs font-bold text-red-600 dark:text-red-400">반려사유</span>
                            <span className="text-xs text-red-600 dark:text-red-400 break-words">{leave.rejection_reason}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${statusStyle(leave.status)}`}>
                          {leave.status || "대기"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
