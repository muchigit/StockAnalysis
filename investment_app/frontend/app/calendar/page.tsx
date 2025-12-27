"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchEarningsCalendar } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface EarningsEvent {
    symbol: string;
    company_name: string;
    earnings_date: string;
    market_cap: number;
    sector: string;
}

export default function CalendarPage() {
    const router = useRouter();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<EarningsEvent[]>([]);
    const [loading, setLoading] = useState(false);

    // Calculate calendar grid
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-indexed

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Days in previous month to fill grid
    const daysInPrevMonth = firstDay.getDay(); // 0 (Sun) - 6 (Sat)

    // Helper to format YYYY-MM-DD
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    useEffect(() => {
        const start = new Date(year, month, 1 - daysInPrevMonth);
        const end = new Date(year, month + 1, 14); // Fetch a bit more for next month preview

        setLoading(true);
        fetchEarningsCalendar(formatDate(start), formatDate(end))
            .then(data => {
                setEvents(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [year, month]);

    const changeMonth = (delta: number) => {
        setCurrentDate(new Date(year, month + delta, 1));
    };

    const getEventsForDay = (day: number, isCurrentMonth: boolean) => {
        if (!isCurrentMonth) return [];
        // Construct date string
        // Note: JS Date month is 0-indexed, events are YYYY-MM-DD
        const target = new Date(year, month, day);
        const dateStr = formatDate(target);

        // Fix: API returns ISO string (e.g. 2026-01-28T00:00:00), we need to compare YYYY-MM-DD part.
        return events.filter(e => {
            if (!e.earnings_date) return false;
            return e.earnings_date.startsWith(dateStr);
        });
    };

    // Render Grid
    const renderCalendarDays = () => {
        const grid = [];
        const todayStr = formatDate(new Date());

        // Previous Month padding
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = daysInPrevMonth - 1; i >= 0; i--) {
            grid.push(
                <div key={`prev-${i}`} className="bg-gray-900/50 min-h-[120px] p-2 border border-gray-800 text-gray-600">
                    <div className="text-right text-sm">{prevMonthLastDay - i}</div>
                </div>
            );
        }

        // Current Month
        const daysInMonth = lastDay.getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const dayEvents = getEventsForDay(i, true);
            const dateStr = formatDate(new Date(year, month, i));
            const isToday = dateStr === todayStr;

            // Sort events by market cap (desc) to show big ones first
            dayEvents.sort((a, b) => b.market_cap - a.market_cap);

            grid.push(
                <div key={`curr-${i}`} className={`bg-gray-900 min-h-[120px] p-2 border border-gray-800 transition hover:bg-gray-800/80 ${isToday ? 'ring-1 ring-blue-500 bg-blue-900/20' : ''}`}>
                    <div className={`text-right text-sm mb-2 ${isToday ? 'text-blue-400 font-bold' : 'text-gray-400'}`}>
                        {i} {isToday && '(本日)'}
                    </div>
                    <div className="space-y-1">
                        {dayEvents.map(e => (
                            <div
                                key={e.symbol}
                                className="text-xs px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 hover:border-blue-500 cursor-pointer flex justify-between items-center group"
                                onClick={() => router.push(`/stocks/${e.symbol}`)}
                            >
                                <span className="font-bold text-gray-200">{e.symbol}</span>
                                {/* Roughly show importance by star if market cap > 100B? Or just show cap */}
                                {e.market_cap > 100e9 && <span className="text-[10px] text-yellow-500">★</span>}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // Next Month padding to fill 35 or 42 cells
        const total = grid.length;
        const remaining = (total % 7 === 0) ? 0 : 7 - (total % 7);
        // Also ensure at least 5 rows (35 cells) or 6 rows (42) depending on needs.

        for (let i = 1; i <= remaining; i++) {
            grid.push(
                <div key={`next-${i}`} className="bg-gray-900/50 min-h-[120px] p-2 border border-gray-800 text-gray-600">
                    <div className="text-right text-sm">{i}</div>
                </div>
            );
        }

        return grid;
    };

    return (
        <div className="min-h-screen bg-black text-gray-200 p-8 font-sans">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <Link href="/" className="text-gray-400 hover:text-white mb-2 inline-block">← Dashboard</Link>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <span>📅</span> Earnings Calendar
                    </h1>
                </div>
                <div className="flex items-center gap-4 bg-gray-900 p-2 rounded-lg border border-gray-800">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-800 rounded">◀</button>
                    <span className="text-xl font-bold min-w-[150px] text-center">
                        {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-800 rounded">▶</button>
                    <button onClick={() => setCurrentDate(new Date())} className="text-xs text-blue-400 hover:underline ml-2">Today</button>
                </div>
            </header>

            {loading && <div className="absolute top-20 right-8 text-yellow-500 font-mono animate-pulse">Loading data...</div>}

            <div className="grid grid-cols-7 gap-px bg-gray-800 border border-gray-800 rounded-lg overflow-hidden shadow-2xl">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="bg-gray-950 p-2 text-center font-bold text-gray-500 text-sm py-3">
                        {d}
                    </div>
                ))}
                {renderCalendarDays()}
            </div>
        </div>
    );
}
