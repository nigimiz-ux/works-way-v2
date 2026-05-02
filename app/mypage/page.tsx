"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { User, Mail, Building2, Briefcase, Phone, Calendar, Shield, Edit3, Check, X } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Profile = {
  id: string;
  email: string;
  full_name: string;
  department: string;
  position: string;
  role: string;
  phone: string;
  hire_date: string;
  leave_days: number;
};

type Leave = {
  id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
};

type Expense = {
  id: number;
  usage_date: string;
  merchant: string;
  amount: number;
  purpose: string;
  status: string;
};

const ROLE_LABEL: Record<string, string> = {
  staff:    "사원",
  manager:  "팀장",
  director: "부장",
  admin:    "관리자",
};

const STATUS_COLOR: Record<string, string> = {
  "대기":    "bg-amber-100 text-amber-800 border-amber-200",
  "1차승인": "bg-blue-100 text-blue-800 border-blue-200",
  "승인":    "bg-green-100 text-green-800 border-green-200",
  "반려":    "bg-red-100 text-red-800 border-red-200",
};

export default function MyPage() {
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [leaves, setLeaves]         = useState<Leave[]>([]);
  const [expenses, setExpenses]     = useState<Expense[]>([]);
  const [tab, setTab]               = useState<"leave" | "expense">("leave");
  const [isLoading, setIsLoading]   = useState(true);
  const [isEditing, setIsEditing]   = useState(false);
  const [isSaving, setIsSaving]     = useState(false);

  // 편집용 임시 상태
  const [editPhone, setEditPhone]   = useState("");
  const [editName, setEditName]     = useState("");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setIsLoading(false); return; }

    const email = session.user.email!;

    // 프로필
    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .single();
    if (prof) {
      setProfile(prof);
      setEditPhone(prof.phone || "");
      setEditName(prof.full_name || "");
    }

    // 내 연차 내역 (최근 10건)
    const { data: leavesData } = await supabase
      .from("leaves")
      .select("id, leave_type, start_date, end_date, reason, status, created_at")
      .eq("applicant_email", email)
      .order("created_at", { ascending: false })
      .limit(10);
    setLeaves(leavesData || []);

    // 내 경비 내역 (최근 10건)
    const { data: expData } = await supabase
      .from("expenses")
      .select("id, usage_date, merchant, amount, purpose, status")
      .eq("applicant_email", email)
      .order("created_at", { ascending: false })
      .limit(10);
    setExpenses(expData || []);

    setIsLoading(false);
  };

  // 프로필 저장
  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: editName, phone: editPhone })
      .eq("id", profile.id);

    if (error) {
      alert("저장 실패: " + error.message);
    } else {
      setProfile(prev => prev ? { ...prev, full_name: editName, phone: editPhone } : prev);
      setIsEditing(false);
      alert("저장되었습니다.");
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        <svg className="animate-spin h-6 w-6 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        불러오는 중...
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center py-20 text-slate-400">로그인이 필요합니다.</div>;
  }

  // 연차 통계
  const leaveApproved = leaves.filter(l => l.status === "승인").length;
  const leavePending  = leaves.filter(l => l.status === "대기" || l.status === "1차승인").length;

  return (
    <div className="w-full animate-fade-in flex flex-col min-h-[calc(100vh-6rem)]">

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">마이페이지</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">내 정보와 신청 이력을 확인하세요.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── 왼쪽: 프로필 카드 ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* 프로필 카드 */}
          <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-6">

            {/* 아바타 + 이름 */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold text-white mb-3 shadow-lg">
                {profile.full_name?.charAt(0) ?? "?"}
              </div>
              {isEditing ? (
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="text-xl font-bold text-center bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1 w-full text-slate-900 dark:text-white border border-blue-400 focus:outline-none"
                />
              ) : (
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{profile.full_name}</h3>
              )}
              <span className="mt-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {ROLE_LABEL[profile.role] ?? profile.role}
              </span>
            </div>

            {/* 정보 목록 */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <Mail size={15} className="shrink-0 text-slate-400" />
                <span className="truncate">{profile.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <Building2 size={15} className="shrink-0 text-slate-400" />
                <span>{profile.department || "미지정"}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <Briefcase size={15} className="shrink-0 text-slate-400" />
                <span>{profile.position || "미지정"}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <Phone size={15} className="shrink-0 text-slate-400" />
                {isEditing ? (
                  <input
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    placeholder="연락처 입력"
                    className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 text-slate-900 dark:text-white border border-blue-400 focus:outline-none text-sm"
                  />
                ) : (
                  <span>{profile.phone || "미등록"}</span>
                )}
              </div>
              {profile.hire_date && (
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Calendar size={15} className="shrink-0 text-slate-400" />
                  <span>입사일: {profile.hire_date}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <Shield size={15} className="shrink-0 text-slate-400" />
                <span>권한: {ROLE_LABEL[profile.role] ?? profile.role}</span>
              </div>
            </div>

            {/* 편집 버튼 */}
            <div className="mt-5 flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check size={14} /> {isSaving ? "저장 중..." : "저장"}
                  </button>
                  <button
                    onClick={() => { setIsEditing(false); setEditPhone(profile.phone || ""); setEditName(profile.full_name || ""); }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
                  >
                    <X size={14} /> 취소
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                >
                  <Edit3 size={14} /> 정보 수정
                </button>
              )}
            </div>
          </div>

          {/* 연차 현황 카드 */}
          <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">🗓 연차 현황</h4>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                <div className="text-2xl font-bold text-blue-600">{profile.leave_days ?? 0}</div>
                <div className="text-xs text-slate-500 mt-1">잔여일</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-600">{leaveApproved}</div>
                <div className="text-xs text-slate-500 mt-1">승인됨</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                <div className="text-2xl font-bold text-amber-600">{leavePending}</div>
                <div className="text-xs text-slate-500 mt-1">대기중</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 오른쪽: 신청 이력 ── */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">

            {/* 탭 */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
              {(["leave", "expense"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    tab === t
                      ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {t === "leave" ? "🗓 연차 신청 이력" : "💳 경비 신청 이력"}
                </button>
              ))}
            </div>

            {/* 연차 이력 */}
            {tab === "leave" && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaves.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-sm">연차 신청 내역이 없습니다.</div>
                ) : leaves.map(l => (
                  <div key={l.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {l.leave_type === "half" ? "반차" : "연차"}
                        </span>
                        <span className="text-xs text-slate-400">{l.start_date} ~ {l.end_date}</span>
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">{l.reason}</div>
                    </div>
                    <span className={`shrink-0 ml-3 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${STATUS_COLOR[l.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 경비 이력 */}
            {tab === "expense" && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {expenses.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-sm">경비 신청 내역이 없습니다.</div>
                ) : expenses.map(e => (
                  <div key={e.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{e.merchant}</span>
                        <span className="text-xs text-slate-400">{e.usage_date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-blue-600">{Number(e.amount).toLocaleString()}원</span>
                        <span className="text-xs text-slate-500">{e.purpose}</span>
                      </div>
                    </div>
                    <span className={`shrink-0 ml-3 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${STATUS_COLOR[e.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {e.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
