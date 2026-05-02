"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

// 환경변수를 사용하여 Supabase 클라이언트 초기화
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (activeTab === "login") {
      if (!email || !password) {
        alert("이메일과 비밀번호를 모두 입력해주세요.");
        return;
      }
    } else {
      if (!email || !password || !fullName || !position) {
        alert("모든 필드를 입력해주세요.");
        return;
      }
    }
    
    setIsLoading(true);

    try {
      if (activeTab === "login") {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // 승인 여부 확인
        if (signInData.user) {
          const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("is_approved")
            .eq("id", signInData.user.id);
            
          const profile = profiles?.[0];
            
          if (profileError) {
             throw profileError;
          }

          if (profile && !profile.is_approved) {
            await supabase.auth.signOut();
            alert("관리자의 승인이 대기 중입니다.");
            return;
          }
        }
        
        onClose(); // 성공 시 모달 닫기
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (signUpData.user) {
          const { error: profileError } = await supabase.from("profiles").insert([
            {
              id: signUpData.user.id,
              email: email,
              full_name: fullName,
              position: position,
              is_approved: false,
              role: "user"
            }
          ]);
          if (profileError) throw profileError;
        }
        
        alert("회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.");
        setActiveTab("login");
        setFullName("");
        setPosition("");
      }
    } catch (error: any) {
      alert(`오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            className={`flex-1 py-4 text-sm font-bold text-center transition-colors ${
              activeTab === "login" 
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-slate-900" 
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 bg-slate-50/50 dark:bg-slate-950/50"
            }`}
            onClick={() => setActiveTab("login")}
          >
            로그인
          </button>
          <button
            className={`flex-1 py-4 text-sm font-bold text-center transition-colors ${
              activeTab === "signup" 
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-slate-900" 
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 bg-slate-50/50 dark:bg-slate-950/50"
            }`}
            onClick={() => setActiveTab("signup")}
          >
            회원가입
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {activeTab === "login" ? "환영합니다!" : "계정 만들기"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {activeTab === "login" 
                ? "서비스를 이용하시려면 로그인해주세요." 
                : "이메일로 간편하게 가입하세요."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                placeholder="name@company.com"
                required
              />
            </div>
            
            {activeTab === "signup" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">이름</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                    placeholder="홍길동"
                    required={activeTab === "signup"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">직급</label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                    placeholder="사원"
                    required={activeTab === "signup"}
                  />
                </div>
              </>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading 
                ? "처리 중..." 
                : (activeTab === "login" ? "로그인" : "가입하기")
              }
            </button>
          </form>
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            type="button"
            className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
