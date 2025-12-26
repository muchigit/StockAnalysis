"use client";

import { useState, useEffect } from 'react';
import { fetchGroups, addGroupMember, StockGroup } from '@/lib/api';

interface AddToGroupDialogProps {
    symbol: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function AddToGroupDialog({ symbol, isOpen, onClose }: AddToGroupDialogProps) {
    const [groups, setGroups] = useState<StockGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetchGroups().then(data => {
                setGroups(data);
                setLoading(false);
            }).catch(console.error);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAdd = async (groupId: number) => {
        setAdding(groupId);
        try {
            await addGroupMember(groupId, symbol);
            alert(`Added ${symbol} to group!`);
            onClose();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setAdding(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96 shadow-xl relative">
                <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-white">✕</button>
                <h2 className="text-xl font-bold text-white mb-1">Add to Group</h2>
                <div className="text-lg text-blue-400 font-mono mb-4">{symbol}</div>

                {loading ? (
                    <div className="text-center py-4 text-gray-500">Loading groups...</div>
                ) : groups.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                        No groups found. <br />
                        <a href="/groups" className="text-blue-400 underline">Create one first</a>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                        {groups.map(g => (
                            <button
                                key={g.id}
                                onClick={() => handleAdd(g.id)}
                                disabled={adding === g.id}
                                className="text-left px-4 py-3 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 transition flex justify-between items-center"
                            >
                                <span className="font-bold text-gray-200">{g.name}</span>
                                {adding === g.id && <span className="animate-spin text-blue-400">c</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
