"use client";

import { useEffect, useState, useMemo } from 'react';
import { fetchHistoryAnalytics, HistoryAnalytics, TradeHistory } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import Link from 'next/link';
import HeaderFilter, { ColumnFilterValue } from '@/components/HeaderFilter';
import SortIcon from '@/components/SortIcon';

export default function HistoryPage() {
    const { t } = useTranslation();
    const [data, setData] = useState<HistoryAnalytics | null>(null);
    const [loading, setLoading] = useState(true);

    // Filter & Sort State
    const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterValue>>({});
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

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
    ], []);

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
    const historyList = data?.history || [];
    const stats = data?.stats;

    // Aggregation Logic (Same Day per Symbol)
    const aggregatedHistory = useMemo(() => {
        if (!historyList.length) return [];

        const groups: Record<string, TradeHistory[]> = {};

        // Group by Date (YYYY-MM-DD) + Symbol
        historyList.forEach(h => {
            const dateStr = new Date(h.trade_date).toISOString().slice(0, 10);
            const key = `${dateStr}_${h.symbol}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(h);
        });

        // Flatten Groups
        return Object.values(groups).map(group => {
            let buyQty = 0, sellQty = 0;
            let buyAmt = 0, sellAmt = 0;
            let totalPL = 0;
            let costBasisSum = 0;

            // For metrics, we can't easily aggregate different trades if they have different execution prices.
            // But if it's same day, usually price is close.
            // Let's Average the returns? Or just take the first/last?
            // "Post-Trade Return" implies return from *that* trade.
            // If we aggregate 3 trades, what is the 1D return?
            // Simple approach: Take weighted average of returns?
            // Or simpler: Just take the return from the First trade (since it's same day, finding Close T+1 is same for all).
            // Yes, T+1 Close is same for all. Entry Price might differ.
            // Return = (Close(T+n) - Entry) / Entry.
            // If Entry differs, Return differs.
            // Let's compute average return weighted by quantity?
            // Or just average return?

            let ret1dSum = 0, ret1dCount = 0;
            let ret5dSum = 0, ret5dCount = 0;
            let ret20dSum = 0, ret20dCount = 0;
            let ret50dSum = 0, ret50dCount = 0;

            group.forEach(t => {
                const typeUpper = t.trade_type.toUpperCase();
                const isSell = typeUpper.includes('SELL') || typeUpper === '売り';
                if (isSell) {
                    sellQty += t.quantity;
                    sellAmt += t.price * t.quantity;
                    totalPL += t.realized_pl || 0;
                    costBasisSum += t.cost_basis || 0;
                } else {
                    buyQty += t.quantity;
                    buyAmt += t.price * t.quantity;
                }

                // Sum Returns
                if (t.return_1d !== undefined && t.return_1d !== null) { ret1dSum += t.return_1d; ret1dCount++; }
                if (t.return_5d !== undefined && t.return_5d !== null) { ret5dSum += t.return_5d; ret5dCount++; }
                if (t.return_20d !== undefined && t.return_20d !== null) { ret20dSum += t.return_20d; ret20dCount++; }
                if (t.return_50d !== undefined && t.return_50d !== null) { ret50dSum += t.return_50d; ret50dCount++; }
            });

            const netQty = buyQty - sellQty;
            const totalVol = buyQty + sellQty;
            const avgPrice = totalVol > 0 ? (buyAmt + sellAmt) / totalVol : 0; // VWAP

            // ROI Calculation
            const roiPct = costBasisSum > 0 ? (totalPL / costBasisSum) * 100 : 0;

            let type = '不明';
            if (buyQty > 0 && sellQty > 0) type = '売買'; // Trading
            else if (buyQty > 0) type = '買い'; // BUY
            else if (sellQty > 0) type = '売り'; // SELL

            return {
                ...group[0],
                trade_type: type,
                quantity: netQty,
                price: avgPrice,
                realized_pl: totalPL,
                roi_pct: roiPct,
                return_1d: ret1dCount > 0 ? ret1dSum / ret1dCount : undefined,
                return_5d: ret5dCount > 0 ? ret5dSum / ret5dCount : undefined,
                return_20d: ret20dCount > 0 ? ret20dSum / ret20dCount : undefined,
                return_50d: ret50dCount > 0 ? ret50dSum / ret50dCount : undefined,
                _isAggregated: true
            } as TradeHistory;
        });
    }, [historyList]);

    // Filter & Sort Logic
    const filteredHistory = useMemo(() => {
        return aggregatedHistory.filter(h => {
            return Object.entries(columnFilters).every(([key, filterVal]) => {
                if (!filterVal) return true;

                // Map keys to values
                let val: any;
                if (key === 'date') val = h.trade_date;
                else if (key === 'symbol') val = h.symbol;
                else if (key === 'type') val = h.trade_type;
                else if (key === 'qty') val = h.quantity;
                else if (key === 'price') val = h.price;
                else if (key === 'amount') val = h.price * Math.abs(h.quantity);
                else if (key === 'pl') val = h.realized_pl;
                else if (key === 'roi') val = h.roi_pct;
                // New Metrics
                else if (key === 'return_1d') val = h.return_1d;
                else if (key === 'return_5d') val = h.return_5d;
                else if (key === 'return_20d') val = h.return_20d;
                else if (key === 'return_50d') val = h.return_50d;
                else return true;

                // 1. Range Filter (Number)
                if ('min' in filterVal || 'max' in filterVal) {
                    const numVal = Number(val);
                    if (isNaN(numVal)) return false;
                    if (filterVal.min !== undefined && numVal < filterVal.min) return false;
                    if (filterVal.max !== undefined && numVal > filterVal.max) return false;
                }

                // 2. Select Filter (String)
                if ('selected' in filterVal && filterVal.selected) {
                    if (filterVal.selected.length > 0 && !filterVal.selected.includes(String(val))) return false;
                }

                // 3. Date Range Filter
                if ('startDate' in filterVal || 'endDate' in filterVal) {
                    if (!val) return false;
                    const d = new Date(String(val));
                    const dateStr = d.toISOString().slice(0, 10);

                    if (filterVal.startDate) {
                        if (dateStr < filterVal.startDate) return false;
                    }
                    if (filterVal.endDate) {
                        if (dateStr > filterVal.endDate) return false;
                    }
                }

                return true;
            });
        });
    }, [aggregatedHistory, columnFilters]);

    const processedHistory = useMemo(() => {
        return [...filteredHistory].sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;

            const getVal = (item: any) => {
                if (key === 'date') return new Date(item.trade_date).getTime();
                if (key === 'symbol') return item.symbol;
                if (key === 'type') return item.trade_type;
                if (key === 'qty') return item.quantity;
                if (key === 'price') return item.price;
                if (key === 'amount') return item.price * Math.abs(item.quantity);
                if (key === 'pl') return item.realized_pl || 0;
                if (key === 'roi') return item.roi_pct || 0;
                if (key === 'return_1d') return item.return_1d || -9999;
                if (key === 'return_5d') return item.return_5d || -9999;
                if (key === 'return_20d') return item.return_20d || -9999;
                if (key === 'return_50d') return item.return_50d || -9999;
                return 0;
            };

            const vA = getVal(a);
            const vB = getVal(b);

            if (vA < vB) return direction === 'asc' ? -1 : 1;
            if (vA > vB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredHistory, sortConfig]);


    // Validation for Render
    if (loading) return <div className="p-10 text-white font-mono">Loading history...</div>;
    if (!data || !stats) return <div className="p-10 text-white font-mono">Failed to load history</div>;

    const renderReturnCell = (val?: number) => {
        if (val === undefined || val === null) return <span className="text-gray-600">-</span>;
        const color = val >= 0 ? 'text-red-400' : 'text-blue-400';
        return <span className={`font-mono font-bold ${color}`}>{val >= 0 ? '+' : ''}{val.toFixed(2)}%</span>;
    };

    return (
        <div className="min-h-screen bg-black text-gray-200 font-sans p-8">
            <header className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-blue-500 bg-clip-text text-transparent">
                    取引履歴 (History)
                </h1>
                <Link href="/" className="text-gray-400 hover:text-white font-bold">
                    &larr; ダッシュボードに戻る
                </Link>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl">
                    <div className="text-gray-500 text-sm mb-1">トータル損益</div>
                    <div className={`text-3xl font-mono font-bold ${stats.total_pl >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {stats.total_pl >= 0 ? '+' : ''}{stats.total_pl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
                <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl">
                    <div className="text-gray-500 text-sm mb-1">勝率</div>
                    <div className="text-3xl font-mono font-bold text-yellow-400">
                        {stats.win_rate.toFixed(1)}%
                    </div>
                </div>
                <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl">
                    <div className="text-gray-500 text-sm mb-1">総取引数</div>
                    <div className="text-3xl font-mono font-bold text-gray-300">
                        {stats.total_trades}
                    </div>
                </div>
            </div>

            {/* Monthly P&L Grid */}
            <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl mb-8">
                <h2 className="text-xl font-bold mb-4 text-gray-300">月次損益 (Monthly P&L)</h2>
                <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2">
                    {Object.entries(stats.monthly).sort().reverse().map(([month, pl]) => (
                        <div
                            key={month}
                            onClick={() => handleMonthClick(month)}
                            className="bg-gray-800 p-2 rounded border border-gray-700 flex flex-col items-center cursor-pointer hover:bg-gray-700 transition"
                        >
                            <span className="text-xs text-gray-500">{month}</span>
                            <span className={`font-mono text-sm font-bold ${pl >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                {pl >= 0 ? '+' : ''}{pl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Trade List */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-300">取引一覧 (Transactions)</h2>
                    <button
                        onClick={() => { setColumnFilters({}); setSortConfig(null); }}
                        className="text-xs text-blue-400 hover:text-white"
                    >
                        フィルタ解除
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
                            <tr>
                                {COLUMNS.map((col) => {
                                    // Prepare Unique Values for Select Filter
                                    let uniqueValues: string[] | undefined = undefined;
                                    if (col.type === 'string') {
                                        uniqueValues = Array.from(new Set(aggregatedHistory.map(h => {
                                            if (col.k === 'symbol') return h.symbol;
                                            if (col.k === 'type') return h.trade_type;
                                            return '';
                                        }))).filter(Boolean).sort();
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
                            {processedHistory.map((t) => {
                                const isSell = t.trade_type === '売り';
                                const isTrading = t.trade_type === '売買';
                                const pl = t.realized_pl;
                                const roi = t.roi_pct;

                                return (
                                    <tr
                                        key={`${t.trade_date}_${t.symbol}_${t.id}`}
                                        className="hover:bg-gray-800/50 transition cursor-pointer"
                                        onDoubleClick={() => window.open(`/stocks/${String(t.symbol)}`, '_blank')}
                                    >
                                        <td className="px-6 py-4 font-mono text-gray-400">
                                            {new Date(t.trade_date).toLocaleDateString('ja-JP')}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-200">
                                            {String(t.symbol)}
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${isSell ? 'bg-blue-900/30 text-blue-400' :
                                                    isTrading ? 'bg-purple-900/30 text-purple-400' :
                                                        'bg-red-900/30 text-red-400'
                                                }`}>
                                                {t.trade_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-gray-300">
                                            {t.quantity}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-gray-300">
                                            {t.price.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-gray-300">
                                            {(t.price * Math.abs(t.quantity)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold">
                                            {isSell || isTrading ? (
                                                <span className={pl >= 0 ? 'text-red-400' : 'text-blue-400'}>
                                                    {pl >= 0 ? '+' : ''}{pl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold">
                                            {isSell || isTrading ? (
                                                <div className="flex flex-col items-center">
                                                    <span className={roi >= 0 ? 'text-red-400' : 'text-blue-400'}>
                                                        {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                                                    </span>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">{renderReturnCell(t.return_1d)}</td>
                                        <td className="px-6 py-4 text-right">{renderReturnCell(t.return_5d)}</td>
                                        <td className="px-6 py-4 text-right">{renderReturnCell(t.return_20d)}</td>
                                        <td className="px-6 py-4 text-right">{renderReturnCell(t.return_50d)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
