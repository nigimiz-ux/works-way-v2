"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { Search, Mail, Building2, UserCircle2 } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Employee = {
  id: string;
  email: string;
  full_name: string;
  position: string;
  department: string;
};

export default function DirectoryPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("전체");

  useEffect(() => {
    async function fetchEmployees() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, position, department")
        .eq("is_approved", true);

      if (!error && data) {
        setEmployees(data as Employee[]);
      }
      setIsLoading(false);
    }
    fetchEmployees();
  }, []);

  const departments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department || "소속 없음"));
    return ["전체", ...Array.from(depts)].sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch = emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const empDept = emp.department || "소속 없음";
      const matchesDept = selectedDept === "전체" || empDept === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [employees, searchTerm, selectedDept]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <UserCircle2 className="text-blue-600 dark:text-blue-400" />
          직원 주소록
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          사내 전체 직원의 연락처와 소속 정보를 확인하세요.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 text-slate-900 dark:text-slate-100 transition-colors"
            placeholder="이름으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Department Filter */}
        <div className="w-full sm:w-auto flex overflow-x-auto hide-scrollbar gap-2 pb-1 sm:pb-0">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedDept === dept
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-12 text-center">
          <UserCircle2 size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">결과가 없습니다</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1">검색 조건에 맞는 직원을 찾을 수 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredEmployees.map((emp) => (
            <div key={emp.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col gap-5 group">
              {/* Header: Avatar and Name */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 shrink-0 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-xl font-bold uppercase shadow-inner">
                  {emp.full_name?.charAt(0) || "?"}
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{emp.full_name || "이름 없음"}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5 truncate">{emp.position || "직급 없음"}</p>
                </div>
              </div>

              {/* Body: Contact Info */}
              <div className="space-y-3 pt-5 border-t border-slate-100 dark:border-slate-800/80 mt-auto">
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center shrink-0">
                    <Building2 size={16} className="text-slate-400" />
                  </div>
                  <span className="truncate">{emp.department || "소속 없음"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center shrink-0">
                    <Mail size={16} className="text-slate-400" />
                  </div>
                  <a href={`mailto:${emp.email}`} className="truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    {emp.email || "이메일 없음"}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
