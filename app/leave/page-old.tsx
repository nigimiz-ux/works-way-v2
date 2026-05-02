"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import ExcelDownloadButton from "../components/ExcelDownloadButton";

// 환경변수를 사용하여 Supabase 클라이언트 초기화
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
  created_at: string;
};

export default function LeaveApplicationPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState("full"); // "full" | "half"
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(true);

  const [userProfile, setUserProfile] = useState<{ full_name: string; department: string; leave_days: number } | null>(null);

  const fetchLeavesAndProfile = async () => {
    setIsLoadingLeaves(true);

    // 유저 프로필(잔여 연차 등) 가져오기
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, department, leave_days")
        .eq("email", session.user.email)
        .single();

      if (profile) {
        setUserProfile(profile);
      }
    }

    const { data, error } = await supabase
      .from("leaves")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("연차 내역 로딩 에러:", error);
    } else {
      setLeaves(data || []);
    }
    setIsLoadingLeaves(false);
  };

  useEffect(() => {
    fetchLeavesAndProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || (leaveType === "full" && !endDate) || !reason) {
      alert("모든 필수 항목을 입력해주세요.");
      return;
    }

    // 현재 로그인된 유저 세션 가져오기
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email || "guest@unknown.com";

    // 1. 소진되는 연차 일수 계산 (주말 제외)
    let requestedDays = 0;
    if (leaveType === "half") {
      requestedDays = 0.5;
    } else {
      let curDate = new Date(startDate);
      const endD = new Date(endDate);
      while (curDate <= endD) {
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 일요일(0), 토요일(6) 제외
          requestedDays += 1;
        }
        curDate.setDate(curDate.getDate() + 1);
      }
    }

    if (requestedDays === 0) {
      alert("선택한 기간 중 평일이 없어 연차를 신청할 수 없습니다.");
      return;
    }

    // 2. 잔여 연차 부족 시 차단
    if (userProfile && (userProfile.leave_days <= 0 || requestedDays > userProfile.leave_days)) {
      alert(`잔여 연차가 부족합니다. (잔여: ${userProfile.leave_days}일, 신청: ${requestedDays}일)`);
      return;
    }

    setIsSubmitting(true);

    // DB 저장 로직 (반차일 경우 endDate는 startDate와 동일하게 처리)
    const finalEndDate = leaveType === "half" ? startDate : endDate;

    const { error } = await supabase.from("leaves").insert([
      {
        applicant_email: userEmail,
        leave_type: leaveType,
        start_date: startDate,
        end_date: finalEndDate,
        reason: reason,
      }
    ]);

    setIsSubmitting(false);

    if (error) {
      console.error("연차 신청 에러:", error);
      alert(`연차 신청에 실패했습니다: ${error.message}`);
      return;
    }

    // 3. 스마트 텔레그램 알림 API 호출
    if (userProfile) {
      fetch("/api/telegram-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantEmail: userEmail,
          applicantName: userProfile.full_name,
          applicantDept: userProfile.department,
          startDate,
          endDate: finalEndDate,
          leaveType,
          reason,
          requestedDays
        })
      }).catch(err => console.error("텔레그램 알림 요청 에러:", err));
    }

    alert("연차 신청이 완료되었습니다.");
    // 폼 초기화
    setStartDate("");
    setEndDate("");
    setLeaveType("full");
    setReason("");

    // 목록 새로고침
    fetchLeavesAndProfile();
  };

  return (
    <div className="w-full animate-fade-in flex flex-col min-h-[calc(100vh-6rem)]">
      {/* Title Section */}
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
        <ExcelDownloadButton type="leave" data={leaves} />
      </div>

      {/* Main Form Content */}
      <div className="bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden w-full max-w-3xl mx-auto mt-4 mb-10">
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* 연차 종류 (Leave Type) */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">연차 종류</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="leaveType"
                    value="full"
                    checked={leaveType === "full"}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:ring-offset-slate-950"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">연차 (종일)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="leaveType"
                    value="half"
                    checked={leaveType === "half"}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:ring-offset-slate-950"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">반차 (오전/오후)</span>
                </label>
              </div>
            </div>

            {/* 시작일 및 종료일 (Date Range) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">시작일</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">종료일</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow text-slate-900 dark:text-white"
                  required={leaveType === "full"}
                  min={startDate} // 종료일은 시작일 이후여야 함
                  disabled={leaveType === "half"} // 반차일 경우 종료일 입력 비활성화
                />
                {leaveType === "half" && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">반차는 하루만 신청 가능합니다.</p>
                )}
              </div>
            </div>

            {/* 사유 (Reason) */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">신청 사유</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 h-32 resize-none"
                placeholder="연차 신청 사유를 입력해주세요. (예: 개인 사정, 병원 진료 등)"
                required
              ></textarea>
            </div>

            {/* 제출 버튼 */}
            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isSubmitting ? "신청 중..." : "신청하기"}
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* My Leave Application History Table */}
      <div className="w-full max-w-5xl mx-auto mt-2">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 px-2">내 연차 신청 내역</h3>
        <div className="bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mb-10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap w-24">연차 종류</th>
                  <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap w-32">시작일</th>
                  <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap w-32">종료일</th>
                  <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">사유</th>
                  <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 w-28 text-center whitespace-nowrap">결재 상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-transparent">
                {isLoadingLeaves ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      신청 내역을 불러오는 중...
                    </td>
                  </tr>
                ) : leaves.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      신청한 연차 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  leaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-slate-700 dark:text-slate-300">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-slate-200">
                        {leave.leave_type === 'half' ? '반차' : '연차'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap tabular-nums">{leave.start_date}</td>
                      <td className="px-6 py-4 whitespace-nowrap tabular-nums">{leave.end_date}</td>
                      <td className="px-6 py-4 truncate max-w-sm">{leave.reason}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 whitespace-nowrap">
                          {leave.status || '대기중'}
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
