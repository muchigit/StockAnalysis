
import React, { useState, useEffect } from 'react';
import { createAlert, AlertCondition } from '@/lib/api';
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
];

const METRICS = [
    ...BASE_METRICS,
    ...Object.entries(SIGNAL_LABELS).map(([key, label]) => ({
        value: key,
        label: `シグナル: ${label} (1=ON, 0=OFF)`
    }))
];

export default function AlertDialog({ isOpen, onClose, onSuccess, initialCondition, targetSymbol: initialTargetSymbol }: AlertDialogProps) {
    const [targetSymbol, setTargetSymbol] = useState(initialTargetSymbol || '');
    const [conditions, setConditions] = useState<AlertCondition[]>([
        { metric: 'current_price', op: 'gte', value: 0 }
    ]);

    useEffect(() => {
        setTargetSymbol(initialTargetSymbol || '');
    }, [initialTargetSymbol]);

    useEffect(() => {
        if (isOpen) {
            setTargetSymbol(initialTargetSymbol || '');
            setConditions(initialCondition ? [initialCondition] : [{ metric: 'current_price', op: 'gte', value: 0 }]);
        }
    }, [isOpen, initialCondition, initialTargetSymbol]);

    const handleAddCondition = () => {
        setConditions([...conditions, { metric: 'current_price', op: 'gte', value: 0 }]);
    };

    const handleRemoveCondition = (idx: number) => {
        setConditions(conditions.filter((_, i) => i !== idx));
    };

    const handleChangeCondition = (idx: number, field: keyof AlertCondition, val: any) => {
        const newConds = [...conditions];
        newConds[idx] = { ...newConds[idx], [field]: val };
        setConditions(newConds);
    };

    const handleSubmit = async () => {
        if (!targetSymbol) return alert("シンボルを入力してください");

        try {
            await createAlert({
                symbol: targetSymbol,
                condition_json: JSON.stringify(conditions),
                is_active: true,
                triggered: false
            });
            onSuccess?.();
            onClose();
        } catch (e) {
            alert("Failed to create alert: " + e);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-gray-800 p-6 rounded-lg w-[600px] border border-gray-700 shadow-xl">
                <h2 className="text-xl font-bold text-white mb-4">🔔 アラート作成</h2>

                <div className="mb-4">
                    <label className="block text-xs uppercase text-gray-500 mb-1">銘柄コード</label>
                    <input
                        type="text"
                        value={targetSymbol}
                        onChange={e => setTargetSymbol(e.target.value.toUpperCase())}
                        disabled={!!initialTargetSymbol}
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white font-mono uppercase disabled:text-gray-500"
                        placeholder="SYMBOL"
                    />
                </div>

                <div className="mb-6 space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="block text-xs uppercase text-gray-500">条件 (AND)</label>
                        <button onClick={handleAddCondition} className="text-xs text-blue-400 hover:text-blue-300 pointer">+ 追加</button>
                    </div>

                    {conditions.map((cond, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-gray-900 p-2 rounded border border-gray-700">
                            <select
                                value={cond.metric}
                                onChange={e => handleChangeCondition(idx, 'metric', e.target.value)}
                                className="bg-black text-white text-sm rounded border border-gray-700 p-1 flex-1"
                            >
                                {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>

                            <select
                                value={cond.op}
                                onChange={e => handleChangeCondition(idx, 'op', e.target.value)}
                                className="bg-black text-white text-sm rounded border border-gray-700 p-1 w-20"
                            >
                                <option value="gte">≧ (以上)</option>
                                <option value="lte">≦ (以下)</option>
                                <option value="eq">= (一致)</option>
                            </select>

                            <input
                                type="number"
                                step="any"
                                value={cond.value}
                                onChange={e => handleChangeCondition(idx, 'value', Number(e.target.value))}
                                className="bg-black text-white text-sm rounded border border-gray-700 p-1 w-24"
                            />

                            {conditions.length > 1 && (
                                <button onClick={() => handleRemoveCondition(idx)} className="text-red-500 hover:text-red-400 ml-2">×</button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-bold"
                    >
                        作成
                    </button>
                </div>
            </div>
        </div>
    );
}
