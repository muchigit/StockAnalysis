"use client";

import { Stock } from '@/lib/api';
import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PortfolioAnalysisDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stocks: Stock[];
    groupName: string;
}

export default function PortfolioAnalysisDialog({ open, onOpenChange, stocks, groupName }: PortfolioAnalysisDialogProps) {

    // Calculate Asset Allocation & P&L
    const { allocationData, totalValue, totalPL } = useMemo(() => {
        let totalVal = 0;
        let totalCst = 0;

        const sectorMap: Record<string, number> = {};

        const heldStocks = stocks.filter(s => (s.holding_quantity || 0) > 0);

        for (const s of heldStocks) {
            const qty = s.holding_quantity || 0;
            const price = s.current_price || 0;
            const val = qty * price;

            const cost = (s.average_cost || 0) * qty;

            totalVal += val;
            totalCst += cost;

            const sector = s.sector || "Unknown";
            sectorMap[sector] = (sectorMap[sector] || 0) + val;
        }

        const allocationData = Object.entries(sectorMap).map(([name, value]) => ({
            name,
            value
        })).sort((a, b) => b.value - a.value);

        return {
            allocationData,
            totalValue: totalVal,
            totalPL: totalVal - totalCst,
            totalCost: totalCst
        };
    }, [stocks]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

    const handleClose = () => onOpenChange(false);

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={handleClose}>
            <div
                className="bg-gray-900 border border-gray-800 p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative"
                onClick={e => e.stopPropagation()}
            >
                <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">×</button>

                <header className="flex justify-between items-start mb-6 pr-8">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">ポートフォリオ分析: {groupName}</h2>
                        <div className="text-sm text-gray-400">
                            <span className="mr-4">総資産額: <span className="text-white font-mono text-lg">¥{totalValue.toLocaleString()}</span></span>
                            <span>評価損益: <span className={`${totalPL >= 0 ? 'text-green-400' : 'text-red-400'} font-mono text-lg`}>
                                {totalPL >= 0 ? '+' : ''}{totalPL.toLocaleString()}
                            </span></span>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Chart Section */}
                    <div className="bg-gray-950 p-4 rounded border border-gray-800 min-h-[300px] flex flex-col items-center justify-center">
                        <h3 className="text-center font-bold text-gray-300 mb-2">セクター別配分 (時価評価額)</h3>
                        {allocationData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={allocationData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {allocationData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: any) => `¥${value.toLocaleString()}`} contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-gray-500">保有銘柄がありません</div>
                        )}
                    </div>

                    {/* Details Table */}
                    <div className="bg-gray-950 p-4 rounded border border-gray-800 overflow-x-auto">
                        <h3 className="font-bold text-gray-300 mb-2">保有銘柄詳細</h3>
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-900">
                                <tr>
                                    <th className="px-2 py-1">銘柄</th>
                                    <th className="px-2 py-1 text-right">数量</th>
                                    <th className="px-2 py-1 text-right">現在値</th>
                                    <th className="px-2 py-1 text-right">評価額</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stocks.filter(s => (s.holding_quantity || 0) > 0).map(s => {
                                    const val = (s.holding_quantity || 0) * (s.current_price || 0);
                                    return (
                                        <tr key={s.symbol} className="border-b border-gray-800">
                                            <td className="px-2 py-1 font-mono text-white">{s.symbol} <span className="text-xs text-gray-500 block truncate max-w-[100px]">{s.company_name}</span></td>
                                            <td className="px-2 py-1 text-right font-mono">{(s.holding_quantity || 0).toLocaleString()}</td>
                                            <td className="px-2 py-1 text-right font-mono">¥{(s.current_price || 0).toLocaleString()}</td>
                                            <td className="px-2 py-1 text-right font-mono text-white">¥{val.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {stocks.filter(s => (s.holding_quantity || 0) > 0).length === 0 && (
                            <div className="text-center py-4 text-gray-500">データなし</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
