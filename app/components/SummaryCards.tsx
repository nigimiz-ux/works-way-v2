"use client";

import { useEffect, useState } from "react";
import { FileText, Clock } from "lucide-react";

interface SummaryCardsProps {
  pendingLeaveCount: number;
  totalPostCount: number;
}

function AnimatedCounter({ targetValue }: { targetValue: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    // 부드러운 애니메이션을 위한 duration 설정 (ms)
    const duration = 1000;
    const incrementTime = 16; // 약 60fps
    const totalSteps = Math.ceil(duration / incrementTime);
    const increment = targetValue / totalSteps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= targetValue) {
        setCount(targetValue);
        clearInterval(timer);
      } else {
        setCount(Math.ceil(start));
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [targetValue]);

  return <span>{count}</span>;
}

export default function SummaryCards({ pendingLeaveCount, totalPostCount }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
      {/* 미결재 건수 카드 */}
      <div className="bg-white dark:bg-slate-950 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-all hover:shadow-md group">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">미결재 연차 신청</p>
          <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
            <AnimatedCounter targetValue={pendingLeaveCount} />
            <span className="text-lg font-medium text-slate-500 dark:text-slate-500 ml-1">건</span>
          </h3>
        </div>
        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
          <Clock size={24} />
        </div>
      </div>

      {/* 공지사항/게시글 수 카드 */}
      <div className="bg-white dark:bg-slate-950 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-all hover:shadow-md group">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">전체 게시글</p>
          <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
            <AnimatedCounter targetValue={totalPostCount} />
            <span className="text-lg font-medium text-slate-500 dark:text-slate-500 ml-1">건</span>
          </h3>
        </div>
        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
          <FileText size={24} />
        </div>
      </div>
    </div>
  );
}
