import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { X, Send, UserCircle2, Trash2 } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ProjectComment = {
  id: number;
  project_id: number;
  content: string;
  author_email: string;
  author_name?: string;
  author_dept?: string;
  created_at: string;
};

export default function ProjectDetailModal({ isOpen, onClose, project, sessionEmail, userRole, onDeleteProject }: any) {
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && project) {
      fetchComments();
    }
  }, [isOpen, project]);

  const fetchComments = async () => {
    setIsLoading(true);
    
    // 1. Get comments for this project
    const { data: commentsData, error } = await supabase
      .from("project_comments")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("댓글 로딩 에러:", error);
      setIsLoading(false);
      return;
    }

    const fetchedComments = commentsData || [];

    // 2. 정확한 eq 조인을 위한 프로필 개별 조회 (유저 지시사항 반영)
    const emails = Array.from(new Set(fetchedComments.map(c => c.author_email).filter(Boolean)));
    const profilesMap: Record<string, any> = {};

    if (emails.length > 0) {
      await Promise.all(emails.map(async (email) => {
        const { data } = await supabase
          .from("profiles")
          .select("email, full_name, department")
          .eq("email", email)
          .single();
        if (data) profilesMap[email] = data;
      }));
    }

    // 3. Map profile info
    const enrichedComments = fetchedComments.map(comment => {
      const profile = comment.author_email ? profilesMap[comment.author_email] : null;
      return {
        ...comment,
        author_name: profile?.full_name || comment.author_email || "알 수 없는 사용자",
        author_dept: profile?.department || "소속 없음"
      };
    });

    setComments(enrichedComments as ProjectComment[]);
    setIsLoading(false);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !sessionEmail) return;

    const tempComment = newComment.trim();
    setNewComment("");

    // 즉각적인 렌더링을 위한 Optimistic Update (본인 프로필 가져오기)
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("full_name, department")
      .eq("email", sessionEmail)
      .single();

    const optimisticComment: ProjectComment = {
      id: Date.now(), // 임시 ID
      project_id: project.id,
      content: tempComment,
      author_email: sessionEmail,
      author_name: myProfile?.full_name || sessionEmail,
      author_dept: myProfile?.department || "소속 없음",
      created_at: new Date().toISOString()
    };

    // 새로고침(F5) 없이 즉시 상태 반영
    setComments(prev => [...prev, optimisticComment]);

    // DB 실제 Insert 로직
    const { error } = await supabase.from("project_comments").insert([
      {
        project_id: project.id,
        content: tempComment,
        author_email: sessionEmail
      }
    ]);

    if (error) {
      console.error("댓글 추가 에러:", error);
      alert("댓글 작성에 실패했습니다.");
      fetchComments(); // 실패 시 원래 데이터 롤백
    } else {
      fetchComments(); // DB에 정상 생성된 진짜 ID로 동기화
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm("정말로 이 코멘트를 삭제하시겠습니까?")) return;
    
    const { error } = await supabase
      .from("project_comments")
      .delete()
      .eq("id", commentId)
      .eq("author_email", sessionEmail); // 이중 보안: 본인 댓글만 삭제 가능
      
    if (error) {
      console.error("댓글 삭제 에러:", error);
      alert("댓글 삭제에 실패했습니다.");
    } else {
      setComments(comments.filter(c => c.id !== commentId));
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                project.status === '시작 전' ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' :
                project.status === '진행 중' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50' :
                'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50'
              }`}>
                {project.status}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{project.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {userRole === 'admin' && onDeleteProject && (
              <button 
                onClick={() => onDeleteProject(project.id)} 
                className="text-slate-400 hover:text-red-500 transition-colors p-1"
                title="프로젝트 삭제"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors p-1">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content & Comments Body */}
        <div className="overflow-y-auto p-6 flex-1 bg-slate-50 dark:bg-slate-900">
          {/* Project Description */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">프로젝트 설명</h3>
            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed min-h-[100px]">
              {project.description || "등록된 설명이 없습니다."}
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              공지사항 및 코멘트
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full">{comments.length}</span>
            </h3>

            <div className="space-y-4 mb-6">
              {isLoading ? (
                <div className="text-center py-4 text-slate-500 text-sm">로딩 중...</div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
                  아직 코멘트가 없습니다. 첫 번째 코멘트를 남겨보세요!
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                      <UserCircle2 size={20} />
                    </div>
                    <div className="flex-1 bg-white dark:bg-slate-950 p-3.5 rounded-xl rounded-tl-sm border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white">{comment.author_name}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{comment.author_dept}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">
                            {new Date(comment.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {comment.author_email === sessionEmail && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                              title="삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Comment Input Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <form onSubmit={handleAddComment} className="flex gap-2 relative">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="프로젝트 관련 코멘트를 입력하세요..."
              className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 text-sm text-slate-900 dark:text-white pr-12"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
            >
              <Send size={16} className="ml-0.5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
