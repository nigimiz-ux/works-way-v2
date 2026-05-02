// app/utils/exportExcel.ts
// xlsx 라이브러리를 사용한 엑셀 다운로드 유틸
// 사용법: exportToExcel(데이터배열, 컬럼정의, 파일명)

import * as XLSX from "xlsx";

type Column = {
  key: string;       // 데이터 객체의 키
  label: string;     // 엑셀 헤더명
  format?: (val: any) => string; // 값 변환 함수 (선택)
};

export function exportToExcel(
  data: Record<string, any>[],
  columns: Column[],
  fileName: string
) {
  if (data.length === 0) {
    alert("다운로드할 데이터가 없습니다.");
    return;
  }

  // 헤더 행
  const header = columns.map((c) => c.label);

  // 데이터 행
  const rows = data.map((item) =>
    columns.map((c) => {
      const val = item[c.key];
      return c.format ? c.format(val) : (val ?? "");
    })
  );

  // 워크시트 생성
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

  // 열 너비 자동 조정
  ws["!cols"] = columns.map((c) => ({
    wch: Math.max(c.label.length * 2, 12),
  }));

  // 헤더 스타일 (배경색)
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E3A5F" } },
        alignment: { horizontal: "center" },
      };
    }
  }

  // 워크북 생성 및 다운로드
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  const today = new Date().toISOString().split("T")[0]; // 2026-05-02
  XLSX.writeFile(wb, `${fileName}_${today}.xlsx`);
}

// ── 연차 내역 다운로드 ──────────────────────────────────────
export function exportLeaves(leaves: any[]) {
  exportToExcel(
    leaves,
    [
      { key: "id",             label: "번호" },
      { key: "applicant_email",label: "신청자 이메일" },
      { key: "leave_type",     label: "연차 종류",
        format: (v) => v === "half" ? "반차" : "연차" },
      { key: "start_date",     label: "시작일" },
      { key: "end_date",       label: "종료일" },
      { key: "reason",         label: "사유" },
      { key: "status",         label: "결재 상태" },
      { key: "created_at",     label: "신청일",
        format: (v) => v ? new Date(v).toLocaleDateString("ko-KR") : "" },
    ],
    "연차신청내역"
  );
}

// ── 법인카드·경비 내역 다운로드 ────────────────────────────
export function exportExpenses(expenses: any[]) {
  exportToExcel(
    expenses,
    [
      { key: "id",             label: "번호" },
      { key: "applicant_email",label: "신청자 이메일" },
      { key: "usage_date",     label: "사용일" },
      { key: "merchant",       label: "가맹점" },
      { key: "amount",         label: "금액(원)",
        format: (v) => v ? Number(v).toLocaleString("ko-KR") : "0" },
      { key: "category",       label: "카테고리" },
      { key: "purpose",        label: "목적" },
      { key: "status",         label: "결재 상태" },
      { key: "created_at",     label: "등록일",
        format: (v) => v ? new Date(v).toLocaleDateString("ko-KR") : "" },
    ],
    "법인카드사용내역"
  );
}
