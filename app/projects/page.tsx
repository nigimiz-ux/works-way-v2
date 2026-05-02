"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { KanbanSquare, Plus, MessageSquare, Clock, Trash2 } from "lucide-react";
import ProjectDetailModal from "../components/ProjectDetailModal";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ProjectStatus = '시작 전' | '진행 중' | '완료';

type Project = {
  id: any;
  title: string;
  description: string;
  status: ProjectStatus;
  created_at: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionEmail, setSessionEmail] = useState("");
  const [userRole, setUserRole] = useState("user");
  
  // Modal states
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // New Project states
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    fetchSessionAndProjects();

    // 사용자가 로그아웃 후 다른 계정으로 로그인할 경우를 대비한 실시간 세션 동기화
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setSessionEmail(session.user.email);
      } else {
        setSessionEmail("");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchSessionAndProjects = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      setSessionEmail(session.user.email);
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("email", session.user.email)
        .single();
      
      if (profile) {
        setUserRole(profile.role || "user");
      }
    }

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("프로젝트 로딩 에러:", error);
      if (error.code === '42P01') {
         console.warn("Table does not exist. Using empty array.");
      }
    } else {
      setProjects(data as Project[] || []);
    }
    setIsLoading(false);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as ProjectStatus;
    const projectId = draggableId; // 숫자/UUID 범용 처리를 위해 parseInt 제거

    // 프론트엔드 상태 즉시 업데이트 (Optimistic Update)
    setProjects(projects.map(p => p.id.toString() === projectId ? { ...p, status: newStatus } : p));

    // DB 업데이트
    const { error } = await supabase
      .from("projects")
      .update({ status: newStatus })
      .eq("id", projectId);

    if (error) {
      console.error("Drag & Drop DB Update Error:", error, { projectId, newStatus });
      alert(`상태 업데이트에 실패했습니다: ${error.message}`);
      // 실패 시 원래 상태로 복구
      fetchSessionAndProjects();
    }
  };

  const handleDeleteProject = async (projectId: any) => {
    // 1차 검증: 클라이언트 상태 (UI 방어)
    if (userRole !== 'admin') {
      alert("권한이 없습니다.");
      return;
    }

    // 2차 검증: 백엔드(DB)에서 role 다시 확인 (이중 보안)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("email", session.user.email)
      .single();

    if (profile?.role !== 'admin') {
      alert("권한이 없습니다.");
      return;
    }

    if (!window.confirm("정말로 이 프로젝트를 삭제하시겠습니까? 관련된 코멘트 등 데이터가 모두 삭제될 수 있습니다.")) return;

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      console.error("프로젝트 삭제 에러:", error);
      alert("프로젝트 삭제에 실패했습니다.");
    } else {
      setProjects(projects.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) {
        setIsDetailOpen(false);
      }
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const { error, data } = await supabase.from("projects").insert([
      {
        title: newTitle,
        description: newDescription,
        status: '시작 전'
      }
    ]).select();

    if (error) {
      alert("프로젝트 생성에 실패했습니다.");
      console.error(error);
    } else {
      if (data) {
        setProjects([data[0], ...projects]);
      } else {
        fetchSessionAndProjects();
      }
      setIsNewOpen(false);
      setNewTitle("");
      setNewDescription("");
    }
  };

  const openDetail = (project: Project) => {
    setSelectedProject(project);
    setIsDetailOpen(true);
  };

  const columns: { id: ProjectStatus; title: string; color: string; bg: string }[] = [
    { id: '시작 전', title: '시작 전 (To Do)', color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800/50' },
    { id: '진행 중', title: '진행 중 (In Progress)', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10' },
    { id: '완료', title: '완료 (Done)', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/10' },
  ];

  return (
    <div className="w-full animate-fade-in flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <KanbanSquare className="text-blue-600 dark:text-blue-400" />
            프로젝트 보드
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">사내 프로젝트의 상태를 관리하고 코멘트를 공유하세요.</p>
        </div>
        <button
          onClick={() => setIsNewOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          새 프로젝트
        </button>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 hide-scrollbar">
          {columns.map((col) => (
            <div key={col.id} className={`flex-shrink-0 w-80 rounded-2xl flex flex-col border border-slate-200 dark:border-slate-800 ${col.bg}`}>
              <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50 shrink-0 flex items-center justify-between">
                <h3 className={`font-bold ${col.color}`}>{col.title}</h3>
                <span className="bg-white/50 dark:bg-slate-900/50 text-slate-500 text-xs font-medium px-2.5 py-1 rounded-full">
                  {projects.filter(p => p.status === col.id).length}
                </span>
              </div>
              
              <Droppable droppableId={col.id}>
                {(provided) => (
                  <div 
                    className="p-4 flex-1 overflow-y-auto space-y-4"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {isLoading ? (
                      <div className="text-center text-sm text-slate-500 py-4">로딩 중...</div>
                    ) : projects.filter(p => p.status === col.id).map((project, index) => (
                      <Draggable key={project.id.toString()} draggableId={project.id.toString()} index={index}>
                        {(provided, snapshot) => (
                          <div 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              opacity: snapshot.isDragging ? 0.8 : 1,
                            }}
                            onClick={() => openDetail(project)}
                            className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/50 cursor-grab hover:border-blue-300 dark:hover:border-blue-600/50 hover:shadow-md transition-all group"
                          >
                            <h4 className="font-bold text-slate-900 dark:text-white text-base mb-2 line-clamp-2">{project.title}</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                              {project.description || "설명이 없습니다."}
                            </p>
                            
                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                              <div className="flex items-center text-xs text-slate-400 gap-1.5">
                                <Clock size={14} />
                                {new Date(project.created_at).toLocaleDateString()}
                              </div>
                              {userRole === 'admin' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteProject(project.id);
                                  }}
                                  className="text-slate-300 hover:text-red-500 transition-colors"
                                  title="프로젝트 삭제"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* New Project Modal */}
      {isNewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsNewOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">새 프로젝트 추가</h3>
            <form onSubmit={handleAddProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">프로젝트 명</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="예: 2분기 마케팅 기획"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">설명</label>
                <textarea
                  required
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none outline-none"
                  placeholder="프로젝트의 주요 목표나 내용을 적어주세요."
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsNewOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                >
                  보드에 추가
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <ProjectDetailModal 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
        project={selectedProject} 
        sessionEmail={sessionEmail} 
        userRole={userRole}
        onDeleteProject={handleDeleteProject}
      />
    </div>
  );
}
