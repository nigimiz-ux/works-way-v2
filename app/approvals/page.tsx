"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── 타입 정의 ───────────────────────────────────────────────
type RequestItem = {
  request_type: "leave" | "expense";
  ref_id: number;
  requester_email: string;
  requester_name: string;
  requester_dept: string;
  detail: string;       // 연차종류 or 지출카테고리
  start_info: string;   // 시작일 or 지출일
  end_info: string;     // 종료일 or 가맹점
  note: string;         // 사유 or 목적
  current_status: string;
  created_at: string;
};

type TabType = "all" | "leave" | "expense";

// ─── 상태 뱃지 ───────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "대기":   "bg-amber-100 text-amber-800 border-amber-200",
    "1차승인": "bg-blue-100 text-blue-800 border-blue-200",
    "승인":   "bg-green-100 text-green-800 border-green-200",
    "반려":   "bg-red-100 text-red-800 border-red-200",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export default function ApprovalsPage() {
  const [items, setItems]           = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [tab, setTab]               = useState<TabType>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [myRole, setMyRole]         = useState<string>("");
  const [myDept, setMyDept]         = useState<string>("");
  const [myEmail, setMyEmail]       = useState<string>("");

  // ── 데이터 로드 ──────────────────────────────────────────
  const fetchAll = async () => {
    setIsLoading(true);

    // 내 정보
    const { data: { session } } = await supabase.auth.getSession();
    let role = "", dept = "", email = "";
    if (session?.user) {
      email = session.user.email ?? "";
      const { data: me } = await supabase
        .from("profiles")
        .select("role, department")
        .eq("id", session.user.id)
        .single();
      role = me?.role ?? "staff";
      dept = me?.department ?? "";
    }
    setMyRole(role);
    setMyDept(dept);
    setMyEmail(email);

    // v_pending_approvals View 사용 — 연차+경비 한 번에
    const { data, error } = await supabase
      .from("v_pending_approvals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("결재 데이터 로딩 오류:", error);
      setIsLoading(false);
      return;
    }

    // 역할별 필터: admin/director는 전체, manager는 본인 부서만
    const filtered = (data ?? []).filter((item: any) => {
      if (role === "admin" || role === "director") return true;
      if (role === "manager") return item.requester_dept === dept;
      return false; // staff는 결재함 접근 불가
    });

    setItems(filtered as RequestItem[]);
    setIsLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ── 탭 필터 ─────────────────────────────────────────────
  const displayed = items.filter(item =>
    tab === "all" ? true : item.request_type === tab
  );

  const countByTab = {
    all:     items.length,
    leave:   items.filter(i => i.request_type === "leave").length,
    expense: items.filter(i => i.request_type === "expense").length,
  };

  // ── 결재 처리 ────────────────────────────────────────────
  const handleDecision = async (
    item: RequestItem,
    decision: "승인" | "반려"
  ) => {
    let comment = "";
    if (decision === "반려") {
      const input = window.prompt("반려 사유를 입력해주세요.");
      if (input === null) return;
      comment = input.trim();
    }
    if (!window.confirm(`${decision} 처리하시겠습니까?`)) return;

    const key = `${item.request_type}-${item.ref_id}`;
    setUpdatingId(key);

    const table = item.request_type === "leave" ? "leaves" : "expenses";

    // 결재자 역할에 따라 단계 결정
    let updateData: Record<string, any> = {};

    if (myRole === "admin" || myRole === "director") {
      // 최종 결재
      updateData = {
        status: decision,
        ...(decision === "반려" && comment ? { rejection_reason: comment } : {}),
        ...(decision === "승인" ? { approved_at: new Date().toISOString() } : { rejected_at: new Date().toISOString() }),
      };
    } else if (myRole === "manager") {
      // 1차 결재: 승인이면 1차승인, 반려면 바로 반려
      updateData = {
        status: decision === "승인" ? "1차승인" : "반려",
        manager_status: decision,
        manager_comment: comment,
        ...(decision === "반려" ? { rejected_at: new Date().toISOString() } : {}),
      };
    }

    const { error } = await supabase
      .from(table)
      .update(updateData)
      .eq("id", item.ref_id);

    if (error) {
      alert(`처리 실패: ${error.message}`);
      setUpdatingId(null);
      return;
    }

    // 연차 승인 시 잔여일 차감
    if (item.request_type === "leave" && decision === "승인" && (myRole === "admin" || myRole === "director")) {
      const start = new Date(item.start_info);
      const end   = new Date(item.end_info);
      let days = 0;
      if (item.detail === "half") {
        days = 0.5;
      } else {
        let cur = new Date(start);
        while (cur <= end) {
          const d = cur.getDay();
          if (d !== 0 && d !== 6) days++;
          cur.setDate(cur.getDate() + 1);
        }
      }
      if (days > 0) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("leave_days")
          .eq("email", item.requester_email)
          .single();
        if (prof?.leave_days != null) {
          await supabase
            .from("profiles")
            .update({ leave_days: prof.leave_days - days })
            .eq("email", item.requester_email);
        }
      }
    }

    // 알림 기록 (notifications 테이블)
    await supabase.from("notifications").insert({
      user_email: item.requester_email,
      message: `${item.request_type === "leave" ? "연차" : "경비"} 신청이 ${myRole === "manager" ? "1차 " : ""}${decision} 처리되었습니다.`,
      is_read: false,
      link: item.request_type === "leave" ? "/leave" : "/expense",
    });

    setUpdatingId(null);

    // 목록에서 해당 항목 제거 (처리 완료)
    setItems(prev => prev.filter(i => !(i.request_type === item.request_type && i.ref_id === item.ref_id)));
    alert(`${decision} 처리가 완료되었습니다.`);
  };

  // ── 접근 권한 없음 ───────────────────────────────────────
  if (!isLoading && myRole === "staff") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-lg font-medium">접근 권한이 없습니다</p>
        <p className="text-sm mt-1">결재함은 팀장 이상만 사용할 수 있습니다.</p>
      </div>
    );
  }

  // ── UI ──────────────────────────────────────────────────
  return (
    <div className="w-full animate-fade-in flex flex-col min-h-[calc(100vh-6rem)]">

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            통합 결재함
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {myRole === "manager"
              ? `${myDept} 소속 직원의 결재 대기 항목입니다.`
              : "전체 부서의 결재 대기 항목입니다."}
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 border border-slate-200 dark:border-slate-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          새로고침
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        {(["all", "leave", "expense"] as TabType[]).map(t => {
          const labels: Record<TabType, string> = { all: "전체", leave: "연차", expense: "법인카드·경비" };
          const isActive = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                isActive
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              }`}
            >
              {labels[t]}
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                isActive ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              }`}>
                {countByTab[t]}
              </span>
            </button>
          );
        })}
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-4 font-semibold text-slate-600 dark:text-slate-400 w-24 text-center">구분</th>
                <th className="px-4 py-4 font-semibold text-slate-600 dark:text-slate-400">신청자</th>
                <th className="px-4 py-4 font-semibold text-slate-600 dark:text-slate-400">내용</th>
                <th className="px-4 py-4 font-semibold text-slate-600 dark:text-slate-400">날짜 / 금액</th>
                <th className="px-4 py-4 font-semibold text-slate-600 dark:text-slate-400">사유·목적</th>
                <th className="px-4 py-4 font-semibold text-slate-600 dark:text-slate-400 text-center w-24">상태</th>
                <th className="px-4 py-4 font-semibold text-slate-600 dark:text-slate-400 text-center w-36">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                    <div className="flex justify-center items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      불러오는 중...
                    </div>
                  </td>
                </tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                    <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    대기 중인 결재 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                displayed.map((item) => {
                  const key = `${item.request_type}-${item.ref_id}`;
                  const isUpdating = updatingId === key;
                  const isLeave = item.request_type === "leave";

                  return (
                    <tr key={key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-slate-700 dark:text-slate-300">

                      {/* 구분 뱃지 */}
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold border ${
                          isLeave
                            ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
                            : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800"
                        }`}>
                          {isLeave ? "🗓 연차" : "💳 경비"}
                        </span>
                      </td>

                      {/* 신청자 */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 shrink-0">
                            {(item.requester_name ?? "?")[0]}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {item.requester_name ?? "알 수 없음"}
                            </div>
                            <div className="text-xs text-slate-400">{item.requester_dept}</div>
                          </div>
                        </div>
                      </td>

                      {/* 내용 */}
                      <td className="px-4 py-4 font-medium">
                        {isLeave
                          ? (item.detail === "half" ? "반차" : "연차")
                          : (item.detail || "기타")}
                      </td>

                      {/* 날짜/금액 */}
                      <td className="px-4 py-4 tabular-nums text-slate-500 dark:text-slate-400">
                        {isLeave
                          ? <span>{item.start_info} ~ {item.end_info}</span>
                          : <span>{item.start_info}<br/><span className="text-xs">{item.end_info}</span></span>
                        }
                      </td>

                      {/* 사유 */}
                      <td className="px-4 py-4 max-w-xs">
                        <div className="truncate text-slate-500 dark:text-slate-400">{item.note || "-"}</div>
                      </td>

                      {/* 상태 */}
                      <td className="px-4 py-4 text-center">
                        <StatusBadge status={item.current_status} />
                      </td>

                      {/* 처리 버튼 */}
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleDecision(item, "승인")}
                            disabled={isUpdating || item.current_status === "승인"}
                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isUpdating ? "⏳" : "승인"}
                          </button>
                          <button
                            onClick={() => handleDecision(item, "반려")}
                            disabled={isUpdating || item.current_status === "반려"}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            반려
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 하단 안내 */}
        {!isLoading && displayed.length > 0 && (
          <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {myRole === "manager" ? "팀장 권한: 1차 승인 처리 후 상위 결재자에게 전달됩니다." : "최종 결재 권한입니다. 승인 시 연차는 즉시 차감됩니다."}
          </div>
        )}
      </div>
    </div>
  );
}
