"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { CreditCard, History, Building2 } from "lucide-react";
import ExcelDownloadButton from "../components/ExcelDownloadButton";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Expense = {
  id: number;
  usage_date: string;
  merchant: string;
  amount: number;
  purpose: string;
  status: string;
  applicant_email: string;
  rejection_reason: string;  // ← 추가
  created_at: string;
};

export default function ExpensePage() {
  const [usageDate, setUsageDate] = useState("");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── 핵심 수정: 상태 필터 없이 전체 내역 조회 ──────────────
  const fetchMyExpenses = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) { setIsLoading(false); return; }

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("applicant_email", session.user.email)
      .order("created_at", { ascending: false });
      // ↑ .neq("status","승인") 같은 필터 없이 전체 조회

    if (error) console.error("사용 내역 로딩 에러:", error);
    else setExpenses(data || []);
    setIsLoading(false);
  };

  useEffect(() => { fetchMyExpenses(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usageDate || !merchant || !amount || !purpose) {
      alert("모든 항목을 입력해주세요.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) { alert("로그인이 필요합니다."); setIsSubmitting(false); return; }

      const { error } = await supabase.from("expenses").insert([{
        usage_date: usageDate,
        merchant,
        amount: parseInt(amount.replace(/[^0-9]/g, ""), 10),
        purpose,
        applicant_email: session.user.email,
        status: "대기",
      }]);

      if (error) {
        alert(`보고 중 오류가 발생했습니다: ${error.message}`);
      } else {
        fetch("/api/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: session.user.email, usageDate, merchant,
            amount: parseInt(amount.replace(/[^0-9]/g, ""), 10), purpose,
          }),
        }).catch(err => console.error("텔레그램 알림 전송 실패:", err));

        alert("법인카드 사용 보고가 접수되었습니다.");
        setUsageDate(""); setMerchant(""); setAmount(""); setPurpose("");
        fetchMyExpenses();
      }
    } catch (err) {
      alert("보고 중 예기치 않은 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value.replace(/[^0-9]/g, ""));
  };

  // 상태별 뱃지 스타일
  const statusStyle = (status: string) => {
    if (status === "승인")  return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50";
    if (status === "반려")  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50";
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800/50";
  };

  return (
    <div className="w-full animate-fade-in flex flex-col min-h-[calc(100vh-6rem)]">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <CreditCard className="text-blue-600 dark:text-blue-400" />
            법인카드 사용 보고
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">법인카드 사용 내역을 보고하고 승인을 받으세요.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
        {/* 신청 폼 */}
        <div className="lg:col-span-4 h-fit">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:sticky lg:top-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Building2 size={20} className="text-blue-600 dark:text-blue-400" />
              신규 내역 보고
            </h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">사용 일자</label>
                <input type="date" required value={usageDate} onChange={(e) => setUsageDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">사용처</label>
                <input type="text" required placeholder="예: 스타벅스 강남점" value={merchant} onChange={(e) => setMerchant(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">금액 (원)</label>
                <input type="text" required placeholder="숫자만 입력하세요"
                  value={amount ? Number(amount).toLocaleString() : ""}
                  onChange={handleAmountChange}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">사용 사유</label>
                <textarea required placeholder="구체적인 사용 목적을 입력해주세요." value={purpose}
                  onChange={(e) => setPurpose(e.target.value)} rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-slate-100 resize-none placeholder-slate-400" />
              </div>
              <button type="submit" disabled={isSubmitting}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                {isSubmitting ? "제출 중..." : "결제 내역 보고"}
              </button>
            </form>
          </div>
        </div>

        {/* 내역 테이블 */}
        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History size={20} className="text-slate-400" />
                내 카드 사용 내역
              </h3>
              <ExcelDownloadButton type="expense" data={expenses} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-4 whitespace-nowrap">사용일자</th>
                    <th className="px-5 py-4 whitespace-nowrap">사용처</th>
                    <th className="px-5 py-4 whitespace-nowrap text-right">금액</th>
                    <th className="px-5 py-4 whitespace-nowrap">사유 / 반려사유</th>
                    <th className="px-5 py-4 whitespace-nowrap text-center">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                        <div className="flex justify-center items-center gap-2">
                          <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          내역을 불러오는 중...
                        </div>
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400">사용 내역이 없습니다.</td>
                    </tr>
                  ) : (
                    expenses.map((expense) => (
                      <tr key={expense.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                          expense.status === "반려" ? "bg-red-50/40 dark:bg-red-900/10" : ""
                        }`}>
                        <td className="px-5 py-4 whitespace-nowrap text-slate-600 dark:text-slate-400 tabular-nums">
                          {expense.usage_date}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-slate-200">
                          {expense.merchant}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right font-medium text-slate-900 dark:text-slate-200 tabular-nums">
                          {expense.amount.toLocaleString()}원
                        </td>
                        {/* ── 사유 + 반려사유 표시 ── */}
                        <td className="px-5 py-4 max-w-[200px]">
                          <div className="truncate text-slate-600 dark:text-slate-400">{expense.purpose}</div>
                          {expense.status === "반려" && expense.rejection_reason && (
                            <div className="mt-1 flex items-start gap-1">
                              <span className="shrink-0 text-xs font-bold text-red-500">반려사유:</span>
                              <span className="text-xs text-red-500 break-words">{expense.rejection_reason}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${statusStyle(expense.status)}`}>
                            {expense.status || "대기"}
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
    </div>
  );
}
