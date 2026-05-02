"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── 타입 ────────────────────────────────────────────────────
type CalendarEvent = {
  id: number;
  date: string;       // YYYY-MM-DD
  endDate?: string;
  title: string;
  type: "leave" | "half" | "holiday";
  name: string;
  dept: string;
  status: string;
};

// ── 대한민국 공휴일 (2026) ───────────────────────────────────
const HOLIDAYS_2026: Record<string, string> = {
  "2026-01-01": "신정",
  "2026-01-28": "설날 연휴",
  "2026-01-29": "설날",
  "2026-01-30": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-05-05": "어린이날",
  "2026-05-25": "부처님오신날",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절",
  "2026-10-09": "한글날",
  "2026-12-25": "크리스마스",
};

// ── 날짜 유틸 ────────────────────────────────────────────────
const toYMD = (date: Date) => date.toISOString().split("T")[0];
const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const getFirstDayOfWeek = (y: number, m: number) => new Date(y, m, 1).getDay();

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

// ── 이벤트 색상 ──────────────────────────────────────────────
const EVENT_STYLE: Record<string, string> = {
  leave: "bg-blue-500 text-white",
  half: "bg-purple-400 text-white",
  holiday: "bg-red-100 text-red-700 border border-red-200",
};

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [myEmail, setMyEmail] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "mine">("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadEvents(); }, [year, month]);

  const loadEvents = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email ?? "";
    setMyEmail(email);

    // 해당 월 범위
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${getDaysInMonth(year, month)}`;

    // 연차 데이터 (승인된 것만 캘린더에 표시)
    const { data: leaves } = await supabase
      .from("leaves")
      .select("id, applicant_email, leave_type, start_date, end_date, status")
      .in("status", ["승인", "대기", "1차승인"])
      .lte("start_date", to)
      .gte("end_date", from);

    // 직원 이름 매핑
    const { data: profiles } = await supabase
      .from("profiles")
      .select("email, full_name, department");

    const emailToProfile: Record<string, { name: string; dept: string }> = {};
    (profiles ?? []).forEach((p: any) => {
      emailToProfile[p.email] = { name: p.full_name, dept: p.department };
    });

    const calEvents: CalendarEvent[] = [];

    // 연차 → 날짜별 이벤트 생성
    (leaves ?? []).forEach((l: any) => {
      const prof = emailToProfile[l.applicant_email] ?? { name: l.applicant_email, dept: "" };
      if (l.leave_type === "half") {
        calEvents.push({
          id: l.id,
          date: l.start_date,
          title: `${prof.name} 반차`,
          type: "half",
          name: prof.name,
          dept: prof.dept,
          status: l.status,
        });
      } else {
        // 연차: 시작일~종료일 사이 날짜 모두 추가
        let cur = new Date(l.start_date);
        const end = new Date(l.end_date);
        while (cur <= end) {
          const ymd = toYMD(cur);
          if (ymd >= from && ymd <= to) {
            calEvents.push({
              id: l.id * 1000 + cur.getDate(),
              date: ymd,
              title: `${prof.name} 연차`,
              type: "leave",
              name: prof.name,
              dept: prof.dept,
              status: l.status,
            });
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
    });

    // 공휴일 추가
    Object.entries(HOLIDAYS_2026).forEach(([date, name]) => {
      if (date >= from && date <= to) {
        calEvents.push({
          id: parseInt(date.replace(/-/g, "")),
          date,
          title: name,
          type: "holiday",
          name,
          dept: "",
          status: "",
        });
      }
    });

    setEvents(calEvents);
    setIsLoading(false);
  };

  // 월 이동
  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  // 해당 날짜의 이벤트
  const eventsOn = (ymd: string) => {
    const filtered = events.filter(e => e.date === ymd);
    if (viewMode === "mine") return filtered.filter(e => e.type === "holiday" || e.name === myEmail);
    return filtered;
  };

  // 선택된 날 이벤트
  const selectedEvents = selected
    ? events.filter(e => e.date === selected && (viewMode === "all" || e.type === "holiday" || myEmail.includes(e.name)))
    : [];

  // 달력 셀 생성
  const firstDow = getFirstDayOfWeek(year, month);
  const daysInMon = getDaysInMonth(year, month);
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayYMD = toYMD(today);

  return (
    <div className="w-full animate-fade-in flex flex-col min-h-[calc(100vh-6rem)]">

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Calendar size={22} className="text-blue-500" />
            업무 캘린더
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            팀 연차·공휴일을 한눈에 확인하세요.
          </p>
        </div>

        {/* 보기 모드 + 월 이동 */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
            <button onClick={() => setViewMode("all")}
              className={`px-3 py-1.5 font-medium transition-colors ${viewMode === "all" ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50"}`}>
              전체
            </button>
            <button onClick={() => setViewMode("mine")}
              className={`px-3 py-1.5 font-medium transition-colors ${viewMode === "mine" ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50"}`}>
              내 일정
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={prevMonth}
              className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-600 dark:text-slate-400 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-base font-bold text-slate-900 dark:text-white min-w-[90px] text-center">
              {year}년 {MONTH_LABELS[month]}
            </span>
            <button onClick={nextMonth}
              className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-600 dark:text-slate-400 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 text-slate-600 dark:text-slate-400 transition-colors">
            오늘
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* ── 캘린더 본체 ── */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
              {DAY_LABELS.map((d, i) => (
                <div key={d} className={`py-3 text-center text-xs font-bold ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500 dark:text-slate-400"
                  }`}>
                  {d}
                </div>
              ))}
            </div>

            {/* 날짜 셀 */}
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                if (!day) return (
                  <div key={`empty-${idx}`} className="min-h-[90px] border-r border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/20" />
                );

                const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday = ymd === todayYMD;
                const isSelected = ymd === selected;
                const dayEvents = events.filter(e => e.date === ymd);
                const isHoliday = HOLIDAYS_2026[ymd];
                const dow = (firstDow + day - 1) % 7;
                const isSun = dow === 0;
                const isSat = dow === 6;

                return (
                  <div key={ymd}
                    onClick={() => setSelected(isSelected ? null : ymd)}
                    className={`min-h-[90px] border-r border-b border-slate-100 dark:border-slate-800/50 p-1.5 cursor-pointer transition-colors ${isSelected ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      }`}>

                    {/* 날짜 숫자 */}
                    <div className="flex justify-end mb-1">
                      <span className={`w-7 h-7 flex items-center justify-center text-xs font-semibold rounded-full ${isToday
                        ? "bg-blue-600 text-white"
                        : isSun || isHoliday
                          ? "text-red-500"
                          : isSat
                            ? "text-blue-500"
                            : "text-slate-700 dark:text-slate-300"
                        }`}>
                        {day}
                      </span>
                    </div>

                    {/* 이벤트 목록 (최대 2개 + 더보기) */}
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map(ev => (
                        <div key={ev.id}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded truncate ${EVENT_STYLE[ev.type]}`}>
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-slate-400 px-1">+{dayEvents.length - 2}건</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 범례 */}
          <div className="flex items-center gap-4 mt-3 px-1">
            {[
              { color: "bg-blue-500", label: "연차 (승인/대기)" },
              { color: "bg-purple-400", label: "반차" },
              { color: "bg-red-100 border border-red-200", label: "공휴일" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-sm ${color}`} />
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 사이드: 선택된 날 상세 + 이번 달 연차 목록 ── */}
        <div className="space-y-4">

          {/* 선택된 날 */}
          <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              {selected
                ? `${selected.replace(/-/g, ".")} 일정`
                : "날짜를 클릭하세요"}
            </h3>
            {selected ? (
              <div className="space-y-2">
                {events.filter(e => e.date === selected).length === 0 ? (
                  <p className="text-xs text-slate-400">일정이 없습니다.</p>
                ) : (
                  events.filter(e => e.date === selected).map(ev => (
                    <div key={ev.id} className={`p-2.5 rounded-lg text-xs ${ev.type === "holiday"
                      ? "bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30"
                      : "bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30"
                      }`}>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{ev.title}</div>
                      {ev.dept && <div className="text-slate-500 mt-0.5">{ev.dept}</div>}
                      {ev.status && (
                        <div className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${ev.status === "승인" ? "bg-green-100 text-green-700" :
                          ev.status === "반려" ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                          {ev.status}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">달력에서 날짜를 클릭하면<br />해당 일의 일정을 볼 수 있습니다.</p>
            )}
          </div>

          {/* 이번 달 연차 현황 */}
          <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              {MONTH_LABELS[month]} 연차 현황
            </h3>
            {isLoading ? (
              <p className="text-xs text-slate-400">불러오는 중...</p>
            ) : (
              <div className="space-y-1.5">
                {/* 이름별 중복 제거해서 보여주기 */}
                {Array.from(
                  new Map(
                    events
                      .filter(e => e.type !== "holiday")
                      .map(e => [e.name, e])
                  ).values()
                ).map(ev => (
                  <div key={ev.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {ev.name?.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-700 dark:text-slate-300">{ev.name}</div>
                        <div className="text-slate-400">{ev.dept}</div>
                      </div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ev.type === "half"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                      }`}>
                      {ev.type === "half" ? "반차" : "연차"}
                    </span>
                  </div>
                ))}
                {events.filter(e => e.type !== "holiday").length === 0 && (
                  <p className="text-xs text-slate-400">이번 달 연차 신청이 없습니다.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
