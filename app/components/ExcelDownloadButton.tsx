"use client";

// app/components/ExcelDownloadButton.tsx
// 연차 또는 경비 페이지에서 import해서 버튼 하나만 추가하면 됩니다

import { exportLeaves, exportExpenses } from "../utils/exportExcel";
import { Download } from "lucide-react";

type Props = {
  type: "leave" | "expense";
  data: any[];
};

export default function ExcelDownloadButton({ type, data }: Props) {
  const handleClick = () => {
    if (type === "leave") exportLeaves(data);
    else exportExpenses(data);
  };

  return (
    <button
      onClick={handleClick}
      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
    >
      <Download size={15} />
      엑셀 다운로드
    </button>
  );
}
