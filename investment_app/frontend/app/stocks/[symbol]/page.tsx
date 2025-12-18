"use client";

import { useEffect, useState } from 'react';
import { fetchStockDetail, fetchStockChart, fetchStockSignals, fetchStockHistory, fetchStockNote, saveStockNote, fetchStockAnalysis, deleteStock, Stock, ChartData, TradeHistory, StockNote, AnalysisResult, updateStock, fetchPrompts, fetchStockPriceHistory, GeminiPrompt, openFile } from '@/lib/api';
import { StockChart } from '@/components/StockChart';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { useParams, useRouter } from 'next/navigation';
import { SeriesMarker } from 'lightweight-charts';

export default function StockDetailPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const params = useParams();
    const symbol = params?.symbol as string;

    const [stock, setStock] = useState<Stock | null>(null);
    const [chartDataDaily, setChartDataDaily] = useState<ChartData[]>([]);
    const [chartDataWeekly, setChartDataWeekly] = useState<ChartData[]>([]);
    const [signals, setSignals] = useState<Record<string, number>>({});
    const [history, setHistory] = useState<TradeHistory[]>([]);
    const [note, setNote] = useState<string>('');
    const [lastSavedNote, setLastSavedNote] = useState<string>('');
    const [analysis, setAnalysis] = useState<AnalysisResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingNote, setSavingNote] = useState(false);

    // Prompts
    const [prompts, setPrompts] = useState<GeminiPrompt[]>([]);
    const [selectedPromptId, setSelectedPromptId] = useState<number | string>("");
    const [copyingPrompt, setCopyingPrompt] = useState(false);

    useEffect(() => {
        if (symbol) {
            loadData(symbol);
        }
    }, [symbol]);

    async function loadData(sym: string) {
        setLoading(true);
        try {
            const [s, cDaily, cWeekly, sig, h, n, a, p] = await Promise.all([
                fetchStockDetail(sym),
                fetchStockChart(sym, '5y', '1d'), // Fetch 5y for daily
                fetchStockChart(sym, '10y', '1wk'), // Fetch 10y for weekly
                fetchStockSignals(sym),
                fetchStockHistory(sym),
                fetchStockNote(sym),
                fetchStockAnalysis(sym),
                fetchPrompts()
            ]);
            setStock(s);
            setChartDataDaily(cDaily);
            setChartDataWeekly(cWeekly);
            setSignals(sig || {});
            setHistory(h);
            const content = n.content || '';
            setNote(content);
            setLastSavedNote(content);
            setAnalysis(a);
            setPrompts(p); // Assuming 8th element is prompts
            if (p && p.length > 0) setSelectedPromptId(p[0].id);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveNote() {
        if (!stock) return;
        setSavingNote(true);
        try {
            await saveStockNote(stock.symbol, note);
            setLastSavedNote(note);
            // alert(t('noteSaved')); // Removed alert as requested
        } catch (e) {
            console.error("Failed to save note", e);
        } finally {
            setSavingNote(false);
        }
    }

    async function handleCopyPrompt() {
        if (!stock || !selectedPromptId) return;

        const prompt = prompts.find(p => p.id === Number(selectedPromptId));
        if (!prompt) return;

        setCopyingPrompt(true);
        try {
            let content = prompt.content;

            // Basic vars
            content = content.replace(/%SYMBOL%/g, stock.symbol);
            content = content.replace(/%COMPANYNAME%/g, stock.company_name);
            content = content.replace(/%DATE%/g, new Date().toISOString().split('T')[0]);

            // Stock Data
            if (content.includes('%STOCKDATA%')) {
                const history = await fetchStockPriceHistory(stock.symbol, 100);

                // Convert to CSV
                if (history && history.length > 0) {
                    const header = Object.keys(history[0]).join(',') + "\n";
                    const rows = history.map(row => Object.values(row).join(',')).join("\n");
                    content = content.replace(/%STOCKDATA%/g, header + rows);
                } else {
                    content = content.replace(/%STOCKDATA%/g, "No Data");
                }
            }

            await navigator.clipboard.writeText(content);
            alert("Prompt copied to clipboard! 📋");
        } catch (e) {
            console.error(e);
            alert("Failed to copy prompt.");
        } finally {
            setCopyingPrompt(false);
        }
    }

    // Process markers from history (aggregated by date)
    const markers: SeriesMarker<string>[] = (() => {
        const grouped: Record<string, { type: string, qty: number, totalVal: number }> = {};
        history.forEach(h => {
            const d = new Date(h.trade_date);
            const timeStr = d.toISOString().split('T')[0];
            const key = `${timeStr}_${h.trade_type}`;
            if (!grouped[key]) grouped[key] = { type: h.trade_type, qty: 0, totalVal: 0 };
            grouped[key].qty += h.quantity;
            grouped[key].totalVal += (h.quantity * h.price);
        });

        return Object.entries(grouped).map(([key, val]) => {
            const [timeStr, type] = key.split('_');
            const avgPrice = val.qty > 0 ? (val.totalVal / val.qty) : 0;
            return {
                time: timeStr,
                position: (type === '買い' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar' | 'inBar',
                color: type === '買い' ? '#ef4444' : '#3b82f6',
                shape: (type === '買い' ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown' | 'circle' | 'square',
                text: `${type === '買い' ? 'Buy' : 'Sell'} @ ${avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            };
        }).sort((a, b) => (a.time > b.time ? 1 : -1));
    })();

    if (loading) return <div className="p-10 text-white">{t('loading')}</div>;
    if (!stock) return <div className="p-10 text-white">{t('stockNotFound')}</div>;

    // Chart Configs
    const smaDaily = [
        { key: 'sma5', color: '#9ca3af' },   // Gray
        { key: 'sma20', color: '#a855f7' },  // Purple
        { key: 'sma50', color: '#15803d' },  // Dark Green
        { key: 'sma100', color: '#f97316' }, // Orange
        { key: 'sma200', color: '#3b82f6' }, // Blue
    ];

    const smaWeekly = [
        { key: 'sma4', color: '#a855f7' },   // Purple
        { key: 'sma10', color: '#15803d' },  // Dark Green
        { key: 'sma20', color: '#f97316' },  // Orange
        { key: 'sma40', color: '#3b82f6' },  // Blue
    ];

    // Zoom Defaults (approx bars)
    // Daily: 6 months ~ 130 trading days
    // Weekly: 2 years ~ 104 weeks
    const zoomDaily = 130;
    const zoomWeekly = 104;

    const chartColors = {
        backgroundColor: 'white',
        textColor: '#333',
    };

    return (
        <main className="min-h-screen bg-gray-900 text-white pb-20">
            {/* Sticky Header with Back Link */}
            <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-8 py-4 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold">{stock.symbol} <span className="text-lg font-normal text-gray-400">{stock.company_name}</span></h1>
                    {stock.asset_type !== 'index' && (
                        <>
                            <span className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-300 border border-gray-700 hover:bg-gray-700 transition-colors cursor-default" title="Sector">{stock.sector}</span>
                            <span className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-400 border border-gray-700 hover:bg-gray-700 transition-colors cursor-default" title="Industry">{stock.industry}</span>
                            {/* Display Triggered Signals */}
                            {Object.entries(signals || {}).filter(([_, val]) => val === 1).map(([key, _]) => (
                                <span key={key} className="px-3 py-1 bg-green-900/50 text-green-400 border border-green-700/50 rounded text-sm font-bold uppercase">
                                    {key.replace(/_/g, ' ')}
                                </span>
                            ))}
                        </>
                    )}

                    {/* First Import Date Badge */}
                    {stock.asset_type !== 'index' && stock.first_import_date && (
                        <span className="px-3 py-1 bg-gray-800 text-gray-400 border border-gray-700/50 rounded text-sm" title="First Import Date">
                            📅 {new Date(stock.first_import_date).toLocaleDateString()}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <a
                        href={`https://research.investors.com/ibdchartsenlarged.aspx?symbol=${stock.symbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-80 hover:opacity-100 transition"
                        title="IBD Chart"
                    >
                        <span className="text-sm bg-yellow-600 text-white px-2 py-1 rounded font-bold">I</span>
                    </a>
                    <a
                        href={`https://www.tradingview.com/chart/?symbol=${stock.symbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-80 hover:opacity-100 transition mr-4"
                        title="TradingView"
                    >
                        <span className="text-sm bg-blue-600 text-white px-2 py-1 rounded font-bold">T</span>
                    </a>

                    <div className="mr-4">
                        <input
                            type="text"
                            placeholder="Jump to..."
                            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500 w-28 placeholder-gray-500 uppercase font-mono"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = e.currentTarget.value.trim().toUpperCase();
                                    if (val) router.push(`/stocks/${val}`);
                                }
                            }}
                        />
                    </div>

                    <Link
                        href={stock.asset_type === 'index' ? '/?tab=index' : '/?tab=stock'}
                        className="text-gray-400 hover:text-white font-bold flex items-center gap-2"
                    >
                        {t('backToDashboard')} &rarr;
                    </Link>
                </div>
            </div>

            <div className="flex justify-end px-8 mb-4">
                <button
                    onClick={async () => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (confirm(t('confirmDeleteStock' as any) || `Are you sure you want to delete ${stock.symbol}? This will remove all data including notes and history.`)) {
                            try {
                                await deleteStock(stock.symbol);
                                router.push('/');
                            } catch (e) {
                                alert('Failed to delete stock');
                                console.error(e);
                            }
                        }
                    }}
                    className="text-red-500 hover:text-red-400 text-sm font-bold opacity-60 hover:opacity-100 transition"
                >
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {t('deleteStock' as any) || 'Delete Stock'} 🗑️
                </button>
            </div>

            <div className="space-y-6 px-8">
                {/* Compact Dashboard Metrics Summary */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 items-center bg-gray-800 rounded-xl px-6 py-3 border border-gray-700 text-sm shadow-sm">
                    {stock.asset_type !== 'index' && (
                        <>
                            {/* Status & Qty */}
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">{t('status')}:</span>
                                <span className="font-bold">
                                    {stock.status === 'Holding' ? (
                                        <span className="text-green-400">{t('holding')} ({stock.holding_quantity})</span>
                                    ) : stock.status === 'Past Trade' ? (
                                        <span className="text-gray-400">{t('pastTrade')}</span>
                                    ) : '-'}
                                </span>
                            </div>

                            <div className="hidden md:block w-px h-4 bg-gray-600"></div>

                            {/* P&L */}
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">{t('totalPL')}:</span>
                                <span className={`font-bold font-mono ${(stock.realized_pl || 0) > 0 ? 'text-red-400' : (stock.realized_pl || 0) < 0 ? 'text-blue-400' : 'text-gray-300'}`}>
                                    {stock.realized_pl ? `${(stock.realized_pl > 0 ? '+' : '')}${stock.realized_pl.toLocaleString()}` : '-'}
                                </span>
                            </div>

                            <div className="hidden md:block w-px h-4 bg-gray-600"></div>

                            {/* Last Buy */}
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">{t('lastBuy')}:</span>
                                <span className="font-mono text-gray-300">{stock.last_buy_date || '-'}</span>
                            </div>

                            <div className="hidden md:block w-px h-4 bg-gray-600"></div>

                            {/* Last Sell */}
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">{t('lastSell')}:</span>
                                <span className="font-mono text-gray-300">{stock.last_sell_date || '-'}</span>
                            </div>

                            <div className="hidden md:block w-px h-4 bg-gray-600"></div>
                        </>
                    )}

                    {/* Changes (Grouped) */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1" title="1D Change">
                            <span className="text-gray-500">1D:</span>
                            <span className={`font-mono ${(stock.change_percentage_1d || 0) > 0 ? 'text-red-400' : (stock.change_percentage_1d || 0) < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                {stock.change_percentage_1d ? `${stock.change_percentage_1d > 0 ? '+' : ''}${stock.change_percentage_1d.toFixed(1)}%` : '-'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1" title={t('change5d')}>
                            <span className="text-gray-500">5D:</span>
                            <span className={`font-mono ${(stock.change_percentage_5d || 0) > 0 ? 'text-red-400' : (stock.change_percentage_5d || 0) < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                {stock.change_percentage_5d ? `${stock.change_percentage_5d > 0 ? '+' : ''}${stock.change_percentage_5d.toFixed(1)}%` : '-'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1" title={t('change20d')}>
                            <span className="text-gray-500">20D:</span>
                            <span className={`font-mono ${(stock.change_percentage_20d || 0) > 0 ? 'text-red-400' : (stock.change_percentage_20d || 0) < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                {stock.change_percentage_20d ? `${stock.change_percentage_20d > 0 ? '+' : ''}${stock.change_percentage_20d.toFixed(1)}%` : '-'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1" title={t('change50d')}>
                            <span className="text-gray-500">50D:</span>
                            <span className={`font-mono ${(stock.change_percentage_50d || 0) > 0 ? 'text-red-400' : (stock.change_percentage_50d || 0) < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                {stock.change_percentage_50d ? `${stock.change_percentage_50d > 0 ? '+' : ''}${stock.change_percentage_50d.toFixed(1)}%` : '-'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1" title={t('change200d')}>
                            <span className="text-gray-500">200D:</span>
                            <span className={`font-mono ${(stock.change_percentage_200d || 0) > 0 ? 'text-red-400' : (stock.change_percentage_200d || 0) < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                                {stock.change_percentage_200d ? `${stock.change_percentage_200d > 0 ? '+' : ''}${stock.change_percentage_200d.toFixed(1)}%` : '-'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1" title="ATR (14 days)">
                            <span className="text-gray-500">ATR(14):</span>
                            <span className="font-mono text-gray-300">
                                {stock.atr_14 ? (
                                    <>
                                        {stock.atr_14.toFixed(2)}
                                        {chartDataDaily.length > 0 && (
                                            <span className="text-xs text-gray-500 ml-1">
                                                ({((stock.atr_14 / chartDataDaily[chartDataDaily.length - 1].close) * 100).toFixed(2)}%)
                                            </span>
                                        )}
                                    </>
                                ) : '-'}
                            </span>
                        </div>
                    </div>
                </div>




                {stock.asset_type !== 'index' && (
                    <div className="bg-gray-800 rounded-xl px-6 py-4 border border-gray-700 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-8">
                            <h3 className="text-gray-400 font-bold text-sm">IBD Ratings</h3>
                            <div className="flex items-center gap-4">
                                <IBDRatingInput
                                    label="Composite"
                                    initialValue={stock.composite_rating}
                                    onSave={async (val) => {
                                        try {
                                            const updated = await updateStock(stock.symbol, { composite_rating: val });
                                            console.log("Updated Comp:", updated);
                                            setStock(prev => prev ? { ...prev, ...updated } : null);
                                        } catch (e) {
                                            console.error("Failed to update Comp", e);
                                            alert("Update failed");
                                        }
                                    }}
                                    colorClass="text-yellow-500"
                                />
                                <IBDRatingInput
                                    label="RS Rating"
                                    initialValue={stock.rs_rating}
                                    onSave={async (val) => {
                                        try {
                                            const updated = await updateStock(stock.symbol, { rs_rating: val });
                                            console.log("Updated RS:", updated);
                                            setStock(prev => prev ? { ...prev, ...updated } : null);
                                        } catch (e) {
                                            console.error("Failed to update RS", e);
                                            alert("Update failed");
                                        }
                                    }}
                                    colorClass="text-blue-400"
                                />
                            </div>
                        </div>
                        <div className="text-xs text-gray-500">
                            Updated: {stock.ibd_rating_date ? new Date(stock.ibd_rating_date).toLocaleDateString() : '-'}
                        </div>
                    </div>
                )}

                {/* Gemini Prompt Selector */}
                {stock.asset_type !== 'index' && (
                    <div className="bg-gray-800 rounded-xl px-6 py-4 border border-gray-700 shadow-sm mt-4 flex items-center gap-4">
                        <div className="flex-1 flex items-center gap-4">
                            <label className="text-gray-400 font-bold text-sm">Gemini Prompt:</label>
                            <select
                                value={selectedPromptId}
                                onChange={(e) => setSelectedPromptId(e.target.value)}
                                className="bg-gray-900 border border-gray-600 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-blue-500 flex-1 max-w-md"
                            >
                                {prompts.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={handleCopyPrompt}
                            disabled={copyingPrompt || !selectedPromptId}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition"
                        >
                            {copyingPrompt ? 'Generating...' : 'Copy Prompt 📋'}
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        {/* Daily Chart */}
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-gray-300">{t('priceChart')} ({t('dailyChart')})</h2>
                            </div>
                            {chartDataDaily.length > 0 ? (
                                <div className="bg-white p-2 rounded">
                                    <StockChart
                                        data={chartDataDaily}
                                        markers={markers}
                                        height={400}
                                        colors={chartColors}
                                        smas={smaDaily}
                                        visibleBars={zoomDaily}
                                    />
                                </div>
                            ) : (
                                <div className="h-[400px] flex items-center justify-center text-gray-600">{t('noChartData')}</div>
                            )}
                        </div>

                        {/* Weekly Chart */}
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-gray-300">{t('priceChart')} ({t('weeklyChart')})</h2>
                            </div>
                            {chartDataWeekly.length > 0 ? (
                                <div className="bg-white p-2 rounded">
                                    <StockChart
                                        data={chartDataWeekly}
                                        markers={markers}
                                        height={400}
                                        colors={chartColors}
                                        smas={smaWeekly}
                                        visibleBars={zoomWeekly}
                                    />
                                </div>
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-gray-600">{t('noChartData')}</div>
                            )}
                        </div>


                    </div>

                    <div>
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 h-full flex flex-col">
                            <h2 className="text-xl font-bold mb-4 text-gray-300">{t('myNotes')}</h2>
                            <textarea
                                className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-gray-300 focus:border-blue-500 focus:outline-none h-48 mb-4 resize-none"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                            <button
                                onClick={handleSaveNote}
                                disabled={savingNote || note === lastSavedNote}
                                className={`w-full py-2 rounded font-bold transition ${savingNote || note === lastSavedNote ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                            >
                                {savingNote ? t('loading') : t('saveNote')}
                            </button>

                            <div className="mt-8 pt-8 border-t border-gray-700 flex-1">
                                {stock.asset_type !== 'index' && (
                                    <>
                                        <h2 className="text-xl font-bold mb-4 text-gray-300">{t('geminiAnalysis')}</h2>
                                        {analysis.length > 0 ? (
                                            <div className="space-y-4 max-h-[300px] overflow-y-auto">
                                                {analysis.map((a) => (
                                                    <div key={a.id} className="p-4 bg-gray-900 rounded border border-gray-700">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</div>
                                                            {a.file_path && (
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            await openFile(a.file_path!);
                                                                        } catch (e) {
                                                                            alert("Failed to open file: " + e);
                                                                        }
                                                                    }}
                                                                    className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded hover:bg-blue-800 transition border border-blue-800"
                                                                >
                                                                    Open Report 📄
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="prose prose-invert prose-sm">
                                                            {/* In real app, render full markdown. For now just text. */}
                                                            <p className="whitespace-pre-wrap">{a.content}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 italic">{t('noAnalysis')}</div>
                                        )}
                                    </>
                                )}
                            </div>

                            {stock.asset_type !== 'index' && (
                                <div className="mt-8 pt-8 border-t border-gray-700">
                                    <h2 className="text-xl font-bold mb-4 text-gray-300">{t('tradeHistory')}</h2>
                                    {history.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left text-gray-400">
                                                <thead className="text-xs text-gray-300 uppercase bg-gray-700">
                                                    <tr>
                                                        <th scope="col" className="px-4 py-3">{t('date')}</th>
                                                        <th scope="col" className="px-4 py-3">{t('side')}</th>
                                                        <th scope="col" className="px-4 py-3">{t('qty')}</th>
                                                        <th scope="col" className="px-4 py-3">{t('price')}</th>
                                                        <th scope="col" className="px-4 py-3">{t('value')}</th>
                                                        <th scope="col" className="px-4 py-3">{t('pl')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        // 1. Calculate P&L (Average Cost Method) on raw data sorted by date ASC
                                                        const sortedHistory = [...history].sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());

                                                        let currentQty = 0;
                                                        let currentTotalCost = 0;

                                                        const historyWithPL = sortedHistory.map(trade => {
                                                            let pl = 0;
                                                            if (trade.trade_type === '買い') {
                                                                currentQty += trade.quantity;
                                                                currentTotalCost += (trade.price * trade.quantity);
                                                            } else if (trade.trade_type === '売り') {
                                                                const avgCost = currentQty > 0 ? (currentTotalCost / currentQty) : 0;
                                                                pl = (trade.price - avgCost) * trade.quantity;

                                                                // Reduce holdings
                                                                currentQty -= trade.quantity;
                                                                currentTotalCost -= (avgCost * trade.quantity);

                                                                if (currentQty < 0.0001) {
                                                                    currentQty = 0;
                                                                    currentTotalCost = 0;
                                                                }
                                                            }
                                                            return { ...trade, realized_pl: pl };
                                                        });

                                                        // 2. Grouping Logic
                                                        const grouped: Record<string, {
                                                            date: string,
                                                            side: string,
                                                            qty: number,
                                                            totalVal: number,
                                                            totalPL: number,
                                                            id: number
                                                        }> = {};

                                                        historyWithPL.forEach(trade => {
                                                            const d = new Date(trade.trade_date);
                                                            const dateKey = d.toLocaleDateString();
                                                            const key = `${dateKey}_${trade.trade_type}`;

                                                            if (!grouped[key]) {
                                                                grouped[key] = {
                                                                    date: dateKey,
                                                                    side: trade.trade_type,
                                                                    qty: 0,
                                                                    totalVal: 0,
                                                                    totalPL: 0,
                                                                    id: trade.id
                                                                };
                                                            }

                                                            grouped[key].qty += trade.quantity;
                                                            grouped[key].totalVal += (trade.quantity * trade.price);
                                                            grouped[key].totalPL += trade.realized_pl;
                                                        });

                                                        // 3. Sort DESC for display
                                                        const finalSorted = Object.values(grouped).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                                        return finalSorted.map((g) => (
                                                            <tr key={g.id} className="border-b border-gray-700 hover:bg-gray-800">
                                                                <td className="px-4 py-3">{g.date}</td>
                                                                <td className={`px-4 py-3 font-bold ${g.side === '買い' ? 'text-blue-400' : 'text-red-400'}`}>
                                                                    {g.side === '買い' ? t('buy') : t('sell')}
                                                                </td>
                                                                <td className="px-4 py-3">{g.qty.toLocaleString()}</td>
                                                                <td className="px-4 py-3">{(g.totalVal / g.qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                <td className="px-4 py-3">{g.totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                <td className={`px-4 py-3 font-bold ${g.totalPL > 0 ? 'text-red-400' : g.totalPL < 0 ? 'text-blue-400' : 'text-gray-500'}`}>
                                                                    {g.side === '売り' ? g.totalPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                                                </td>
                                                            </tr>
                                                        ));
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-400">
                                            {t('noTradesFound')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main >
    );
}

function IBDRatingInput({ label, initialValue, onSave, colorClass }: { label: string, initialValue?: number, onSave: (val: number) => Promise<void>, colorClass: string }) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(initialValue?.toString() || '');

    useEffect(() => {
        setValue(initialValue?.toString() || '');
    }, [initialValue]);

    const handleSave = async () => {
        const num = parseInt(value);
        if (!isNaN(num)) {
            await onSave(num);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">{label}:</span>
                <input
                    type="text"
                    className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white font-bold text-center"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') setIsEditing(false);
                    }}
                    onFocus={(e) => e.target.select()}
                    autoFocus
                />
                <button type="button" onClick={handleSave} className="text-green-400 hover:text-green-300 text-xs font-bold">✓</button>
                <button type="button" onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-gray-400 text-xs">✕</button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-2 py-1 rounded transition" onClick={() => setIsEditing(true)}>
            <span className="text-gray-500 text-sm">{label}:</span>
            <span className={`font-bold text-lg ${colorClass}`}>{initialValue || '-'}</span>
        </div>
    );
}
