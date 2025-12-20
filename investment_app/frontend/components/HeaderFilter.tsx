import { useState, useMemo, useRef, useEffect } from 'react';

export type ColumnFilterValue = {
    type: 'select' | 'range';
    selected?: string[]; // For select
    min?: number;        // For range
    max?: number;        // For range
};

interface HeaderFilterProps {
    columnKey: string;
    dataType: 'string' | 'number' | 'date' | 'boolean';
    uniqueValues?: string[] | number[]; // For 'select' mode
    currentFilter?: ColumnFilterValue;
    onApply: (filter: ColumnFilterValue | null) => void;
    title: string;
}

export default function HeaderFilter({ columnKey, dataType, uniqueValues, currentFilter, onApply, title }: HeaderFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Filter State (Local to popover until applied)
    const [tempSelect, setTempSelect] = useState<string[]>(currentFilter?.selected || []);
    const [tempMin, setTempMin] = useState<string>(currentFilter?.min?.toString() || '');
    const [tempMax, setTempMax] = useState<string>(currentFilter?.max?.toString() || '');
    const [searchTerm, setSearchTerm] = useState('');

    // Reset local state when opening
    useEffect(() => {
        if (isOpen) {
            setTempSelect(currentFilter?.selected || []);
            setTempMin(currentFilter?.min?.toString() || '');
            setTempMax(currentFilter?.max?.toString() || '');
            setSearchTerm('');
        }
    }, [isOpen, currentFilter]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleApply = () => {
        if (dataType === 'number') {
            const min = tempMin === '' ? undefined : parseFloat(tempMin);
            const max = tempMax === '' ? undefined : parseFloat(tempMax);
            if (min === undefined && max === undefined) {
                onApply(null);
            } else {
                onApply({ type: 'range', min, max });
            }
        } else {
            // String/Select
            if (tempSelect.length === 0 && uniqueValues && uniqueValues.length > 0) {
                // If nothing selected, maybe clear? Or implies "Show Nothing"?
                // Excel behavior: Unchecking all hides all.
                onApply({ type: 'select', selected: [] });
            } else if (uniqueValues && tempSelect.length === uniqueValues.length) {
                // All selected = Clear filter
                onApply(null);
            } else {
                onApply({ type: 'select', selected: tempSelect });
            }
        }
        setIsOpen(false);
    };

    const handleClear = () => {
        onApply(null);
        setIsOpen(false);
    };

    const toggleValue = (val: string) => {
        if (tempSelect.includes(val)) {
            setTempSelect(tempSelect.filter(v => v !== val));
        } else {
            setTempSelect([...tempSelect, val]);
        }
    };

    const handleSelectAll = () => {
        if (uniqueValues) {
            // If filtered by search, only select/deselect visible?
            // Simple version: Select all unique values.
            setTempSelect(uniqueValues.map(String));
        }
    };

    const handleSelectNone = () => {
        setTempSelect([]);
    };

    // Filter unique values by search
    const displayedValues = useMemo(() => {
        if (!uniqueValues) return [];
        if (!searchTerm) return uniqueValues;
        return uniqueValues.filter(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()));
    }, [uniqueValues, searchTerm]);

    const isActive = !!currentFilter;

    return (
        <div className="relative inline-block ml-1" ref={wrapperRef}>
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className={`p-1 rounded hover:bg-gray-700 transition ${isActive ? 'text-blue-400 bg-gray-800' : 'text-gray-500'}`}
                title="Filter"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-50 text-left cursor-auto font-normal" onClick={(e) => e.stopPropagation()}>
                    <div className="p-3 border-b border-gray-700 font-bold text-sm text-gray-200 flex justify-between items-center">
                        <span>Filter: {title}</span>
                        <button onClick={handleClear} className="text-xs text-red-300 hover:text-red-200 hover:underline">Clear</button>
                    </div>

                    <div className="p-3">
                        {dataType === 'number' ? (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Min</label>
                                    <input
                                        type="number"
                                        value={tempMin}
                                        onChange={(e) => setTempMin(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
                                        placeholder="No Min"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Max</label>
                                    <input
                                        type="number"
                                        value={tempMax}
                                        onChange={(e) => setTempMax(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
                                        placeholder="No Max"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col h-60">
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="mb-2 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                />
                                <div className="flex gap-2 mb-2 text-xs">
                                    <button onClick={handleSelectAll} className="text-blue-400 hover:underline">Select All</button>
                                    <button onClick={handleSelectNone} className="text-blue-400 hover:underline">Select None</button>
                                </div>
                                <div className="flex-1 overflow-y-auto overflow-x-hidden border border-gray-700 rounded bg-gray-900/50 p-1">
                                    {displayedValues.length === 0 && <div className="text-gray-500 text-xs p-2">No matches</div>}
                                    {displayedValues.map(val => (
                                        <label key={String(val)} className="flex items-center gap-2 p-1 hover:bg-gray-800 rounded cursor-pointer whitespace-nowrap">
                                            <input
                                                type="checkbox"
                                                checked={tempSelect.includes(String(val))}
                                                onChange={() => toggleValue(String(val))}
                                                className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-0"
                                            />
                                            <span className="text-xs text-gray-300 truncate">{String(val) || '(Empty)'}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-2 border-t border-gray-700 flex justify-end gap-2 bg-gray-800 rounded-b-lg">
                        <button onClick={() => setIsOpen(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-white border border-transparent hover:border-gray-600 rounded transition">Cancel</button>
                        <button onClick={handleApply} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-bold shadow-lg transition">Apply</button>
                    </div>
                </div>
            )}
        </div>
    );
}
