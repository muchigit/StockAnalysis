import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { saveFilter } from '@/lib/api';

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

    min_composite_rating?: number;
    min_rs_rating?: number;
    min_atr?: number;
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

export default function FilterDialog({ isOpen, onClose, onApply, onSaved, initialCriteria }: FilterDialogProps) {
    const { t } = useTranslation();
    const [criteria, setCriteria] = useState<FilterCriteria>(initialCriteria || {});
    const [filterName, setFilterName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && initialCriteria) {
            setCriteria(initialCriteria);
        }
    }, [isOpen, initialCriteria]);

    const handleApply = () => {
        onApply(criteria);
        onClose();
    };

    const handleSave = async () => {
        if (!filterName) return;
        setSaving(true);
        try {
            await saveFilter(filterName, JSON.stringify(criteria));
            alert('Filter saved!');
            setFilterName('');
            if (onApply) onApply(criteria); // Optional: apply on save? Maybe not.
            if (onSaved) onSaved();
        } catch (e) {
            console.error(e);
            alert('Failed to save filter');
        } finally {
            setSaving(false);
        }
    };

    const toggleBool = (key: keyof FilterCriteria) => {
        setCriteria(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleChange = (key: keyof FilterCriteria, value: any) => {
        setCriteria(prev => ({ ...prev, [key]: value }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-gray-800 p-6 rounded-lg w-full max-w-lg border border-gray-700 shadow-xl">
                <h2 className="text-xl font-bold mb-4 text-white">Advanced Filter</h2>

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
                            <span>Has 200MA Uptrend</span>
                        </label>
                        <label className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!criteria.has_note}
                                onChange={() => toggleBool('has_note')}
                                className="rounded bg-gray-700 border-gray-600"
                            />
                            <span>Has Note</span>
                        </label>
                        <label className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!criteria.has_analysis}
                                onChange={() => toggleBool('has_analysis')}
                                className="rounded bg-gray-700 border-gray-600"
                            />
                            <span>Has AI Analysis</span>
                        </label>
                    </div>

                    <h3 className="text-sm font-bold text-gray-400 mt-4 mb-2">Technical Signals</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {[
                            { k: 'signal_higher_200ma', l: 'Higher 200MA' },
                            { k: 'signal_near_200ma', l: 'Near 200MA' },
                            { k: 'signal_over_50ma', l: 'Over 50MA' },
                            { k: 'signal_higher_50ma_than_200ma', l: '50MA > 200MA' },
                            { k: 'signal_sameslope_50_200', l: 'Same Slope 50/200' },
                            { k: 'signal_uptrand_200ma', l: '200MA Uptrend' },
                            { k: 'signal_high_volume', l: 'High Volume' },
                            { k: 'signal_newhigh', l: 'New High (All)' },
                            { k: 'signal_newhigh_200days', l: 'New High (200D)' },
                            { k: 'signal_newhigh_100days', l: 'New High (100D)' },
                            { k: 'signal_newhigh_50days', l: 'New High (50D)' },
                            { k: 'signal_price_up', l: 'Price Up' },
                            { k: 'signal_break_atr', l: 'Break ATR' },
                            { k: 'signal_high_slope5ma', l: 'High Slope 5MA' },
                        ].map(item => (
                            <label key={item.k} className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!criteria[item.k as keyof FilterCriteria]}
                                    onChange={() => toggleBool(item.k as keyof FilterCriteria)}
                                    className="rounded bg-gray-700 border-gray-600"
                                />
                                <span className="text-xs">{item.l}</span>
                            </label>
                        ))}
                    </div>

                    {/* Numeric Ranges */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Min Comp Rating</label>
                            <input
                                type="number"
                                value={criteria.min_composite_rating || ''}
                                onChange={(e) => handleChange('min_composite_rating', e.target.value ? parseInt(e.target.value) : undefined)}
                                className="w-full bg-gray-700 text-white rounded px-2 py-1 border border-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Min RS Rating</label>
                            <input
                                type="number"
                                value={criteria.min_rs_rating || ''}
                                onChange={(e) => handleChange('min_rs_rating', e.target.value ? parseInt(e.target.value) : undefined)}
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
                            <option value="">Any</option>
                            <option value="Holding">{t('holding')}</option>
                            <option value="Past Trade">{t('pastTrade')}</option>
                            <option value="None">None (Watching)</option>
                        </select>
                    </div>
                </div>

                {/* Save Section */}
                <div className="border-t border-gray-700 pt-4 mb-6">
                    <h3 className="text-sm font-bold text-gray-400 mb-2">Save Pattern</h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Pattern Name (e.g. Bullish)"
                            value={filterName}
                            onChange={(e) => setFilterName(e.target.value)}
                            className="flex-1 bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600"
                        />
                        <button
                            onClick={handleSave}
                            disabled={!filterName || saving}
                            className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-sm disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                    <button
                        onClick={handleApply}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold"
                    >
                        Apply Filter
                    </button>
                </div>
            </div>
        </div>
    );
}
