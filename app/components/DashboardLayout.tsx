"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Sidebar from "./Sidebar";
import Header from "./Header";
import AuthModal from "./AuthModal";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function checkUserAccess() {
      if (pathname === "/pending") {
        setIsLoadingAuth(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      // If no session, let them be (AuthModal handles login on main page)
      // Actually, if we are on a protected route, we might want to enforce login.
      // For now, only redirect if they ARE logged in but not approved.
      if (session?.user) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("is_approved, role")
          .eq("id", session.user.id);
          
        const profile = profiles?.[0];

        // 1. Unapproved user -> /pending
        if (profile && !profile.is_approved) {
          router.replace("/pending");
          return;
        }

        // 2. Admin route restriction
        if ((pathname?.startsWith("/admin") || pathname?.startsWith("/approvals")) && profile?.role?.trim().toLowerCase() !== "admin") {
          alert("관리자 전용 페이지입니다.");
          router.replace("/");
          return;
        }
      }

      setIsLoadingAuth(false);
    }

    checkUserAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      checkUserAccess();
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  // Optionally, show a loading state while checking auth to prevent flicker
  if (isLoadingAuth && pathname !== "/pending") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Hide sidebar and header on the pending page to isolate the user completely
  if (pathname === "/pending") {
    return <>{children}</>;
  }

  // 로그아웃 상태일 때 (인트로 화면 렌더링)
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
        <div className="mb-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-600/30">
            <span className="text-white text-3xl font-black">W</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Work's Way</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">사내 전용 업무 포털에 오신 것을 환영합니다.</p>
        </div>
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5"
        >
          로그인 / 회원가입
        </button>
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-200 overflow-hidden font-sans">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-slate-900/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
