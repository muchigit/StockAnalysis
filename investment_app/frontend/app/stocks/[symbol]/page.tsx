"use client";

import { useEffect, useState } from 'react';
import { fetchStockDetail, fetchStockChart, fetchStockSignals, fetchStockHistory, fetchStockNote, saveStockNote, fetchStockAnalysis, deleteStock, Stock, ChartData, TradeHistory, StockNote, AnalysisResult, updateStock, fetchPrompts, fetchStockPriceHistory, GeminiPrompt, openFile, generateText, updateTradeNote, pickFile, AlertCondition, triggerVisualAnalysis, deleteAnalysisResult } from '@/lib/api';
import { addResearchTicker } from '@/lib/research-storage';
import { SIGNAL_LABELS } from '@/lib/signals';
import { StockChart } from '@/components/StockChart';
import Toast from '@/components/Toast';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { useParams, useRouter } from 'next/navigation';
import AlertDialog from '@/components/AlertDialog';
import { SeriesMarker } from 'lightweight-charts';
import TradingDialog from '@/components/Trading/TradingDialog';
import { getRatingColor } from '@/lib/utils';

declare global {
    interface Window {
        electron: {
            ipcRenderer: {
                invoke(channel: string, ...args: any[]): Promise<any>;
            };
        };
    }
}

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
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingNoteValue, setEditingNoteValue] = useState("");
    const [editingTradeId, setEditingTradeId] = useState<number | null>(null);
    const [editingTradeNoteValue, setEditingTradeNoteValue] = useState("");
    const [loading, setLoading] = useState(true);
    const [savingNote, setSavingNote] = useState(false);
    const [logScale, setLogScale] = useState(true); // Default to Log Scale

    // Prompts (Restored)
    const [prompts, setPrompts] = useState<GeminiPrompt[]>([]);
    const [selectedPromptId, setSelectedPromptId] = useState<number | string>("");
    const [copyingPrompt, setCopyingPrompt] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [runningGemini, setRunningGemini] = useState(false);

    // Reports (New)
    // Reports (New)
    const [refreshingAnalysis, setRefreshingAnalysis] = useState(false);
    const [isTradingOpen, setIsTradingOpen] = useState(false);
    const [showAlertDialog, setShowAlertDialog] = useState(false);
    const [initialAlertCondition, setInitialAlertCondition] = useState<AlertCondition | undefined>(undefined);

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

            // Restore last selected prompt
            const lastId = localStorage.getItem('lastSelectedPromptId');
            if (p && p.length > 0) {
                if (lastId && p.find(item => item.id.toString() === lastId)) {
                    setSelectedPromptId(lastId);
                } else {
                    setSelectedPromptId(p[0].id.toString());
                }
            }

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

    async function handleRunGemini() {
        if (!stock || !selectedPromptId) return;

        const pData = prompts.find(p => p.id === Number(selectedPromptId));
        if (!pData) return;

        // Removed confirmation dialog
        // if (!confirm("プロンプトを実行してGeminiで生成しますか？\n(約20-30秒かかります)")) return;

        setRunningGemini(true);
        setToastMsg("Geminiで生成中... (約20-30秒)"); // Show start toast

        try {
            let content = pData.content;
            // Basic vars
            content = content.replace(/%SYMBOL%/g, stock.symbol);
            content = content.replace(/%COMPANYNAME%/g, stock.company_name);
            content = content.replace(/%DATE%/g, new Date().toISOString().split('T')[0]);

            // Stock Data
            if (content.includes('%STOCKDATA%')) {
                const h = await fetchStockPriceHistory(stock.symbol, 100);
                if (h && h.length > 0) {
                    const header = Object.keys(h[0]).join(',') + "\n";
                    const rows = h.map(row => Object.values(row).join(',')).join("\n");
                    content = content.replace(/%STOCKDATA%/g, header + rows);
                } else {
                    content = content.replace(/%STOCKDATA%/g, "No Data");
                }
            }

            const text = await generateText(content);

            // Append to note
            const timestamp = new Date().toLocaleString();
            // Removed header, added timestamp at end
            const newNote = note ? (note + "\n\n" + text + "\n(" + timestamp + ")") : (text + "\n(" + timestamp + ")");

            setNote(newNote);
            await saveStockNote(stock.symbol, newNote);
            setLastSavedNote(newNote);
            setToastMsg("メモに追記しました"); // Success toast

        } catch (e) {
            console.error(e);
            setToastMsg("Geminiエラー: " + e); // Error toast
        } finally {
            setRunningGemini(false);
        }
    }

    async function handleRefreshAnalysis() {
        if (!stock) return;
        setRefreshingAnalysis(true);
        try {
            const a = await fetchStockAnalysis(stock.symbol);
            setAnalysis(a);
            setToastMsg('レポートを更新しました');
        } catch (e) {
            console.error(e);
            alert("更新に失敗しました: " + e);
        } finally {
            setRefreshingAnalysis(false);
        }
    }

    async function handleVisualAnalysis() {
        if (!stock) return;
        if (!confirm("チャート画像分析を実行しますか？\n(Beta: Gemini Pro Visionを使用)")) return;

        setRefreshingAnalysis(true);
        setToastMsg("画像分析を実行中... (チャートの生成とアップロードを行っています)");
        try {
            await triggerVisualAnalysis(stock.symbol);
            setToastMsg("分析が完了しました");
            // Reload analysis list
            const a = await fetchStockAnalysis(stock.symbol);
            setAnalysis(a);
        } catch (e) {
            console.error(e);
            alert("分析に失敗しました: " + e);
        } finally {
            setRefreshingAnalysis(false);
        }
    }

    const handleTradeNoteSave = async (tradeId: number) => {
        try {
            await updateTradeNote(tradeId, editingTradeNoteValue);
            // Refresh history
            const hist = await fetchStockHistory(params.symbol as string);
            setHistory(hist);
        } catch (e) {
            console.error("Failed to save trade note", e);
            alert("メモの保存に失敗しました");
        } finally {
            setEditingTradeId(null);
        }
    };

    // Process markers from history (aggregated by date)
    const markers: SeriesMarker<string>[] = (() => {
        const grouped: Record<string, { type: string, qty: number, totalVal: number }> = {};
        history.forEach(h => {
            const d = new Date(h.trade_date);
            const timeStr = d.toISOString().split('T')[0];
            const key = timeStr + "_" + h.trade_type;
            if (!grouped[key]) grouped[key] = { type: h.trade_type, qty: 0, totalVal: 0 };
            grouped[key].qty += h.quantity;
            grouped[key].totalVal += (h.quantity * h.price);
        });

        const combinedMarkers = Object.entries(grouped).map(([key, val]) => {
            const [timeStr, type] = key.split('_');
            const avgPrice = val.qty > 0 ? (val.totalVal / val.qty) : 0;
            return {
                time: timeStr,
                position: (type === '買い' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar' | 'inBar',
                color: type === '買い' ? '#ef4444' : '#3b82f6',
                shape: (type === '買い' ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown' | 'circle' | 'square',
                text: (type === '買い' ? 'Buy' : 'Sell') + " @" + avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            };
        });

        // Add Earnings Markers
        if (stock) {
            // Get last chart date to prevent future markers
            const lastChartDate = chartDataDaily.length > 0 ? chartDataDaily[chartDataDaily.length - 1].time : null;

            if (stock.last_earnings_date) {
                const d = new Date(stock.last_earnings_date);
                if (!isNaN(d.getTime())) {
                    const dateStr = d.toISOString().split('T')[0];
                    // Only show if <= last chart date
                    if (lastChartDate && dateStr <= lastChartDate) {
                        combinedMarkers.push({
                            time: dateStr,
                            position: 'aboveBar',
                            color: '#d946ef', // fuchsia-500 (Magenta)
                            shape: 'circle',
                            text: 'E (Last)',
                        });
                    }
                }
            }
            if (stock.next_earnings_date) {
                const d = new Date(stock.next_earnings_date);
                if (!isNaN(d.getTime())) {
                    const dateStr = d.toISOString().split('T')[0];
                    // Only show if <= last chart date
                    if (lastChartDate && dateStr <= lastChartDate) {
                        combinedMarkers.push({
                            time: dateStr,
                            position: 'aboveBar',
                            color: '#d946ef', // fuchsia-500 (Magenta)
                            shape: 'circle',
                            text: 'E (Next)',
                        });
                    }
                }
            }
        }

        return combinedMarkers.sort((a, b) => (a.time > b.time ? 1 : -1));
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
            {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg('')} />}
            {/* Sticky Header with Back Link */}
            <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-8 py-4 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold">
                        {stock.symbol}
                        {stock.is_hidden && <span className="text-red-500 text-lg ml-2">(非表示)</span>}
                        <span className="text-lg font-normal text-gray-400 ml-2">{stock.company_name}</span>
                        {/* Buy Mark Toggle */}
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                    const newVal = !stock.is_buy_candidate;
                                    const updated = await updateStock(stock.symbol, { is_buy_candidate: newVal });
                                    // Ensure we merge the update fully
                                    setStock(prev => prev ? { ...prev, ...updated, is_buy_candidate: newVal } : null);

                                    // Also show toast or log for feedback
                                    console.log("Buy candidate updated:", newVal);
                                } catch (e) {
                                    console.error("Failed to update buy mark", e);
                                    alert(t('failedToUpdate'));
                                }
                            }}
                            className="ml-3 focus:outline-none"
                            title={t('toggleBuyCandidate') || 'Toggle Buy Candidate'}
                        >
                            <span className={`text-2xl ${stock.is_buy_candidate ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}>
                                ★
                            </span>
                        </button>
                    </h1>
                    {stock.asset_type !== 'index' && (
                        <>
                            <span className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-300 border border-gray-700 hover:bg-gray-700 transition-colors cursor-default" title={t('sector') || 'Sector'}>{stock.sector}</span>
                            <span className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-400 border border-gray-700 hover:bg-gray-700 transition-colors cursor-default" title={t('industry') || 'Industry'}>{stock.industry}</span>
                            {/* Display Triggered Signals */}
                            {Object.entries(signals || {}).filter(([_, val]) => val === 1).map(([key, _]) => (
                                <span key={key} className="px-3 py-1 bg-green-900/50 text-green-400 border border-green-700/50 rounded text-sm font-bold uppercase">
                                    {SIGNAL_LABELS["signal_" + key] || key.replace(/_/g, ' ')}
                                </span>
                            ))}
                        </>
                    )}

                    {/* First Import Date Badge */}
                    {stock.asset_type !== 'index' && stock.first_import_date && (
                        <span className="px-3 py-1 bg-gray-800 text-gray-400 border border-gray-700/50 rounded text-sm" title={t('importedAt') || 'First Import Date'}>
                            📅 {new Date(stock.first_import_date).toLocaleDateString()}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <a
                        href={"https://research.investors.com/ibdchartsenlarged.aspx?symbol=" + stock.symbol}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-80 hover:opacity-100 transition"
                        title="IBDチャート"
                    >
                        <span className="text-sm bg-yellow-600 text-white px-2 py-1 rounded font-bold">I</span>
                    </a >
                    <a
                        href={"https://www.tradingview.com/chart/?symbol=" + stock.symbol}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-80 hover:opacity-100 transition mr-4"
                        title="TradingView"
                    >
                        <span className="text-sm bg-blue-600 text-white px-2 py-1 rounded font-bold">T</span>
                    </a>

                    {/* Trade button hidden as OpenD is not available in JP
                    <button
                        onClick={() => setIsTradingOpen(true)}
                        className="opacity-80 hover:opacity-100 transition mr-4 bg-green-700 text-white px-3 py-1 rounded font-bold text-sm border border-green-600 flex items-center gap-1"
                        title="Trade"
                    >
                        <span>$</span> Trade
                    </button>
                    */}

                    <button
                        onClick={() => {
                            addResearchTicker(stock.symbol);
                            setToastMsg(t('addedToResearch').replace('{{symbol}}', stock.symbol));
                        }}
                        className="opacity-80 hover:opacity-100 transition mr-4"
                        title={t('addToDeepResearch')}
                    >
                        <span className="text-sm bg-purple-600 text-white px-2 py-1 rounded font-bold">🧠</span>
                    </button>

                    {/* Alert Button */}
                    <button
                        onClick={() => setShowAlertDialog(true)}
                        className="opacity-80 hover:opacity-100 transition mr-4"
                        title="Set Alert"
                    >
                        <span className="text-sm bg-gray-700 text-white px-2 py-1 rounded font-bold">🔔</span>
                    </button>

                    <div className="mr-4">
                        <input
                            type="text"
                            placeholder="銘柄移動..."
                            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500 w-28 placeholder-gray-500 uppercase font-mono"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = e.currentTarget.value.trim().toUpperCase();
                                    if (val) router.push("/stocks/" + val);
                                }
                            }}
                        />
                    </div>

                    <Link
                        href="/"
                        className="text-gray-400 hover:text-white font-bold flex items-center gap-2 mr-4"
                    >
                        {t('backToDashboard')} &rarr;
                    </Link>

                    {/* Delete Button (Far Right) */}
                    <button
                        onClick={async () => {
                            if (!stock) return;
                            try {
                                const newVal = !stock.is_hidden;
                                const updated = await updateStock(stock.symbol, { is_hidden: newVal });
                                setStock(prev => prev ? { ...prev, ...updated } : null);
                            } catch (e) {
                                alert('Failed to update hidden status');
                            }
                        }}
                        className={"px-3 py-1 border transition-colors rounded text-sm font-bold ml-4 " + (stock.is_hidden ? "bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600" : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700")}
                        title={stock.is_hidden ? '再表示する' : '隠す'}
                    >
                        {stock.is_hidden ? 'Show' : 'Hide'}
                    </button>

                    <button
                        onClick={async () => {
                            if (confirm(t('confirmDeleteStock') || "Are you sure you want to delete " + stock.symbol + "?")) {
                                try {
                                    await deleteStock(stock.symbol);
                                    router.push('/');
                                } catch (e) {
                                    alert('Failed to delete');
                                }
                            }
                        }}
                        className="px-3 py-1 bg-red-900/50 text-red-400 border border-red-700 hover:bg-red-800 transition-colors rounded text-sm font-bold ml-4"
                    >
                        {t('delete') || 'Delete'}
                    </button>
                </div >
            </div >

            {/* Content Grid */}
            {/* Content Grid */}
            <div className="space-y-6 px-8 mt-4">
                {/* Compact Dashboard Metrics Summary */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 items-center bg-gray-800 rounded-xl px-4 py-2 border border-gray-700 text-xs shadow-sm">
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

                            <div className="hidden md:block w-px h-3 bg-gray-600"></div>

                            {/* P&L */}
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">{t('totalPL')}:</span>
                                <span className={"font-bold font-mono " + ((stock.realized_pl || 0) > 0 ? "text-red-400" : (stock.realized_pl || 0) < 0 ? "text-blue-400" : "text-gray-300")}>
                                    {stock.realized_pl ? (stock.realized_pl > 0 ? "+" : "") + stock.realized_pl.toLocaleString() : "-"}
                                </span>
                            </div>

                            <div className="hidden md:block w-px h-3 bg-gray-600"></div>

                            {/* IBD Ratings (Compact - BEFORE Flags) */}
                            <div className="flex items-center gap-2">
                                <EditableNumber
                                    label="CR"
                                    initialValue={stock.composite_rating}
                                    onSave={async (val) => {
                                        const updated = await updateStock(stock.symbol, { composite_rating: val });
                                        setStock(prev => prev ? { ...prev, ...updated } : null);
                                    }}
                                    colorClass={getRatingColor(stock.composite_rating)}
                                />
                                <EditableNumber
                                    label="RS"
                                    initialValue={stock.rs_rating}
                                    onSave={async (val) => {
                                        const updated = await updateStock(stock.symbol, { rs_rating: val });
                                        setStock(prev => prev ? { ...prev, ...updated } : null);
                                    }}
                                    colorClass={getRatingColor(stock.rs_rating)}
                                />
                            </div>

                            <div className="hidden md:block w-px h-3 bg-gray-600"></div>

                        </>
                    )}

                    {/* Changes (Grouped) */}
                    {/* Changes (Grouped) */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1" title={t('marketCap') || 'Market Cap'}>
                            <span className="text-gray-500 text-sm">MC:</span>
                            <span className="font-mono text-sm text-gray-300">
                                {stock.market_cap ? (Number(stock.market_cap) / 1e9).toFixed(2) + " B" : "-"}
                            </span>
                        </div>
                        <div className="hidden md:block w-px h-3 bg-gray-600"></div>

                        <div className="flex items-center gap-1" title={t('volume') || 'Volume'}>
                            <span className="text-gray-500 text-sm">Vol:</span>
                            <span className="font-mono text-sm text-gray-300">
                                {stock.volume ? Number(stock.volume).toLocaleString() : '-'}
                            </span>
                        </div>

                        <div className="flex items-center gap-1" title={t('volumeIncrease' as any) || 'Vol Inc %'}>
                            <span className="text-gray-500 text-sm">出来高増%:</span>
                            <span className={"font-mono text-sm " + ((stock.volume_increase_pct || 0) > 0 ? "text-red-400" : (stock.volume_increase_pct || 0) < 0 ? "text-blue-400" : "text-gray-300")}>
                                {stock.volume_increase_pct ? (stock.volume_increase_pct > 0 ? "+" : "") + stock.volume_increase_pct.toFixed(1) + "%" : "-"}
                            </span>
                        </div>
                        <div className="hidden md:block w-px h-3 bg-gray-600"></div>

                        <div className="flex items-center gap-1" title={t('lastEarnings') || 'Last Earnings'}>
                            <span className="text-gray-500 text-sm">決算(直近):</span>
                            <span className="font-mono text-sm text-gray-300">
                                {stock.last_earnings_date ? new Date(stock.last_earnings_date).toISOString().split('T')[0] : '-'}
                            </span>
                        </div>

                        <div className="flex items-center gap-1" title={t('nextEarnings') || 'Next Earnings'}>
                            <span className="text-gray-500 text-sm">決算(次回):</span>
                            <span className="font-mono text-sm text-gray-300">
                                {stock.next_earnings_date ? new Date(stock.next_earnings_date).toISOString().split('T')[0] : '-'}
                            </span>
                        </div>
                        <div className="hidden md:block w-px h-3 bg-gray-600"></div>



                        <div className="flex items-center gap-1" title="前日比">
                            <span className="text-gray-500 text-sm">前日比:</span>
                            <span className={"font-mono text-sm " + ((stock.change_percentage_1d || 0) > 0 ? "text-red-400" : (stock.change_percentage_1d || 0) < 0 ? "text-blue-400" : "text-gray-400")}>
                                {stock.change_percentage_1d ? (stock.change_percentage_1d > 0 ? "+" : "") + stock.change_percentage_1d.toFixed(1) + "%" : "-"}
                            </span>
                        </div>
                        <div className="flex items-center gap-1" title={t('change5d')}>
                            <span className="text-gray-500 text-sm">5日比:</span>
                            <span className={"font-mono text-sm " + ((stock.change_percentage_5d || 0) > 0 ? "text-red-400" : (stock.change_percentage_5d || 0) < 0 ? "text-blue-400" : "text-gray-400")}>
                                {stock.change_percentage_5d ? (stock.change_percentage_5d > 0 ? "+" : "") + stock.change_percentage_5d.toFixed(1) + "%" : "-"}
                            </span>
                        </div>
                        <div className="flex items-center gap-1" title={t('change20d')}>
                            <span className="text-gray-500 text-sm">20日比:</span>
                            <span className={"font-mono text-sm " + ((stock.change_percentage_20d || 0) > 0 ? "text-red-400" : (stock.change_percentage_20d || 0) < 0 ? "text-blue-400" : "text-gray-400")}>
                                {stock.change_percentage_20d ? (stock.change_percentage_20d > 0 ? "+" : "") + stock.change_percentage_20d.toFixed(1) + "%" : "-"}
                            </span>
                        </div>
                        <div className="flex items-center gap-1" title={t('change50d')}>
                            <span className="text-gray-500 text-sm">50日比:</span>
                            <span className={"font-mono text-sm " + ((stock.change_percentage_50d || 0) > 0 ? "text-red-400" : (stock.change_percentage_50d || 0) < 0 ? "text-blue-400" : "text-gray-400")}>
                                {stock.change_percentage_50d ? (stock.change_percentage_50d > 0 ? "+" : "") + stock.change_percentage_50d.toFixed(1) + "%" : "-"}
                            </span>
                        </div>
                        <div className="flex items-center gap-1" title={t('change200d')}>
                            <div className="flex items-center gap-1" title="ATR (14日)">
                                <span className="text-gray-500 text-sm">ATR(14):</span>
                                <span className="font-mono text-gray-300 text-sm">
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

                        {/* SMA Deviations */}
                        <div className="flex items-center gap-4 border-l border-gray-600 pl-4 sm:ml-4 mt-2 sm:mt-0">
                            <div className="flex items-center gap-1" title="乖離率 (5日)">
                                <span className="text-gray-500 font-mono text-sm">{t('dev5')}:</span>
                                <span className={"font-mono text-sm " + ((stock.deviation_5ma_pct || 0) > 0 ? "text-red-400" : (stock.deviation_5ma_pct || 0) < 0 ? "text-blue-400" : "text-gray-400")}>
                                    {stock.deviation_5ma_pct ? (stock.deviation_5ma_pct > 0 ? "+" : "") + stock.deviation_5ma_pct.toFixed(2) + "%" : "-"}
                                </span>
                            </div>
                            <div className="flex items-center gap-1" title="乖離率 (20日)">
                                <span className="text-gray-500 font-mono text-sm">{t('dev20')}:</span>
                                <span className={"font-mono text-sm " + ((stock.deviation_20ma_pct || 0) > 0 ? "text-red-400" : (stock.deviation_20ma_pct || 0) < 0 ? "text-blue-400" : "text-gray-400")}>
                                    {stock.deviation_20ma_pct ? (stock.deviation_20ma_pct > 0 ? "+" : "") + stock.deviation_20ma_pct.toFixed(2) + "%" : "-"}
                                </span>
                            </div>
                            <div className="flex items-center gap-1" title="乖離率 (50日)">
                                <span className="text-gray-500 font-mono text-sm">{t('dev50')}:</span>
                                <span className={"font-mono text-sm " + ((stock.deviation_50ma_pct || 0) > 0 ? "text-red-400" : (stock.deviation_50ma_pct || 0) < 0 ? "text-blue-400" : "text-gray-400")}>
                                    {stock.deviation_50ma_pct ? (stock.deviation_50ma_pct > 0 ? "+" : "") + stock.deviation_50ma_pct.toFixed(2) + "%" : "-"}
                                </span>
                            </div>
                            <div className="flex items-center gap-1" title="乖離率 (200日)">
                                <span className="text-gray-500 font-mono text-sm">{t('dev200')}:</span>
                                <span className={"font-mono text-sm " + ((stock.deviation_200ma_pct || 0) > 0 ? "text-red-400" : (stock.deviation_200ma_pct || 0) < 0 ? "text-blue-400" : "text-gray-400")}>
                                    {stock.deviation_200ma_pct ? (stock.deviation_200ma_pct > 0 ? "+" : "") + stock.deviation_200ma_pct.toFixed(2) + "%" : "-"}
                                </span>
                            </div>
                        </div>
                        {/* MA Slopes */}
                        <div className="flex items-center gap-4 border-l border-gray-600 pl-4 sm:ml-4 mt-2 sm:mt-0">
                            <div className="flex items-center gap-1" title="傾き (5日)">
                                <span className="text-gray-500 font-mono text-sm">傾き(5):</span>
                                <span className={"font-mono text-sm " + ((stock.slope_5ma || 0) > 0 ? "text-red-400" : (stock.slope_5ma || 0) < 0 ? "text-blue-400" : "text-gray-400")}>
                                    {stock.slope_5ma ? (stock.slope_5ma > 0 ? "+" : "") + stock.slope_5ma.toFixed(2) : "-"}
                                </span>
                            </div>
                            <div className="flex items-center gap-1" title="傾き (20日)">
                                <span className="text-gray-500 font-mono text-sm">傾き(20):</span>
                                <span className={"font-mono text-sm " + ((stock.slope_20ma || 0) > 0 ? "text-red-400" : (stock.slope_20ma || 0) < 0 ? "text-blue-400" : "text-gray-400")}>
                                    {stock.slope_20ma ? (stock.slope_20ma > 0 ? "+" : "") + stock.slope_20ma.toFixed(2) : "-"}
                                </span>
                            </div>
                            <div className="flex items-center gap-1" title="傾き (50日)">
                                <span className="text-gray-500 font-mono text-sm">傾き(50):</span>
                                <span className={"font-mono text-sm " + ((stock.slope_50ma || 0) > 0 ? "text-red-400" : (stock.slope_50ma || 0) < 0 ? "text-blue-400" : "text-gray-400")}>
                                    {stock.slope_50ma ? (stock.slope_50ma > 0 ? "+" : "") + stock.slope_50ma.toFixed(2) : "-"}
                                </span>
                            </div>
                            <div className="flex items-center gap-1" title="傾き (200日)">
                                <span className="text-gray-500 font-mono text-sm">傾き(200):</span>
                                <span className={"font-mono text-sm " + ((stock.slope_200ma || 0) > 0 ? "text-red-400" : (stock.slope_200ma || 0) < 0 ? "text-blue-400" : "text-gray-400")}>
                                    {stock.slope_200ma ? (stock.slope_200ma > 0 ? "+" : "") + stock.slope_200ma.toFixed(2) : "-"}
                                </span>
                            </div>
                        </div>
                    </div>








                    {/* Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-full">
                        {/* Charts Column - Stacks vertically but takes 2/3 width */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Daily Chart */}
                            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold text-gray-300">{t('priceChart')} ({t('dailyChart')})</h2>
                                    <div className="flex items-center gap-2">
                                        <span className={"text-xs " + (logScale ? "text-blue-400 font-bold" : "text-gray-500")}>対数</span>
                                        <button
                                            onClick={() => setLogScale(!logScale)}
                                            className={"w-10 h-5 flex items-center bg-gray-700 rounded-full p-1 duration-300 ease-in-out " + (logScale ? "bg-blue-600" : "")}
                                        >
                                            <div className={"bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ease-in-out " + (logScale ? "translate-x-5" : "")}></div>
                                        </button>
                                    </div>
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
                                            interval="1d"
                                            logScale={logScale}
                                            onChartDoubleClick={(price) => {
                                                const current = stock.current_price || 0;
                                                const op = price >= current ? 'gte' : 'lte';
                                                setInitialAlertCondition({ metric: 'current_price', op: op, value: Number(price.toFixed(2)) });
                                                setShowAlertDialog(true);
                                            }}
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
                                            interval="1wk"
                                            logScale={logScale}
                                            onChartDoubleClick={(price) => {
                                                const current = stock.current_price || 0;
                                                const op = price >= current ? 'gte' : 'lte';
                                                setInitialAlertCondition({ metric: 'current_price', op: op, value: Number(price.toFixed(2)) });
                                                setShowAlertDialog(true);
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="h-[300px] flex items-center justify-center text-gray-600">{t('noChartData')}</div>
                                )}
                            </div>


                        </div>

                        <div>
                            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 h-full flex flex-col min-h-[400px]">
                                <h2 className="text-xl font-bold mb-4 text-gray-300">{t('myNotes')}</h2>
                                <textarea
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-gray-300 focus:border-blue-500 focus:outline-none h-48 mb-4 resize-none text-[14pt] leading-relaxed"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                                <button
                                    onClick={handleSaveNote}
                                    disabled={savingNote || note === lastSavedNote}
                                    className={"w-full py-2 rounded font-bold transition " + (savingNote || note === lastSavedNote ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white")}
                                >
                                    {savingNote ? t('loading') : t('saveNote')}
                                </button>

                                <div className="mt-8 pt-8 border-t border-gray-700 flex-1">
                                    {stock.asset_type !== 'index' && (
                                        <>
                                            <div className="mb-4">
                                                {/* Prompt Selector (Added back by request) */}
                                                {stock.asset_type !== 'index' && (
                                                    <div className="flex items-center gap-2 mb-2 p-2 bg-gray-900 rounded border border-gray-700">
                                                        <select
                                                            value={selectedPromptId}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setSelectedPromptId(val);
                                                                localStorage.setItem('lastSelectedPromptId', val);
                                                            }}
                                                            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500 flex-1 w-full"
                                                        >
                                                            {prompts.map(p => (
                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={handleCopyPrompt}
                                                            disabled={copyingPrompt || !selectedPromptId}
                                                            className="px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded text-white font-bold text-xs disabled:opacity-50 transition min-w-[30px]"
                                                            title="Copy Prompt"
                                                        >
                                                            {copyingPrompt ? '...' : '📋'}
                                                        </button>
                                                        <button
                                                            onClick={handleRunGemini}
                                                            disabled={runningGemini || !selectedPromptId}
                                                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white font-bold text-xs disabled:opacity-50 transition min-w-[30px]"
                                                            title="Run Gemini & Insert"
                                                        >
                                                            {runningGemini ? '...' : '✨'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex justify-between items-center mb-4">
                                                <h2 className="text-xl font-bold text-gray-300">AI生成レポート分析</h2>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleVisualAnalysis}
                                                        disabled={refreshingAnalysis}
                                                        className="text-xs px-2 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded text-white font-bold transition flex items-center gap-1 shadow-lg border border-purple-500/50"
                                                        title="Backendでチャート画像を生成しGemini Pro Visionで分析します"
                                                    >
                                                        👁️ Pro Vision分析
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            const path = await pickFile();
                                                            if (path) {
                                                                const updated = await updateStock(stock.symbol, { analysis_file_path: path });
                                                                setStock(prev => prev ? { ...prev, ...updated } : null);
                                                            }
                                                        }}
                                                        className="text-xs px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded text-gray-300 transition border border-blue-600"
                                                    >
                                                        ファイルを紐付ける 📎
                                                    </button>
                                                    {stock.analysis_file_path && (
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm('紐付けを解除しますか？')) {
                                                                    const updated = await updateStock(stock.symbol, { analysis_file_path: "" }); // Send empty string to clear
                                                                    setStock(prev => prev ? { ...prev, ...updated, analysis_file_path: undefined } : null);
                                                                }
                                                            }}
                                                            className="text-xs px-2 py-1 bg-red-900/50 hover:bg-red-800/50 rounded text-red-300 transition border border-red-800"
                                                        >
                                                            解除 ✕
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={handleRefreshAnalysis}
                                                        disabled={refreshingAnalysis}
                                                        className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition"
                                                    >
                                                        {refreshingAnalysis ? '更新中...' : '再読み込み 🔄'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Linked File Display (Priority) */}
                                            {stock.analysis_file_path && (
                                                <div className="mb-4 p-4 bg-blue-900/20 rounded border border-blue-700/50">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <div className="text-xs text-blue-400 font-bold mb-1">🔗 手動紐付けファイル</div>
                                                            <div className="text-sm text-gray-300 break-all">{stock.analysis_file_path}</div>
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await openFile(stock.analysis_file_path!);
                                                                } catch (e) {
                                                                    alert(t('failedToOpenFile') + ": " + e);
                                                                }
                                                            }}
                                                            className="text-xs bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-500 transition font-bold whitespace-nowrap ml-4 shadow-lg"
                                                        >
                                                            開く 📄
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {analysis.length > 0 ? (
                                                <div className="space-y-4 max-h-[300px] overflow-y-auto">
                                                    {analysis.map((a) => (
                                                        <div key={a.id} className="p-4 bg-gray-900 rounded border border-gray-700 relative group">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</div>
                                                                <div className="flex gap-2">
                                                                    {a.file_path && (
                                                                        <button
                                                                            onClick={async () => {
                                                                                try {
                                                                                    await openFile(a.file_path!);
                                                                                } catch (e) {
                                                                                    alert(t('failedToOpenFile') + ": " + e);
                                                                                }
                                                                            }}
                                                                            className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded hover:bg-blue-800 transition border border-blue-800"
                                                                        >
                                                                            Google Docを開く 📄
                                                                        </button>
                                                                    )}
                                                                    {/* Delete Button (Only for DB results with positive ID) */}
                                                                    {a.id && a.id > 0 && (
                                                                        <button
                                                                            onClick={async () => {
                                                                                if (!confirm("この分析結果を削除しますか？")) return;
                                                                                try {
                                                                                    await deleteAnalysisResult(stock.symbol, a.id);
                                                                                    setAnalysis(analysis.filter(item => item.id !== a.id));
                                                                                } catch (e) {
                                                                                    alert("Delete Failed: " + e);
                                                                                }
                                                                            }}
                                                                            className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded hover:bg-red-800 transition border border-red-800 opacity-0 group-hover:opacity-100"
                                                                            title="削除"
                                                                        >
                                                                            🗑️
                                                                        </button>
                                                                    )}
                                                                </div>
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
                                        <h2 className="text-xl font-bold mb-4 text-gray-300">売買履歴</h2>
                                        {history.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left text-gray-400">
                                                    <thead className="text-xs text-gray-300 uppercase bg-gray-700">
                                                        <tr>
                                                            <th scope="col" className="px-4 py-3">日付</th>
                                                            <th scope="col" className="px-4 py-3">売買</th>
                                                            <th scope="col" className="px-4 py-3">数量</th>
                                                            <th scope="col" className="px-4 py-3">価格</th>
                                                            <th scope="col" className="px-4 py-3">受渡金額</th>
                                                            <th scope="col" className="px-4 py-3">損益</th>
                                                            <th scope="col" className="px-4 py-3">メモ</th>
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
                                                                id: number,
                                                                note: string | null
                                                            }> = {};

                                                            historyWithPL.forEach(trade => {
                                                                const d = new Date(trade.trade_date);
                                                                const dateKey = d.toLocaleDateString();
                                                                const key = dateKey + "_" + trade.trade_type;

                                                                if (!grouped[key]) {
                                                                    grouped[key] = {
                                                                        date: dateKey,
                                                                        side: trade.trade_type,
                                                                        qty: 0,
                                                                        totalVal: 0,
                                                                        totalPL: 0,
                                                                        id: trade.id,
                                                                        note: trade.note || null
                                                                    };
                                                                }

                                                                grouped[key].qty += trade.quantity;
                                                                grouped[key].totalVal += (trade.quantity * trade.price);
                                                                grouped[key].totalPL += (trade.realized_pl || 0);
                                                                // If multiple trades on same day/type, keep the latest note or concatenate
                                                                if (trade.note) {
                                                                    grouped[key].note = trade.note || null;
                                                                }
                                                            });

                                                            // 3. Sort DESC for display
                                                            const finalSorted = Object.values(grouped).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                                            return finalSorted.map((g) => (
                                                                <tr key={g.id} className="border-b border-gray-700 hover:bg-gray-800">
                                                                    <td className="px-4 py-3">{g.date}</td>
                                                                    <td className={"px-4 py-3 font-bold " + (g.side === '買い' ? "text-blue-400" : "text-red-400")}>
                                                                        {g.side === '買い' ? t('buy') : t('sell')}
                                                                    </td>
                                                                    <td className="px-4 py-3">{g.qty.toLocaleString()}</td>
                                                                    <td className="px-4 py-3">{(g.totalVal / g.qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                    <td className="px-4 py-3">{g.totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                    <td className={"px-4 py-3 font-bold " + (g.totalPL > 0 ? "text-red-400" : g.totalPL < 0 ? "text-blue-400" : "text-gray-500")}>
                                                                        {g.side === '売り' ? g.totalPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        {editingTradeId === g.id ? (
                                                                            <input
                                                                                type="text"
                                                                                value={editingTradeNoteValue}
                                                                                onChange={(e) => setEditingTradeNoteValue(e.target.value)}
                                                                                onBlur={() => handleTradeNoteSave(g.id)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                                                        e.preventDefault();
                                                                                        handleTradeNoteSave(g.id);
                                                                                    }
                                                                                    if (e.key === 'Escape') setEditingTradeId(null);
                                                                                }}
                                                                                autoFocus
                                                                                className="bg-gray-700 text-white p-1 rounded w-full border border-blue-500 outline-none"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            />
                                                                        ) : (
                                                                            <div
                                                                                onDoubleClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setEditingTradeId(g.id);
                                                                                    setEditingTradeNoteValue(g.note || "");
                                                                                }}
                                                                                className="cursor-text min-h-[20px] hover:bg-gray-700/50 p-1 rounded transition max-w-[200px] truncate"
                                                                            >
                                                                                {g.note || <span className="text-gray-600 text-xs italic">No Note</span>}
                                                                            </div>
                                                                        )}
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
                {/* Content Grid */}
                <TradingDialog
                    isOpen={isTradingOpen}
                    onClose={() => setIsTradingOpen(false)}
                    initialSymbol={stock.symbol}
                />

                <AlertDialog
                    isOpen={showAlertDialog}
                    onClose={() => {
                        setShowAlertDialog(false);
                        setInitialAlertCondition(undefined);
                    }}
                    targetSymbol={stock?.symbol}
                    initialCondition={initialAlertCondition}
                    onSuccess={() => alert("アラートを作成しました")}
                />
            </div>
        </main >
    );
}

function EditableNumber({ label, initialValue, onSave, colorClass }: { label: string, initialValue?: number, onSave: (val: number) => Promise<void>, colorClass: string }) {
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
            <span className={"font-bold text-lg " + colorClass}>{initialValue || '-'}</span>
        </div>
    );
}
