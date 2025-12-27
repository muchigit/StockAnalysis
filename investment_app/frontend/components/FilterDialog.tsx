import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/lib/i18n';
import { SIGNAL_LABELS } from '@/lib/signals';

export interface FilterCriteria {
    is_in_uptrend?: boolean;
    has_note?: boolean;
    has_analysis?: boolean;

    // Signals
    signal_higher_200ma?: boolean;
    signal_near_200ma?: boolean;
    signal_over_50ma?: boolean;
    signal_higher_50ma_than_200ma?: boolean;
    signal_uptrand_200ma?: boolean;
    signal_sameslope_50_200?: boolean;
    signal_newhigh?: boolean;
    signal_high_volume?: boolean;
    signal_price_up?: boolean;
    signal_break_atr?: boolean;
    signal_high_slope5ma?: boolean;
    signal_newhigh_200days?: boolean;
    signal_newhigh_100days?: boolean;
    signal_newhigh_50days?: boolean;
    signal_rebound_5ma?: boolean;

    min_composite_rating?: number;
    min_rs_rating?: number;
    min_atr?: number;

    // Financials
    min_forward_pe?: number;
    max_forward_pe?: number;
    min_dividend_yield?: number;
    min_roe?: number;

    status?: string;
    industry?: string;
}

interface FilterDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (criteria: FilterCriteria) => void;
    onSaved?: () => void;
    initialCriteria?: FilterCriteria;
}

// Helper to check if criteria has any active values
export function isCriteriaActive(c: FilterCriteria): boolean {
    if (!c) return false;
    return Object.values(c).some(val => {
        if (typeof val === 'boolean') return val === true;
        if (typeof val === 'number') return val !== undefined && val !== null;
        if (typeof val === 'string') return val !== '' && val !== 'Any' && val !== 'None';
        return val !== undefined && val !== null && val !== '';
    });
}

export default function FilterDialog({ isOpen, onClose, onApply, onSaved, initialCriteria }: FilterDialogProps) {
    const { t } = useTranslation();
    const [criteria, setCriteria] = useState<FilterCriteria>(initialCriteria || {});
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen && initialCriteria) {
            setCriteria(initialCriteria);
        }
    }, [isOpen, initialCriteria]);

    const handleApply = () => {
        onApply(criteria);
        onClose();
    };

    const toggleBool = (key: keyof FilterCriteria) => {
        setCriteria(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleChange = (key: keyof FilterCriteria, value: any) => {
        setCriteria(prev => ({ ...prev, [key]: value }));
    };

    const handleClear = () => {
        setCriteria({});
    };

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div className="fixed inset-0 bg-black/50 z-[100000] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-gray-800 p-6 rounded-lg w-full max-w-lg border border-gray-700 shadow-xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold mb-4 text-white">詳細フィルタ</h2>

                <div className="space-y-4 mb-6">
                    {/* Boolean Flags */}
                    <div className="grid grid-cols-2 gap-4">
                        <label className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!criteria.is_in_uptrend}
                                onChange={() => toggleBool('is_in_uptrend')}
                                className="rounded bg-gray-700 border-gray-600"
                            />
                            <span>200MA上昇トレンド</span>
                        </label>
                        <label className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!criteria.has_note}
                                onChange={() => toggleBool('has_note')}
                                className="rounded bg-gray-700 border-gray-600"
                            />
                            <span>メモ有</span>
                        </label>
                        <label className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!criteria.has_analysis}
                                onChange={() => toggleBool('has_analysis')}
                                className="rounded bg-gray-700 border-gray-600"
                            />
                            <span>AI分析有</span>
                        </label>
                    </div>

                    <h3 className="text-sm font-bold text-gray-400 mt-4 mb-2">テクニカルシグナル</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {Object.entries(SIGNAL_LABELS).map(([key, label]) => (
                            <label key={key} className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!criteria[key as keyof FilterCriteria]}
                                    onChange={() => toggleBool(key as keyof FilterCriteria)}
                                    className="rounded bg-gray-700 border-gray-600"
                                />
                                <span className="text-xs">{label}</span>
                            </label>
                        ))}
                    </div>

                    {/* Numeric Ranges */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">総合評価(CR) 最小</label>
                            <input
                                type="number"
                                value={criteria.min_composite_rating || ''}
                                onChange={(e) => handleChange('min_composite_rating', e.target.value ? parseInt(e.target.value) : undefined)}
                                className="w-full bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">相対強度(RS) 最小</label>
                            <input
                                type="number"
                                value={criteria.min_rs_rating || ''}
                                onChange={(e) => handleChange('min_rs_rating', e.target.value ? parseInt(e.target.value) : undefined)}
                                className="w-full bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">予想PER (Min - Max)</label>
                            <div className="flex gap-1">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={criteria.min_forward_pe || ''}
                                    onChange={(e) => handleChange('min_forward_pe', e.target.value ? parseFloat(e.target.value) : undefined)}
                                    className="w-1/2 bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                />
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={criteria.max_forward_pe || ''}
                                    onChange={(e) => handleChange('max_forward_pe', e.target.value ? parseFloat(e.target.value) : undefined)}
                                    className="w-1/2 bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">配当利回り(%) 最小</label>
                            <input
                                type="number"
                                step="0.1"
                                value={criteria.min_dividend_yield !== undefined ? criteria.min_dividend_yield * 100 : ''}
                                onChange={(e) => handleChange('min_dividend_yield', e.target.value ? parseFloat(e.target.value) / 100 : undefined)}
                                className="w-full bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">ROE(%) 最小</label>
                            <input
                                type="number"
                                step="0.1"
                                value={criteria.min_roe !== undefined ? criteria.min_roe * 100 : ''}
                                onChange={(e) => handleChange('min_roe', e.target.value ? parseFloat(e.target.value) / 100 : undefined)}
                                className="w-full bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">{t('status')}</label>
                        <select
                            value={criteria.status || ''}
                            onChange={(e) => handleChange('status', e.target.value || undefined)}
                            className="w-full bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                        >
                            <option value="">指定なし</option>
                            <option value="Holding">{t('holding')}</option>
                            <option value="Past Trade">{t('pastTrade')}</option>
                            <option value="None">監視中</option>
                        </select>
                    </div>
                </div>

                {/* Actions */}
                <div className="border-t border-gray-700 pt-4 flex justify-between items-center">
                    <button
                        onClick={handleClear}
                        className="px-4 py-2 text-red-500 hover:text-red-400 font-bold text-sm border border-red-900/30 rounded bg-red-900/10 hover:bg-red-900/20"
                    >
                        全てクリア
                    </button>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">キャンセル</button>
                        <button
                            onClick={handleApply}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold"
                        >
                            適用
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

