"use client";

import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, HistogramData, SeriesMarker } from 'lightweight-charts';
import { useEffect, useRef } from 'react';

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
    visibleBars?: number
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
        visibleBars
    } = props;

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

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
                vertLines: { color: '#334155' }, // slate-700
                horzLines: { color: '#334155' },
            },
            timeScale: {
                borderColor: '#475569',
                timeVisible: true,
            },
            rightPriceScale: {
                borderColor: '#475569',
            },
        });

        chartRef.current = chart;

        // --- Volume Series ---
        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: '', // Overlay
        });

        // set volume series to roughly bottom 20%
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
                .filter(d => d.value !== null && d.value !== undefined); // Filter out nulls

            // @ts-ignore
            lineSeries.setData(lineData);
        });

        // Markers
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

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            chartRef.current = null;
        };
    }, [data, markers, backgroundColor, textColor, height, smas, visibleBars]);

    return (
        <div
            ref={chartContainerRef}
            className="w-full"
            style={{ height: `${height}px` }}
        />
    );
};
