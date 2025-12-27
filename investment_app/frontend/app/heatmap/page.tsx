"use client";

import { useEffect, useState, useMemo } from 'react';
import { fetchStocks, Stock } from '@/lib/api';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Custom Content Component for Treemap
const CustomizedContent = (props: any) => {
    const router = useRouter();
    let { depth, x, y, width, height, name, change, isHeld, index } = props;

    // Fallback if change is missing in props (sometimes stripped by Recharts)
    if (change === undefined && props.payload && props.payload.change !== undefined) {
        change = props.payload.change;
    }

    // Recharts Treemap 'children' check to identify leaf
    const isLeaf = !props.children && !props.hasChildren && depth > 0;

    if (isLeaf) {
        // This is a leaf (Stock)

        // Color logic based on Change %
        let fill = "#374151"; // Gray default
        if (change !== undefined) {
            const abs = Math.abs(change);
            const opacity = Math.min(1, Math.max(0.4, abs / 3)); // Increased min opacity

            if (change > 0) fill = `rgba(34, 197, 94, ${opacity})`; // Green
            else fill = `rgba(239, 68, 68, ${opacity})`; // Red
        }

        // Holding Highlight
        const stroke = isHeld ? "#fbbf24" : "#111827"; // Amber-400 for held, dark for others
        const strokeWidth = isHeld ? 4 : 1;
        const zIndex = isHeld ? 10 : 1;

        // Text contrast
        const textColor = "#ffffff";
        const showText = width > 24 && height > 14;
        const showSubText = width > 24 && height > 30;

        return (
            <g
                onClick={(e) => {
                    // Prevent propagation if needed, but Treemap might need click for zoom (not used here)
                }}
                onDoubleClick={() => router.push(`/stocks/${name}`)}
                style={{ cursor: 'pointer', zIndex }}
            >
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    style={{
                        fill: fill,
                        stroke: stroke,
                        strokeWidth: strokeWidth,
                        paintOrder: 'stroke', // Ensure stroke doesn't eat too much fill
                    }}
                />
                {showText && (
                    <text
                        x={x + width / 2}
                        y={y + height / 2 - (showSubText ? 8 : -2)}
                        textAnchor="middle"
                        fill={textColor}
                        fontSize={Math.min(width / 3, 24)}
                        fontWeight="900"
                        style={{ pointerEvents: 'none', textShadow: 'none' }} // Explicitly none
                    >
                        {name}
                    </text>
                )}
                {showSubText && change !== undefined && (
                    <text
                        x={x + width / 2}
                        y={y + height / 2 + 14}
                        textAnchor="middle"
                        fill="#eeeeee"
                        fontSize={Math.min(width / 4, 16)}
                        fontWeight="bold"
                        style={{ pointerEvents: 'none', textShadow: 'none' }} // Explicitly none
                    >
                        {change > 0 ? '+' : ''}{change.toFixed(1)}%
                    </text>
                )}
            </g>
        );
    }

    // Sector Node (Container)
    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: 'none',
                    stroke: '#fff',
                    strokeWidth: 2,
                    strokeOpacity: 0.1,
                }}
            />
            {width > 50 && height > 20 && (
                <text
                    x={x + 4}
                    y={y + 14}
                    textAnchor="start"
                    fill="#fff"
                    fontSize={12}
                    fontWeight="900"
                    fillOpacity={0.5}
                    style={{ pointerEvents: 'none' }}
                >
                    {name}
                </text>
            )}
        </g>
    );

};


// Helper to format market cap for dropdown
const formatCap = (cap: number | null) => {
    if (!cap) return "All";
    if (cap >= 1e12) return `< $${cap / 1e12}T`;
    if (cap >= 1e9) return `< $${cap / 1e9}B`;
    return `< $${cap / 1e6}M`;
};

export default function HeatmapPage() {
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [loading, setLoading] = useState(true);
    const [metric, setMetric] = useState<'1d' | '5d'>('1d');
    const [maxCap, setMaxCap] = useState<number | null>(null); // Null means no limit

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        console.log("Heatmap: Starting fetch...");

        const timeoutId = setTimeout(() => {
            setError("Timeout: Server took too long to respond.");
            setLoading(false);
        }, 15000); // 15s timeout

        fetchStocks(0, 5000, "stock", false, true).then(data => {
            clearTimeout(timeoutId);
            console.log("Heatmap: Data received", data.length);
            setStocks(data);
            if (data.length === 0) {
                setError("No stocks found. Please check database or connection.");
            } else {
                setLoading(false);
                // Log sample data to verify market_cap formatting
                const sample = data.find(s => s.market_cap > 0);
                console.log("Sample Stock Market Cap:", sample?.symbol, sample?.market_cap, typeof sample?.market_cap);
            }
        }).catch(err => {
            clearTimeout(timeoutId);
            console.error("Heatmap Fetch Error:", err);
            setError(`Failed to load data: ${err.message}`);
            setLoading(false);
        });

        return () => clearTimeout(timeoutId);
    }, []);

    const treeData = useMemo(() => {
        if (stocks.length === 0) return [];

        const sectors: Record<string, any> = {};

        let filteredCount = 0;
        stocks.forEach(s => {
            if (!s.sector || !s.market_cap || s.asset_type === 'index') return;

            // Market Cap Filter
            // Handle potentially string or already number market_cap
            // Python backend might send scientific notation or simple ints
            const cap = Number(s.market_cap);

            if (maxCap !== null) {
                // Debug first few rejections
                if (cap > maxCap) {
                    // console.log(`Filtering out ${s.symbol}: ${cap} > ${maxCap}`);
                    return;
                }
            }

            if (!sectors[s.sector]) {
                sectors[s.sector] = { name: s.sector, children: [] };
            }

            const change = metric === '1d' ? s.change_percentage_1d : s.change_percentage_5d;

            sectors[s.sector].children.push({
                name: s.symbol,
                size: cap,
                change: change || 0,
                company: s.company_name,
                isHeld: (s.holding_quantity || 0) > 0.0001 // Determine strict holding
            });
            filteredCount++;
        });

        console.log(`Filtered stocks count: ${filteredCount} / ${stocks.length} (MaxCap: ${maxCap})`);

        // Filter out empty sectors
        return Object.values(sectors).filter(s => s.children.length > 0);

    }, [stocks, metric, maxCap]);

    return (
        <div className="min-h-screen bg-black text-gray-200">
            <header className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-gray-400 hover:text-white transition flex items-center gap-1">
                        <span>←</span> Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Market Heatmap</h1>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-xs text-gray-400 font-mono">
                        {treeData.reduce((acc, sector) => acc + sector.children.length, 0)} Stocks
                    </div>
                    {/* Market Cap Filter */}
                    <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1 border border-gray-700">
                        <span className="text-xs text-gray-400 px-2 font-mono">MAX CAP:</span>
                        <select
                            value={maxCap || ""}
                            onChange={(e) => setMaxCap(e.target.value ? Number(e.target.value) : null)}
                            className="bg-gray-900 text-white text-sm rounded border border-gray-700 px-2 py-1 focus:outline-none focus:border-blue-500"
                        >
                            <option value="">All Size</option>
                            <option value={2000e9}>&lt; $2T (Excl. Mega)</option>
                            <option value={200e9}>&lt; $200B (Large)</option>
                            <option value={50e9}>&lt; $50B (Mid)</option>
                            <option value={10e9}>&lt; $10B (Small)</option>
                            <option value={2e9}>&lt; $2B (Micro)</option>
                        </select>
                    </div>

                    <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                        <button
                            onClick={() => setMetric('1d')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${metric === '1d' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            1 Day
                        </button>
                        <button
                            onClick={() => setMetric('5d')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${metric === '5d' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            5 Days
                        </button>
                    </div>
                </div>
            </header>

            <main className="p-1 h-[calc(100vh-73px)] overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent"></div>
                            <div className="text-blue-400 animate-pulse">Loading Market Data...</div>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-red-500 flex-col gap-2">
                        <div className="text-2xl font-bold">⚠️ Error</div>
                        <div>{error}</div>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-gray-800 px-4 py-2 rounded hover:bg-gray-700 transition text-white mt-4"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                            key={`${metric}-${maxCap || 'all'}`} // Force re-render on filter change
                            data={treeData}
                            dataKey="size"
                            aspectRatio={16 / 9}
                            stroke="#111"
                            content={<CustomizedContent />}
                            animationDuration={0} // Disable animation for performance with many nodes
                        >
                            <Tooltip
                                content={({ payload }) => {
                                    if (payload && payload.length) {
                                        const data = payload[0].payload;
                                        // Handle hovering on sector node vs leaf
                                        if (!data.company) return null; // Likely a sector node

                                        return (
                                            <div className="bg-gray-900/90 border border-gray-700 p-3 rounded-lg shadow-2xl text-xs backdrop-blur-sm z-[100]">
                                                <div className="font-bold text-white text-base mb-1">{data.name}</div>
                                                <div className="text-gray-300 mb-2 max-w-[200px] truncate">{data.company}</div>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-400">
                                                    <div>Market Cap:</div>
                                                    <div className="text-white text-right font-mono">${(data.size / 1e9).toFixed(2)}B</div>

                                                    <div>Change ({metric}):</div>
                                                    <div className={`text-right font-mono font-bold ${data.change > 0 ? 'text-green-400' : data.change < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                                        {data.change > 0 ? '+' : ''}{data.change?.toFixed(2)}%
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                        </Treemap>
                    </ResponsiveContainer>
                )}
            </main>
        </div>
    );
}
