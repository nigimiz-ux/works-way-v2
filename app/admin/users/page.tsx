"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Users, UserCheck, Shield, CalendarDays,
  Search, Save, X, ChevronDown
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Profile = {
  id: string;
  email: string;
  full_name: string;
  position: string;
  department: string;
  role: string;
  leave_days: number;
  is_approved: boolean;
  phone: string;
  hire_date: string;
};

const ROLE_OPTIONS = [
  { value: "staff",    label: "사원" },
  { value: "manager",  label: "팀장" },
  { value: "director", label: "부장" },
  { value: "admin",    label: "관리자" },
];

const ROLE_BADGE: Record<string, string> = {
  staff:    "bg-slate-100 text-slate-700 border-slate-200",
  manager:  "bg-blue-100 text-blue-700 border-blue-200",
  director: "bg-purple-100 text-purple-700 border-purple-200",
  admin:    "bg-red-100 text-red-700 border-red-200",
};

const ROLE_LABEL: Record<string, string> = {
  staff: "사원", manager: "팀장", director: "부장", admin: "관리자"
};

type TabType = "all" | "pending";

export default function AdminPanelPage() {
  const [isAdmin, setIsAdmin]       = useState<boolean | null>(null);
  const [users, setUsers]           = useState<Profile[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [tab, setTab]               = useState<TabType>("all");
  const [search, setSearch]         = useState("");
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [savingId, setSavingId]     = useState<string | null>(null);

  // 편집 임시값
  const [editRole, setEditRole]       = useState("");
  const [editDept, setEditDept]       = useState("");
  const [editLeave, setEditLeave]     = useState<number>(0);
  const [editPosition, setEditPosition] = useState("");

  useEffect(() => { init(); }, []);

  const init = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setIsAdmin(false); setIsLoading(false); return; }

    const { data: me } = await supabase
      .from("profiles").select("role").eq("id", session.user.id).single();

    if (!["admin", "director"].includes(me?.role ?? "")) {
      setIsAdmin(false); setIsLoading(false); return;
    }
    setIsAdmin(true);
    await fetchUsers();
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("department", { ascending: true });
    if (!error && data) setUsers(data as Profile[]);
    setIsLoading(false);
  };

  // 편집 시작
  const startEdit = (user: Profile) => {
    setEditingId(user.id);
    setEditRole(user.role || "staff");
    setEditDept(user.department || "");
    setEditLeave(user.leave_days ?? 0);
    setEditPosition(user.position || "");
  };

  // 편집 저장
  const saveEdit = async (user: Profile) => {
    setSavingId(user.id);
    const { error } = await supabase
      .from("profiles")
      .update({
        role:       editRole,
        department: editDept,
        leave_days: editLeave,
        position:   editPosition,
      })
      .eq("id", user.id);

    if (error) {
      alert("저장 실패: " + error.message);
    } else {
      setUsers(prev => prev.map(u =>
        u.id === user.id
          ? { ...u, role: editRole, department: editDept, leave_days: editLeave, position: editPosition }
          : u
      ));
      setEditingId(null);

      // 역할 변경 시 알림 전송
      if (editRole !== user.role) {
        await supabase.from("notifications").insert({
          user_email: user.email,
          message: `권한이 '${ROLE_LABEL[editRole]}'(으)로 변경되었습니다.`,
          link: "/mypage",
          is_read: false,
        });
      }
    }
    setSavingId(null);
  };

  // 가입 승인
  const handleApprove = async (id: string, email: string) => {
    const { error } = await supabase
      .from("profiles").update({ is_approved: true }).eq("id", id);
    if (error) { alert("승인 오류: " + error.message); return; }

    await supabase.from("notifications").insert({
      user_email: email,
      message: "가입이 승인되었습니다. Work's Way에 오신 것을 환영합니다!",
      link: "/",
      is_read: false,
    });
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_approved: true } : u));
    alert("승인되었습니다.");
  };

  // 필터링
  const filtered = users.filter(u => {
    const matchTab    = tab === "pending" ? !u.is_approved : true;
    const matchSearch = search === "" ||
      u.full_name?.includes(search) ||
      u.email?.includes(search) ||
      u.department?.includes(search);
    return matchTab && matchSearch;
  });

  const pendingCount = users.filter(u => !u.is_approved).length;

  // ── 접근 불가 ────────────────────────────────────────────
  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Shield size={48} className="mb-4 opacity-30" />
        <p className="text-lg font-medium">접근 권한이 없습니다</p>
        <p className="text-sm mt-1">관리자(부장·관리자) 권한이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in flex flex-col min-h-[calc(100vh-6rem)]">

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Shield size={22} className="text-blue-500" />
            관리자 패널
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            직원 권한·부서·연차를 관리합니다.
          </p>
        </div>

        {/* 요약 카드 */}
        <div className="flex gap-3">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-center min-w-[80px]">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{users.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">전체 직원</div>
          </div>
          <div className="bg-white dark:bg-slate-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-center min-w-[80px]">
            <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">승인 대기</div>
          </div>
        </div>
      </div>

      {/* 탭 + 검색 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-2">
          {(["all", "pending"] as TabType[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                tab === t
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              }`}>
              {t === "all" ? "전체 직원" : "승인 대기"}
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                tab === t ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              }`}>
                {t === "all" ? users.length : pendingCount}
              </span>
            </button>
          ))}
        </div>

        {/* 검색 */}
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름·이메일·부서 검색..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-400">직원</th>
                <th className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-400">부서 / 직급</th>
                <th className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-400 text-center">권한</th>
                <th className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-400 text-center">잔여연차</th>
                <th className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-400 text-center">가입</th>
                <th className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-400 text-center w-32">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    불러오는 중...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    <Users size={32} className="mx-auto mb-2 opacity-20" />
                    {tab === "pending" ? "승인 대기 직원이 없습니다." : "직원이 없습니다."}
                  </td>
                </tr>
              ) : (
                filtered.map(user => {
                  const isEditing = editingId === user.id;
                  const isSaving  = savingId === user.id;

                  return (
                    <tr key={user.id}
                      className={`transition-colors ${
                        isEditing
                          ? "bg-blue-50/50 dark:bg-blue-900/10"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}>

                      {/* 직원 */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                            {user.full_name?.charAt(0) ?? "?"}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">{user.full_name}</div>
                            <div className="text-xs text-slate-400 truncate max-w-[160px]">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* 부서/직급 */}
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <input value={editDept} onChange={e => setEditDept(e.target.value)}
                              placeholder="부서명"
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white" />
                            <input value={editPosition} onChange={e => setEditPosition(e.target.value)}
                              placeholder="직급"
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white" />
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{user.department || "미지정"}</div>
                            <div className="text-xs text-slate-400">{user.position || "미지정"}</div>
                          </div>
                        )}
                      </td>

                      {/* 권한 */}
                      <td className="px-5 py-4 text-center">
                        {isEditing ? (
                          <div className="relative inline-block">
                            <select value={editRole} onChange={e => setEditRole(e.target.value)}
                              className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-white dark:bg-slate-900 border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white cursor-pointer">
                              {ROLE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${ROLE_BADGE[user.role] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
                            {ROLE_LABEL[user.role] ?? user.role}
                          </span>
                        )}
                      </td>

                      {/* 잔여연차 */}
                      <td className="px-5 py-4 text-center">
                        {isEditing ? (
                          <input
                            type="number" min="0" max="30" step="0.5"
                            value={editLeave}
                            onChange={e => setEditLeave(Number(e.target.value))}
                            className="w-20 px-2 py-1.5 text-center text-xs bg-white dark:bg-slate-900 border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                          />
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <CalendarDays size={14} className="text-slate-400" />
                            <span className={`font-bold ${(user.leave_days ?? 0) <= 3 ? "text-red-500" : "text-slate-700 dark:text-slate-300"}`}>
                              {user.leave_days ?? 0}일
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 가입 상태 */}
                      <td className="px-5 py-4 text-center">
                        {user.is_approved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                            <UserCheck size={11} /> 승인
                          </span>
                        ) : (
                          <button onClick={() => handleApprove(user.id, user.email)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-200 rounded-md transition-colors">
                            대기 → 승인
                          </button>
                        )}
                      </td>

                      {/* 관리 버튼 */}
                      <td className="px-5 py-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => saveEdit(user)} disabled={isSaving}
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50">
                              <Save size={12} />
                              {isSaving ? "저장중" : "저장"}
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(user)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors border border-slate-200 dark:border-slate-700">
                            수정
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 하단 안내 */}
        {!isLoading && (
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 flex items-center gap-1.5">
            <Shield size={12} />
            수정 버튼 클릭 후 부서·직급·권한·연차를 변경하고 저장하세요. 권한 변경 시 해당 직원에게 알림이 전송됩니다.
          </div>
        )}
      </div>
    </div>
  );
}
