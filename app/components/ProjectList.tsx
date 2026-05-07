'use client'

export default function ProjectList({ projects, selectedId, onSelect }: any) {

    // 💡 영어든 한글이든 찰떡같이 번역해서 예쁜 뱃지로 만들어주는 마법의 함수
    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase() || 'todo';

        if (s === 'doing' || s === 'in progress' || s === 'in-progress' || s === '진행 중' || s === '진행중') {
            return <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">진행 중</span>;
        }
        if (s === 'done' || s === '완료') {
            return <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">완료</span>;
        }

        // 기본값 (todo 또는 그 외 모르는 글자일 때)
        return <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">시작 전</span>;
    };

    return (
        <div className="space-y-2">
            {projects.map((p: any) => (
                <div
                    key={p.id}
                    onClick={() => onSelect(p)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border ${selectedId === p.id
                            ? 'bg-slate-800 border-blue-500/50 shadow-lg'
                            : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                >
                    {/* 프로젝트 제목 */}
                    <div className="font-bold text-sm text-white mb-2">{p.title || p.name}</div>

                    {/* 상태 뱃지 (여기서 번역기 함수가 작동합니다!) */}
                    {getStatusBadge(p.status)}
                </div>
            ))}

            {projects.length === 0 && (
                <div className="text-center text-sm text-slate-500 py-4">
                    프로젝트가 없습니다.
                </div>
            )}
        </div>
    );
}