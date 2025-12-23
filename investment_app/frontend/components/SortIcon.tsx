
import React from 'react';

type SortDirection = 'asc' | 'desc';

interface SortConfig {
    key: string;
    direction: SortDirection;
}

interface SortIconProps {
    colKey: string;
    sortConfig: SortConfig | null;
}

export default function SortIcon({ colKey, sortConfig }: SortIconProps) {
    if (sortConfig?.key !== colKey) return <span className="text-gray-600 ml-1">⇅</span>;
    return <span className="text-blue-400 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
}
