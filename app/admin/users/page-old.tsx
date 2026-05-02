"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Check, UserX, UserCheck } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Profile = {
  id: string;
  email: string;
  full_name: string;
  position: string;
  is_approved: boolean;
  role: string;
};

export default function AdminUsersPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAdminAndFetchUsers() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id);
        
      const profile = profiles?.[0];

      if (profile?.role?.trim().toLowerCase() === "admin") {
        setIsAdmin(true);
        await fetchUnapprovedUsers();
      } else {
        setIsAdmin(false);
        setIsLoading(false);
      }
    }

    checkAdminAndFetchUsers();
  }, []);

  async function fetchUnapprovedUsers() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_approved", false);
    
    if (!error && data) {
      setUsers(data as Profile[]);
    }
    setIsLoading(false);
  }

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: true })
      .eq("id", id);
      
    if (error) {
      alert("승인 처리 중 오류가 발생했습니다: " + error.message);
    } else {
      alert("승인되었습니다.");
      setUsers(users.filter(u => u.id !== id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center">
        <UserX size={48} className="text-slate-400 dark:text-slate-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">접근 권한 없음</h2>
        <p className="text-slate-500 dark:text-slate-400">
          이 페이지는 관리자만 접근할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <UserCheck className="text-blue-600 dark:text-blue-400" />
          가입 승인 관리
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          신규 가입자의 접근을 승인하거나 거절할 수 있습니다.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {users.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            승인 대기 중인 사용자가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th scope="col" className="px-6 py-4">이름</th>
                  <th scope="col" className="px-6 py-4">이메일</th>
                  <th scope="col" className="px-6 py-4">직급</th>
                  <th scope="col" className="px-6 py-4 text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {user.full_name}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {user.email || "이메일 없음"}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {user.position || "직급 없음"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleApprove(user.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 transition-colors"
                      >
                        <Check size={14} />
                        승인
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
