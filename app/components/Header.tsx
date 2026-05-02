"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Menu } from "lucide-react";
import AuthModal from "./AuthModal";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // 현재 세션 로드
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 로그인, 로그아웃 등 세션 변경 이벤트 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/'; // 강제 새로고침(Hard Refresh)으로 Next.js 캐싱 및 남은 세션 날리기
  };

  return (
    <>
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white sticky top-0 z-10 transition-colors">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            {onMenuClick && (
              <button 
                onClick={onMenuClick} 
                className="mr-4 p-2 rounded-md lg:hidden text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <Menu size={20} />
              </button>
            )}
            <span className="text-xl font-bold tracking-tight cursor-pointer transition hover:text-blue-600 dark:hover:text-blue-400">
              Work's Way V2
            </span>
          </div>
          <div>
            {user ? (
              <button 
                onClick={handleLogout}
                className="text-sm border border-slate-300 dark:border-slate-700 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors px-4 py-2 rounded-md flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse"></div>
                로그아웃
              </button>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="text-sm border border-slate-300 dark:border-slate-700 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors px-4 py-2 rounded-md"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Auth Modal Portal/Component */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </>
  );
}
