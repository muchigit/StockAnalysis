
import React, { useState, useEffect } from 'react';
import { createAlert, updateAlert, fetchAlerts, AlertCondition, StockAlert } from '@/lib/api';
import { SIGNAL_LABELS } from '@/lib/signals';

interface AlertDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    targetSymbol?: string;
    initialCondition?: AlertCondition;
}

const BASE_METRICS = [
    { value: 'current_price', label: '価格 (Price)' },
    { value: 'deviation_5ma_pct', label: '乖離率(5MA) %' },
    { value: 'deviation_20ma_pct', label: '乖離率(20MA) %' },
    { value: 'deviation_50ma_pct', label: '乖離率(50MA) %' },
    { value: 'deviation_200ma_pct', label: '乖離率(200MA) %' },
    { value: 'slope_5ma', label: '傾き(5MA)' },
    { value: 'slope_20ma', label: '傾き(20MA)' },
    { value: 'slope_50ma', label: '傾き(50MA)' },
    { value: 'slope_200ma', label: '傾き(200MA)' },
    { value: 'rs_rating', label: 'RS Rating' },
    { value: 'composite_rating', label: 'Comp Rating' }
];

const METRICS = [
    ...BASE_METRICS,
    ...Object.entries(SIGNAL_LABELS).map(([key, label]) => ({
        value: key,
        label: `シグナル: ${label} (1=ON, 0=OFF)`
    }))
];

const OP_LABELS: Record<string, string> = {
    'gte': '≧',
    'lte': '≦',
    'eq': '='
};

export default function AlertDialog({ isOpen, onClose, onSuccess, initialCondition, targetSymbol: initialTargetSymbol }: AlertDialogProps) {
    const [targetSymbol, setTargetSymbol] = useState(initialTargetSymbol || '');
    const [existingAlertId, setExistingAlertId] = useState<number | null>(null);
    const [stages, setStages] = useState<AlertCondition[][]>([[{ metric: 'current_price', op: 'gte', value: 0 }]]);
    const [loading, setLoading] = useState(false);

    // Smart Load: Fetch existing alert when opening or changing symbol
    useEffect(() => {
        if (isOpen && initialTargetSymbol) {
            setTargetSymbol(initialTargetSymbol);
            loadExistingAlert(initialTargetSymbol);
        } else if (isOpen) {
            setTargetSymbol('');
            setStages(initialCondition ? [[initialCondition]] : [[{ metric: 'current_price', op: 'gte', value: 0 }]]);
            setExistingAlertId(null);
        }
    }, [isOpen, initialTargetSymbol]);

    const loadExistingAlert = async (symbol: string) => {
        setLoading(true);
        try {
            const alerts = await fetchAlerts(symbol);
            // Default to first active alert if multiple (though ideally one per symbol for now)
            const match = alerts.find(a => a.is_active) || alerts[0];

            if (match) {
                setExistingAlertId(match.id!);
                let loadedStages: AlertCondition[][] = [];
                if (match.stages_json) {
                    try { loadedStages = JSON.parse(match.stages_json); } catch { }
                }
                if (loadedStages.length === 0 && match.condition_json) {
                    try { loadedStages = [JSON.parse(match.condition_json)]; } catch { }
                }
                if (loadedStages.length === 0) {
                    loadedStages = [[{ metric: 'current_price', op: 'gte', value: 0 }]];
                }
                setStages(loadedStages);
            } else {
                // No existing alert: Pre-fill with initialCondition if provided (Double-Click on Chart), else default
                setExistingAlertId(null);
                setStages(initialCondition ? [[initialCondition]] : [[{ metric: 'current_price', op: 'gte', value: 0 }]]);
            }
        } catch (e) {
            console.error("Failed to load existing alert", e);
        } finally {
            setLoading(false);
        }
    };

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

    const handleSubmit = async () => {
        if (!targetSymbol) return alert("シンボルを入力してください");

        const payload: Partial<StockAlert> = {
            symbol: targetSymbol,
            condition_json: JSON.stringify(stages[0]), // Legacy compat
            stages_json: JSON.stringify(stages),
            is_active: true,
            triggered: false,
            // If editing, reset progress? Or keep? Reset seems safer for logic change.
            current_stage_index: 0
        };

        try {
            if (existingAlertId) {
                await updateAlert(existingAlertId, payload);
            } else {
                // @ts-ignore
                await createAlert(payload as StockAlert);
            }
            onSuccess?.();
            onClose();
        } catch (e) {
            alert("Failed to save alert: " + e);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl w-full max-w-3xl border border-gray-700 shadow-xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">
                        {loading ? '読み込み中...' : (existingAlertId ? '🔔 アラート編集' : '🔔 新規アラート作成')}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="mb-6">
                        <label className="block text-gray-400 text-sm mb-2">対象銘柄</label>
                        <input
                            type="text"
                            value={targetSymbol}
                            onChange={e => setTargetSymbol(e.target.value.toUpperCase())}
                            disabled={!!initialTargetSymbol || !!existingAlertId}
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-white font-mono w-full text-lg uppercase disabled:text-gray-500"
                            placeholder="SYMBOL"
                        />
                    </div>

                    <div className="space-y-6">
                        {stages.map((stage, stageIdx) => (
                            <div key={stageIdx} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 relative">
                                <div className="absolute -left-3 -top-3 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold shadow-lg border-2 border-gray-800 text-white">
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
                                        <div key={condIdx} className="flex flex-wrap gap-2 items-center">
                                            <select
                                                value={cond.metric}
                                                onChange={e => updateStageCondition(stageIdx, condIdx, 'metric', e.target.value)}
                                                className="bg-gray-800 border border-gray-600 rounded p-1 text-sm text-gray-200 min-w-[200px]"
                                            >
                                                {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
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
                                                step="any"
                                                value={cond.value}
                                                onChange={e => updateStageCondition(stageIdx, condIdx, 'value', e.target.value)}
                                                className="bg-gray-800 border border-gray-600 rounded p-1 text-sm text-gray-200 w-24"
                                            />
                                            {stage.length > 1 && <button onClick={() => removeCondition(stageIdx, condIdx)} className="text-red-500 hover:text-red-400">×</button>}
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
                </div>

                <div className="p-6 border-t border-gray-700 flex justify-end gap-3 bg-gray-900/50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded text-white font-bold shadow-lg transition"
                    >
                        {existingAlertId ? '更新 保存' : '新規 保存'}
                    </button>
                </div>
            </div>
        </div>
    );
}
