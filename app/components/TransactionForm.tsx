'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function TransactionForm({ project }: any) {
    const [type, setType] = useState('expense')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [newCategoryName, setNewCategoryName] = useState('')

    const [transactions, setTransactions] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [profit, setProfit] = useState<any>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        fetchCategories()
        fetchTransactions()
        fetchProfit()
    }, [project])

    // 1. 항목(카테고리) 불러오기
    const fetchCategories = async () => {
        const { data } = await supabase
            .from('expense_categories')
            .select('*')
            .eq('project_id', project.id)
        setCategories(data || [])
    }

    const fetchTransactions = async () => {
        // 카테고리 이름까지 같이 가져오도록 조인(Join)
        const { data } = await supabase
            .from('transactions')
            .select('*, expense_categories(name)')
            .eq('project_id', project.id)
            .order('occurred_at', { ascending: false })
        setTransactions(data || [])
    }

    const fetchProfit = async () => {
        const { data } = await supabase.from('project_profit').select('*').eq('project_id', project.id).single()
        setProfit(data)
    }

    // 2. 새 항목(카테고리) 추가하기
    const handleAddCategory = async () => {
        if (!newCategoryName) return;
        const { data } = await supabase.from('expense_categories').insert({
            name: newCategoryName,
            project_id: project.id,
            created_by: (await supabase.auth.getUser()).data.user?.id
        }).select().single()

        if (data) {
            setCategories([...categories, data])
            setCategoryId(data.id) // 방금 만든 걸로 자동 선택
            setNewCategoryName('')
        }
    }

    // 3. 돈 입력하기
    const handleSubmit = async () => {
        if (!amount) return
        setIsSubmitting(true)
        await supabase.from('transactions').insert({
            project_id: project.id,
            type,
            amount: Number(amount),
            description,
            category_id: categoryId || null, // 항목 선택 안 했으면 null
            occurred_at: new Date().toISOString().split('T')[0],
            created_by: (await supabase.auth.getUser()).data.user?.id
        })
        setAmount(''); setDescription(''); setCategoryId('')
        await fetchTransactions(); await fetchProfit()
        setIsSubmitting(false)
    }

    const formatMoney = (num: number) => num?.toLocaleString('ko-KR') || '0';

    return (
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 space-y-6">

            {/* 요약 대시보드 */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                    <div className="text-xs text-slate-500 mb-1">총 수익 (예산)</div>
                    <div className="text-lg font-bold text-green-400">₩{formatMoney(profit?.total_income)}</div>
                </div>
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                    <div className="text-xs text-slate-500 mb-1">총 지출 (경비)</div>
                    <div className="text-lg font-bold text-red-400">₩{formatMoney(profit?.total_expense)}</div>
                </div>
                <div className={`p-3 rounded-xl border text-center ${Number(profit?.profit) >= 0 ? 'bg-blue-900/20 border-blue-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                    <div className="text-xs text-slate-500 mb-1">잔여 이윤</div>
                    <div className={`text-xl font-bold ${Number(profit?.profit) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        ₩{formatMoney(profit?.profit)}
                    </div>
                </div>
            </div>

            {/* 새 항목 추가 영역 (혁신 포인트!) */}
            <div className="flex gap-2 items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700 border-dashed">
                <span className="text-sm text-slate-400 font-bold">✨ 항목 직접 만들기 :</span>
                <input
                    type="text"
                    placeholder="예: 직접인건비, 학술료"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-sm text-white rounded-lg px-3 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <button onClick={handleAddCategory} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-sm transition">추가</button>
            </div>

            {/* 메인 입력 폼 */}
            <div className="flex gap-2">
                <select value={type} onChange={(e) => setType(e.target.value)} className="bg-slate-800 border border-slate-700 text-sm text-white rounded-lg px-2 py-2">
                    <option value="expense">지출</option>
                    <option value="income">수입</option>
                </select>

                {/* 항목 선택 드롭다운 */}
                {type === 'expense' && (
                    <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="bg-slate-800 border border-slate-700 text-sm text-white rounded-lg px-2 py-2">
                        <option value="">(항목 미지정)</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                )}

                <input type="number" placeholder="금액" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28 bg-slate-800 border border-slate-700 text-sm text-white rounded-lg px-3 py-2" />
                <input type="text" placeholder="상세 내역" value={description} onChange={(e) => setDescription(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 text-sm text-white rounded-lg px-3 py-2" />

                <button onClick={handleSubmit} disabled={isSubmitting || !amount} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg text-sm">
                    저장
                </button>
            </div>

            {/* 거래 내역 리스트 */}
            <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-2">
                {transactions.map((t) => (
                    <div key={t.id} className="flex justify-between items-center border border-slate-700/50 bg-slate-800/30 p-3 rounded-xl">
                        <div>
                            <div className="text-sm text-slate-200 font-medium">
                                {/* 지출이면 등록한 카테고리 이름표를 달아줍니다 */}
                                {t.type === 'expense' && t.expense_categories && (
                                    <span className="bg-slate-700 text-[10px] px-2 py-0.5 rounded text-slate-300 mr-2">{t.expense_categories.name}</span>
                                )}
                                {t.description || '내역 없음'}
                            </div>
                        </div>
                        <div className={`font-bold text-sm ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                            {t.type === 'income' ? '+' : '-'}₩{formatMoney(t.amount)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}