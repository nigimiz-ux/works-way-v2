"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, KanbanSquare, ClipboardList, CalendarDays,
  CreditCard, MessageCircle, Megaphone, Users, Settings,
  Inbox, UserCheck, Menu, X, Bell, User, LogOut, Target
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Notification = {
  id: number;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
  user_email?: string;
};

type UserProfile = {
  full_name: string;
  position: string;
  role: string;
};

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const NAV_GROUPS = [
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
      { name: "OKR 목표관리", href: "/okr", icon: Target },
      { name: "연차신청", href: "/leave", icon: CalendarDays },
      { name: "법인카드 사용 내역", href: "/expense", icon: CreditCard },
    ],
  },
  {
    label: "소통",
    items: [
      { name: "부서 소통 게시판", href: "/department-board", icon: MessageCircle },
      { name: "직원 주소록", href: "/directory", icon: Users },
      { name: "주간 업무", href: "/weekly", icon: ClipboardList },
    ],
  },
];

const ADMIN_GROUP = {
  label: "관리자",
  items: [
    { name: "결재함", href: "/approvals", icon: Inbox },
    { name: "업무 캘린더", href: "/calendar", icon: CalendarDays },
    { name: "관리자 패널", href: "/admin/users", icon: Settings }
  ],
};

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const loadUserAndNotifications = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const email = session.user.email!;
    setUserEmail(email);

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, position, role")
      .eq("id", session.user.id)
      .single();

    if (prof) {
      setUserProfile(prof);
      setIsAdmin(["admin", "director", "manager"].includes(prof.role));
    }

    const { data: notifs } = await supabase
      .from("notifications")
      .select("id, message, link, is_read, created_at")
      .eq("user_email", email)
      .order("created_at", { ascending: false })
      .limit(20);

    setNotifications(notifs || []);
  }, []);

  useEffect(() => {
    loadUserAndNotifications();

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new as Notification;
          if (newNotif.user_email === userEmail) {
            setNotifications(cur => [newNotif, ...cur]);
          }
        }
      )
      .subscribe();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          setUserProfile(null);
          setIsAdmin(false);
          setNotifications([]);
        } else {
          loadUserAndNotifications();
        }
      }
    );

    return () => {
      supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [loadUserAndNotifications, userEmail]);

  const markAsRead = async (notif: Notification) => {
    if (!notif.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    setShowNotifications(false);
    if (notif.link && notif.link !== "#") router.push(notif.link);
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <Link href="/" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-black">W</span>
          Work's Way
        </Link>
        <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {[...NAV_GROUPS, ...(isAdmin ? [ADMIN_GROUP] : [])].map((group) => (
          <div key={group.label} className="mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-blue-600/10 text-blue-400" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                      }`}
                  >
                    <Icon size={18} className={isActive ? "text-blue-400" : "text-slate-400"} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-800 space-y-2">
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800/50 hover:text-white transition-colors"
          >
            <div className="relative">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <span>알림</span>
          </button>
          {showNotifications && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="px-3 py-2.5 border-b border-slate-700 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">알림</h4>
                <button onClick={markAllAsRead} className="text-xs text-blue-400">전체 읽음</button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">알림이 없습니다.</div>
                ) : (
                  notifications.map((notif) => (
                    <button key={notif.id} onClick={() => markAsRead(notif)} className={`w-full text-left px-3 py-3 hover:bg-slate-700/50 flex items-start gap-3 ${notif.is_read ? "opacity-50" : ""}`}>
                      <div className={`w-2 h-2 mt-1.5 rounded-full ${notif.is_read ? "bg-slate-600" : "bg-red-500"}`} />
                      <p className="text-sm text-slate-200 line-clamp-2">{notif.message}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {userProfile ? (
          <Link href="/mypage" className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/50 transition-colors">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">{userProfile.full_name.charAt(0)}</div>
            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{userProfile.full_name}</p></div>
          </Link>
        ) : (
          <div className="p-2 opacity-40 text-xs text-slate-500">로그인 필요</div>
        )}

        <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-red-400">
          로그아웃
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 rounded-lg text-white shadow-lg"><Menu size={20} /></button>
      {isOpen && <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setIsOpen(false)} />}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col h-screen sticky top-0">{sidebarContent}</aside>
      <aside className={`lg:hidden fixed inset-y-0 left-0 w-64 z-50 transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>{sidebarContent}</aside>
    </>
  );
}