"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StockAlert, fetchAlerts, checkAlerts, updateAlert, deleteAlert, createAlert, AlertCondition } from '@/lib/api';

const SIGNAL_LABELS: Record<string, string> = {
    'current_price': '現在値',
    'change_percentage_1d': '前日比',
    'predicted_price_next': '翌日予想',
    'deviation_5ma_pct': '5MA乖離',
    'deviation_20ma_pct': '20MA乖離',
    'deviation_50ma_pct': '50MA乖離',
    'deviation_200ma_pct': '200MA乖離',
    'slope_5ma': '5MA傾き',
    'slope_20ma': '20MA傾き',
    'slope_50ma': '50MA傾き',
    'slope_200ma': '200MA傾き',
    'rs_rating': 'RS Rating',
    'composite_rating': 'Comp Rating',
    'signal_base_formation': 'ベース形成'
};

const OP_LABELS: Record<string, string> = {
    'gte': '≧',
    'lte': '≦',
    'eq': '='
};

export default function AlertsPage() {
    const router = useRouter();
    const [alerts, setAlerts] = useState<StockAlert[]>([]);
    const [checking, setChecking] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Edit Form State
    const [editId, setEditId] = useState<number | null>(null);
    const [targetSymbol, setTargetSymbol] = useState('');
    const [stages, setStages] = useState<AlertCondition[][]>([[]]); // List of Stages (each stage is list of conditions)

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        const data = await fetchAlerts();
        setAlerts(data);
    };

    const handleCheck = async () => {
        setChecking(true);
        try {
            await checkAlerts();
            await load();
        } finally {
            setChecking(false);
        }
    };

    const handleToggle = async (alert: StockAlert) => {
        await updateAlert(alert.id!, { is_active: !alert.is_active });
        load();
    };

    const handleDelete = async (id: number) => {
        if (confirm('Delete this alert?')) {
            await deleteAlert(id);
            load();
        }
    };

    const startCreate = () => {
        setEditId(null);
        setTargetSymbol('');
        setStages([[{ metric: 'current_price', op: 'gte', value: 0 }]]);
        setIsEditing(true);
    };

    const startEdit = (alert: StockAlert) => {
        setEditId(alert.id!);
        setTargetSymbol(alert.symbol);

        // Parse stages
        let loadedStages: AlertCondition[][] = [];
        if (alert.stages_json) {
            try {
                loadedStages = JSON.parse(alert.stages_json);
            } catch { }
        }

        if (loadedStages.length === 0 && alert.condition_json) {
            try {
                loadedStages = [JSON.parse(alert.condition_json)];
            } catch { }
        }

        if (loadedStages.length === 0) {
            loadedStages = [[{ metric: 'current_price', op: 'gte', value: 0 }]];
        }

        setStages(loadedStages);
        setIsEditing(true);
    }

    const handleSave = async () => {
        const payload: Partial<StockAlert> = {
            symbol: targetSymbol,
            condition_json: JSON.stringify(stages[0]), // Legacy compat
            stages_json: JSON.stringify(stages),
            current_stage_index: 0, // Reset progress on edit
            is_active: true,
            triggered: false
        };

        if (editId) {
            await updateAlert(editId, payload);
        } else {
            // @ts-ignore
            await createAlert(payload as StockAlert);
        }
        setIsEditing(false);
        load();
    };

    // --- Form Helpers ---
    const updateStageCondition = (stageIdx: number, condIdx: number, field: keyof AlertCondition, val: any) => {
        const newStages = [...stages];
        const newConds = [...newStages[stageIdx]];
        newConds[condIdx] = { ...newConds[condIdx], [field]: val };
        newStages[stageIdx] = newConds;
        setStages(newStages);
    };

    const addCondition = (stageIdx: number) => {
        const newStages = [...stages];
        newStages[stageIdx] = [...newStages[stageIdx], { metric: 'current_price', op: 'gte', value: 0 }];
        setStages(newStages);
    };

    const removeCondition = (stageIdx: number, condIdx: number) => {
        const newStages = [...stages];
        if (newStages[stageIdx].length > 1) {
            newStages[stageIdx] = newStages[stageIdx].filter((_, i) => i !== condIdx);
            setStages(newStages);
        }
    };

    const addStage = () => {
        setStages([...stages, [{ metric: 'current_price', op: 'gte', value: 0 }]]);
    };

    const removeStage = (idx: number) => {
        if (stages.length > 1) {
            setStages(stages.filter((_, i) => i !== idx));
        }
    };


    const formatStage = (conds: AlertCondition[]) => {
        return conds.map(c => `${SIGNAL_LABELS[c.metric] || c.metric} ${OP_LABELS[c.op] || c.op} ${c.value}`).join(' AND ');
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white">← ダッシュボード</button>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
                            アラート管理
                        </h1>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={handleCheck}
                            disabled={checking}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2"
                        >
                            {checking ? <span className="animate-spin">↻</span> : <span>⚡</span>}
                            今すぐチェック
                        </button>
                        <button
                            onClick={startCreate}
                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold"
                        >
                            + 新規アラート
                        </button>
                    </div>
                </div>

                {!isEditing ? (
                    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-800 text-gray-400 text-sm uppercase">
                                <tr>
                                    <th className="p-4">状態</th>
                                    <th className="p-4">銘柄</th>
                                    <th className="p-4">進捗</th>
                                    <th className="p-4">条件ステージ</th>
                                    <th className="p-4">最終トリガー</th>
                                    <th className="p-4">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800 text-sm">
                                {alerts.map(alert => {
                                    let stages: AlertCondition[][] = [];
                                    try { stages = alert.stages_json ? JSON.parse(alert.stages_json) : (alert.condition_json ? [JSON.parse(alert.condition_json)] : []); } catch { }

                                    const currentIdx = alert.current_stage_index || 0;
                                    const progress = Math.min((currentIdx / stages.length) * 100, 100);

                                    return (
                                        <tr key={alert.id} className="hover:bg-gray-800/50 cursor-pointer" onDoubleClick={() => router.push(`/stocks/${alert.symbol}`)}>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => handleToggle(alert)}
                                                    className={`px-3 py-1 rounded-full text-xs font-bold ${alert.is_active ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}
                                                >
                                                    {alert.is_active ? '有効' : '無効'}
                                                </button>
                                                {alert.triggered && <div className="mt-1 text-xs text-red-500 font-bold animate-pulse">トリガー済み</div>}
                                            </td>
                                            <td className="p-4 font-bold text-lg font-mono">{alert.symbol}</td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1 w-32">
                                                    <div className="flex justify-between text-xs text-gray-400">
                                                        <span>ステップ {currentIdx + 1}/{stages.length}</span>
                                                    </div>
                                                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${((currentIdx) / Math.max(stages.length, 1)) * 100}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 space-y-2">
                                                {stages.map((stage, idx) => (
                                                    <div key={idx} className={`flex items-center gap-2 ${idx === currentIdx ? 'text-white' : 'text-gray-500'}`}>
                                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${idx === currentIdx ? 'bg-blue-600 border-blue-400' : idx < currentIdx ? 'bg-green-900 border-green-700 text-green-300' : 'bg-gray-800 border-gray-600'}`}>
                                                            {idx + 1}
                                                        </span>
                                                        <span>{formatStage(stage)}</span>
                                                        {idx < currentIdx && <span className="text-green-500">✓</span>}
                                                    </div>
                                                ))}
                                            </td>
                                            <td className="p-4 text-gray-400">
                                                {alert.last_triggered_at ? new Date(alert.last_triggered_at).toLocaleString() : '-'}
                                            </td>
                                            <td className="p-4 flex gap-2">
                                                <button onClick={() => startEdit(alert)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-blue-300">✎</button>
                                                <button onClick={() => handleDelete(alert.id!)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-red-300">🗑</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 max-w-3xl mx-auto">
                        <h2 className="text-2xl font-bold mb-6 border-b border-gray-700 pb-2">{editId ? 'アラート編集' : 'アラート作成'}</h2>

                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm mb-2">対象銘柄</label>
                            <input
                                type="text"
                                value={targetSymbol}
                                onChange={e => setTargetSymbol(e.target.value.toUpperCase())}
                                className="bg-gray-800 border border-gray-700 rounded p-2 text-white font-mono w-full text-lg"
                                placeholder="AAPL"
                            />
                        </div>

                        <div className="space-y-6 mb-8">
                            {stages.map((stage, stageIdx) => (
                                <div key={stageIdx} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 relative">
                                    <div className="absolute -left-3 -top-3 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold shadow-lg border-2 border-gray-900">
                                        {stageIdx + 1}
                                    </div>
                                    <div className="mb-2 flex justify-between items-center pl-4">
                                        <h3 className="font-bold text-gray-300">ステージ {stageIdx + 1} 条件</h3>
                                        {stages.length > 1 && (
                                            <button onClick={() => removeStage(stageIdx)} className="text-xs text-red-400 hover:text-red-300">ステージ削除</button>
                                        )}
                                    </div>

                                    <div className="space-y-2 pl-4">
                                        {stage.map((cond, condIdx) => (
                                            <div key={condIdx} className="flex gap-2 items-center">
                                                <select
                                                    value={cond.metric}
                                                    onChange={e => updateStageCondition(stageIdx, condIdx, 'metric', e.target.value)}
                                                    className="bg-gray-800 border border-gray-600 rounded p-1 text-sm text-gray-200 w-40"
                                                >
                                                    {Object.entries(SIGNAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                                </select>
                                                <select
                                                    value={cond.op}
                                                    onChange={e => updateStageCondition(stageIdx, condIdx, 'op', e.target.value)}
                                                    className="bg-gray-800 border border-gray-600 rounded p-1 text-sm text-gray-200 w-16"
                                                >
                                                    {Object.entries(OP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                                </select>
                                                <input
                                                    type="number"
                                                    value={cond.value}
                                                    onChange={e => updateStageCondition(stageIdx, condIdx, 'value', e.target.value)}
                                                    className="bg-gray-800 border border-gray-600 rounded p-1 text-sm text-gray-200 w-24"
                                                />
                                                {stage.length > 1 && <button onClick={() => removeCondition(stageIdx, condIdx)} className="text-red-500">×</button>}
                                            </div>
                                        ))}
                                        <button onClick={() => addCondition(stageIdx)} className="text-xs text-blue-400 hover:text-blue-300 mt-2">+ 条件追加 (AND)</button>
                                    </div>

                                    {stageIdx < stages.length - 1 && (
                                        <div className="absolute left-1/2 -bottom-6 w-px h-6 bg-gray-600"></div>
                                    )}
                                </div>
                            ))}

                            <button onClick={addStage} className="w-full py-2 border-2 border-dashed border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 rounded-lg transition">
                                + 次のステージを追加
                            </button>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-gray-800 pt-4">
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-400 hover:text-white">キャンセル</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded shadow-lg">
                                保存
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
