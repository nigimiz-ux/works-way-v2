"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { MessageCircle, Send, Briefcase, Share2, AlertCircle } from "lucide-react";

// 환경변수를 사용하여 Supabase 클라이언트 초기화
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CEO_EMAIL = "nigimiz@naver.com"; // 임원님의 이메일 주소

type Comment = {
  id: number;
  post_id: number;
  author_email: string;
  content: string;
  created_at: string;
  profile?: any;
};

type Post = {
  id: number;
  author_email: string;
  department: string;
  category: string;
  content: string;
  created_at: string;
  profile?: any;
  comments?: Comment[];
};

export default function DepartmentBoardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostCategory, setNewPostCategory] = useState("업무공유");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [isSubmittingComment, setIsSubmittingComment] = useState<number | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email, department, full_name, position")
        .eq("id", session.user.id)
        .single();
        
      if (profiles) {
        setCurrentUserProfile(profiles);
        await fetchPosts(profiles);
      } else {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  };

  const fetchPosts = async (profile: any) => {
    const isCEO = profile.email.trim().toLowerCase() === CEO_EMAIL.trim().toLowerCase();
    
    let query = supabase
      .from("department_posts")
      .select("*")
      .order("created_at", { ascending: false });

    // 사장님이 아니면 소속 부서 글만 필터링
    if (!isCEO) {
      query = query.eq("department", profile.department);
    }

    const { data: postsData, error: postsError } = await query;

    if (postsError) {
      console.error("게시글 조회 에러 상세:", JSON.stringify(postsError, null, 2));
      alert(`게시글 조회 중 오류가 발생했습니다: ${postsError.message}`);
      setIsLoading(false);
      return;
    }

    if (postsData && postsData.length > 0) {
      // 1. 작성자 이메일 목록 수집
      const postEmails = postsData.map(p => p.author_email);
      
      // 2. 게시글의 댓글들 일괄 수집
      const postIds = postsData.map(p => p.id);
      const { data: commentsData, error: commentsError } = await supabase
        .from("post_comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });
        
      if (commentsError) {
        console.error("댓글 조회 에러 상세:", JSON.stringify(commentsError, null, 2));
      }
      
      const commentEmails = commentsData ? commentsData.map(c => c.author_email) : [];
      const allEmails = Array.from(new Set([...postEmails, ...commentEmails]));
      
      // 3. Profiles 정보 수동 JOIN (400 Bad Request 방지)
      let profilesMap: Record<string, any> = {};
      if (allEmails.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("email, full_name, department, position")
          .in("email", allEmails);
          
        if (profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.email] = p;
          });
        }
      }

      // 4. 게시글, 댓글, 프로필 하나로 병합
      const mergedPosts = postsData.map(post => {
        const postComments = (commentsData || []).filter(c => c.post_id === post.id).map(c => ({
          ...c,
          profile: profilesMap[c.author_email] || null
        }));
        
        return {
          ...post,
          profile: profilesMap[post.author_email] || null,
          comments: postComments
        };
      });

      setPosts(mergedPosts);
    } else {
      setPosts([]);
    }
    
    setIsLoading(false);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;
    if (!currentUserProfile) return;

    setIsSubmitting(true);

    const newPost = {
      author_email: currentUserProfile.email,
      department: currentUserProfile.department || "부서 없음",
      category: newPostCategory,
      content: newPostContent.trim()
    };

    const { error } = await supabase
      .from("department_posts")
      .insert([newPost]);

    if (error) {
      console.error("게시글 등록 에러 상세:", JSON.stringify(error, null, 2));
      alert(`게시글 등록에 실패했습니다: ${error.message}`);
    } else {
      setNewPostContent("");
      // 다시 패치해서 최신 상태(본인 글) 리스트에 반영
      await fetchPosts(currentUserProfile);
    }
    setIsSubmitting(false);
  };

  const handleCreateComment = async (e: React.FormEvent, postId: number) => {
    e.preventDefault();
    const content = commentInputs[postId];
    if (!content?.trim()) return;
    if (!currentUserProfile) return;

    setIsSubmittingComment(postId);

    const newComment = {
      post_id: postId,
      author_email: currentUserProfile.email,
      content: content.trim()
    };

    const { error } = await supabase
      .from("post_comments")
      .insert([newComment]);

    if (error) {
      console.error("댓글 등록 에러 상세:", JSON.stringify(error, null, 2));
      alert(`댓글 등록에 실패했습니다: ${error.message}`);
    } else {
      setCommentInputs(prev => ({ ...prev, [postId]: "" }));
      // 재패치하여 댓글 반영
      await fetchPosts(currentUserProfile);
    }
    setIsSubmittingComment(null);
  };

  const getCategoryColor = (category: string) => {
    switch(category) {
      case "업무지시": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
      case "도움요청": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
      case "업무공유": default: return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch(category) {
      case "업무지시": return <AlertCircle size={14} />;
      case "도움요청": return <MessageCircle size={14} />;
      case "업무공유": default: return <Share2 size={14} />;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in flex flex-col py-6 min-h-[calc(100vh-6rem)]">
      <div className="mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">부서 소통 게시판</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {currentUserProfile?.email === CEO_EMAIL 
            ? "전사 각 부서의 실시간 업무 현황을 한눈에 파악하세요." 
            : `${currentUserProfile?.department || "소속"} 부서원들과 빠르고 가볍게 소통하세요.`}
        </p>
      </div>

      {/* 새 글 작성 영역 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mb-8">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex gap-2">
          {["업무공유", "업무지시", "도움요청"].map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setNewPostCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border ${
                newPostCategory === cat 
                  ? getCategoryColor(cat) + " shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {getCategoryIcon(cat)}
              {cat}
            </button>
          ))}
        </div>
        <form onSubmit={handleCreatePost}>
          <textarea
            className="w-full bg-white dark:bg-slate-900 px-5 py-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none min-h-[100px] resize-none"
            placeholder="지금 부서원들과 나눌 업무 이야기를 자유롭게 입력하세요..."
            value={newPostContent}
            onChange={e => setNewPostContent(e.target.value)}
            disabled={isSubmitting}
          />
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              {currentUserProfile?.email === CEO_EMAIL 
                ? "사장님 계정은 전체 부서 게시판을 조회 중입니다." 
                : <span>작성 시 <strong>{currentUserProfile?.department || "소속"}</strong> 부서원에게만 공유됩니다.</span>}
            </span>
            <button
              type="submit"
              disabled={isSubmitting || !newPostContent.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-bold rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <Send size={16} />
              {isSubmitting ? "게시 중..." : "게시하기"}
            </button>
          </div>
        </form>
      </div>

      {/* 피드 목록 */}
      <div className="space-y-6 pb-20">
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Briefcase size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-slate-500 font-medium">아직 작성된 소통 글이 없습니다.</p>
            <p className="text-sm text-slate-400 mt-1">부서원들과 첫 번째 이야기를 나눠보세요!</p>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* 카드 헤더 */}
              <div className="p-5 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
                    {post.profile?.full_name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {post.profile?.full_name || post.author_email}
                      </span>
                      <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium">
                        {post.department}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      {new Date(post.created_at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1 ${getCategoryColor(post.category)}`}>
                  {getCategoryIcon(post.category)}
                  {post.category}
                </div>
              </div>

              {/* 본문 */}
              <div className="px-5 pb-5">
                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed text-[15px]">
                  {post.content}
                </p>
              </div>

              {/* 카카오톡 스타일 댓글 영역 */}
              <div className="bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 p-5">
                {post.comments && post.comments.length > 0 && (
                  <div className="space-y-4 mb-5">
                    {post.comments.map(comment => (
                      <div key={comment.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs shrink-0 mt-0.5">
                          {comment.profile?.full_name?.charAt(0) || "?"}
                        </div>
                        <div className="flex-1 max-w-[90%]">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              {comment.profile?.full_name || comment.author_email}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="inline-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
                            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 댓글 입력창 */}
                <form 
                  onSubmit={(e) => handleCreateComment(e, post.id)}
                  className="flex gap-2 items-start"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0 mt-1">
                    {currentUserProfile?.full_name?.charAt(0) || "나"}
                  </div>
                  <div className="flex-1 relative">
                    <textarea
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none pr-12 min-h-[44px] overflow-hidden leading-tight"
                      placeholder="부서원에게 댓글 달기..."
                      rows={1}
                      value={commentInputs[post.id] || ""}
                      onChange={(e) => {
                        setCommentInputs(prev => ({...prev, [post.id]: e.target.value}));
                        e.target.style.height = "44px"; // reset
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleCreateComment(e, post.id);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingComment === post.id || !commentInputs[post.id]?.trim()}
                      className="absolute right-1.5 bottom-1.5 p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
