import { useState, useEffect } from 'react';
import { fetchFilters, SavedFilter, deleteFilter } from '@/lib/api';
import { FilterCriteria } from './FilterDialog';

interface FilterSelectProps {
    onSelect: (criteria: FilterCriteria | null) => void;
    refreshKey?: number;
}

export default function FilterSelect({ onSelect, refreshKey }: FilterSelectProps) {
    const [filters, setFilters] = useState<SavedFilter[]>([]);
    const [loading, setLoading] = useState(true);

    const loadFilters = async () => {
        try {
            const data = await fetchFilters();
            setFilters(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFilters();
    }, [refreshKey]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = parseInt(e.target.value);
        if (!id) {
            onSelect(null); // Clear filter
            return;
        }
        const found = filters.find(f => f.id === id);
        if (found) {
            try {
                const criteria = JSON.parse(found.criteria_json);
                onSelect(criteria);
            } catch (err) {
                console.error("Invalid criteria json", err);
            }
        }
    };

    return (
        <div className="flex items-center gap-2">
            <select
                onChange={handleChange}
                className="bg-gray-800 text-white text-sm border border-gray-600 rounded px-2 py-1 max-w-[150px]"
            >
                <option value="">-- Saved Filters --</option>
                {filters.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                ))}
            </select>
            <button
                onClick={loadFilters}
                className="text-gray-400 hover:text-white text-xs"
                title="Refresh Filters"
            >
                ↻
            </button>
        </div>
    );
}
