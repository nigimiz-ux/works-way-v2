export default function ProjectList({ projects, selectedId, onSelect }: any) {
    if (projects.length === 0) return <p className="text-xs text-slate-500">프로젝트가 없습니다.</p>;

    return (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {projects.map((p: any) => {
                const isSelected = p.id === selectedId;
                return (
                    <div
                        key={p.id}
                        onClick={() => onSelect(p)}
                        className={`p-3 border rounded-xl cursor-pointer transition-all duration-200 ${isSelected
                                ? "bg-blue-600/20 border-blue-500/50"
                                : "bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-700/50"
                            }`}
                    >
                        <div className="font-bold text-sm text-white mb-1 truncate">{p.title}</div>
                        <div className={`text-[10px] font-semibold px-2 py-0.5 rounded inline-block ${p.status === '완료' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-300'
                            }`}>
                            {p.status}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}