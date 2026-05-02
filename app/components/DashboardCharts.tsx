"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { Clock, FileText, CreditCard, CheckCircle } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── 색상 ──────────────────────────────────────────────────────
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

// ── 숫자 카드 ─────────────────────────────────────────────────
function StatCard({
  label, value, unit, icon, color,
}: {
  label: string; value: number; unit: string;
  icon: React.ReactNode; color: string;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cur = 0;
    const step = Math.ceil(value / 30);
    const t = setInterval(() => {
      cur += step;
      if (cur >= value) { setCount(value); clearInterval(t); }
      else setCount(cur);
    }, 20);
    return () => clearInterval(t);
  }, [value]);

  return (
    <div className="bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:shadow-md transition-shadow group">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
          {count}
          <span className="text-base font-medium text-slate-400 ml-1">{unit}</span>
        </h3>
      </div>
      <div className={`w-11 h-11 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${color}`}>
        {icon}
      </div>
    </div>
  );
}

// ── 메인 대시보드 컴포넌트 ────────────────────────────────────
export default function DashboardCharts({
  pendingLeaveCount,
  totalPostCount,
}: {
  pendingLeaveCount: number;
  totalPostCount: number;
}) {
  // 차트 데이터 상태
  const [leaveByDept, setLeaveByDept]     = useState<any[]>([]);
  const [expenseByCategory, setExpenseByCategory] = useState<any[]>([]);
  const [projectStatus, setProjectStatus] = useState<any[]>([]);
  const [pendingExpense, setPendingExpense] = useState(0);
  const [approvedToday, setApprovedToday]  = useState(0);
  const [isLoading, setIsLoading]          = useState(true);

  useEffect(() => {
    const load = async () => {
      // 1. 부서별 연차 현황
      const { data: leaves } = await supabase
        .from("leaves")
        .select("applicant_email, status");

      const { data: profiles } = await supabase
        .from("profiles")
        .select("email, department");

      if (leaves && profiles) {
        const deptMap: Record<string, { 대기: number; 승인: number; 반려: number }> = {};
        const emailToDept: Record<string, string> = {};
        profiles.forEach((p: any) => { emailToDept[p.email] = p.department || "미분류"; });

        leaves.forEach((l: any) => {
          const dept = emailToDept[l.applicant_email] || "미분류";
          if (!deptMap[dept]) deptMap[dept] = { 대기: 0, 승인: 0, 반려: 0 };
          const s = l.status === "1차승인" ? "대기" : (l.status || "대기");
          if (s in deptMap[dept]) deptMap[dept][s as keyof typeof deptMap[string]]++;
        });

        setLeaveByDept(
          Object.entries(deptMap).map(([dept, v]) => ({ dept, ...v }))
        );
      }

      // 2. 법인카드 지출 카테고리별 집계
      const { data: expenses } = await supabase
        .from("expenses")
        .select("category, status");

      if (expenses) {
        const catMap: Record<string, number> = {};
        let pending = 0;
        expenses.forEach((e: any) => {
          const cat = e.category || "기타";
          catMap[cat] = (catMap[cat] || 0) + 1;
          if (e.status === "대기") pending++;
        });
        setExpenseByCategory(
          Object.entries(catMap).map(([name, value]) => ({ name, value }))
        );
        setPendingExpense(pending);
      }

      // 3. 프로젝트 상태별 집계
      const { data: projects } = await supabase
        .from("projects")
        .select("status");

      if (projects) {
        const statusMap: Record<string, number> = {};
        projects.forEach((p: any) => {
          const s = p.status || "진행중";
          statusMap[s] = (statusMap[s] || 0) + 1;
        });
        setProjectStatus(
          Object.entries(statusMap).map(([name, value]) => ({ name, value }))
        );
      }

      // 4. 오늘 처리된 결재 건수
      const today = new Date().toISOString().split("T")[0];
      const { count: todayCount } = await supabase
        .from("leaves")
        .select("*", { count: "exact", head: true })
        .eq("status", "승인")
        .gte("approved_at", `${today}T00:00:00`);
      setApprovedToday(todayCount || 0);

      setIsLoading(false);
    };
    load();
  }, []);

  return (
    <div className="space-y-6 mb-8">

      {/* ── 숫자 카드 4개 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="미결재 연차"
          value={pendingLeaveCount}
          unit="건"
          icon={<Clock size={20} className="text-amber-500" />}
          color="bg-amber-50 dark:bg-amber-500/10"
        />
        <StatCard
          label="미결재 경비"
          value={pendingExpense}
          unit="건"
          icon={<CreditCard size={20} className="text-orange-500" />}
          color="bg-orange-50 dark:bg-orange-500/10"
        />
        <StatCard
          label="전체 게시글"
          value={totalPostCount}
          unit="건"
          icon={<FileText size={20} className="text-blue-500" />}
          color="bg-blue-50 dark:bg-blue-500/10"
        />
        <StatCard
          label="오늘 처리 완료"
          value={approvedToday}
          unit="건"
          icon={<CheckCircle size={20} className="text-green-500" />}
          color="bg-green-50 dark:bg-green-500/10"
        />
      </div>

      {/* ── 차트 2개 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 부서별 연차 현황 — 막대 차트 */}
        <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            📊 부서별 연차 현황
          </h3>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">불러오는 중...</div>
          ) : leaveByDept.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={leaveByDept} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="dept" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-bg, #1e293b)",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="대기" fill="#f59e0b" radius={[4,4,0,0]} />
                <Bar dataKey="승인" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="반려" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 법인카드 지출 카테고리 — 도넛 차트 */}
        <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            💳 법인카드 지출 카테고리
          </h3>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">불러오는 중...</div>
          ) : expenseByCategory.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {expenseByCategory.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 프로젝트 현황 — 가로 진행 바 */}
      {!isLoading && projectStatus.length > 0 && (
        <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            📋 프로젝트 현황
          </h3>
          <div className="space-y-3">
            {projectStatus.map((item: any, i: number) => {
              const total = projectStatus.reduce((s: number, x: any) => s + x.value, 0);
              const pct = Math.round((item.value / total) * 100);
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.value}개 ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
