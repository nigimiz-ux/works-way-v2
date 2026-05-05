'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function TransactionForm({ project }: any) {
    const [type, setType] = useState('expense')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')
    const [transactions, setTransactions] = useState<any[]>([])
    const [profit, setProfit] = useState<any>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        fetchTransactions()
        fetchProfit()
    }, [project])

    const fetchTransactions = async () => {
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('project_id', project.id)
            .order('occurred_at', { ascending: false })
            .order('created_at', { ascending: false })
        setTransactions(data || [])
    }

    const fetchProfit = async () => {
        const { data } = await supabase
            .from('project_profit')
            .select('*')
            .eq('project_id', project.id)
            .single()
        setProfit(data)
    }

    const handleSubmit = async () => {
        if (!amount) return
        setIsSubmitting(true)
        await supabase.from('transactions').insert({
            project_id: project.id,
            type,
            amount: Number(amount),
            description,
            occurred_at: new Date().toISOString().split('T')[0], // 오늘 날짜
            created_by: (await supabase.auth.getUser()).data.user?.id
        })
        setAmount('')
        setDescription('')
        await fetchTransactions()
        await fetchProfit()
        setIsSubmitting(false)
    }

    // 돈 포맷 함수 (예: 1,000,000)
    const formatMoney = (num: number) => num?.toLocaleString('ko-KR') || '0';

    return (
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 space-y-6">

            {/* 1. 요약 (수익/비용/이익) */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                    <div className="text-xs text-slate-500 mb-1">총 수익</div>
                    <div className="text-lg font-bold text-green-400">₩{formatMoney(profit?.total_income)}</div>
                </div>
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center">
                    <div className="text-xs text-slate-500 mb-1">총 비용</div>
                    <div className="text-lg font-bold text-red-400">₩{formatMoney(profit?.total_expense)}</div>
                </div>
                <div className={`p-3 rounded-xl border text-center ${Number(profit?.profit) >= 0 ? 'bg-blue-900/20 border-blue-500/30' : 'bg-red-900/20 border-red-500/30'
                    }`}>
                    <div className="text-xs text-slate-500 mb-1">순 이익</div>
                    <div className={`text-xl font-bold ${Number(profit?.profit) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        ₩{formatMoney(profit?.profit)}
                    </div>
                </div>
            </div>

            {/* 2. 돈 입력 폼 */}
            <div className="flex gap-2">
                <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                    <option value="expense">지출</option>
                    <option value="income">수입</option>
                </select>
                <input
                    type="number"
                    placeholder="금액 (원)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 placeholder-slate-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <input
                    type="text"
                    placeholder="내역 (예: 회식비)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 placeholder-slate-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !amount}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors"
                >
                    {isSubmitting ? '입력중...' : '추가'}
                </button>
            </div>

            {/* 3. 거래 내역 리스트 */}
            <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-2">
                {transactions.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-4">내역이 없습니다.</p>
                ) : (
                    transactions.map((t) => (
                        <div key={t.id} className="flex justify-between items-center border border-slate-700/50 bg-slate-800/30 p-3 rounded-xl hover:bg-slate-800 transition-colors">
                            <div>
                                <div className="text-sm text-slate-200 font-medium">{t.description || '내역 없음'}</div>
                                <div className="text-[10px] text-slate-500">{t.occurred_at}</div>
                            </div>
                            <div className={`font-bold text-sm ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                                {t.type === 'income' ? '+' : '-'}₩{formatMoney(t.amount)}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}