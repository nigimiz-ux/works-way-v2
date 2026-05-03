"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { CreditCard, History, Building2, ImagePlus, X } from "lucide-react";
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
  rejection_reason?: string;
  image_url?: string;
  created_at: string;
};

// ── 상태 뱃지 스타일 ─────────────────────────────────────────
const statusStyle = (status?: string) => {
  if (status === "승인") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50";
  if (status === "반려" || status?.includes("반려")) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50";
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800/50";
};

export default function ExpensePage() {
  const [usageDate, setUsageDate]   = useState("");
  const [merchant, setMerchant]     = useState("");
  const [amount, setAmount]         = useState("");
  const [purpose, setPurpose]       = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenses, setExpenses]     = useState<Expense[]>([]);
  const [isLoading, setIsLoading]   = useState(true);

  // ── 이미지 상태 ──────────────────────────────────────────
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile]       = useState<File | null>(null);
  const [uploading, setUploading]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchMyExpenses(); }, []);

  // ── 내역 조회 ────────────────────────────────────────────
  const fetchMyExpenses = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) { setIsLoading(false); return; }

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("applicant_email", session.user.email)
      .order("created_at", { ascending: false });

    if (error) console.error("사용 내역 로딩 에러:", error);
    else setExpenses(data || []);
    setIsLoading(false);
  };

  // ── 이미지 선택 ──────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("파일 크기는 5MB 이하만 가능합니다.");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── 이미지 업로드 ────────────────────────────────────────
  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    setUploading(true);
    const ext  = imageFile.name.split(".").pop();
    const path = `expenses/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("attachments")
      .upload(path, imageFile, { upsert: false });

    if (error) {
      alert("이미지 업로드 실패: " + error.message);
      setUploading(false);
      return null;
    }

    const { data } = supabase.storage.from("attachments").getPublicUrl(path);
    setUploading(false);
    return data.publicUrl;
  };

  // ── 제출 ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usageDate || !merchant || !amount || !purpose) {
      alert("모든 항목을 입력해주세요.");
      return;
    }
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        alert("로그인이 필요합니다.");
        setIsSubmitting(false);
        return;
      }

      // 이미지 먼저 업로드
      const imageUrl = await uploadImage();

      const { error } = await supabase.from("expenses").insert([{
        usage_date:      usageDate,
        merchant,
        amount:          parseInt(amount.replace(/[^0-9]/g, ""), 10),
        purpose,
        applicant_email: session.user.email,
        status:          "대기",
        image_url:       imageUrl || null,
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
        clearImage();
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

        {/* ── 왼쪽: 신청 폼 ── */}
        <div className="lg:col-span-4 h-fit">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:sticky lg:top-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Building2 size={20} className="text-blue-600 dark:text-blue-400" />
              신규 내역 보고
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">사용 일자</label>
                <input type="date" required value={usageDate}
                  onChange={e => setUsageDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-slate-100" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">사용처</label>
                <input type="text" required placeholder="예: 스타벅스 강남점"
                  value={merchant} onChange={e => setMerchant(e.target.value)}
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
                <textarea required placeholder="구체적인 사용 목적을 입력해주세요."
                  value={purpose} onChange={e => setPurpose(e.target.value)} rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-slate-100 resize-none placeholder-slate-400" />
              </div>

              {/* ── 영수증 사진 첨부 ── */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  영수증 사진 <span className="text-slate-400 font-normal">(선택, 최대 5MB)</span>
                </label>

                {imagePreview ? (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="미리보기"
                      className="w-36 h-36 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" />
                    <button type="button" onClick={clearImage}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow transition-colors">
                      <X size={12} />
                    </button>
                    {uploading && (
                      <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-36 h-36 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                    <ImagePlus size={24} className="text-slate-400 mb-1.5" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 text-center px-2">영수증 사진 첨부</span>
                    <input ref={fileInputRef} type="file" accept="image/*"
                      className="hidden" onChange={handleFileChange} />
                  </label>
                )}
              </div>

              <button type="submit" disabled={isSubmitting || uploading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                {isSubmitting ? "제출 중..." : uploading ? "이미지 업로드 중..." : "결제 내역 보고"}
              </button>
            </form>
          </div>
        </div>

        {/* ── 오른쪽: 내역 테이블 ── */}
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
                    <th className="px-5 py-4 whitespace-nowrap text-center">영수증</th>
                    <th className="px-5 py-4 whitespace-nowrap text-center">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
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
                      <td colSpan={6} className="px-6 py-10 text-center text-slate-400">사용 내역이 없습니다.</td>
                    </tr>
                  ) : (
                    expenses.map(expense => (
                      <tr key={expense.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                          expense.status === "반려" ? "bg-red-50/40 dark:bg-red-900/10" : ""
                        }`}>

                        <td className="px-5 py-4 whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-400">
                          {expense.usage_date}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-slate-200">
                          {expense.merchant}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right font-medium tabular-nums text-slate-900 dark:text-slate-200">
                          {expense.amount?.toLocaleString()}원
                        </td>

                        {/* 사유 + 반려사유 */}
                        <td className="px-5 py-4 max-w-[180px]">
                          <div className="truncate text-slate-600 dark:text-slate-400">{expense.purpose}</div>
                          {expense.status === "반려" && expense.rejection_reason && (
                            <div className="mt-1 flex items-start gap-1 p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/50">
                              <span className="shrink-0 text-xs font-bold text-red-600 dark:text-red-400">반려:</span>
                              <span className="text-xs text-red-600 dark:text-red-400 break-words">{expense.rejection_reason}</span>
                            </div>
                          )}
                        </td>

                        {/* 영수증 썸네일 */}
                        <td className="px-5 py-4 text-center">
                          {expense.image_url ? (
                            <a href={expense.image_url} target="_blank" rel="noopener noreferrer">
                              <img src={expense.image_url} alt="영수증"
                                className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-700 hover:opacity-80 transition-opacity cursor-pointer mx-auto shadow-sm" />
                            </a>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                          )}
                        </td>

                        {/* 상태 뱃지 */}
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
