
import React, { useEffect, useState } from 'react';
import { StockAlert, fetchAlerts, checkAlerts, updateAlert, deleteAlert, AlertCondition } from '@/lib/api';

interface AlertManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void; // Trigger global refresh of alert count
}

export default function AlertManager({ isOpen, onClose, onUpdate }: AlertManagerProps) {
    const [alerts, setAlerts] = useState<StockAlert[]>([]);
    const [checking, setChecking] = useState(false);

    const load = async () => {
        const data = await fetchAlerts();
        setAlerts(data);
    };

    useEffect(() => {
        if (isOpen) load();
    }, [isOpen]);

    const handleCheck = async () => {
        setChecking(true);
        try {
            await checkAlerts();
            await load();
            onUpdate();
        } finally {
            setChecking(false);
        }
    };

    const handleToggle = async (alert: StockAlert) => {
        await updateAlert(alert.id!, { is_active: !alert.is_active });
        await load();
        onUpdate();
    };

    const handleDelete = async (id: number) => {
        if (confirm('Delete this alert?')) {
            await deleteAlert(id);
            await load();
            onUpdate();
        }
    };

    const formatCondition = (json: string) => {
        try {
            const conds = JSON.parse(json) as AlertCondition[];
            return conds.map(c => {
                let opStr: string = c.op;
                if (c.op === 'gte') opStr = '≧';
                if (c.op === 'lte') opStr = '≦';
                if (c.op === 'eq') opStr = '=';
                return `${c.metric} ${opStr} ${c.value}`;
            }).join(' AND ');
        } catch {
            return json;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-gray-800 p-6 rounded-lg w-[800px] max-h-[80vh] flex flex-col border border-gray-700 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        🔔 アラート管理
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>

                <div className="flex gap-2 mb-4">
                    <button
                        onClick={handleCheck}
                        disabled={checking}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold shadow transition flex items-center gap-2"
                    >
                        {checking ? <span className="animate-spin">↻</span> : <span>⚡</span>}
                        今すぐチェック
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-900 rounded p-4 border border-gray-700">
                    <table className="w-full text-sm text-left text-gray-300">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-900 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">状態</th>
                                <th className="px-4 py-2">コード</th>
                                <th className="px-4 py-2">条件</th>
                                <th className="px-4 py-2">最終検知</th>
                                <th className="px-4 py-2">アクション</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {alerts.map(alert => (
                                <tr key={alert.id} className="hover:bg-gray-800/50">
                                    <td className="px-4 py-2">
                                        <button
                                            onClick={() => handleToggle(alert)}
                                            className={`px-2 py-1 rounded text-xs font-bold ${alert.is_active
                                                ? 'bg-green-900 text-green-300 border border-green-700'
                                                : 'bg-gray-700 text-gray-500'
                                                }`}
                                        >
                                            {alert.is_active ? 'ON' : 'OFF'}
                                        </button>
                                        {alert.is_active && alert.triggered && (
                                            <span className="ml-2 text-xs text-red-500 font-bold animate-pulse">
                                                ⚠ 検知中
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 font-mono font-bold text-white">{alert.symbol}</td>
                                    <td className="px-4 py-2 font-mono text-xs text-blue-300">{formatCondition(alert.condition_json)}</td>
                                    <td className="px-4 py-2 text-xs text-gray-500">
                                        {alert.last_triggered_at
                                            ? new Date(alert.last_triggered_at + 'Z').toLocaleString('ja-JP')
                                            : '-'
                                        }
                                    </td>
                                    <td className="px-4 py-2">
                                        <button
                                            onClick={() => handleDelete(alert.id!)}
                                            className="text-red-400 hover:text-red-300"
                                            title="削除"
                                        >
                                            🗑
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {alerts.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">アラート設定はありません</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
