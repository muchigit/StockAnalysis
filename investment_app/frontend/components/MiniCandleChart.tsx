
interface CandleData {
    d: string;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    sap?: (number | null)[]; // SMA5, 20, 50, 200
}

interface MiniCandleChartProps {
    dataJson: string | null;
    width?: number; // Default increased +20% -> 192 (from 160)
    height?: number; // Default increased +20% -> 72 (from 60)
}

export default function MiniCandleChart({ dataJson, width = 192, height = 72 }: MiniCandleChartProps) {
    if (!dataJson) return <div style={{ width, height }} className="bg-white rounded border border-gray-200" />;

    let data: CandleData[] = [];
    try {
        data = JSON.parse(dataJson);
    } catch (e) {
        return <div style={{ width, height }} className="bg-white text-xs text-red-500">Error</div>;
    }

    if (!data.length) return <div style={{ width, height }} className="bg-white" />;

    // Calculate scaling including SMAs
    const allPrices = data.flatMap(d => {
        const p = [d.h, d.l];
        if (d.sap) d.sap.forEach(v => { if (v !== null) p.push(v); });
        return p;
    });

    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;

    const volumes = data.map(d => d.v);
    const maxVol = Math.max(...volumes) || 1;

    // Margins
    const padTop = 4;
    const padBottom = 4;
    const padRight = 24; // Space for the text labels on the right
    const chartHeight = height - padTop - padBottom;
    const chartWidth = width - padRight;

    // X Scale
    const candleWidth = (chartWidth / data.length) * 0.7;
    const gap = (chartWidth / data.length) * 0.3;
    const step = chartWidth / data.length;

    // Y Scale (flip Y because SVG 0 is top)
    const getY = (val: number) => {
        const normalized = (val - minPrice) / priceRange;
        return padTop + chartHeight * (1 - normalized);
    };

    const getX = (i: number) => i * step + gap / 2 + candleWidth / 2;

    // Volume Scale (bottom 25% of height)
    const getVolHeight = (vol: number) => (vol / maxVol) * (height * 0.25);

    // Colors
    const colorUp = "#ef4444"; // Red
    const colorDown = "#3b82f6"; // Blue

    // SMA Palette matching Detail Page
    // SMA5 (0): Gray (#9ca3af)
    // SMA20 (1): Purple (#a855f7)
    // SMA50 (2): Dark Green (#15803d)
    // SMA200 (3): Blue (#3b82f6)
    // SMA100 (4): Orange (#f97316) - New logic appends 100MA at end
    const smaPalette = ['#9ca3af', '#a855f7', '#15803d', '#3b82f6', '#f97316'];

    // Generate Grid Lines
    const gridColor = "#e5e7eb"; // gray-200
    const horizontalGrid = [0.25, 0.5, 0.75].map(ratio => {
        const y = padTop + chartHeight * ratio;
        return <line key={`h-${ratio}`} x1={0} y1={y} x2={width} y2={y} stroke={gridColor} strokeWidth={1} strokeDasharray="3 3" />;
    });

    // Vertical grid every 10 candles? Or fixed quantity like 4 lines?
    // Let's do 4 vertical lines evenly spaced
    const verticalGrid = [1, 2, 3].map(i => {
        const x = (chartWidth / 4) * i;
        return <line key={`v-${i}`} x1={x} y1={0} x2={x} y2={height} stroke={gridColor} strokeWidth={1} strokeDasharray="3 3" />;
    });

    // Generate Path for SMAs
    const generateSmaPath = (smaIndex: number) => {
        let path = "";
        data.forEach((d, i) => {
            if (d.sap && d.sap[smaIndex] !== null && d.sap[smaIndex] !== undefined) {
                const x = getX(i);
                const y = getY(d.sap[smaIndex] as number);
                if (path === "") path += `M ${x} ${y}`;
                else path += ` L ${x} ${y}`;
            }
        });
        return path;
    };


    return (
        <div className="relative bg-white rounded shadow-sm border border-gray-200 overflow-hidden" style={{ width, height }}>
            <svg width={width} height={height} className="block">
                {/* Grid */}
                {horizontalGrid}
                {verticalGrid}

                {/* Volume Bars */}
                {data.map((d, i) => {
                    const x = i * step + gap / 2;
                    const h = getVolHeight(d.v);
                    const isUp = d.c >= d.o;
                    return (
                        <rect
                            key={`v-${i}`}
                            x={x}
                            y={height - h}
                            width={candleWidth}
                            height={h}
                            fill={isUp ? colorUp : colorDown}
                            opacity={0.6}
                        />
                    );
                })}

                {/* Candles */}
                {data.map((d, i) => {
                    const center = getX(i);
                    const x = i * step + gap / 2;

                    const yOpen = getY(d.o);
                    const yClose = getY(d.c);
                    const yHigh = getY(d.h);
                    const yLow = getY(d.l);

                    const isUp = d.c >= d.o;
                    const color = isUp ? colorUp : colorDown;

                    // Body
                    // y start is min(yOpen, yClose) because SVG Y grows down
                    const bodyTop = Math.min(yOpen, yClose);
                    const bodyHeight = Math.abs(yClose - yOpen) || 1; // min 1px

                    return (
                        <g key={`c-${i}`}>
                            <line x1={center} y1={yHigh} x2={center} y2={yLow} stroke={color} strokeWidth={1} />
                            <rect
                                x={x}
                                y={bodyTop}
                                width={candleWidth}
                                height={bodyHeight}
                                fill={color}
                            />
                        </g>
                    );
                })}

                {/* SMAs */}
                {[0, 1, 2, 3, 4].map(idx => (
                    <path
                        key={`sma-${idx}`}
                        d={generateSmaPath(idx)}
                        fill="none"
                        stroke={smaPalette[idx]}
                        strokeWidth={1}
                        opacity={0.8}
                    />
                ))}
            </svg>

            {/* Price Labels */}
            <div className="absolute right-0 top-0 text-[8px] text-gray-400 bg-white/90 px-0.5 pointer-events-none border-b border-l border-gray-100 rounded-bl font-mono">
                {maxPrice.toFixed(0)}
            </div>
            <div className="absolute right-0 bottom-0 text-[8px] text-gray-400 bg-white/90 px-0.5 pointer-events-none border-t border-l border-gray-100 rounded-tl font-mono">
                {minPrice.toFixed(0)}
            </div>
        </div>
    );
}
