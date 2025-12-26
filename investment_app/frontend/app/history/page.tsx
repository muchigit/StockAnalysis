"use client";

import { useEffect, useState, useMemo } from 'react';
import { fetchHistoryAnalytics, HistoryAnalytics, TradeHistory, updateTradeNote } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import Link from 'next/link';
import HeaderFilter, { ColumnFilterValue } from '@/components/HeaderFilter';
import SortIcon from '@/components/SortIcon';
import ColumnManager from '@/components/ColumnManager';

export default function HistoryPage() {
    const { t } = useTranslation();
    const [data, setData] = useState<HistoryAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingTradeId, setEditingTradeId] = useState<number | null>(null);
    const [editingNoteValue, setEditingNoteValue] = useState("");

    // Column Manager State
    const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
    const [selectedViewId, setSelectedViewId] = useState<string>("");

    // Filter & Sort State
    const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterValue>>({});
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleColumnFilterChange = (key: string, value: ColumnFilterValue | null) => {
        setColumnFilters(prev => {
            const next = { ...prev };
            if (value === null) {
                delete next[key];
            } else {
                next[key] = value;
            }
            return next;
        });
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetchHistoryAnalytics();
            setData(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Column Definitions
    const COLUMNS = useMemo(() => [
        { k: 'date', label: '日付', type: 'date' as const },
        { k: 'symbol', label: '銘柄', type: 'string' as const },
        { k: 'company_name', label: '会社名', type: 'string' as const },
        { k: 'type', label: 'タイプ', type: 'string' as const },
        { k: 'qty', label: '数量', type: 'number' as const, align: 'right' },
        { k: 'price', label: '価格', type: 'number' as const, align: 'right' },
        { k: 'amount', label: '金額', type: 'number' as const, align: 'right' },
        { k: 'pl', label: '損益(P&L)', type: 'number' as const, align: 'right' },
        { k: 'roi', label: 'ROI', type: 'number' as const, align: 'right' },
        // New Metrics
        { k: 'return_1d', label: '翌日', type: 'number' as const, align: 'right' },
        { k: 'return_5d', label: '5日後', type: 'number' as const, align: 'right' },
        { k: 'return_20d', label: '20日後', type: 'number' as const, align: 'right' },
        { k: 'return_50d', label: '50日後', type: 'number' as const, align: 'right' },
        { k: 'note', label: 'メモ', type: 'string' as const, width: 200 },
    ], []);

    // Set initial visible columns
    useEffect(() => {
        if (visibleColumns.length === 0) {
            setVisibleColumns(COLUMNS.map(c => c.k));
        }
    }, [COLUMNS]);

    const handleNoteDoubleClick = (trade: TradeHistory) => {
        setEditingTradeId(trade.id);
        setEditingNoteValue(trade.note || "");
    };

    const handleNoteSave = async (tradeId: number) => {
        if (!data) return;
        try {
            await updateTradeNote(tradeId, editingNoteValue);
            // Update local state
            const updatedHistory = data.history.map(h =>
                h.id === tradeId ? { ...h, note: editingNoteValue } : h
            );
            setData({ ...data, history: updatedHistory });
        } catch (e) {
            console.error("Failed to save note", e);
            alert("メモの保存に失敗しました");
        } finally {
            setEditingTradeId(null);
        }
    };

    const handleNoteKeyDown = (e: React.KeyboardEvent, tradeId: number) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleNoteSave(tradeId);
        }
        if (e.key === 'Escape') {
            setEditingTradeId(null);
        }
    };


    // Monthly P&L Filter Handler
    const handleMonthClick = (monthStr: string) => {
        const [year, month] = monthStr.split('-').map(Number);
        if (!year || !month) return;

        const endDate = new Date(year, month, 0);
        const mStr = month < 10 ? `0${month}` : month;
        const lastDay = endDate.getDate();
        const dStr = lastDay < 10 ? `0${lastDay}` : lastDay;

        const startStr = `${year}-${mStr}-01`;
        const endStr = `${year}-${mStr}-${dStr}`;

        setColumnFilters(prev => ({
            ...prev,
            date: {
                type: 'date',
                startDate: startStr,
                endDate: endStr
            }
        }));
    };

    // --- Hooks must run unconditionally ---
    // Flatten history for display
    const aggregatedHistory = useMemo(() => {
        if (!data) return [];
        return data.history;
    }, [data]);

    // Apply Filters & Sort
    const processedHistory = useMemo(() => {
        let result = [...aggregatedHistory];

        // Reset Logic to be handled in effect or simply derive checking length?
        // Actually, better to reset page in useEffect.

        // Filter
        // Filter
        Object.entries(columnFilters).forEach(([key, filterVal]) => {
            const val = filterVal as any;
            const value = val.value;
            const mode = val.mode;

            if (value === undefined || value === null || value === '') return;

            result = result.filter(item => {
                let itemVal: any;
                // Map key to item property
                if (key === 'date') itemVal = new Date(item.trade_date).getTime();
                else if (key === 'symbol') itemVal = item.symbol;
                else if (key === 'company_name') itemVal = item.company_name;
                else if (key === 'type') itemVal = item.trade_type;
                else if (key === 'qty') itemVal = item.quantity;
                else if (key === 'price') itemVal = item.price;
                else if (key === 'amount') itemVal = (item.price * item.quantity) + (item.system_fee || 0) + (item.tax || 0);
                else if (key === 'pl') itemVal = item.realized_pl || 0;
                else if (key === 'roi') itemVal = item.roi_pct || 0;
                else if (key === 'return_1d') itemVal = item.return_1d;
                else if (key === 'return_5d') itemVal = item.return_5d;
                else if (key === 'return_20d') itemVal = item.return_20d;
                else if (key === 'return_50d') itemVal = item.return_50d;
                else if (key === 'note') itemVal = item.note || '';
                else return true; // If key not mapped, don't filter

                if (itemVal === undefined || itemVal === null) {
                    return mode === 'empty';
                }

                // If 'value' is actually an object from HeaderFilter { value, mode } ??
                // Wait, HeaderFilter returns { value: string, mode: string }. columnFilters values ARE that object.
                // The issue "Property 'value' does not exist on ColumnFilterValue" implies ColumnFilterValue might be defined as just string/number or something else.
                // Let's check HeaderFilter definition. But for now, let's fix the logic assuming it works or cast.

                // Assuming ColumnFilterValue IS { value: any, mode: string }
                // We will cast to any to bypass TS error for now if ColumnFilterValue is imported and opaque.
                const filterValAny = filterVal as any;
                const v = filterValAny.value;
                const m = filterValAny.mode;

                if (m === 'equals') return String(itemVal) === String(v);
                if (m === 'contains') return String(itemVal).toLowerCase().includes(String(v).toLowerCase());
                if (m === 'greater') return Number(itemVal) >= Number(v);
                if (m === 'less') return Number(itemVal) <= Number(v);
                if (m === 'empty') return itemVal === '' || itemVal === null || itemVal === undefined;
                return true;
            });
        });

        // Sort
        if (sortConfig) {
            result.sort((a, b) => {
                const { key, direction } = sortConfig;
                let valA: any = 0, valB: any = 0;
                const getSortVal = (item: TradeHistory, key: string) => {
                    if (key === 'date') return new Date(item.trade_date).getTime();
                    if (key === 'symbol') return item.symbol;
                    if (key === 'type') return item.trade_type;
                    if (key === 'qty') return item.quantity;
                    if (key === 'price') return item.price;
                    if (key === 'amount') return (item.price * item.quantity) + (item.system_fee || 0) + (item.tax || 0);
                    if (key === 'pl') return item.realized_pl || 0;
                    if (key === 'roi') return item.roi_pct || 0;
                    if (key === 'return_1d') return item.return_1d || -9999;
                    if (key === 'return_5d') return item.return_5d || -9999;
                    if (key === 'return_20d') return item.return_20d || -9999;
                    if (key === 'return_50d') return item.return_50d || -9999;
                    if (key === 'note') return item.note || '';
                    return 0;
                };

                valA = getSortVal(a, key);
                valB = getSortVal(b, key);

                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [aggregatedHistory, columnFilters, sortConfig]);

    // Reset pagination when data changes
    useEffect(() => {
        setCurrentPage(1);
    }, [columnFilters, sortConfig]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return processedHistory.slice(start, start + itemsPerPage);
    }, [processedHistory, currentPage]);

    const totalPages = Math.ceil(processedHistory.length / itemsPerPage);

    const renderReturnCell = (val?: number) => {
        if (val === undefined || val === null) return <span className="text-gray-600">-</span>;
        const color = val > 0 ? 'text-red-400' : val < 0 ? 'text-blue-400' : 'text-gray-400';
        return <span className={`font-mono font-bold ${color}`}>{val > 0 ? '+' : ''}{val.toFixed(2)}%</span>;
    };

    const allColumnsForManager = useMemo(() => COLUMNS.map(c => ({ key: c.k, label: c.label })), [COLUMNS]);
    const displayColumns = useMemo(() => COLUMNS.filter(c => visibleColumns.includes(c.k)), [COLUMNS, visibleColumns]);

    if (loading) return <div className="p-8 text-center text-white font-mono">Loading history...</div>;
    if (!data) return <div className="p-8 text-center text-white font-mono">Failed to load history</div>;

    const renderCellContent = (t: TradeHistory, colKey: string) => {
        const isBuy = t.trade_type === '買い';
        const isSell = t.trade_type === '売り';
        const isTrading = t.trade_type === '売買';

        switch (colKey) {
            case 'date':
                return <span className="font-mono text-gray-400">{new Date(t.trade_date).toLocaleDateString('ja-JP')}</span>;
            case 'symbol':
                return <span className="font-bold">{t.symbol}</span>;
            case 'company_name':
                return <span className="text-gray-400 text-xs">{t.company_name || '-'}</span>;
            case 'type':
                return (
                    <span className={`font-bold ${isBuy ? 'text-red-400' : isSell ? 'text-blue-400' : 'text-yellow-400'}`}>
                        {t.trade_type}
                    </span>
                );
            case 'qty':
                return t.quantity.toLocaleString();
            case 'price':
                return <span className="font-mono text-gray-300">{t.price.toFixed(2)}</span>;
            case 'amount':
                return (
                    <span className="font-mono text-gray-300">
                        {((t.price * t.quantity) + (t.system_fee || 0) + (t.tax || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                );
            case 'pl':
                return (isSell || isTrading) && t.realized_pl !== undefined ? (
                    <span className={`font-mono font-bold ${t.realized_pl >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {t.realized_pl >= 0 ? '+' : ''}{t.realized_pl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                ) : '-';
            case 'roi':
                return (isSell || isTrading) && t.roi_pct !== undefined ? (
                    <div className="flex flex-col items-center">
                        <span className={`font-mono font-bold ${t.roi_pct >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                            {t.roi_pct >= 0 ? '+' : ''}{t.roi_pct.toFixed(1)}%
                        </span>
                    </div>
                ) : '-';
            case 'return_1d': return renderReturnCell(t.return_1d);
            case 'return_5d': return renderReturnCell(t.return_5d);
            case 'return_20d': return renderReturnCell(t.return_20d);
            case 'return_50d': return renderReturnCell(t.return_50d);
            case 'note':
                return (
                    <div className="text-left">
                        {editingTradeId === t.id ? (
                            <input
                                type="text"
                                value={editingNoteValue}
                                onChange={(e) => setEditingNoteValue(e.target.value)}
                                onBlur={() => handleNoteSave(t.id)}
                                onKeyDown={(e) => handleNoteKeyDown(e, t.id)}
                                autoFocus
                                className="bg-gray-700 text-white p-1 rounded w-full border border-blue-500 outline-none"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <div
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleNoteDoubleClick(t);
                                }}
                                className="cursor-text min-h-[20px] hover:bg-gray-700/50 p-1 rounded transition whitespace-pre-wrap max-w-[200px]"
                                title="ダブルクリックで編集"
                            >
                                {t.note || <span className="text-gray-600 italic text-xs">No Note</span>}
                            </div>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
            <div className="max-w-[1920px] mx-auto p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400">
                        トレード履歴分析
                    </h1>
                    <Link href="/" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition">
                        ダッシュボードへ戻る
                    </Link>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl">
                        <div className="text-gray-500 text-sm mb-1">トータル損益</div>
                        <div className={`text-3xl font-mono font-bold ${data.stats.total_pl >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                            {data.stats.total_pl >= 0 ? '+' : ''}{data.stats.total_pl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl">
                        <div className="text-gray-500 text-sm mb-1">勝率</div>
                        <div className="text-3xl font-mono font-bold text-yellow-400">
                            {data.stats.win_rate.toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl">
                        <div className="text-gray-500 text-sm mb-1">総取引数</div>
                        <div className="text-3xl font-mono font-bold text-gray-300">
                            {data.stats.total_trades}
                        </div>
                    </div>
                </div>

                {/* Monthly Performance */}
                <div className="mb-8">
                    <h2 className="text-lg font-bold text-gray-400 mb-3">月別パフォーマンス</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                        {Object.entries(data.stats.monthly)
                            .sort((a, b) => b[0].localeCompare(a[0]))
                            .map(([month, pl]) => (
                                <button
                                    key={month}
                                    onClick={() => handleMonthClick(month)}
                                    className={`p-3 rounded-lg border text-left transition hover:scale-105 ${pl >= 0
                                        ? 'bg-gray-800/50 border-green-900/30 hover:bg-gray-700 hover:border-green-700'
                                        : 'bg-gray-800/50 border-red-900/30 hover:bg-gray-700 hover:border-red-700'
                                        }`}
                                >
                                    <div className="text-xs text-gray-500 mb-1">{month}</div>
                                    <div className={`font-mono font-bold text-lg ${pl >= 0 ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                        {pl >= 0 ? '+' : ''}{pl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                </button>
                            ))}
                    </div>
                </div>

                {/* Filters & Controls */}
                <div className="flex flex-wrap gap-4 mb-4 bg-gray-800 p-4 rounded-xl items-center">
                    <button
                        onClick={() => {/* TODO: Export */ }}
                        className="px-4 py-2 bg-green-700/50 hover:bg-green-600/50 text-green-200 rounded text-sm font-bold border border-green-600/30 transition flex items-center gap-2"
                    >
                        <span>Excel出力</span>
                    </button>

                    <div className="ml-auto">
                        <ColumnManager
                            allColumns={allColumnsForManager}
                            visibleColumns={visibleColumns}
                            onUpdateColumns={setVisibleColumns}
                            selectedViewId={selectedViewId}
                            onSelectView={setSelectedViewId}
                            viewType="history"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-gray-800 rounded-xl overflow-hidden shadow-xl border border-gray-700">
                    <div className="p-2 bg-gray-800/80 border-b border-gray-700 flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                            {processedHistory.length} 件のトレード
                        </span>
                        <button
                            onClick={() => setColumnFilters({})}
                            className="text-xs text-blue-400 hover:text-white"
                        >
                            フィルタ解除
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-800 text-gray-400 uppercase text-xs sticky top-0 z-10 shadow-md">
                                <tr>
                                    {displayColumns.map((col) => {
                                        // Prepare Unique Values for Select Filter
                                        let uniqueValues: string[] | undefined = undefined;
                                        if (col.type === 'string') {
                                            uniqueValues = Array.from(new Set(aggregatedHistory.map(h => {
                                                if (col.k === 'symbol') return h.symbol;
                                                if (col.k === 'type') return h.trade_type;
                                                if (col.k === 'note') return h.note;
                                                return '';
                                            }))).filter((v): v is string => !!v).sort();
                                        }

                                        return (
                                            <th key={col.k} className={`px-6 py-3 whitespace-nowrap ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                                                <div className={`flex flex-col gap-1 ${col.align === 'right' ? 'items-end' : col.align === 'center' ? 'items-center' : 'items-start'}`}>
                                                    <div
                                                        className="cursor-pointer hover:text-white flex items-center gap-1"
                                                        onClick={() => handleSort(col.k)}
                                                    >
                                                        {col.label}
                                                        <SortIcon colKey={col.k} sortConfig={sortConfig} />
                                                    </div>
                                                    <HeaderFilter
                                                        columnKey={col.k}
                                                        title={col.label}
                                                        dataType={col.type}
                                                        onApply={(val) => handleColumnFilterChange(col.k, val)}
                                                        currentFilter={columnFilters[col.k]}
                                                        uniqueValues={uniqueValues}
                                                    />
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {paginatedData.map((t) => (
                                    <tr key={t.id} className="border-b border-gray-700 hover:bg-gray-800 cursor-pointer"
                                        onDoubleClick={() => window.open(`/stocks/${String(t.symbol)}`, '_blank')}
                                    >
                                        {displayColumns.map(col => (
                                            <td key={col.k} className={`px-6 py-4 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                                                {renderCellContent(t, col.k)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="p-4 border-t border-gray-700 flex justify-between items-center bg-gray-800">
                        <div className="text-sm text-gray-400">
                            Page {currentPage} of {totalPages || 1} ({processedHistory.length} items)
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50 transition"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50 transition"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
