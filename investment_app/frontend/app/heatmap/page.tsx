"use client";

import { useEffect, useState } from 'react';
import { fetchStocks, Stock } from '@/lib/api';
import { Treemap, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface HeatmapData {
    name: string;
    size: number; // Market Value
    change: number; // Daily Change %
    company: string;
    pl: number; // Unrealized P&L
    buyDate: string; // Last Buy Date
    [key: string]: any;
}

const CustomizedContent = (props: any) => {
    const { root, depth, x, y, width, height, index, payload, colors, rank, name, change, onDoubleClick } = props;

    if (depth < 2) return null; // Root/Category (if any)

    // Color logic
    // User request: "Larger number (magnitude) -> Brighter color", "Smaller -> Darker"
    let bgColor = '#374151'; // Gray-700

    if (change > 0) {
        // Green scale: Higher change -> Brighter/Lighter Green
        if (change > 3) bgColor = '#22c55e'; // Green-500 (Bright)
        else if (change > 1) bgColor = '#15803d'; // Green-700 (Medium)
        else bgColor = '#14532d'; // Green-900 (Dark)
    } else if (change < 0) {
        // Red scale: Lower (more negative) -> Brighter/Lighter Red
        if (change < -3) bgColor = '#ef4444'; // Red-500 (Bright)
        else if (change < -1) bgColor = '#b91c1c'; // Red-700 (Medium)
        else bgColor = '#7f1d1d'; // Red-900 (Dark)
    }

    // Font size logic - Increased as requested
    // Ensure it fits but be bolder and larger
    const maxFontSize = 32;
    const minFontSize = 12; // increased from implied small
    const calculatedFontSize = Math.min(width / 4, height / 3, maxFontSize);
    const fontSize = Math.max(calculatedFontSize, minFontSize);

    return (
        <g
            onDoubleClick={() => onDoubleClick && onDoubleClick(props)}
            style={{ cursor: 'pointer' }}
        >
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: bgColor,
                    stroke: '#000', // Black border for better separation
                    strokeWidth: 2 / (depth + 1e-10),
                    strokeOpacity: 0.5,
                }}
            />
            {width > 40 && height > 30 && (
                <>
                    <text
                        x={x + width / 2}
                        y={y + height / 2 - fontSize * 0.4}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={fontSize}
                        fontWeight="900"
                        style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.8)', pointerEvents: 'none' }} // Shadow for visibility
                    >
                        {name}
                    </text>
                    <text
                        x={x + width / 2}
                        y={y + height / 2 + fontSize * 0.8}
                        textAnchor="middle"
                        fill="#f3f4f6"
                        fontSize={Math.max(fontSize * 0.6, 11)}
                        fontWeight="bold"
                        style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.8)', pointerEvents: 'none' }}
                    >
                        {change > 0 ? '+' : ''}{change.toFixed(2)}%
                    </text>
                </>
            )}
        </g>
    );
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-gray-800 border border-gray-700 p-3 rounded shadow-lg text-sm text-gray-200">
                <p className="font-bold text-lg mb-1">{data.name}</p>
                <p className="text-gray-400 text-xs mb-2">{data.company}</p>
                <div className="space-y-1">
                    <p className="flex justify-between gap-4">
                        <span className="text-gray-500">評価額:</span>
                        <span className="font-mono">{Math.round(data.size).toLocaleString()}</span>
                    </p>
                    <p className="flex justify-between gap-4">
                        <span className="text-gray-500">含み損益:</span>
                        <span className={`font-mono font-bold ${data.pl > 0 ? 'text-green-400' : data.pl < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {data.pl > 0 ? '+' : ''}{Math.round(data.pl).toLocaleString()}
                        </span>
                    </p>
                    <p className="flex justify-between gap-4">
                        <span className="text-gray-500">最終購入日:</span>
                        <span className="font-mono">{data.buyDate || '-'}</span>
                    </p>
                    <p className="flex justify-between gap-4">
                        <span className="text-gray-500">騰落率:</span>
                        <span className={`font-mono font-bold ${data.change > 0 ? 'text-green-400' : data.change < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {data.change > 0 ? '+' : ''}{data.change.toFixed(2)}%
                        </span>
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

export default function HeatmapPage() {
    const [data, setData] = useState<HeatmapData[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter(); // Import needed from next/navigation

    useEffect(() => {
        async function load() {
            try {
                const stocks = await fetchStocks(0, 2000, 'stock');
                const holdings = stocks.filter(s => (s.holding_quantity || 0) > 0.0001);

                const mapped = holdings.map(s => {
                    const price = s.current_price || 0;
                    const val = (s.holding_quantity || 0) * price;
                    return {
                        name: s.symbol,
                        size: val,
                        change: s.change_percentage_1d || 0,
                        company: s.company_name,
                        pl: s.unrealized_pl || 0,
                        buyDate: s.last_buy_date || ''
                    };
                }).filter(d => d.size > 0);

                // Sort by size desc for better layout usually, but Treemap handles it
                mapped.sort((a, b) => b.size - a.size);

                setData(mapped);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">読み込み中...</div>;

    const treeData = [{
        name: '保有銘柄',
        children: data
    }];

    // Treemap onClick/DoubleClick wrapper
    const handleDoubleClick = (node: any) => {
        // Treemap node returns something like { name, value, x, y, ... } + payload if custom?
        // We can check if name is present.
        if (node && node.name) {
            router.push(`/stocks/${node.name}`);
        }
    };

    return (
        <div className="min-h-screen bg-black text-gray-200 font-sans flex flex-col">
            <header className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-gray-400 hover:text-white transition">
                        ← ダッシュボード
                    </Link>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                        ポートフォリオ・ヒートマップ
                    </h1>
                </div>
            </header>

            <main className="flex-1 p-4">
                {data.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-gray-500">
                        保有銘柄が見つかりません。
                    </div>
                ) : (
                    <div className="w-full h-[calc(100vh-100px)]">
                        <ResponsiveContainer width="100%" height="100%">
                            <Treemap
                                data={treeData}
                                dataKey="size"
                                stroke="#000"
                                fill="#8884d8"
                                content={<CustomizedContent onDoubleClick={handleDoubleClick} />}
                            >
                                <Tooltip content={<CustomTooltip />} />
                            </Treemap>
                        </ResponsiveContainer>
                    </div>
                )}
            </main>
        </div>
    );
}
