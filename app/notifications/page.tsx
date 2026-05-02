"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2 } from "lucide-react";

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
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [filter, setFilter]               = useState<"all" | "unread">("all");

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) { setIsLoading(false); return; }

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_email", session.user.email)
      .order("created_at", { ascending: false })
      .limit(50);

    setNotifications(data || []);
    setIsLoading(false);
  };

  // 단건 읽음
  const markAsRead = async (notif: Notification) => {
    if (!notif.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    if (notif.link && notif.link !== "#") router.push(notif.link);
  };

  // 전체 읽음
  const markAllAsRead = async () => {
    const ids = notifications.filter(n => !n.is_read).map(n => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  // 읽은 것 전체 삭제
  const deleteRead = async () => {
    if (!window.confirm("읽은 알림을 모두 삭제하시겠습니까?")) return;
    const ids = notifications.filter(n => n.is_read).map(n => n.id);
    if (ids.length === 0) { alert("삭제할 알림이 없습니다."); return; }
    await supabase.from("notifications").delete().in("id", ids);
    setNotifications(prev => prev.filter(n => !n.is_read));
  };

  const displayed = filter === "unread"
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="w-full animate-fade-in flex flex-col min-h-[calc(100vh-6rem)]">

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Bell size={22} className="text-blue-500" />
            알림 센터
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            읽지 않은 알림 {unreadCount}건
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-blue-200 dark:border-blue-800"
          >
            <CheckCheck size={15} /> 전체 읽음
          </button>
          <button
            onClick={deleteRead}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-800"
          >
            <Trash2 size={15} /> 읽은 것 삭제
          </button>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 mb-4">
        {(["all", "unread"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              filter === f
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
            }`}
          >
            {f === "all" ? "전체" : "읽지 않음"}
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
              filter === f ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            }`}>
              {f === "all" ? notifications.length : unreadCount}
            </span>
          </button>
        ))}
      </div>

      {/* 알림 목록 */}
      <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400">
            <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            불러오는 중...
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Bell size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">{filter === "unread" ? "읽지 않은 알림이 없습니다." : "알림이 없습니다."}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayed.map(notif => (
              <button
                key={notif.id}
                onClick={() => markAsRead(notif)}
                className={`w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-start gap-4 ${
                  notif.is_read ? "opacity-50" : ""
                }`}
              >
                {/* 읽음 표시 점 */}
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                  notif.is_read ? "bg-slate-300 dark:bg-slate-700" : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                }`} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {notif.message}
                  </p>
                  <span className="text-xs text-slate-400 mt-1 block">
                    {new Date(notif.created_at).toLocaleDateString("ko-KR", {
                      year: "numeric", month: "long", day: "numeric",
                      hour: "2-digit", minute: "2-digit"
                    })}
                  </span>
                </div>

                {!notif.is_read && (
                  <span className="shrink-0 px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800">
                    NEW
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
