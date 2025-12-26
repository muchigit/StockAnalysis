"use client";

import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, HistogramData, SeriesMarker, LineStyle, PriceScaleMode } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';

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
    interval?: '1d' | '1wk' | '1mo',
    logScale?: boolean,
    onChartDoubleClick?: (price: number) => void
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
        interval = '1d', // Default to 1d
        logScale = false,
        onChartDoubleClick
    } = props;

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    // Legend State
    const [legendData, setLegendData] = useState<{
        open: number;
        high: number;
        low: number;
        close: number;
        change: number;
        changePercent: number;
        volume: number;
        volChangePercent: number;
        color: string; // Text color class
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
                mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
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

        // --- Tooltip / Legend Init Logic ---
        // Helper to format date
        const formatDate = (dateStr: string) => {
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
            return displayDate;
        };

        // Initialize Legend with Latest Data
        const latestIdx = sortedData.length - 1;
        if (latestIdx >= 0) {
            const latest = sortedData[latestIdx];
            const prev = latestIdx > 0 ? sortedData[latestIdx - 1] : undefined;
            const prevClose = prev ? prev.close : latest.open; // Fallback
            const change = latest.close - prevClose;
            const changePercent = (change / prevClose) * 100;
            const isUp = change >= 0;

            // Vol Change
            const prevVol = prev ? prev.volume : latest.volume; // If no prev, change is 0% based on self
            const volChangePercent = prevVol ? ((latest.volume - prevVol) / prevVol) * 100 : 0;

            setLegendData({
                open: latest.open,
                high: latest.high,
                low: latest.low,
                close: latest.close,
                change,
                changePercent,
                volume: latest.volume,
                volChangePercent,
                color: isUp ? 'text-red-500' : 'text-blue-500',
                timeStr: formatDate(latest.time)
            });
        }

        // --- Tooltip / Legend Crosshair Logic ---
        // Create a map for fast lookup: time -> { o, h, l, c, v, prevClose, prevVol }
        const dataMap = new Map<string, { o: number; h: number; l: number; c: number; v: number; prevClose?: number; prevVol?: number }>();
        sortedData.forEach((d, i) => {
            const prev = i > 0 ? sortedData[i - 1] : undefined;
            dataMap.set(d.time as string, {
                o: d.open,
                h: d.high,
                l: d.low,
                c: d.close,
                v: d.volume,
                prevClose: prev?.close,
                prevVol: prev?.volume,
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
                // Revert to latest data
                if (latestIdx >= 0) {
                    const latest = sortedData[latestIdx];
                    const prev = latestIdx > 0 ? sortedData[latestIdx - 1] : undefined;
                    const prevClose = prev ? prev.close : latest.open;
                    const change = latest.close - prevClose;
                    const changePercent = (change / prevClose) * 100;
                    const isUp = change >= 0;

                    const prevVol = prev ? prev.volume : latest.volume;
                    const volChangePercent = prevVol ? ((latest.volume - prevVol) / prevVol) * 100 : 0;

                    setLegendData({
                        open: latest.open,
                        high: latest.high,
                        low: latest.low,
                        close: latest.close,
                        change,
                        changePercent,
                        volume: latest.volume,
                        volChangePercent,
                        color: isUp ? 'text-red-500' : 'text-blue-500',
                        timeStr: formatDate(latest.time)
                    });
                } else {
                    setLegendData(null);
                }
            } else {
                const dateStr = param.time as string;
                const item = dataMap.get(dateStr);

                if (item) {
                    const prevClose = item.prevClose !== undefined ? item.prevClose : item.o; // Fallback
                    const change = item.c - prevClose;
                    const changePercent = (change / prevClose) * 100;
                    const isUp = change >= 0;

                    const prevVol = item.prevVol !== undefined ? item.prevVol : item.v;
                    const volChangePercent = prevVol ? ((item.v - prevVol) / prevVol) * 100 : 0;

                    setLegendData({
                        open: item.o,
                        high: item.h,
                        low: item.l,
                        close: item.c,
                        change,
                        changePercent,
                        volume: item.v,
                        volChangePercent,
                        color: isUp ? 'text-red-500' : 'text-blue-500',
                        timeStr: formatDate(dateStr)
                    });
                }
            }
        });

        // Double Click Handler
        const handleDblClick = (e: MouseEvent) => {
            if (!onChartDoubleClick || !chartContainerRef.current) return;

            const rect = chartContainerRef.current.getBoundingClientRect();
            const y = e.clientY - rect.top;

            const seriesApi = candlestickSeries as unknown as ISeriesApi<"Candlestick">;
            const price = seriesApi.coordinateToPrice(y);

            if (price !== null) {
                onChartDoubleClick(price);
            }
        };

        if (chartContainerRef.current) {
            chartContainerRef.current.addEventListener('dblclick', handleDblClick);
        }

        window.addEventListener('resize', handleResize);

        return () => {
            if (chartContainerRef.current) {
                chartContainerRef.current.removeEventListener('dblclick', handleDblClick);
            }
            window.removeEventListener('resize', handleResize);
            chart.remove();
            chartRef.current = null;
        };
    }, [data, markers, backgroundColor, textColor, height, smas, visibleBars, interval, logScale, onChartDoubleClick]);

    return (
        <div className="relative w-full group text-sm font-mono select-none">
            {/* Legend Overlay */}
            {legendData && (
                <div className="absolute top-1 left-2 z-20 flex flex-wrap gap-x-4 gap-y-1 pointer-events-none bg-white/90 p-1 rounded border border-gray-200 shadow-sm">
                    <div className="text-black mr-2 font-bold">{legendData.timeStr}</div>
                    <div className="flex gap-1">
                        <span className="text-black font-bold">始</span>
                        <span className={legendData.color}>{legendData.open.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-1">
                        <span className="text-black font-bold">高</span>
                        <span className={legendData.color}>{legendData.high.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-1">
                        <span className="text-black font-bold">安</span>
                        <span className={legendData.color}>{legendData.low.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-1">
                        <span className="text-black font-bold">終</span>
                        <span className={legendData.color}>{legendData.close.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-1">
                        <span className={`font-bold ${legendData.color}`}>
                            {legendData.change > 0 ? '+' : ''}{legendData.change.toFixed(2)} ({legendData.changePercent.toFixed(2)}%)
                        </span>
                    </div>
                    <div className="flex gap-1">
                        <span className="text-black font-bold">出来高</span>
                        <span className={legendData.color}>
                            {(legendData.volume / 1000).toFixed(0)}K
                            <span className="ml-1 opacity-80">
                                ({legendData.volChangePercent > 0 ? '+' : ''}{legendData.volChangePercent.toFixed(1)}%)
                            </span>
                        </span>
                    </div>
                </div>
            )}
            <div
                ref={chartContainerRef}
                className="w-full"
                style={{ height: `${height}px` }}
            />
        </div>
    );
};
