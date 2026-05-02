"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  KanbanSquare,
  ClipboardList,
  CalendarDays,
  Megaphone,
  Users,
  Settings,
  Inbox,
  UserCheck,
  X,
  CreditCard,
  MessageCircle,
  User,
} from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string; position: string } | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    async function checkAdminStatus(currentSession: any = null) {
      try {
        let sessionToUse = currentSession;

        if (!sessionToUse) {
          const { data } = await supabase.auth.getSession();
          sessionToUse = data.session;
        }

        if (!sessionToUse?.user) {
          setIsAdmin(false);
          setUserProfile(null);
          return;
        }

        console.log("Checking admin status for user:", sessionToUse.user.id);

        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("role, full_name, position")
          .eq("id", sessionToUse.user.id);

        const profile = profiles?.[0];

        if (error) {
          console.error("Failed to fetch profile:", JSON.stringify(error));
          setIsAdmin(false);
          setUserProfile(null);
          return;
        }

        if (profile) {
          setUserProfile({
            full_name: profile.full_name || "이름 없음",
            position: profile.position || "직급 없음",
          });
        }

        console.log("Fetched profile role:", profile?.role);

        if (profile?.role?.trim().toLowerCase() === "admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }

        // 알림 개수 조회
        if (sessionToUse.user.email) {
          const { data } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_email", sessionToUse.user.email)
            .eq("is_read", false)
            .order("created_at", { ascending: false });

          setNotifications(data || []);
          setNotificationsCount(data?.length || 0);
        }
      } catch (err) {
        console.error("Unexpected error in checkAdminStatus:", err);
        setIsAdmin(false);
        setUserProfile(null);
        setNotifications([]);
        setNotificationsCount(0);
      }
    }

    checkAdminStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setIsAdmin(false);
        setUserProfile(null);
      } else {
        checkAdminStatus(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const menuGroups = [
    {
      label: "메인",
      items: [
        { name: "대시보드", href: "/", icon: LayoutDashboard },
      ],
    },
    {
      label: "업무",
      items: [
        { name: "프로젝트 보드", href: "/projects", icon: KanbanSquare },
        { name: "일상보고", href: "/daily-report", icon: ClipboardList },
        { name: "연차신청", href: "/leave", icon: CalendarDays },
        { name: "법인카드 사용 내역", href: "/expense", icon: CreditCard },
        { name: "마이페이지", href: "/mypage", icon: User },
      ],
    },
    {
      label: "소통",
      items: [
        { name: "부서 소통 게시판", href: "/department-board", icon: MessageCircle },
        { name: "전체 공지", href: "#", icon: Megaphone },
        { name: "직원 주소록", href: "/directory", icon: Users },
      ],
    },
    ...(isAdmin ? [{
      label: "관리자",
      items: [
        { name: "관리자 패널", href: "#", icon: Settings },
        { name: "결재함", href: "/approvals", icon: Inbox },
        { name: "가입 승인 관리", href: "/admin/users", icon: UserCheck },
      ],
    }] : []),
  ];

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 border-r border-slate-800 text-slate-300 transform transition-transform duration-300 ease-in-out flex flex-col lg:translate-x-0 lg:static lg:inset-0 ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Logo Area */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800 bg-slate-950/50">
          <Link href="/" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-black">W</span>
            </div>
            Work's Way
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md hover:bg-slate-800 lg:hidden text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {group.label}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${isActive
                        ? "bg-blue-600/10 text-blue-400"
                        : "hover:bg-slate-800/50 hover:text-white"
                        }`}
                      onClick={() => setIsOpen(false)} // Close sidebar on mobile after clicking
                    >
                      <Icon size={18} className={isActive ? "text-blue-400" : "text-slate-400"} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Info / Bottom Area */}
        <div className="relative p-4 border-t border-slate-800 bg-slate-950/30">
          {isDropdownOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 transform origin-bottom animate-in slide-in-from-bottom-2 fade-in duration-200">
              <div className="p-3 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                <h4 className="text-sm font-semibold text-white">알림</h4>
                {notificationsCount > 0 && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">{notificationsCount}건</span>
                )}
              </div>
              <div className="max-h-60 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">
                    새로운 알림이 없습니다.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {notifications.map((notif) => (
                      <button
                        key={notif.id}
                        className="w-full text-left p-3 hover:bg-slate-700/50 transition-colors flex items-start gap-3"
                        onClick={async () => {
                          // Update DB
                          await supabase.from("notifications").update({ is_read: true }).eq("id", notif.id);
                          // Update Local State
                          setNotifications(prev => prev.filter(n => n.id !== notif.id));
                          setNotificationsCount(prev => prev - 1);
                          setIsDropdownOpen(false);
                          // Navigate
                          if (notif.link) {
                            router.push(notif.link);
                          }
                        }}
                      >
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                        <div>
                          <p className="text-sm text-slate-200 line-clamp-2 leading-relaxed">{notif.message}</p>
                          <span className="text-xs text-slate-500 block mt-1">
                            {new Date(notif.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {userProfile ? (
            <Link
              href="/mypage"
              className="w-full flex items-center gap-3 p-1 rounded-xl hover:bg-slate-800/50 transition-colors focus:outline-none"
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white uppercase shadow-md shadow-blue-900/20">
                  {userProfile.full_name.charAt(0)}
                </div>
                {notificationsCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-white truncate">{userProfile.full_name}</p>
                <p className="text-xs text-slate-400 truncate">{userProfile.position}</p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-3 opacity-50">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-500">
                ?
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-400">방문자</p>
                <p className="text-xs text-slate-500">로그인 필요</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
