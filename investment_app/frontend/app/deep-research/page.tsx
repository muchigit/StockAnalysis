'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { fetchPrompts, GeminiPrompt, ResearchStatus, fetchResearchStatus, startResearch, stopResearch } from '../../lib/api';
import { getResearchTickers, saveResearchTickers, clearResearchTickers } from '../../lib/research-storage';
import { useTranslation } from '../../lib/i18n';

export default function DeepResearchPage() {
    const { t } = useTranslation();
    const [symbolsText, setSymbolsText] = useState('');
    const [prompts, setPrompts] = useState<GeminiPrompt[]>([]);
    const [selectedPromptId, setSelectedPromptId] = useState<number | string>("");

    // Status
    const [status, setStatus] = useState<ResearchStatus | null>(null);
    const [loading, setLoading] = useState(false); // For API calls

    // Auto-refresh interval
    useEffect(() => {
        loadData();
        const interval = setInterval(updateStatus, 3000);

        // Load initial
        const tickers = getResearchTickers();
        setSymbolsText(tickers.join('\n'));

        return () => clearInterval(interval);
    }, []);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setSymbolsText(val);
        // Sync to storage
        const tickers = val.split('\n').map(s => s.trim().toUpperCase()).filter(s => s);
        saveResearchTickers(tickers);
    };

    const handleClearList = () => {
        if (!confirm(t('confirmClearList'))) return;
        setSymbolsText('');
        clearResearchTickers();
    };

    const logsEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [status?.logs]);

    async function loadData() {
        try {
            const p = await fetchPrompts();
            setPrompts(p);
            if (p.length > 0) setSelectedPromptId(p[0].id);
            updateStatus();
        } catch (e) {
            console.error(e);
        }
    }

    async function updateStatus() {
        try {
            const s = await fetchResearchStatus();
            setStatus(s);
        } catch (e) {
            console.error("Status fetch failed", e);
        }
    }

    async function handleStart() {
        if (!symbolsText.trim() || !selectedPromptId) {
            alert(t('enterSymbolsAndPrompt'));
            return;
        }

        const symbols = symbolsText.split('\n').map(s => s.trim().toUpperCase()).filter(s => s);
        if (symbols.length === 0) return;

        const prompt = prompts.find(p => p.id === Number(selectedPromptId));
        if (!prompt) return;

        setLoading(true);
        try {
            await startResearch(symbols, prompt.content);
            // setSymbolsText(""); // Keep symbols populated as requested
            updateStatus();
        } catch (e) {
            alert(t('failedToStart'));
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleStop() {
        if (!confirm(t('confirmStop'))) return;
        try {
            await stopResearch();
            updateStatus();
        } catch (e) {
            alert(t('failedToStop'));
        }
    }

    const selectedPrompt = prompts.find(p => p.id === Number(selectedPromptId));

    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col">
            <header className="p-4 border-b border-gray-700 bg-gray-800 flex justify-between items-center shadow-md">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <span>🧠</span> {t('deepResearchTitle')}
                </h1>
                <Link href="/" className="text-gray-400 hover:text-white text-sm font-bold">
                    &larr; {t('backToDashboard')}
                </Link>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: Configuration */}
                <div className="w-1/3 p-6 border-r border-gray-700 bg-gray-900 flex flex-col gap-6 overflow-y-auto">

                    {/* Tickers Input */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-gray-400 font-bold uppercase text-xs tracking-wider">{t('targetTickers')}</label>
                            <button
                                onClick={handleClearList}
                                className="text-xs text-red-400 hover:text-red-300 hover:underline"
                            >
                                {t('clearList')}
                            </button>
                        </div>
                        <textarea
                            value={symbolsText}
                            onChange={handleTextChange}
                            className="w-full h-48 bg-gray-800 border border-gray-700 rounded p-3 text-white font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="AAPL&#10;GOOGL&#10;MSFT"
                            disabled={status?.is_running}
                        />
                        <div className="text-right text-xs text-gray-500">
                            {symbolsText.split('\n').filter(s => s.trim()).length} symbols
                        </div>
                    </div>

                    {/* Prompt Selection */}
                    <div className="space-y-2 flex-1 flex flex-col">
                        <div className="flex justify-between items-center">
                            <label className="text-gray-400 font-bold uppercase text-xs tracking-wider">{t('selectPrompt')}</label>
                            <Link href="/prompts" className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1">
                                <span>📝</span> {t('editPrompts') || 'Edit'}
                            </Link>
                        </div>
                        <select
                            value={selectedPromptId}
                            onChange={(e) => setSelectedPromptId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-500"
                            disabled={status?.is_running}
                        >
                            {prompts.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <div className="flex-1 bg-gray-850 p-3 rounded border border-gray-800 text-xs text-gray-400 overflow-y-auto font-mono mt-2 h-32">
                            {selectedPrompt?.content || t('selectPromptPlaceholder')}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="pt-4 border-t border-gray-800">
                        {!status?.is_running ? (
                            <button
                                onClick={handleStart}
                                disabled={loading || !selectedPromptId}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded font-bold text-white shadow-lg shadow-blue-900/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? t('starting') : t('startResearch')}
                            </button>
                        ) : (
                            <button
                                onClick={handleStop}
                                className="w-full py-3 bg-red-600 hover:bg-red-500 rounded font-bold text-white shadow-lg shadow-red-900/50 transition animate-pulse"
                            >
                                {t('stopExecution')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Panel: Status Monitor */}
                <div className="flex-1 bg-black p-6 flex flex-col">
                    {/* Status Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-gray-300">{t('executionStatus')}</h2>
                            <p className="text-sm text-gray-500">{status?.status || t('ready')}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-mono font-bold text-blue-400">
                                {status ? status.processed : 0} <span className="text-gray-600 text-xl">/ {status ? status.total : 0}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{t('processed')}</div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-800 rounded-full h-4 mb-6 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500 ease-out"
                            style={{ width: `${status && status.total > 0 ? (status.processed / status.total) * 100 : 0}%` }}
                        ></div>
                    </div>

                    {/* Current Action */}
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
                        <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">{t('currentTask')}</div>
                        <div className="text-green-400 font-mono text-lg animate-pulse">
                            {status?.current_symbol ? `${t('processing')}${status.current_symbol}` : t('idle')}
                        </div>
                    </div>

                    {/* Logs Console */}
                    <div className="flex-1 bg-gray-950 border border-gray-800 rounded-lg p-4 font-mono text-xs overflow-y-auto">
                        <div className="text-gray-500 mb-2 border-b border-gray-900 pb-2">{t('executionLogs')}</div>
                        <div className="space-y-1">
                            {status?.logs.map((log, i) => (
                                <div key={i} className="text-gray-300 hover:bg-gray-900/50 px-1 rounded">
                                    {log}
                                </div>
                            ))}
                            <div ref={logsEndRef}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
