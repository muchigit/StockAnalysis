import { useState, useEffect } from 'react';
import { fetchFilters, SavedFilter, deleteFilter, saveFilter, updateFilter } from '@/lib/api';
import { FilterCriteria, isCriteriaActive } from './FilterDialog';

interface FilterSelectProps {
    onSelect: (criteria: FilterCriteria | null) => void;
    refreshKey?: number;
    currentCriteria: FilterCriteria | null;
    onOpenDialog: () => void;
}

export default function FilterSelect({ onSelect, refreshKey, currentCriteria, onOpenDialog }: FilterSelectProps) {
    const [filters, setFilters] = useState<SavedFilter[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');

    const loadFilters = async () => {
        try {
            const data = await fetchFilters();
            setFilters(data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadFilters();
    }, [refreshKey]);

    // Auto-select match when criteria changes (e.g. from URL restoration)
    useEffect(() => {
        if (!currentCriteria) {
            setSelectedId('');
            return;
        }

        // Helper to normalize JSON string for comparison
        const normalize = (obj: any) => {
            if (!obj) return "{}";
            const out: any = {};
            Object.keys(obj).sort().forEach(k => {
                const v = obj[k];
                if (v !== undefined && v !== null) {
                    out[k] = v;
                }
            });
            return JSON.stringify(out);
        };
        const currentStr = normalize(currentCriteria);

        console.log("FilterSelect Debug: Searching for match", { currentCriteria, currentStr, filtersCount: filters.length });

        const match = filters.find(f => {
            try {
                const c = JSON.parse(f.criteria_json);
                const normC = normalize(c);
                const isMatch = normC === currentStr;
                // console.log("Checking filter:", f.name, { c, normC, isMatch }); // Too verbose for all
                if (isMatch) console.log("MATCH FOUND:", f.name);
                return isMatch;
            } catch { return false; }
        });

        if (match) {
            console.log("Setting Selected ID:", match.id);
            setSelectedId(match.id.toString());
        } else {
            console.log("No match found. Setting empty.");
            setSelectedId('');
        }
    }, [currentCriteria, filters]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedId(val);
        const id = parseInt(val);

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

    const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (!selectedId) return;
        const filter = filters.find(f => f.id === parseInt(selectedId));
        if (!confirm(`フィルタ "${filter?.name}" を削除しますか？`)) return;

        try {
            await deleteFilter(parseInt(selectedId));
            setSelectedId('');
            onSelect(null);
            loadFilters();
        } catch (e) {
            alert("削除に失敗しました");
        }
    }

    const handleSave = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (!currentCriteria) {
            alert("検索条件が設定されていません");
            return;
        }

        const id = parseInt(selectedId);

        try {
            if (id) {
                // Update existing
                const filter = filters.find(f => f.id === id);
                if (!confirm(`フィルタ "${filter?.name}" を上書き保存しますか？`)) return;

                const updated = await updateFilter(id, filter?.name || "Filter", JSON.stringify(currentCriteria));
                setFilters(filters.map(f => f.id === id ? updated : f));
                alert("フィルタを更新しました");
            } else {
                // Create new
                const name = prompt("フィルタの名前を入力してください:");
                if (!name) return;

                const newFilter = await saveFilter(name, JSON.stringify(currentCriteria));
                setFilters([newFilter, ...filters]); // Prepend logic or append? sorting handles it
                loadFilters(); // Reload to respect sort
                setSelectedId(newFilter.id.toString());
                alert("フィルタを保存しました");
            }
        } catch (e) {
            console.error(e);
            alert("保存に失敗しました");
        }
    };

    const isActive = currentCriteria && isCriteriaActive(currentCriteria);

    return (
        <div className="flex items-center gap-2 text-sm z-10 relative">
            <span className="font-bold text-gray-400">フィルタ:</span>
            <button
                onClick={onOpenDialog}
                className={`px-3 py-1 rounded text-gray-300 font-bold border border-gray-600 transition ${isActive ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
                詳細設定 {isActive ? '(適用中)' : ''}
            </button>
            <select
                value={selectedId}
                onChange={handleChange}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-300 focus:outline-none max-w-[150px]"
            >
                <option value="">(カスタム)</option>
                {filters.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                ))}
            </select>
            {selectedId && (
                <button
                    onClick={handleDelete}
                    className="text-red-400 hover:text-red-300 font-bold"
                    title="フィルタ削除"
                >
                    ✕
                </button>
            )}
            <button
                onClick={handleSave}
                className="text-blue-400 hover:text-blue-300 text-lg" // Larger icon for floppy, keeping text-lg
                title="フィルタ保存"
            >
                💾
            </button>
        </div>
    );
}
