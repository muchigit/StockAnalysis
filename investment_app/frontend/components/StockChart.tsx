"use client";

import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, HistogramData, SeriesMarker, LineStyle } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';

// ... imports
interface ChartProps {
    data: {
        time: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        [key: string]: any;
    }[];
    markers?: SeriesMarker<string>[];
    colors?: {
        backgroundColor?: string;
        lineColor?: string;
        textColor?: string;
        areaTopColor?: string;
        areaBottomColor?: string;
    };
    height?: number;
}

export const StockChart = (props: ChartProps & {
    smas?: { key: string, color: string }[],
    visibleBars?: number,
    interval?: '1d' | '1wk' | '1mo' // Added interval prop
}) => {
    const {
        data,
        markers = [],
        colors: {
            backgroundColor = 'transparent',
            textColor = '#9ca3af', // gray-400
        } = {},
        height = 400,
        smas = [],
        visibleBars,
        interval = '1d' // Default to 1d
    } = props;




    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const [tooltipData, setTooltipData] = useState<{
        visible: boolean;
        x: number;
        y: number;
        price: number;
        change: number;
        changePercent: number;
        timeStr: string;
    } | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        if (chartRef.current) {
            chartRef.current.remove();
        }

        const handleResize = () => {
            chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth });
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor,
            },
            width: chartContainerRef.current.clientWidth,
            height: height,
            grid: {
                vertLines: {
                    color: 'rgba(51, 65, 85, 0.2)', // slate-700 with 20% opacity
                    style: LineStyle.Dotted,
                },
                horzLines: {
                    color: 'rgba(51, 65, 85, 0.2)', // slate-700 with 20% opacity
                    style: LineStyle.Dotted,
                },
            },
            timeScale: {
                borderColor: '#475569',
                timeVisible: true,
            },
            rightPriceScale: {
                borderColor: '#475569',
            },
            crosshair: {
                // We'll handle the tooltip ourselves
                vertLine: {
                    labelVisible: true,
                },
                horzLine: {
                    labelVisible: true,
                },
            },
        });

        chartRef.current = chart;

        // --- Volume Series ---
        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: '', // Overlay
        });

        volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        // --- Candlestick Series ---
        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#ef4444',     // Red for UP 
            downColor: '#3b82f6',   // Blue for DOWN
            borderVisible: false,
            wickUpColor: '#ef4444',
            wickDownColor: '#3b82f6',
        });

        // Convert data
        // Ensure sorted by time
        const sortedData = [...data].sort((a, b) => (a.time > b.time ? 1 : -1));

        const candleData = sortedData.map(d => ({
            time: d.time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close
        }));

        const volumeData = sortedData.map(d => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.5)',
        }));

        candlestickSeries.setData(candleData as CandlestickData[]);
        volumeSeries.setData(volumeData as HistogramData[]);

        // --- SMAs ---
        smas.forEach(sma => {
            const lineSeries = chart.addLineSeries({
                color: sma.color,
                lineWidth: 1,
                priceScaleId: 'right',
            });
            const lineData = sortedData
                .map(d => ({ time: d.time, value: d[sma.key] }))
                .filter(d => d.value !== null && d.value !== undefined);

            // @ts-ignore
            lineSeries.setData(lineData);
        });

        // Masks
        if (markers.length > 0) {
            candlestickSeries.setMarkers(markers);
        }

        // Fit content OR Zoom
        if (visibleBars && sortedData.length > visibleBars) {
            const to = sortedData.length;
            const from = to - visibleBars;
            chart.timeScale().setVisibleLogicalRange({ from, to });
        } else {
            chart.timeScale().fitContent();
        }

        // --- Tooltip Logic ---
        // Create a map for fast lookup: time -> { close, prevClose }
        const dataMap = new Map<string, { close: number; prevClose?: number }>();
        sortedData.forEach((d, i) => {
            const prev = i > 0 ? sortedData[i - 1] : undefined;
            dataMap.set(d.time as string, {
                close: d.close,
                prevClose: prev?.close,
            });
        });

        chart.subscribeCrosshairMove(param => {
            if (
                param.point === undefined ||
                !param.time ||
                param.point.x < 0 ||
                param.point.x > chartContainerRef.current!.clientWidth ||
                param.point.y < 0 ||
                param.point.y > chartContainerRef.current!.clientHeight
            ) {
                setTooltipData(null);
            } else {
                const dateStr = param.time as string;
                const item = dataMap.get(dateStr);

                if (item) {
                    const price = item.close;
                    const prevClose = item.prevClose;

                    let change = 0;
                    let changePercent = 0;

                    if (prevClose !== undefined) {
                        change = price - prevClose;
                        changePercent = (change / prevClose) * 100;
                    }

                    // Format Date String based on interval (Force YYYY-MM-DD)
                    let displayDate = String(dateStr);
                    try {
                        const dateObj = new Date(dateStr);
                        if (!isNaN(dateObj.getTime())) {
                            const y = dateObj.getFullYear();
                            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                            const d = String(dateObj.getDate()).padStart(2, '0');
                            displayDate = `${y}-${m}-${d}`;
                        }
                    } catch (e) { }

                    setTooltipData({
                        visible: true,
                        x: param.point.x,
                        y: param.point.y,
                        price,
                        change,
                        changePercent,
                        timeStr: displayDate,
                    });
                } else {
                    setTooltipData(null);
                }
            }
        });

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            chartRef.current = null;
        };
    }, [data, markers, backgroundColor, textColor, height, smas, visibleBars, interval]);

    return (
        <div className="relative w-full group">
            <div
                ref={chartContainerRef}
                className="w-full"
                style={{ height: `${height}px` }}
            />
            {tooltipData && tooltipData.visible && (
                <div
                    className="absolute z-50 p-2 text-sm bg-gray-900/90 border border-gray-700 rounded shadow-lg backdrop-blur pointer-events-none select-none"
                    style={{
                        left: Math.min(tooltipData.x + 15, (chartContainerRef.current?.clientWidth || 0) - 160), // Prevent overflow right
                        top: Math.max(10, tooltipData.y - 10), // Keep it near y but not off-top
                        minWidth: '140px'
                    }}
                >
                    <div className="text-gray-400 text-xs mb-1">{tooltipData.timeStr}</div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-300">Close</span>
                        <span className="font-mono text-white text-base font-bold">
                            {tooltipData.price.toFixed(2)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-300">Change</span>
                        <span className={`font-mono font-bold ${tooltipData.change > 0 ? 'text-red-500' :
                            tooltipData.change < 0 ? 'text-blue-500' : 'text-gray-400'
                            }`}>
                            {tooltipData.change > 0 ? '+' : ''}{tooltipData.change.toFixed(2)}
                            <span className="text-xs ml-1 opacity-80">
                                ({tooltipData.changePercent.toFixed(2)}%)
                            </span>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
