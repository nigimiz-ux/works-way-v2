"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Target, Plus, X, ChevronDown, ChevronUp,
  Pencil, Trash2, Check, TrendingUp
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── 타입 ─────────────────────────────────────────────────────
type KeyResult = {
  id: number;
  objective_id: number;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  linked_task_ref: string;
};

type Objective = {
  id: number;
  user_id: string;
  title: string;
  description: string;
  quarter: string;
  status: "진행중" | "완료" | "취소";
  key_results: KeyResult[];
};

// ── 유틸 ─────────────────────────────────────────────────────
const getProgress = (krs: KeyResult[]): number => {
  if (!krs.length) return 0;
  const avg = krs.reduce((sum, kr) => {
    const pct = Math.min((kr.current_value / kr.target_value) * 100, 100);
    return sum + pct;
  }, 0) / krs.length;
  return Math.round(avg);
};

const getProgressColor = (pct: number) => {
  if (pct >= 70) return { bar: "bg-green-500", text: "text-green-400" };
  if (pct >= 40) return { bar: "bg-amber-500", text: "text-amber-400" };
  return { bar: "bg-red-500", text: "text-red-400" };
};

// 현재 분기 자동 계산
const getCurrentQuarter = () => {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
};

const QUARTERS = (() => {
  const now = new Date();
  const year = now.getFullYear();
  return [
    `${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`,
    `${year + 1}-Q1`,
  ];
})();

const UNITS = ["%", "건", "회", "원", "명", "개"];

// ── KR 진행률 입력 모달 ──────────────────────────────────────
function UpdateKRModal({
  kr, onClose, onUpdate,
}: {
  kr: KeyResult;
  onClose: () => void;
  onUpdate: (id: number, value: number) => Promise<void>;
}) {
  const [value, setValue] = useState(kr.current_value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onUpdate(kr.id, value);
    setIsSaving(false);
    onClose();
  };

  const pct = Math.min(Math.round((value / kr.target_value) * 100), 100);
  const color = getProgressColor(pct);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="text-sm font-bold text-white">진행률 업데이트</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-slate-300 font-medium">{kr.title}</p>

          <div>
            <label className="block text-xs text-slate-400 mb-2">
              현재값 (목표: {kr.target_value}{kr.unit})
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={kr.target_value * 2}
                value={value} onChange={e => setValue(Number(e.target.value))}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-slate-400 text-sm shrink-0">{kr.unit}</span>
            </div>
          </div>

          {/* 미리보기 */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-500">달성률</span>
              <span className={`font-bold ${color.text}`}>{pct}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${color.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
              취소
            </button>
            <button type="submit" disabled={isSaving}
              className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {isSaving ? "저장 중..." : <><Check size={14} /> 저장</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 목표 추가/편집 모달 ──────────────────────────────────────
function ObjectiveModal({
  userId, onClose, onSave, initial,
}: {
  userId: string;
  onClose: () => void;
  onSave: () => Promise<void>;
  initial?: Objective;
}) {
  const [title, setTitle]       = useState(initial?.title ?? "");
  const [desc, setDesc]         = useState(initial?.description ?? "");
  const [quarter, setQuarter]   = useState(initial?.quarter ?? getCurrentQuarter());
  const [status, setStatus]     = useState<Objective["status"]>(initial?.status ?? "진행중");

  // KR 입력 목록
  const [krs, setKrs] = useState<Partial<KeyResult>[]>(
    initial?.key_results?.length
      ? initial.key_results.map(kr => ({ ...kr }))
      : [{ title: "", target_value: 100, current_value: 0, unit: "%" }]
  );

  const [isSaving, setIsSaving] = useState(false);

  const addKR = () => setKrs(prev => [...prev, { title: "", target_value: 100, current_value: 0, unit: "%" }]);
  const removeKR = (i: number) => setKrs(prev => prev.filter((_, idx) => idx !== i));
  const updateKR = (i: number, field: string, val: any) =>
    setKrs(prev => prev.map((kr, idx) => idx === i ? { ...kr, [field]: val } : kr));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { alert("목표 제목을 입력해주세요."); return; }
    if (krs.some(kr => !kr.title?.trim())) { alert("모든 핵심결과 내용을 입력해주세요."); return; }
    setIsSaving(true);

    if (initial) {
      // 수정
      await supabase.from("objectives").update({ title, description: desc, quarter, status }).eq("id", initial.id);
      // 기존 KR 삭제 후 재삽입 (간단하게)
      await supabase.from("key_results").delete().eq("objective_id", initial.id);
      await supabase.from("key_results").insert(
        krs.map(kr => ({
          objective_id:   initial.id,
          title:          kr.title,
          target_value:   kr.target_value,
          current_value:  kr.current_value ?? 0,
          unit:           kr.unit ?? "%",
          linked_task_ref: kr.linked_task_ref ?? "",
        }))
      );
    } else {
      // 신규
      const { data: newObj } = await supabase
        .from("objectives")
        .insert({ user_id: userId, title, description: desc, quarter, status })
        .select()
        .single();
      if (newObj) {
        await supabase.from("key_results").insert(
          krs.map(kr => ({
            objective_id:   newObj.id,
            title:          kr.title,
            target_value:   kr.target_value,
            current_value:  0,
            unit:           kr.unit ?? "%",
            linked_task_ref: kr.linked_task_ref ?? "",
          }))
        );
      }
    }

    await onSave();
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Target size={15} className="text-blue-400" />
            {initial ? "목표 수정" : "새 목표 추가"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* 목표 기본 정보 */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              목표 (Objective) *
            </label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="예: 이번 분기 신규 거래처 확보"
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">설명 (선택)</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="목표에 대한 추가 설명" rows={2}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">분기</label>
              <select value={quarter} onChange={e => setQuarter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                {QUARTERS.map(q => <option key={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">상태</label>
              <select value={status} onChange={e => setStatus(e.target.value as Objective["status"])}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option>진행중</option>
                <option>완료</option>
                <option>취소</option>
              </select>
            </div>
          </div>

          {/* 핵심 결과 KR */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-400">핵심 결과 (Key Results)</label>
              <button type="button" onClick={addKR}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                <Plus size={12} /> KR 추가
              </button>
            </div>

            <div className="space-y-3">
              {krs.map((kr, i) => (
                <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 text-xs text-slate-500 font-bold shrink-0">KR{i + 1}</span>
                    <input type="text" value={kr.title ?? ""} onChange={e => updateKR(i, "title", e.target.value)}
                      placeholder="측정 가능한 핵심 결과를 입력하세요"
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    {krs.length > 1 && (
                      <button type="button" onClick={() => removeKR(i)}
                        className="mt-1.5 p-1 text-slate-500 hover:text-red-400 transition-colors shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-xs text-slate-500">목표값</span>
                    <input type="number" value={kr.target_value ?? 100} onChange={e => updateKR(i, "target_value", Number(e.target.value))}
                      className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-center" />
                    <select value={kr.unit ?? "%"} onChange={e => updateKR(i, "unit", e.target.value)}
                      className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
              취소
            </button>
            <button type="submit" disabled={isSaving}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {isSaving ? "저장 중..." : <><Check size={14} /> {initial ? "수정 완료" : "목표 등록"}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 목표 카드 ─────────────────────────────────────────────────
function ObjectiveCard({
  obj, myId, isAdmin, onEdit, onDelete, onUpdateKR,
}: {
  obj: Objective;
  myId: string;
  isAdmin: boolean;
  onEdit: (obj: Objective) => void;
  onDelete: (id: number) => void;
  onUpdateKR: (kr: KeyResult) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const progress = getProgress(obj.key_results);
  const color = getProgressColor(progress);
  const canEdit = obj.user_id === myId || isAdmin;

  const STATUS_STYLE: Record<string, string> = {
    "진행중": "bg-blue-500/20 text-blue-300 border-blue-500/30",
    "완료":   "bg-green-500/20 text-green-300 border-green-500/30",
    "취소":   "bg-slate-500/20 text-slate-400 border-slate-600",
  };

  return (
    <div className={`bg-slate-800/50 border rounded-2xl overflow-hidden transition-all ${
      obj.status === "완료" ? "border-green-500/20 opacity-75" :
      obj.status === "취소" ? "border-slate-700/30 opacity-50" :
      "border-slate-700/50 hover:border-slate-600"
    }`}>

      {/* 카드 헤더 */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-500">{obj.quarter}</span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[obj.status]}`}>
                {obj.status}
              </span>
            </div>
            <h3 className="text-base font-bold text-white leading-snug">{obj.title}</h3>
            {obj.description && (
              <p className="text-xs text-slate-500 mt-1">{obj.description}</p>
            )}
          </div>

          {/* 전체 달성률 링 */}
          <div className="shrink-0 flex flex-col items-center">
            <div className="relative w-14 h-14">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#334155" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none"
                  stroke={progress >= 70 ? "#22c55e" : progress >= 40 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="3"
                  strokeDasharray={`${(progress / 100) * 94.2} 94.2`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xs font-bold ${color.text}`}>{progress}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 전체 진행바 */}
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-1">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>전체 달성률</span>
          <span>{obj.key_results.length}개의 핵심 결과</span>
        </div>
      </div>

      {/* KR 목록 토글 */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-5 py-2 bg-slate-900/30 border-t border-slate-700/50 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        <span>핵심 결과 (KR)</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* KR 상세 */}
      {expanded && (
        <div className="divide-y divide-slate-700/30">
          {obj.key_results.length === 0 ? (
            <p className="px-5 py-4 text-xs text-slate-600 text-center">핵심 결과가 없습니다.</p>
          ) : (
            obj.key_results.map((kr, i) => {
              const krPct = Math.min(Math.round((kr.current_value / kr.target_value) * 100), 100);
              const krColor = getProgressColor(krPct);
              return (
                <div key={kr.id} className="px-5 py-3 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-600 mt-0.5 shrink-0">KR{i + 1}</span>
                      <p className="text-xs text-slate-300 leading-relaxed">{kr.title}</p>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => onUpdateKR(kr)}
                        className="shrink-0 px-2 py-1 text-[10px] font-semibold rounded-lg bg-slate-700 hover:bg-blue-600/30 text-slate-400 hover:text-blue-300 border border-slate-600 hover:border-blue-500/50 transition-all"
                      >
                        업데이트
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${krColor.bar}`}
                        style={{ width: `${krPct}%` }}
                      />
                    </div>
                    <div className="shrink-0 flex items-center gap-1 text-[11px]">
                      <span className={`font-bold ${krColor.text}`}>{kr.current_value}</span>
                      <span className="text-slate-600">/</span>
                      <span className="text-slate-500">{kr.target_value}{kr.unit}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 카드 액션 */}
      {canEdit && (
        <div className="flex gap-2 px-5 py-3 border-t border-slate-700/30 bg-slate-900/20">
          <button
            onClick={() => onEdit(obj)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Pencil size={11} /> 수정
          </button>
          <button
            onClick={() => onDelete(obj.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 size={11} /> 삭제
          </button>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────
export default function OKRPage() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [myId, setMyId]             = useState("");
  const [isAdmin, setIsAdmin]       = useState(false);
  const [isLoading, setIsLoading]   = useState(true);
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());

  // 모달 상태
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [editingObj, setEditingObj]                 = useState<Objective | undefined>();
  const [updatingKR, setUpdatingKR]                 = useState<KeyResult | undefined>();

  useEffect(() => { init(); }, []);
  useEffect(() => { if (myId) fetchObjectives(); }, [myId, selectedQuarter]);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setIsLoading(false); return; }
    setMyId(session.user.id);
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
    if (["admin", "director"].includes(prof?.role ?? "")) setIsAdmin(true);
  };

  const fetchObjectives = async () => {
    setIsLoading(true);
    const { data: objs } = await supabase
      .from("objectives")
      .select("*")
      .eq("quarter", selectedQuarter)
      .order("created_at", { ascending: false });

    if (!objs) { setIsLoading(false); return; }

    const objIds = objs.map(o => o.id);
    const { data: krs } = await supabase
      .from("key_results")
      .select("*")
      .in("objective_id", objIds);

    const merged: Objective[] = objs.map(o => ({
      ...o,
      key_results: (krs ?? []).filter(kr => kr.objective_id === o.id),
    }));

    setObjectives(merged);
    setIsLoading(false);
  };

  const handleDeleteObjective = async (id: number) => {
    if (!confirm("이 목표를 삭제하시겠습니까? 핵심 결과도 모두 삭제됩니다.")) return;
    await supabase.from("objectives").delete().eq("id", id);
    setObjectives(prev => prev.filter(o => o.id !== id));
  };

  const handleUpdateKR = async (krId: number, value: number) => {
    await supabase.from("key_results").update({ current_value: value }).eq("id", krId);
    await fetchObjectives();
  };

  // 전체 요약 통계
  const totalObjs   = objectives.length;
  const avgProgress = totalObjs
    ? Math.round(objectives.reduce((s, o) => s + getProgress(o.key_results), 0) / totalObjs)
    : 0;
  const completedObjs = objectives.filter(o => getProgress(o.key_results) >= 100).length;

  return (
    <div className="w-full animate-fade-in min-h-screen">

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Target size={22} className="text-blue-400" />
            OKR 목표 관리
          </h2>
          <p className="text-sm text-slate-500 mt-1">분기별 목표와 핵심 결과를 관리하세요.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
            {QUARTERS.map(q => <option key={q}>{q}</option>)}
          </select>
          <button
            onClick={() => { setEditingObj(undefined); setShowObjectiveModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-sm"
          >
            <Plus size={15} /> 목표 추가
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "전체 목표", value: totalObjs, unit: "개", color: "text-white" },
          { label: "평균 달성률", value: avgProgress, unit: "%", color: getProgressColor(avgProgress).text },
          { label: "달성 완료", value: completedObjs, unit: "개", color: "text-green-400" },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}<span className="text-base ml-0.5">{unit}</span></div>
            <div className="text-xs text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* 목표 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-slate-500">
          <svg className="animate-spin h-6 w-6 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          불러오는 중...
        </div>
      ) : objectives.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-600">
          <Target size={40} className="opacity-20 mb-3" />
          <p className="text-sm">{selectedQuarter} 목표가 없습니다.</p>
          <button
            onClick={() => { setEditingObj(undefined); setShowObjectiveModal(true); }}
            className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            첫 번째 목표를 추가해보세요
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {objectives.map(obj => (
            <ObjectiveCard
              key={obj.id}
              obj={obj}
              myId={myId}
              isAdmin={isAdmin}
              onEdit={o => { setEditingObj(o); setShowObjectiveModal(true); }}
              onDelete={handleDeleteObjective}
              onUpdateKR={kr => setUpdatingKR(kr)}
            />
          ))}
        </div>
      )}

      {/* 목표 추가/수정 모달 */}
      {showObjectiveModal && (
        <ObjectiveModal
          userId={myId}
          initial={editingObj}
          onClose={() => { setShowObjectiveModal(false); setEditingObj(undefined); }}
          onSave={fetchObjectives}
        />
      )}

      {/* KR 업데이트 모달 */}
      {updatingKR && (
        <UpdateKRModal
          kr={updatingKR}
          onClose={() => setUpdatingKR(undefined)}
          onUpdate={handleUpdateKR}
        />
      )}
    </div>
  );
}
