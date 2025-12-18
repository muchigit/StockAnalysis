'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchPrompts, createPrompt, updatePrompt, deletePrompt, GeminiPrompt } from '../../lib/api';

export default function PromptsPage() {
    const router = useRouter();
    const [prompts, setPrompts] = useState<GeminiPrompt[]>([]);
    const [selectedPrompt, setSelectedPrompt] = useState<GeminiPrompt | null>(null);
    const [loading, setLoading] = useState(true);

    // Editor State
    const [editName, setEditName] = useState('');
    const [editContent, setEditContent] = useState('');
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        loadPrompts();
    }, []);

    useEffect(() => {
        if (selectedPrompt) {
            setEditName(selectedPrompt.name);
            setEditContent(selectedPrompt.content);
            setIsDirty(false);
        } else {
            setEditName('');
            setEditContent('');
            setIsDirty(false);
        }
    }, [selectedPrompt]);

    async function loadPrompts() {
        setLoading(true);
        try {
            const data = await fetchPrompts();
            setPrompts(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleAddPrompt() {
        // const name = prompt("Enter prompt name:");
        // if (!name) return;
        const name = "New Prompt";

        try {
            const newPrompt = await createPrompt(name, "");
            setPrompts([...prompts, newPrompt]);
            setSelectedPrompt(newPrompt);
        } catch (e) {
            alert("Failed to create prompt");
        }
    }

    async function handleDeletePrompt(id: number) {
        if (!confirm("Delete this prompt?")) return;
        try {
            await deletePrompt(id);
            setPrompts(prompts.filter(p => p.id !== id));
            if (selectedPrompt?.id === id) {
                setSelectedPrompt(null);
            }
        } catch (e) {
            alert("Failed to delete prompt");
        }
    }

    async function handleSave() {
        if (!selectedPrompt) return;
        try {
            const updated = await updatePrompt(selectedPrompt.id, editName, editContent);
            setPrompts(prompts.map(p => p.id === updated.id ? updated : p));
            setSelectedPrompt(updated);
            alert("Saved!");
        } catch (e) {
            alert("Failed to save");
            console.error(e);
        }
    }

    function insertVariable(variable: string) {
        const textarea = document.getElementById('prompt-editor') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = editContent;
        const newText = text.substring(0, start) + variable + text.substring(end);

        setEditContent(newText);
        setIsDirty(true);

        // Restore focus/cursor (timeout needed for react state update)
        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        }, 0);
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans flex">
            {/* Sidebar List */}
            <div className="w-1/4 border-r border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                    <h1 className="text-xl font-bold">Prompts</h1>
                    <button
                        onClick={handleAddPrompt}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm font-bold"
                    >
                        + New
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-gray-500">Loading...</div>
                    ) : (
                        <ul>
                            {prompts.map(p => (
                                <li
                                    key={p.id}
                                    className={`p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition flex justify-between items-center ${selectedPrompt?.id === p.id ? 'bg-gray-800 border-l-4 border-l-blue-500' : ''}`}
                                    onClick={() => setSelectedPrompt(p)}
                                >
                                    <span className="truncate flex-1 font-medium">{p.name}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeletePrompt(p.id); }}
                                        className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100" // Group hover logic needs parent group class
                                    >
                                        ✕
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="p-4 border-t border-gray-700">
                    <Link href="/" className="text-gray-400 hover:text-white text-sm">
                        &larr; Back to Dashboard
                    </Link>
                </div>
            </div>

            {/* Main Editor */}
            <div className="flex-1 flex flex-col bg-gray-900">
                {selectedPrompt ? (
                    <>
                        <div className="p-4 border-b border-gray-700 bg-gray-800 flex justify-between items-center shadow-md">
                            <div className="flex items-center gap-4 flex-1">
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => { setEditName(e.target.value); setIsDirty(true); }}
                                    className="bg-transparent text-xl font-bold border-none focus:ring-0 text-white w-full"
                                    placeholder="Prompt Name"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSave}
                                    className={`px-6 py-2 rounded font-bold transition flex items-center gap-2 ${isDirty ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/50' : 'bg-gray-700 text-gray-400'}`}
                                >
                                    {isDirty ? 'SAVE *' : 'SAVED'}
                                </button>
                                <button
                                    onClick={() => handleDeletePrompt(selectedPrompt.id)}
                                    className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 rounded border border-red-800"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>

                        {/* Toolbar */}
                        <div className="p-2 bg-gray-800 border-b border-gray-700 flex gap-2 overflow-x-auto text-xs">
                            <span className="text-gray-500 py-1.5 px-2 font-mono">Variables:</span>
                            <button onClick={() => insertVariable('%SYMBOL%')} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-cyan-300 font-mono border border-gray-600 transition">%SYMBOL%</button>
                            <button onClick={() => insertVariable('%COMPANYNAME%')} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-cyan-300 font-mono border border-gray-600 transition">%COMPANYNAME%</button>
                            <button onClick={() => insertVariable('%DATE%')} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-cyan-300 font-mono border border-gray-600 transition">%DATE%</button>
                            <button onClick={() => insertVariable('%STOCKDATA%')} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-cyan-300 font-mono border border-gray-600 transition">%STOCKDATA%</button>
                        </div>

                        {/* Textarea */}
                        <div className="flex-1 p-4 relative">
                            <textarea
                                id="prompt-editor"
                                value={editContent}
                                onChange={(e) => { setEditContent(e.target.value); setIsDirty(true); }}
                                className="w-full h-full bg-gray-850 p-6 text-gray-200 font-mono text-sm leading-relaxed rounded-lg border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none shadow-inner"
                                placeholder="Write your prompt here..."
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500 flex-col gap-4">
                        <div className="text-6xl">📝</div>
                        <p className="text-xl">Select a prompt to edit or create a new one.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
