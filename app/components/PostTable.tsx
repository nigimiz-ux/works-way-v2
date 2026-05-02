"use client";

import { useState } from "react";
import DeletePostButton from "./DeletePostButton";

type Post = {
  id: number;
  title: string;
  author: string;
  content: string;
  date?: string;
  created_at?: string;
};

export default function PostTable({ posts, error }: { posts: Post[] | null; error: any }) {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 w-24 text-center whitespace-nowrap">번호</th>
              <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">제목</th>
              <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 w-32 text-center whitespace-nowrap">작성자</th>
              <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 w-32 text-center whitespace-nowrap">작성일</th>
              <th scope="col" className="px-6 py-4 font-semibold text-slate-600 dark:text-slate-400 w-24 text-center whitespace-nowrap">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-transparent">
            {error ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-red-500 font-medium">
                  게시글을 불러오는데 실패했습니다.
                </td>
              </tr>
            ) : !posts || posts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-slate-500 dark:text-slate-400">
                  등록된 게시물이 없습니다.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr
                  key={post.id}
                  className="hover:bg-blue-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer text-slate-700 dark:text-slate-300 group"
                  onClick={() => setSelectedPost(post)}
                >
                  <td className="px-6 py-4 text-center text-slate-500 dark:text-slate-500 tabular-nums">{post.id}</td>
                  <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 truncate max-w-md group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {post.title}
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400">{post.author}</td>
                  <td className="px-6 py-4 text-center text-slate-500 dark:text-slate-500 tabular-nums">
                    {post.date || (post.created_at ? new Date(post.created_at).toLocaleDateString('ko-KR') : '-')}
                  </td>
                  <td className="px-6 py-4 text-center w-24">
                    <DeletePostButton id={post.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Post Detail Modal */}
      {selectedPost && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          onClick={() => setSelectedPost(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white pr-4 break-words">
                {selectedPost.title}
              </h3>
              <button 
                onClick={() => setSelectedPost(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex-shrink-0"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Meta Info */}
            <div className="px-6 py-3 bg-white dark:bg-slate-900 flex justify-between text-sm text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                  {selectedPost.author.charAt(0)}
                </div>
                <span className="font-medium text-slate-700 dark:text-slate-300">{selectedPost.author}</span>
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {selectedPost.date || (selectedPost.created_at ? new Date(selectedPost.created_at).toLocaleDateString('ko-KR') : '-')}
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-slate-900">
              <div className="text-slate-800 dark:text-slate-300 leading-relaxed whitespace-pre-wrap min-h-[150px]">
                {selectedPost.content || "내용이 없습니다."}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedPost(null)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-medium rounded-lg transition-all shadow-sm hover:shadow focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:ring-slate-500"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
