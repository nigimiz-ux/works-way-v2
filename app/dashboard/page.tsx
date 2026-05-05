'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ProjectList from '../components/ProjectList'
import TransactionForm from '../components/TransactionForm'

export default function DashboardPage() {
    const [projects, setProjects] = useState<any[]>([])
    const [selectedProject, setSelectedProject] = useState<any>(null)

    useEffect(() => {
        fetchProjects()
    }, [])

    const fetchProjects = async () => {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false })
        if (!error && data) setProjects(data)
    }

    return (
        <div className="w-full animate-fade-in min-h-screen">
            <div className="mb-6 border-b border-slate-800 pb-4">
                <h2 className="text-2xl font-bold text-white tracking-tight">재무 대시보드</h2>
                <p className="text-sm text-slate-500 mt-1">프로젝트별 돈의 흐름과 이익을 추적합니다.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 좌측: 프로젝트 리스트 */}
                <div className="col-span-1 bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5">
                    <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        📊 프로젝트 목록
                    </h2>
                    <ProjectList
                        projects={projects}
                        selectedId={selectedProject?.id}
                        onSelect={setSelectedProject}
                    />
                </div>

                {/* 우측: 돈 입력 + 요약 */}
                <div className="col-span-1 lg:col-span-2">
                    {selectedProject ? (
                        <div className="space-y-4">
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                                <h2 className="text-lg font-bold text-blue-400">
                                    {selectedProject.title}
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">{selectedProject.description || "설명 없음"}</p>
                            </div>
                            <TransactionForm project={selectedProject} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 bg-slate-900/30 border border-slate-700/50 rounded-2xl border-dashed">
                            <p className="text-slate-500 text-sm">👈 좌측에서 프로젝트를 선택하세요</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}