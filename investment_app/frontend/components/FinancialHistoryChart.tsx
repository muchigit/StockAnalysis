
import React, { useState, useMemo } from 'react';
import { StockFinancials } from '@/lib/api';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Props {
    data: StockFinancials[];
}

const formatNumberJP = (num: number) => {
    if (Math.abs(num) >= 1000000000000) {
        return (num / 1000000000000).toFixed(1) + '兆';
    }
    if (Math.abs(num) >= 100000000) {
        return (num / 100000000).toFixed(1) + '億';
    }
    return num.toLocaleString();
};

const formatEPS = (num: number) => {
    return num.toFixed(2);
};

export default function FinancialHistoryChart({ data }: Props) {
    const [period, setPeriod] = useState<'annual' | 'quarterly'>('annual');

    const filteredData = useMemo(() => {
        return data
            .filter(d => d.period === period)
            .sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime());
    }, [data, period]);

    if (!data || data.length === 0) return null;

    return (
        <div className="w-full">
            <div className="flex justify-end items-center mb-4">
                <div className="flex space-x-2">
                    <button
                        onClick={() => setPeriod('annual')}
                        className={`px-3 py-1 rounded text-xs font-bold transition ${period === 'annual' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                    >
                        Annual
                    </button>
                    <button
                        onClick={() => setPeriod('quarterly')}
                        className={`px-3 py-1 rounded text-xs font-bold transition ${period === 'quarterly' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                    >
                        Quarterly
                    </button>
                </div>
            </div>

            <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                        <XAxis
                            dataKey="report_date"
                            stroke="#9CA3AF"
                            tickFormatter={(date) => {
                                const d = new Date(date);
                                return period === 'annual' ? d.getFullYear().toString() : `${d.getFullYear()}/${d.getMonth() + 1}`;
                            }}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#9CA3AF"
                            tickFormatter={formatNumberJP}
                            orientation="left"
                            width={80}
                        />
                        <YAxis
                            yAxisId="right"
                            stroke="#9CA3AF"
                            orientation="right"
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                            formatter={(value: any, name: any) => {
                                if (value === undefined || value === null) return ['-', name];
                                if (name === 'EPS') return [Number(value).toFixed(2), name];
                                return [formatNumberJP(Number(value)), name];
                            }}
                            labelFormatter={(label: any) => new Date(label).toLocaleDateString()}
                        />
                        <Legend wrapperStyle={{ color: '#9CA3AF' }} />
                        <Bar yAxisId="left" dataKey="revenue" name="Total Revenue" fill="#60A5FA" barSize={20} radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="left" dataKey="net_income" name="Net Income" fill="#34D399" barSize={20} radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="eps" name="EPS" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
