'use client';

import { useState, useMemo, useEffect } from 'react';
import { SIGNAL_LABELS } from '../../lib/signals';
import { analyzeHistoricalSignals, HistoricalSignalRequest, SignalResult } from '../../lib/api';
import Link from 'next/link';
import { exportToExcel } from '@/lib/excel-exporter';

export default function HistoricalAnalysisPage() {
    const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedSignals, setSelectedSignals] = useState<string[]>([]); // Keys from SIGNAL_LABELS (with signal_ prefix)
    const [results, setResults] = useState<SignalResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [analyzed, setAnalyzed] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false); // Guard for persistence

    const [calcDate, setCalcDate] = useState<string>(''); // End Date for calculation
    const [maxDate, setMaxDate] = useState<string>(''); // Today (or max valid date)

    // Progress & Timer
    const [progress, setProgress] = useState(0);
    const [totalStocks, setTotalStocks] = useState(0);
    const [elapsedTime, setElapsedTime] = useState<string | null>(null);

    // Persistence: LOAD
    useEffect(() => {
        const savedDate = localStorage.getItem('hist_targetDate');
        const savedSignals = localStorage.getItem('hist_selectedSignals');
        const savedResults = localStorage.getItem('hist_results');

        if (savedDate) setTargetDate(savedDate);
        if (savedSignals) {
            try { setSelectedSignals(JSON.parse(savedSignals)); } catch (e) { }
        }
        if (savedResults) {
            try {
                const parsed = JSON.parse(savedResults);
                setResults(parsed);
                setAnalyzed(true);
            } catch (e) { }
        }
        setIsLoaded(true); // Allow saving after load
    }, []);

    // Persistence: SAVE (Only after loaded)
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('hist_targetDate', targetDate);
        }
    }, [targetDate, isLoaded]);

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('hist_selectedSignals', JSON.stringify(selectedSignals));
        }
    }, [selectedSignals, isLoaded]);

    useEffect(() => {
        if (results.length > 0) {
            try {
                localStorage.setItem('hist_results', JSON.stringify(results));
            } catch (e) {
                console.error("Failed to save results to localStorage", e);
            }
        }
    }, [results]);

    // Toggle signal selection
    const toggleSignal = (key: string) => {
        if (selectedSignals.includes(key)) {
            setSelectedSignals(prev => prev.filter(k => k !== key));
        } else {
            setSelectedSignals(prev => [...prev, key]);
        }
    };

    const handleRunAnalysis = async () => {
        setLoading(true);
        setAnalyzed(false);
        setProgress(0);
        setTotalStocks(0);
        setElapsedTime(null);

        const startTime = performance.now();

        try {
            const req: HistoricalSignalRequest = {
                target_date: targetDate,
                end_date: calcDate || undefined,
                universe: 'all'
            };
            const data = await analyzeHistoricalSignals(req, (current, total) => {
                setProgress(current);
                setTotalStocks(total);
            });
            setResults(data);
            setAnalyzed(true);
        } catch (e) {
            console.error("Analysis failed:", e);
            alert("Analysis failed. Please check backend logs.");
        } finally {
            const endTime = performance.now();
            const seconds = ((endTime - startTime) / 1000).toFixed(2);
            setElapsedTime(`${seconds}s`);
            setLoading(false);
        }
    };



    // Initialize Max Date on Mount
    useEffect(() => {
        setMaxDate(new Date().toISOString().split('T')[0]);
        if (!calcDate) setCalcDate(new Date().toISOString().split('T')[0]);
    }, []);

    // Helper: Days Diff
    const getDaysDiff = (start: string, end: string) => {
        const s = new Date(start).getTime();
        const e = new Date(end).getTime();
        return Math.floor((e - s) / (1000 * 60 * 60 * 24));
    };

    // Helper: Add Days
    const addDays = (dateStr: string, days: number) => {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const days = parseInt(e.target.value);
        const newDate = addDays(targetDate, days);
        setCalcDate(newDate);
    };

    const handleSliderCommit = () => {
        handleRunAnalysis();
    };

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof SignalResult, direction: 'asc' | 'desc' } | null>({ key: 'return_pct', direction: 'desc' });

    const handleSort = (key: keyof SignalResult) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    // Filter Logic & Stats
    const { sortedResults, avgReturn, avgMaxReturn, avgMinReturn, sp500Result } = useMemo(() => {
        // Separate S&P 500
        const sp500 = results.find(r => r.symbol === '^GSPC');

        // Filter out S&P500 for stats calculation
        let stockResults = results.filter(r => r.symbol !== '^GSPC');

        if (stockResults.length === 0) return { sortedResults: [], avgReturn: 0, avgMaxReturn: 0, sp500Result: sp500 };

        // 1. Filter
        let filtered = stockResults;
        if (selectedSignals.length > 0) {
            const requiredSignals = selectedSignals.map(k => k.replace('signal_', ''));
            filtered = stockResults.filter(row => {
                // EXEMPT Index and ETF from signal filtering (Always show them)
                if (row.asset_type === 'index' || row.asset_type === 'etf' || row.symbol.startsWith('^')) {
                    return true;
                }
                return requiredSignals.every(req => row.active_signals.includes(req));
            });
        }

        // 2. Stats
        const totalReturn = filtered.reduce((sum, r) => sum + r.return_pct, 0);
        const totalMaxReturn = filtered.reduce((sum, r) => sum + r.max_return_pct, 0);
        const totalMinReturn = filtered.reduce((sum, r) => sum + (r.min_return_pct || r.return_pct), 0);

        const avgReturn = filtered.length > 0 ? totalReturn / filtered.length : 0;
        const avgMaxReturn = filtered.length > 0 ? totalMaxReturn / filtered.length : 0;
        const avgMinReturn = filtered.length > 0 ? totalMinReturn / filtered.length : 0;

        // 3. Sort
        const sorted = [...filtered].sort((a, b) => {
            if (!sortConfig) return 0;
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return { sortedResults: sorted, avgReturn, avgMaxReturn, avgMinReturn, sp500Result: sp500 };
    }, [results, selectedSignals, sortConfig]);


    const handleExportExcel = async () => {
        if (results.length === 0) return;

        // Match Browser Table Column Order with Japanese Headers
        const cols = [
            { key: 'symbol', header: '銘柄コード', width: 10 },
            { key: 'company_name', header: '会社名', width: 25 },
            { key: 'entry_price', header: '基準日価格', type: 'number' as const },
            { key: 'daily_change_pct', header: '基準日騰落率', type: 'percentage' as const },
            { key: 'dev_ma5', header: '5MA乖離', type: 'number' as const },
            { key: 'dev_ma20', header: '20MA乖離', type: 'number' as const },
            { key: 'dev_ma50', header: '50MA乖離', type: 'number' as const },
            { key: 'dev_ma200', header: '200MA乖離', type: 'number' as const },
            { key: 'current_price', header: '現在値', type: 'number' as const },
            { key: 'return_pct', header: '騰落率', type: 'percentage' as const },
            { key: 'max_return_pct', header: '最大騰落率', type: 'percentage' as const },
            { key: 'min_return_pct', header: '最大下落率', type: 'percentage' as const },
            { key: 'active_signals', header: '発生シグナル', width: 30 },
        ];

        // Use `sortedResults` (which is filtered) instead of `results`.
        // Also ensure sp500Result (filtered out of sortedResults) stats are correct.

        // Note: avgReturn etc are already calculated by useMemo above!
        // We can just use the values from useMemo.

        const summary = {
            '出力日時': new Date().toLocaleString(),
            '基準日': targetDate,
            '計算日': calcDate,
            '対象銘柄数': sortedResults.length, // Filtered count
            'S&P 500 騰落率': sp500Result ? `${sp500Result.return_pct.toFixed(2)}%` : 'N/A',
            'S&P 500 最大騰落率': sp500Result ? `${sp500Result.max_return_pct.toFixed(2)}%` : 'N/A',
            'S&P 500 最大下落率': sp500Result ? `${(sp500Result.min_return_pct || 0).toFixed(2)}%` : 'N/A',
            '平均騰落率': `${avgReturn.toFixed(2)}%`,
            '平均最大騰落率': `${avgMaxReturn.toFixed(2)}%`,
            '平均最大下落率': `${(avgMinReturn || 0).toFixed(2)}%`,
            'シグナル条件': selectedSignals.length > 0 ? selectedSignals.map(k => SIGNAL_LABELS[k] || k).join(', ') : '指定なし'
        };

        // Pre-process active_signals array to string (Japanese Labels)
        const data = sortedResults.map(r => ({
            ...r,
            active_signals: r.active_signals.map(s => SIGNAL_LABELS['signal_' + s] || s).join(', ')
        }));

        await exportToExcel({
            fileName: `historical_analysis_${targetDate}.xlsx`,
            sheetName: '分析結果',
            summaryData: summary,
            columns: cols,
            data: data
        });
    };


    // Date Shortcuts
    const setDateOffset = (months: number, weeks: number = 0) => {
        const d = new Date();
        d.setMonth(d.getMonth() - months);
        d.setDate(d.getDate() - weeks * 7);
        setTargetDate(d.toISOString().split('T')[0]);
    };

    const SortIcon = ({ colKey }: { colKey: keyof SignalResult }) => {
        if (sortConfig?.key !== colKey) return <span className="text-gray-600 ml-1">⇅</span>;
        return <span className="text-blue-400 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
            <div className="container mx-auto max-w-full space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        過去シグナル分析
                    </h1>
                    <Link href="/" className="text-gray-400 hover:text-white text-sm">
                        ← ダッシュボードに戻る
                    </Link>
                </div>

                {/* Controls */}
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">基準日 (Target Date)</label>
                            <input
                                type="date"
                                value={targetDate}
                                onChange={e => setTargetDate(e.target.value)}
                                className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        {/* Date Shortcuts */}
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={() => setDateOffset(0, 1)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 transition">1週間前</button>
                            <button onClick={() => setDateOffset(1, 0)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 transition">1ヶ月前</button>
                            <button onClick={() => setDateOffset(3, 0)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 transition">3ヶ月前</button>
                            <button onClick={() => setDateOffset(6, 0)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 transition">6ヶ月前</button>
                            <button onClick={() => setDateOffset(12, 0)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 transition">1年前</button>
                            <button onClick={() => setDateOffset(24, 0)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 transition">2年前</button>
                            <button onClick={() => setDateOffset(36, 0)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 transition">3年前</button>
                        </div>

                        <div className="flex-grow"></div>

                        <button
                            onClick={handleRunAnalysis}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold disabled:opacity-50 transition w-full md:w-auto"
                        >
                            {loading ? '分析中...' : '分析実行'}
                        </button>
                    </div>

                    {/* Progress Bar */}
                    {loading && (
                        <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                            <div
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${totalStocks > 0 ? (progress / totalStocks) * 100 : 0}%` }}
                            ></div>
                            <div className="text-right text-xs text-gray-400 mt-1">
                                {progress} / {totalStocks}
                            </div>
                        </div>
                    )}

                    {/* Elapsed Time */}
                    {!loading && elapsedTime && (
                        <div className="text-right text-xs text-gray-500 mt-1">
                            処理時間: {elapsedTime}
                        </div>
                    )}

                    {/* Calculation Date Slider */}
                    {analyzed && (
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <label className="block text-xs text-gray-400 mb-2 flex justify-between items-center">
                                <span>計算基準日 (Calculation Date)</span>
                                <span className="font-bold text-lg text-white">{calcDate}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max={getDaysDiff(targetDate, maxDate)}
                                value={getDaysDiff(targetDate, calcDate)}
                                onChange={handleSliderChange}
                                onMouseUp={handleSliderCommit}
                                onTouchEnd={handleSliderCommit}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                                <span>基準日: {targetDate}</span>
                                <span>最新: {maxDate}</span>
                            </div>
                        </div>
                    )}

                    {/* Signal Selector */}
                    <div>
                        <label className="block text-xs text-gray-400 mb-2">シグナル絞り込み (AND条件)</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                            {Object.entries(SIGNAL_LABELS).map(([key, label]) => {
                                const isSelected = selectedSignals.includes(key);
                                return (
                                    <div
                                        key={key}
                                        onClick={() => toggleSignal(key)}
                                        className={`cursor-pointer px-3 py-2 rounded border text-xs transition duration-200 select-none ${isSelected
                                            ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                                            : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full border flex flex-col items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}`}>
                                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </div>
                                            {label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Results */}
                {analyzed && (
                    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                            <div className="flex-1 flex justify-between items-center w-full">
                                <div>
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        分析結果
                                        <span className="text-sm font-normal text-gray-400">({sortedResults.length} / {results.filter(r => r.symbol !== '^GSPC').length})</span>
                                    </h2>
                                    {results.length > 0 && selectedSignals.length > 0 && (
                                        <span className="text-xs text-gray-400">{selectedSignals.length}個のシグナルで絞り込み中</span>
                                    )}
                                </div>
                                <button
                                    onClick={handleExportExcel}
                                    className="bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded shadow shadow-green-900/50 transition font-bold text-sm flex items-center gap-2"
                                >
                                    <span>📊</span> Excel
                                </button>
                            </div>

                            {/* Stats Area */}
                            {(sortedResults.length > 0 || sp500Result) && (
                                <div className="flex gap-4 p-2 bg-gray-900/50 rounded border border-gray-700">
                                    {/* S&P 500 */}
                                    {sp500Result ? (
                                        <>
                                            <div className="text-center px-2">
                                                <div className="text-xs text-gray-400">S&P500 騰落率</div>
                                                <div className={`font-bold ${sp500Result.return_pct >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                                    {sp500Result.return_pct > 0 ? '+' : ''}{sp500Result.return_pct.toFixed(2)}%
                                                </div>
                                            </div>
                                            <div className="w-px bg-gray-700"></div>
                                            <div className="text-center px-2">
                                                <div className="text-xs text-gray-400">S&P500 最大騰落率</div>
                                                <div className={`font-bold ${sp500Result.max_return_pct >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                                    {sp500Result.max_return_pct > 0 ? '+' : ''}{sp500Result.max_return_pct.toFixed(2)}%
                                                </div>
                                            </div>
                                            <div className="w-px bg-gray-700"></div>
                                            <div className="text-center px-2">
                                                <div className="text-xs text-gray-400">S&P500 最大下落率</div>
                                                <div className={`font-bold ${sp500Result.min_return_pct >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                                    {sp500Result.min_return_pct > 0 ? '+' : ''}{(sp500Result.min_return_pct || 0).toFixed(2)}%
                                                </div>
                                            </div>

                                        </>
                                    ) : (
                                        <div className="px-2 flex items-center text-xs text-gray-500">
                                            S&P500 N/A
                                        </div>
                                    )}

                                    {/* Averages */}
                                    <div className="text-center px-2">
                                        <div className="text-xs text-gray-400">平均騰落率</div>
                                        <div className={`font-bold ${avgReturn >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                            {avgReturn > 0 ? '+' : ''}{avgReturn.toFixed(2)}%
                                        </div>
                                    </div>
                                    <div className="w-px bg-gray-700"></div>
                                    <div className="text-center px-2">
                                        <div className="text-xs text-gray-400">平均最大騰落率</div>
                                        <div className={`font-bold ${avgMaxReturn >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                            {avgMaxReturn > 0 ? '+' : ''}{avgMaxReturn.toFixed(2)}%
                                        </div>
                                    </div>
                                    <div className="w-px bg-gray-700"></div>
                                    <div className="text-center px-2">
                                        <div className="text-xs text-gray-400">平均最大下落率</div>
                                        <div className={`font-bold ${avgMinReturn && avgMinReturn >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                            {avgMinReturn && avgMinReturn > 0 ? '+' : ''}{(avgMinReturn || 0).toFixed(2)}%
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>

                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-900 sticky top-0 z-10 shadow-md">
                                    <tr>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-800" onClick={() => handleSort('symbol')}>
                                            銘柄コード <SortIcon colKey="symbol" />
                                        </th>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-800" onClick={() => handleSort('company_name')}>
                                            会社名 <SortIcon colKey="company_name" />
                                        </th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-800" onClick={() => handleSort('entry_price')}>
                                            基準日価格 <SortIcon colKey="entry_price" />
                                        </th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-800" onClick={() => handleSort('daily_change_pct')}>
                                            基準日騰落率 <SortIcon colKey="daily_change_pct" />
                                        </th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-800" onClick={() => handleSort('dev_ma5')}>
                                            5MA乖離 <SortIcon colKey="dev_ma5" />
                                        </th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-800" onClick={() => handleSort('dev_ma20')}>
                                            20MA乖離 <SortIcon colKey="dev_ma20" />
                                        </th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-800" onClick={() => handleSort('dev_ma50')}>
                                            50MA乖離 <SortIcon colKey="dev_ma50" />
                                        </th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-800" onClick={() => handleSort('dev_ma200')}>
                                            200MA乖離 <SortIcon colKey="dev_ma200" />
                                        </th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-800" onClick={() => handleSort('current_price')}>
                                            現在値 <SortIcon colKey="current_price" />
                                        </th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-800" onClick={() => handleSort('return_pct')}>
                                            騰落率 <SortIcon colKey="return_pct" />
                                        </th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-800" onClick={() => handleSort('max_return_pct')}>
                                            最大騰落率 <SortIcon colKey="max_return_pct" />
                                        </th>
                                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-800" onClick={() => handleSort('min_return_pct')}>
                                            最大下落率 <SortIcon colKey="min_return_pct" />
                                        </th>

                                        <th className="px-4 py-3">発生シグナル</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {sortedResults.map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-700/50 transition">
                                            <td className="px-4 py-3 font-medium text-blue-400">
                                                <Link href={`/stocks/${row.symbol}`} target="_blank">
                                                    {row.symbol}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-gray-300">{row.company_name || '-'}</td>
                                            <td className="px-4 py-3 text-right text-gray-400">{row.entry_price.toLocaleString()}</td>
                                            <td className={`px-4 py-3 text-right font-mono ${(row.daily_change_pct || 0) > 0 ? 'text-red-400' : (row.daily_change_pct || 0) < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                                {row.daily_change_pct ? `${row.daily_change_pct > 0 ? '+' : ''}${row.daily_change_pct.toFixed(1)}%` : '-'}
                                            </td>
                                            <td className={`px-4 py-3 text-right text-xs font-mono ${(row.dev_ma5 || 0) > 0 ? 'text-red-300' : (row.dev_ma5 || 0) < 0 ? 'text-blue-300' : 'text-gray-500'}`}>
                                                {row.dev_ma5 ? `${row.dev_ma5 > 0 ? '+' : ''}${row.dev_ma5}%` : '-'}
                                            </td>
                                            <td className={`px-4 py-3 text-right text-xs font-mono ${(row.dev_ma20 || 0) > 0 ? 'text-red-300' : (row.dev_ma20 || 0) < 0 ? 'text-blue-300' : 'text-gray-500'}`}>
                                                {row.dev_ma20 ? `${row.dev_ma20 > 0 ? '+' : ''}${row.dev_ma20}%` : '-'}
                                            </td>
                                            <td className={`px-4 py-3 text-right text-xs font-mono ${(row.dev_ma50 || 0) > 0 ? 'text-red-300' : (row.dev_ma50 || 0) < 0 ? 'text-blue-300' : 'text-gray-500'}`}>
                                                {row.dev_ma50 ? `${row.dev_ma50 > 0 ? '+' : ''}${row.dev_ma50}%` : '-'}
                                            </td>
                                            <td className={`px-4 py-3 text-right text-xs font-mono ${(row.dev_ma200 || 0) > 0 ? 'text-red-300' : (row.dev_ma200 || 0) < 0 ? 'text-blue-300' : 'text-gray-500'}`}>
                                                {row.dev_ma200 ? `${row.dev_ma200 > 0 ? '+' : ''}${row.dev_ma200}%` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right">{row.current_price.toLocaleString()}</td>
                                            <td className={`px-4 py-3 text-right font-bold ${row.return_pct >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                                {row.return_pct > 0 ? '+' : ''}{row.return_pct.toFixed(2)}%
                                            </td>
                                            <td className={`px-4 py-3 text-right ${row.max_return_pct >= 0 ? 'text-red-300' : 'text-blue-300'}`}>
                                                {row.max_return_pct > 0 ? '+' : ''}{row.max_return_pct.toFixed(2)}%
                                            </td>
                                            <td className={`px-4 py-3 text-right ${row.min_return_pct >= 0 ? 'text-red-300' : 'text-blue-300'}`}>
                                                {row.min_return_pct > 0 ? '+' : ''}{(row.min_return_pct || 0).toFixed(2)}%
                                            </td>

                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {row.active_signals.map(s => (
                                                        <span key={s} className="px-1.5 py-0.5 rounded bg-gray-700 text-[10px] text-gray-300 border border-gray-600">
                                                            {/* Try to map back to label? */}
                                                            {SIGNAL_LABELS['signal_' + s] || s}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {sortedResults.length === 0 && (
                                        <tr>
                                            <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                                                条件に一致する銘柄はありませんでした。
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
