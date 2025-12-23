import { useState, useEffect } from 'react';
import { fetchSystemStatus, triggerSystemUpdate, SystemStatus } from '@/lib/api';

export default function SystemStatusBanner() {
    const [status, setStatus] = useState<SystemStatus | null>(null);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const data = await fetchSystemStatus();
                // Only show if running or waiting retry, or JUST completed (show for a bit?)
                // Requirement: "Show status during update", "Show completion message when done".
                setStatus(data);
            } catch (e) {
                console.error("Status fetch error", e);
            }
        }, 5000); // Poll every 5s

        return () => clearInterval(interval);
    }, []);

    if (!status) return null;

    // if (status.status === 'idle') return null; // Always show

    // Calculate percentage
    const percentage = status.total > 0 ? Math.round((status.progress / status.total) * 100) : 0;

    let bgColor = "bg-gray-800/50"; // Transparent default
    let statusText = "待機中";

    if (status.status === 'running') {
        bgColor = "bg-blue-900/40 border-blue-500/30";
        statusText = "更新中...";
    }
    if (status.status === 'waiting_retry') {
        bgColor = "bg-yellow-900/40 border-yellow-500/30";
        statusText = "再試行中...";
    }
    if (status.status === 'completed') {
        bgColor = "bg-green-900/20 border-green-500/30";
        statusText = "更新完了";
    }
    if (status.status === 'error') {
        bgColor = "bg-red-900/40 border-red-500/30";
        statusText = "エラー";
    }

    const handleManualUpdate = async () => {
        try {
            await triggerSystemUpdate();
            // Optimistic update
            setStatus(prev => prev ? { ...prev, status: 'running', message: '開始中...' } : null);
        } catch (e) {
            console.error("Failed to trigger update", e);
            alert("Failed to start update");
        }
    };

    return (
        <div className={`flex items-center gap-4 text-xs ${bgColor} px-3 py-1.5 rounded-lg border border-gray-700/50 shadow-sm transition-all duration-500`}>
            {/* Status & Date */}
            <div className="flex items-center gap-3">
                <span className={`font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${status.status === 'running' ? 'bg-blue-500/20 text-blue-200' : 'bg-gray-700/50 text-gray-400'}`}>
                    {statusText}
                </span>

                {status.status === 'waiting_retry' && <span className="text-yellow-400">{status.message}</span>}

                {(status.status === 'idle' || status.status === 'completed') && (
                    <span className="text-gray-500 hidden xl:inline">
                        最終: {status.last_completed ? new Date(status.last_completed).toLocaleString() : '未実行'}
                    </span>
                )}
            </div>

            {/* Progress Bar */}
            {(status.status === 'running' || status.status === 'waiting_retry') && (
                <div className="flex items-center gap-2 min-w-[150px]">
                    <span className="opacity-80">
                        {status.progress} / {status.total}
                    </span>
                    <div className="w-20 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="bg-blue-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Manual Update Button (Compact) */}
            {(status.status === 'idle' || status.status === 'completed' || status.status === 'error') && (
                <button
                    onClick={handleManualUpdate}
                    className="hover:bg-white/10 text-gray-300 hover:text-white rounded px-2 py-1 transition flex items-center gap-1"
                    title="データの更新を実行"
                >
                    <span className="text-lg">↻</span>
                </button>
            )}
        </div>
    );
}
