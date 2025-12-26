"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchGroups, createGroup, deleteGroup, StockGroup, StockGroupMember, fetchGroupMembers, removeGroupMember } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function GroupsPage() {
    const [groups, setGroups] = useState<StockGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupDesc, setNewGroupDesc] = useState("");

    // Member expansion
    const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
    const [members, setMembers] = useState<any[]>([]); // Using any for stock object for now
    const [membersLoading, setMembersLoading] = useState(false);

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = () => {
        setLoading(true);
        fetchGroups().then(data => {
            setGroups(data);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    };

    const handleCreate = async () => {
        if (!newGroupName.trim()) return;
        try {
            await createGroup(newGroupName, newGroupDesc);
            setNewGroupName("");
            setNewGroupDesc("");
            loadGroups();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this group?")) return;
        try {
            await deleteGroup(id);
            loadGroups();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const toggleExpand = async (id: number) => {
        if (expandedGroupId === id) {
            setExpandedGroupId(null);
            return;
        }
        setExpandedGroupId(id);
        setMembersLoading(true);
        try {
            // In database, we fetch members. But fetchGroupMembers returns Stocks.
            const stocks = await fetchGroupMembers(id);
            setMembers(stocks);
        } catch (err) {
            console.error(err);
        } finally {
            setMembersLoading(false);
        }
    };

    const handleRemoveMember = async (groupId: number, symbol: string) => {
        if (!confirm(`Remove ${symbol} from group?`)) return;
        try {
            await removeGroupMember(groupId, symbol);
            // Reload members
            const stocks = await fetchGroupMembers(groupId);
            setMembers(stocks);
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-black text-gray-200 p-8">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <Link href="/" className="text-gray-400 hover:text-white mb-2 inline-block">← Dashboard</Link>
                    <h1 className="text-3xl font-bold text-white">Groups & Watchlists</h1>
                </div>
            </header>

            {/* Create New */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8 max-w-2xl">
                <h2 className="text-xl font-bold text-white mb-4">Create New Group</h2>
                <div className="flex gap-4 items-end">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Group Name</label>
                        <input
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white w-64"
                            placeholder="e.g. High Growth"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1">Description (Optional)</label>
                        <input
                            value={newGroupDesc}
                            onChange={(e) => setNewGroupDesc(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white w-full"
                            placeholder="My best picks"
                        />
                    </div>
                    <button
                        onClick={handleCreate}
                        disabled={!newGroupName.trim()}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                    >
                        Create
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-4 max-w-4xl">
                {loading ? (
                    <div>Loading...</div>
                ) : groups.length === 0 ? (
                    <div className="text-gray-500 italic">No groups created yet.</div>
                ) : (
                    groups.map(group => (
                        <div key={group.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                            <div className="p-4 flex justify-between items-center hover:bg-gray-800/50 transition cursor-pointer" onClick={() => toggleExpand(group.id)}>
                                <div>
                                    <div className="text-lg font-bold text-white flex items-center gap-2">
                                        {group.name}
                                        <span className="text-xs font-normal text-gray-500 px-2 py-0.5 bg-gray-800 rounded-full border border-gray-700">{group.group_type}</span>
                                    </div>
                                    {group.description && <div className="text-sm text-gray-400">{group.description}</div>}
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(group.id); }}
                                        className="text-red-500 hover:text-red-400 text-sm underline"
                                    >
                                        Delete
                                    </button>
                                    <div className="text-gray-500 transform transition-transform duration-200" style={{ transform: expandedGroupId === group.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                        ▼
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Content (Members) */}
                            {expandedGroupId === group.id && (
                                <div className="border-t border-gray-800 bg-gray-950 p-4">
                                    {membersLoading ? (
                                        <div className="text-sm text-gray-500">Loading members...</div>
                                    ) : members.length === 0 ? (
                                        <div className="text-sm text-gray-500 italic">No members in this group. Add via Dashboard or Detail page.</div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                            {members.map(stock => (
                                                <div key={stock.symbol} className="bg-gray-900 border border-gray-800 rounded p-2 flex justify-between items-center group">
                                                    <Link href={`/stocks/${stock.symbol}`} className="text-blue-400 hover:underline font-mono font-bold">
                                                        {stock.symbol}
                                                    </Link>
                                                    <button
                                                        onClick={() => handleRemoveMember(group.id, stock.symbol)}
                                                        className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                                                        title="Remove from group"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
