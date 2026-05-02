"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

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
  rejection_reason?: string;
  applicant_email?: string;
  applicant_name?: string;
  applicant_dept?: string;
  created_at: string;
};

export default function ApprovalsPage() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchLeaves = async () => {
    setIsLoading(true);
    
    // 1. 관리자 정보(부서) 가져오기
    const { data: { session } } = await supabase.auth.getSession();
    let adminDept = "";
    
    if (session?.user) {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", session.user.id);
      adminDept = adminProfiles?.[0]?.department || "";
    }

    // 2. 전체 휴가 데이터 가져오기
    const { data: leavesData, error: leavesError } = await supabase
      .from("leaves")
      .select("*")
      .order("created_at", { ascending: false });

    if (leavesError) {
      console.error("결재 내역 로딩 에러:", leavesError);
      setIsLoading(false);
      return;
    }

    const fetchedLeaves = leavesData || [];

    // 3. 신청자들의 이메일만 추출해서 profiles 정보 별도 가져오기 (매핑용)
    const emails = Array.from(new Set(fetchedLeaves.map(l => l.applicant_email).filter(Boolean)));
    let profilesMap: Record<string, any> = {};
    
    if (emails.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("email, full_name, department")
        .in("email", emails);
        
      if (profilesData) {
        profilesData.forEach(p => {
          if (p.email) {
            profilesMap[p.email] = p;
          }
        });
      }
    }

    // 4. 데이터 매핑 및 스마트 필터링 적용
    const enrichedLeaves = fetchedLeaves.map(leave => {
      const profile = leave.applicant_email ? profilesMap[leave.applicant_email] : null;
      return {
        ...leave,
        applicant_name: profile?.full_name || "이름 없음",
        applicant_dept: profile?.department || "소속 없음"
      };
    });

    const filteredLeaves = enrichedLeaves.filter(leave => {
      if (adminDept === "경영진") return true;
      return leave.applicant_dept === adminDept;
    });

    setLeaves(filteredLeaves as any);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleUpdateStatus = async (id: number, newStatus: string, isReject: boolean = false) => {
    let rejectionReason = null;
    
    if (isReject) {
      const reason = window.prompt("반려 사유를 입력해주세요. (선택사항)");
      if (reason === null) return; // 사용자가 취소를 누른 경우
      if (reason.trim() !== "") {
        rejectionReason = reason;
      }
    }

    if (!window.confirm(`정말 ${newStatus} 처리하시겠습니까?`)) return;

    setUpdatingId(id);

    // 업데이트할 데이터 객체 구성
    const updateData: any = { status: newStatus };
    if (rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    // 1. leaves 테이블 상태 변경
    const { error } = await supabase
      .from("leaves")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error("상태 업데이트 에러:", error);
      setUpdatingId(null);
      
      // 만약 rejection_reason 컬럼이 없어 에러가 난다면 status에 사유를 붙여서 재시도
      if (error.message.includes("rejection_reason") || error.code === "PGRST204") {
        const fallbackStatus = rejectionReason ? `${newStatus} (사유: ${rejectionReason})` : newStatus;
        const { error: fallbackError } = await supabase
          .from("leaves")
          .update({ status: fallbackStatus })
          .eq("id", id);
          
        if (fallbackError) {
           alert(`상태 업데이트에 실패했습니다: ${fallbackError.message}`);
           return;
        } else {
           // 상태만 업데이트 성공 (fallback)
           setLeaves((prev) => 
            prev.map((leave) => (leave.id === id ? { ...leave, status: fallbackStatus } : leave))
           );
           alert(`${newStatus} 처리가 완료되었습니다.`);
           return;
        }
      }

      alert(`상태 업데이트에 실패했습니다: ${error.message}`);
      return;
    }

    // 2. 승인 시 잔여 연차 차감 로직 (에러 처리 추가)
    if (newStatus === "승인") {
      const leave = leaves.find((l) => l.id === id);
      if (leave && leave.applicant_email && leave.status !== "승인") {
        // 연차 소진일 수 계산 (주말 제외)
        let requestedDays = 0;
        if (leave.leave_type === "half") {
          requestedDays = 0.5;
        } else {
          let curDate = new Date(leave.start_date);
          const endD = new Date(leave.end_date);
          while (curDate <= endD) {
            const dayOfWeek = curDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 일요일(0), 토요일(6) 제외
              requestedDays += 1;
            }
            curDate.setDate(curDate.getDate() + 1);
          }
        }

        // profiles 연차 차감 로직
        if (requestedDays > 0) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("leave_days")
            .eq("email", leave.applicant_email)
            .single();

          if (profileError) {
             console.error("프로필 조회 에러:", profileError);
             alert("사용자 연차 정보를 불러오는 데 실패했습니다.");
          } else if (profileData && profileData.leave_days !== null) {
            const newLeaveDays = profileData.leave_days - requestedDays;
            const { error: updateError } = await supabase
              .from("profiles")
              .update({ leave_days: newLeaveDays })
              .eq("email", leave.applicant_email);
              
            if (updateError) {
               console.error("연차 차감 에러:", updateError);
               alert("연차 차감 중 에러가 발생했습니다.");
            }
          }
        }
      }
    }

    setUpdatingId(null);

    // 성공 시 로컬 상태 즉시 업데이트 (새로고침 없이 반영)
    setLeaves((prev) => 
      prev.map((leave) => 
        leave.id === id 
          ? { ...leave, status: newStatus, rejection_reason: rejectionReason || leave.rejection_reason } 
          : leave
      )
    );
    
    alert(`${newStatus} 처리가 완료되었습니다.`);
  };

  return (
    <div className="w-full animate-fade-in flex flex-col min-h-[calc(100vh-6rem)]">
      {/* Title Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">결재함 (관리자)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">모든 직원의 연차 신청 내역을 확인하고 승인/반려를 처리합니다.</p>
        </div>
        <button 
          onClick={fetchLeaves}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 border border-slate-200 dark:border-slate-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          새로고침
        </button>
      </div>

      {/* Main Table Content */}
      <div className="bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden w-full mx-auto mt-4 mb-10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap w-20 text-center">ID</th>
                <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap w-32">부서</th>
                <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap min-w-[150px]">신청자</th>
                <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap w-24">연차 종류</th>
                <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap w-32">시작일</th>
                <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap w-32">종료일</th>
                <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap min-w-[200px]">사유</th>
                <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 w-28 text-center whitespace-nowrap">결재 상태</th>
                <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 w-40 text-center whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-transparent">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex justify-center items-center gap-2">
                       <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      결재 내역을 불러오는 중...
                    </div>
                  </td>
                </tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                    등록된 연차 신청 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                leaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-slate-700 dark:text-slate-300">
                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-400 tabular-nums">{leave.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {leave.applicant_dept}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900 dark:text-slate-200">{leave.applicant_name}</span>
                        <span className="text-xs text-slate-400 mt-0.5">{leave.applicant_email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-slate-200">
                      {leave.leave_type === 'half' ? '반차' : '연차'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap tabular-nums">{leave.start_date}</td>
                    <td className="px-6 py-4 whitespace-nowrap tabular-nums">{leave.end_date}</td>
                    <td className="px-6 py-4">
                      <div className="truncate max-w-xs xl:max-w-md">{leave.reason}</div>
                      {leave.rejection_reason && (
                        <div className="text-xs text-red-500 mt-1 flex items-start gap-1">
                          <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="truncate">반려사유: {leave.rejection_reason}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap border ${
                        leave.status === '승인' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50'
                          : leave.status === '반려' || leave.status?.includes('반려')
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800/50'
                      }`}>
                        {leave.status || '대기중'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleUpdateStatus(leave.id, "승인", false)}
                          disabled={updatingId === leave.id || leave.status === "승인"}
                          className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(leave.id, "반려", true)}
                          disabled={updatingId === leave.id || leave.status === "반려"}
                          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          반려
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
