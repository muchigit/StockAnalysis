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

    let bgColor = "bg-gray-800 text-gray-400 border-b border-gray-700";
    let statusText = "Ready";

    if (status.status === 'running') {
        bgColor = "bg-blue-600 text-white";
        statusText = "Updating Data...";
    }
    if (status.status === 'waiting_retry') {
        bgColor = "bg-yellow-600 text-white";
        statusText = "Retrying in 10m...";
    }
    if (status.status === 'completed') {
        bgColor = "bg-green-800 text-green-200 border-b border-green-700";
        statusText = "Data Updated";
    }
    if (status.status === 'error') {
        bgColor = "bg-red-900 text-red-200";
        statusText = "Error";
    }

    const handleManualUpdate = async () => {
        try {
            await triggerSystemUpdate();
            // Optimistic update
            setStatus(prev => prev ? { ...prev, status: 'running', message: 'Starting...' } : null);
        } catch (e) {
            console.error("Failed to trigger update", e);
            alert("Failed to start update");
        }
    };

    return (
        <div className={`${bgColor} px-4 py-2 text-sm flex items-center justify-between transition-colors duration-500`}>
            <div className="flex items-center gap-4">
                <span className={`font-bold uppercase tracking-wider text-xs px-2 py-0.5 rounded ${status.status === 'running' ? 'bg-white/20' : 'bg-gray-700/50'}`}>
                    {statusText}
                </span>

                {status.status === 'waiting_retry' && <span>{status.message}</span>}

                {(status.status === 'idle' || status.status === 'completed') && (
                    <span className="text-xs opacity-70">
                        Latest Data: {status.last_completed ? new Date(status.last_completed).toLocaleString() : 'Never'}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-4">
                {(status.status === 'running' || status.status === 'waiting_retry') && (
                    <div className="flex items-center gap-2 min-w-[200px]">
                        <span className="text-xs opacity-80 mr-2">
                            {status.progress} / {status.total}
                        </span>
                        <div className="w-24 bg-black/20 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-white/90 h-full rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Manual Update Button */}
                {(status.status === 'idle' || status.status === 'completed' || status.status === 'error') && (
                    <button
                        onClick={handleManualUpdate}
                        className="bg-white/10 hover:bg-white/20 text-white rounded px-3 py-1 text-xs border border-white/20 transition flex items-center gap-1"
                        title="Run data update immediately"
                    >
                        <span>↻</span> Manual Update
                    </button>
                )}
            </div>
        </div>
    );
}
