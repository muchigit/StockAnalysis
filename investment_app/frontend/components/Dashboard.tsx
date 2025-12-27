"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import { fetchStocks, Stock, triggerImport, createStock, pickFile, updateStock, openAnalysisFolder, fetchStockPriceHistory, generateText, saveStockNote, fetchPrompts, GeminiPrompt } from '@/lib/api';
import { addResearchTicker } from '@/lib/research-storage';
import Toast from '@/components/Toast';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import FilterDialog, { FilterCriteria } from '@/components/FilterDialog';
import FilterSelect from '@/components/FilterSelect';
import ColumnManager from '@/components/ColumnManager';
import HeaderFilter, { ColumnFilterValue } from '@/components/HeaderFilter';
import SystemStatusBanner from '@/components/SystemStatusBanner';
import MiniCandleChart from '@/components/MiniCandleChart';
import SortIcon from '@/components/SortIcon';
import AddToGroupDialog from '@/components/AddToGroupDialog';
import { fetchGroups, fetchGroupMembers, StockGroup } from '@/lib/api';

import AlertDialog from '@/components/AlertDialog';
import { fetchAlerts, checkAlerts, StockAlert, AlertCondition } from '@/lib/api';
import { exportToExcel } from '@/lib/excel-exporter';
import { getRatingColor } from '@/lib/utils';


const DEFAULT_COLUMNS = ['is_buy_candidate', 'symbol', 'company_name', 'sector', 'industry', 'composite_rating', 'rs_rating', 'note', 'note_multiline', 'latest_analysis', 'status', 'change_percentage_1d', 'change_percentage_5d', 'change_percentage_20d', 'change_percentage_50d', 'change_percentage_200d', 'last_buy_date', 'last_sell_date', 'daily_chart_data', 'daily_chart_data_large', 'market_cap', 'volume', 'volume_increase_pct', 'last_earnings_date', 'next_earnings_date', 'realized_pl', 'first_import_date'];

import TradingDialog from '@/components/Trading/TradingDialog';


interface ColumnDef {
    key: string;
    label: string;
    width?: number;
    sortable?: boolean;
    header?: string;
    type?: 'string' | 'number' | 'date' | 'percentage';
    format?: (val: any) => string;
    visible?: boolean;
}

interface DashboardProps {
    showHiddenOnly?: boolean;
}

export default function Dashboard({ showHiddenOnly = false }: DashboardProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const abortBatchRef = useRef(false);

    // Column Definitions (Memoized for translation)
    const INITIAL_COLUMNS: ColumnDef[] = useMemo(() => [
        { key: 'is_buy_candidate', label: '買い', width: 50, sortable: true, header: '★' },
        { key: 'symbol', label: (t('symbol' as any) || 'シンボル'), width: 80, sortable: true },
        { key: 'company_name', label: t('companyName') || '企業名', width: 200, sortable: true },
        { key: 'sector', label: t('sector') || 'セクター', width: 120, sortable: true }, { key: 'industry', label: t('industry') || '業界' },
        { key: 'composite_rating', label: 'CR' },
        { key: 'rs_rating', label: 'RS' },
        { key: 'note', label: t('note') || 'メモ', width: 200 },
        { key: 'note_multiline', label: 'メモ(複数行)', width: 600 },
        { key: 'latest_analysis', label: t('analysis') || 'AI分析', width: 100 },
        { key: 'status', label: t('status') || 'ステータス' },
        { key: 'change_percentage_1d', label: '1D %' },
        { key: 'change_percentage_5d', label: t('change5d') || '5D %' },
        { key: 'change_percentage_20d', label: t('change20d') || '20D %' },
        { key: 'change_percentage_50d', label: t('change50d') || '50D %' },
        { key: 'change_percentage_200d', label: t('change200d') || '200D %' },
        { key: 'last_buy_date', label: t('lastBuy') || '直近買付' },
        { key: 'last_sell_date', label: t('lastSell') || '直近売却' },
        { key: 'daily_chart_data', label: t('chart') || 'チャート', width: 200 },
        { key: 'daily_chart_data_large', label: 'チャート(大)', width: 400 },
        { key: 'realized_pl', label: '確定損益' },
        { key: 'first_import_date', label: '取込日' },
        { key: 'updated_at', label: 'Updated' },
        { key: 'current_price', label: '価格' },
        { key: 'market_cap', label: '時価総額' },
        { key: 'deviation_5ma_pct', label: '乖離5MA' },
        { key: 'deviation_20ma_pct', label: '乖離20MA' },
        { key: 'deviation_50ma_pct', label: '乖離50MA' },
        { key: 'deviation_200ma_pct', label: '乖離200MA' },
        // New Fields
        { key: 'volume', label: '出来高' },
        { key: 'volume_increase_pct', label: '出来高増%' },
        { key: 'last_earnings_date', label: '直近決算', type: 'date' },
        { key: 'next_earnings_date', label: '次回決算', type: 'date' },
        // Predictions
        { key: 'predicted_price_today', label: '推測値(前日)' },
        { key: 'predicted_price_next', label: '推測値(翌日)' },

        // Financials (New)
        { key: 'forward_pe', label: '予想PER', type: 'number', format: (v: number) => v?.toFixed(2), visible: false },
        { key: 'trailing_pe', label: '実績PER', type: 'number', format: (v: number) => v?.toFixed(2), visible: false },
        { key: 'price_to_book', label: 'PBR', type: 'number', format: (v: number) => v?.toFixed(2), visible: false },
        { key: 'dividend_yield', label: '配当利回り', type: 'percentage', format: (v: number) => (v * 100)?.toFixed(2) + '%', visible: false },
        { key: 'return_on_equity', label: 'ROE', type: 'percentage', format: (v: number) => (v * 100)?.toFixed(2) + '%', visible: false },
        { key: 'revenue_growth', label: '売上成長率', type: 'percentage', format: (v: number) => (v * 100)?.toFixed(2) + '%', visible: false },

        // Signals
        { key: 'signal_base_formation', label: 'Base' },
        // Slopes
        { key: 'slope_5ma', label: '傾き(5)', type: 'number', format: (val: number) => val?.toFixed(2), header: '傾き 5MA', visible: false, sortable: true },
        { key: 'slope_20ma', label: '傾き(20)', type: 'number', format: (val: number) => val?.toFixed(2), header: '傾き 20MA', visible: false, sortable: true },
        { key: 'slope_50ma', label: '傾き(50)', type: 'number', format: (val: number) => val?.toFixed(2), header: '傾き 50MA', visible: false, sortable: true },
        { key: 'slope_200ma', label: '傾き(200)', type: 'number', format: (val: number) => val?.toFixed(2), header: '傾き 200MA', visible: false, sortable: true },
    ], [t]);

    // State
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [showBatchDialog, setShowBatchDialog] = useState(false);
    const [prompts, setPrompts] = useState<GeminiPrompt[]>([]);
    const [selectedBatchPromptId, setSelectedBatchPromptId] = useState<number | string>("");
    const [batchProgress, setBatchProgress] = useState<{ current: number, total: number, status: 'idle' | 'running' | 'paused' | 'error' | 'complete', message: string, detail: string }>({ current: 0, total: 0, status: 'idle', message: '', detail: '' });

    // Load Prompts for Batch
    useEffect(() => {
        if (showBatchDialog && prompts.length === 0) {
            fetchPrompts().then(setPrompts).catch(console.error);
        }
    }, [showBatchDialog]);
    // Alert State
    const [showAlertManager, setShowAlertManager] = useState(false);
    const [showAlertDialog, setShowAlertDialog] = useState(false);
    const [alertTargetSymbol, setAlertTargetSymbol] = useState('');
    const [triggeredAlertCount, setTriggeredAlertCount] = useState(0);
    const [alertMap, setAlertMap] = useState<Record<string, StockAlert>>({});

    const refreshAlerts = async () => {
        try {
            const all = await fetchAlerts();
            const triggered = all.filter(a => a.is_active && a.triggered).length;
            setTriggeredAlertCount(triggered);

            const map: Record<string, StockAlert> = {};
            all.forEach(a => {
                if (a.is_active) map[a.symbol] = a;
            });
            setAlertMap(map);
        } catch (e) { console.error("Failed to fetch alerts", e); }
    };

    useEffect(() => {
        refreshAlerts();
    }, []);
    const [loading, setLoading] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Stock; direction: 'asc' | 'desc' } | null>(null);
    const [activeTab, setActiveTab] = useState<'stock' | 'index'>('stock');
    const activeTabRef = useRef(activeTab); // Ref to track current tab in async calls

    useEffect(() => {
        activeTabRef.current = activeTab;
        loadStocks();
    }, [activeTab]);

    // Groups State
    const [groups, setGroups] = useState<StockGroup[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
    const [groupMemberSymbols, setGroupMemberSymbols] = useState<Set<string>>(new Set());
    const [isAddToGroupDialogOpen, setIsAddToGroupDialogOpen] = useState(false);
    const [addToGroupSymbol, setAddToGroupSymbol] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [appliedQuery, setAppliedQuery] = useState('');

    // Import Status
    const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    // Filter
    const [filterMode, setFilterMode] = useState<'all' | 'holding' | 'past' | 'trending' | 'notes' | 'star' | 'doubleCircle' | 'circle' | 'buyCandidate'>('all');
    const [selectedViewId, setSelectedViewId] = useState<string>("");
    const [isTradingOpen, setIsTradingOpen] = useState(false);
    const [tradingSymbol, setTradingSymbol] = useState('');

    // Column Visibility
    const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);

    // Advanced Filter
    const [activeCriteria, setActiveCriteria] = useState<FilterCriteria | null>(null);
    const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

    // Column Filters
    const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterValue>>({});

    // System status
    const [systemStatusMsg, setSystemStatusMsg] = useState<string | null>(null);

    // Index adding
    const [indexSymbol, setIndexSymbol] = useState('');
    const [msg, setMsg] = useState('');

    // Settings loaded flag
    const [areSettingsLoaded, setAreSettingsLoaded] = useState(false);

    // Inline Note Editing State
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingNoteValue, setEditingNoteValue] = useState('');


    // Chart Hover State
    const [hoveredChartStock, setHoveredChartStock] = useState<Stock | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Toast State
    const [toastMsg, setToastMsg] = useState('');
    // Alert Dialog Initial Condition
    const [initialAlertCondition, setInitialAlertCondition] = useState<AlertCondition | undefined>(undefined);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, stock: Stock } | null>(null);

    // Initial Data Load
    useEffect(() => {
        // Restore from localStorage if URL is clean (empty params)
        const paramCount = Array.from(searchParams.keys()).length;

        if (paramCount === 0) {
            const stored = localStorage.getItem('dashboardParams');
            if (stored) {
                router.replace(`${pathname}?${stored}`);
                return;
            }
        }

        // URL Params
        const q = searchParams.get('q');
        if (q) {
            setSearchQuery(q);
            setAppliedQuery(q);
        }

        const tab = searchParams.get('tab');
        if ((tab === 'stock' || tab === 'index') && tab !== activeTab) {
            setActiveTab(tab);
        }

        // Sort
        const sortKey = searchParams.get('sort');
        const sortOrder = searchParams.get('order');
        if (sortKey) {
            setSortConfig({ key: sortKey as any, direction: (sortOrder as any) || 'asc' });
        }

        // Filter
        const filter = searchParams.get('filter');
        if (filter && filter !== filterMode) {
            setFilterMode(filter as any);
        }

        // Advanced Filter
        const adv = searchParams.get('adv');
        if (adv) {
            try {
                const parsed = JSON.parse(adv);
                if (JSON.stringify(activeCriteria) !== adv) {
                    setActiveCriteria(parsed);
                }
            } catch (e) { }
        }

        loadStocks();

    }, [searchParams.toString(), pathname, router]);

    useEffect(() => {
        // Columns
        const savedCols = localStorage.getItem('dashboardVisibleColumns');
        if (savedCols) {
            try {
                const parsed = JSON.parse(savedCols);
                if (Array.isArray(parsed)) {
                    setVisibleColumns(parsed);
                }
            } catch (e) {
                console.error("Failed to parse saved columns", e);
            }
        }

        // View ID
        const savedViewId = localStorage.getItem('dashboardViewId');
        if (savedViewId) {
            setSelectedViewId(savedViewId);
        }

        // Column Filters
        const savedFilters = localStorage.getItem('dashboardColumnFilters');
        if (savedFilters) {
            try {
                const parsed = JSON.parse(savedFilters);
                setColumnFilters(parsed);
            } catch (e) {
                console.error("Failed to parse saved filters", e);
            }
        }

        setAreSettingsLoaded(true);
    }, []);

    // Save settings on change
    useEffect(() => {
        if (areSettingsLoaded) {
            localStorage.setItem('dashboardVisibleColumns', JSON.stringify(visibleColumns));
        }
    }, [visibleColumns, areSettingsLoaded]);

    useEffect(() => {
        if (areSettingsLoaded) {
            if (selectedViewId) {
                localStorage.setItem('dashboardViewId', selectedViewId);
            } else {
                localStorage.removeItem('dashboardViewId');
            }
        }
    }, [selectedViewId, areSettingsLoaded]);

    // Save column filters
    useEffect(() => {
        if (areSettingsLoaded) {
            localStorage.setItem('dashboardColumnFilters', JSON.stringify(columnFilters));
        }
    }, [columnFilters, areSettingsLoaded]);
    async function loadStocks(silent: boolean = false) {
        if (!silent) setLoading(true);
        const targetTab = activeTab; // Capture fetch scope
        try {
            const data = await fetchStocks(0, 2000, targetTab, showHiddenOnly); // Pass showHiddenOnly

            // Guard: Only update if we are still on the same tab
            if (activeTabRef.current === targetTab) {
                setStocks(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (activeTabRef.current === targetTab) {
                if (!silent) setLoading(false);
            }
        }
    }



    async function handleAddIndex() {
        if (!indexSymbol) return;
        try {
            await createStock(indexSymbol, 'index');
            setIndexSymbol('');
            loadStocks();
            setMsg("Index added successfully");
        } catch (e: any) {
            setMsg("Failed to add index: " + e.message);
        }
    }

    async function handleImport() {
        const prev = localStorage.getItem('lastImportPath') || '';
        const path = await pickFile(prev);

        if (!path) return; // Cancelled

        localStorage.setItem('lastImportPath', path);

        try {
            setImportStatus('loading');
            const res = await triggerImport([path]);
            await loadStocks(); // Refresh data
            setImportStatus('success');

            if (res.added_stocks && res.added_stocks.length > 0) {
                alert(`インポートが完了しました。\n${res.added_stocks.length} 件の新規銘柄が追加されました:\n${res.added_stocks.join(', ')}`);
            } else {
                setToastMsg('インポートが完了しました (新規追加なし)');
            }

            setTimeout(() => setImportStatus('idle'), 3000);
        } catch (e) {
            setImportStatus('error');
            setTimeout(() => setImportStatus('idle'), 3000);
        }
    }

    // Inline Note Handlers
    const handleNoteDoubleClick = (stock: Stock) => {
        setEditingNoteId(stock.symbol);
        setEditingNoteValue(stock.note || '');
    };

    const handleNoteSave = async (symbol: string) => {
        try {
            await saveStockNote(symbol, editingNoteValue);
            // Optimistic update
            setStocks(prev => prev.map(s => s.symbol === symbol ? { ...s, note: editingNoteValue } : s));
            setEditingNoteId(null);
        } catch (e) {
            console.error("Failed to save note", e);
            alert("Failed to save note");
        }
    };

    const handleNoteKeyDown = (e: React.KeyboardEvent, symbol: string) => {
        if (e.key === 'Enter') {
            handleNoteSave(symbol);
        } else if (e.key === 'Escape') {
            setEditingNoteId(null);
        }
    };



    // Chart Hover Handlers
    const handleChartEnter = (stock: Stock) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredChartStock(stock);
        }, 600); // 0.6s delay
    };

    const handleChartLeave = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setHoveredChartStock(null);
    };


    const setSort = (key: keyof Stock, direction: 'asc' | 'desc') => {
        setSortConfig({ key, direction });
        updateUrl({ sort: key, order: direction });
    };

    const handleSort = (key: keyof Stock) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSort(key, direction);
    };

    // Helper to update URL
    const updateUrl = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === '') {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        });
        const queryString = params.toString();
        localStorage.setItem('dashboardParams', queryString); // Save to LocalStorage
        router.replace(`${pathname}?${queryString}`);
    };

    // Load Groups
    useEffect(() => {
        fetchGroups().then(setGroups).catch(console.error);
    }, []);

    // Load Group Members when selected
    useEffect(() => {
        if (selectedGroupId) {
            fetchGroupMembers(selectedGroupId).then(stocks => {
                setGroupMemberSymbols(new Set(stocks.map(s => s.symbol)));
            }).catch(console.error);
        } else {
            setGroupMemberSymbols(new Set());
        }
    }, [selectedGroupId]);

    const handleRefresh = () => {
        loadStocks();
        refreshAlerts();
    };

    const handleTabChange = (tab: 'stock' | 'index') => {
        setStocks([]); // Clear data to avoid showing stale table content
        setActiveTab(tab);
        setCurrentPage(1);
        updateUrl({ tab });
    };

    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        // updateUrl({ q: val || null }); // Removed immediate update
    };

    // Handle Enter key for search
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            setAppliedQuery(searchQuery);
            updateUrl({ q: searchQuery || null });
        }
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setAppliedQuery('');
        updateUrl({ q: null });
    };

    const handleFilterChange = (mode: 'all' | 'holding' | 'past' | 'trending' | 'notes' | 'star' | 'doubleCircle' | 'circle' | 'buyCandidate') => {
        const newMode = filterMode === mode ? 'all' : mode;
        setFilterMode(newMode);
        updateUrl({ filter: newMode === 'all' ? null : newMode });
    };

    // Advanced Filter Handlers
    const handleApplyAdvancedFilter = (criteria: FilterCriteria | null) => {
        setActiveCriteria(criteria);
        if (criteria) {
            try {
                updateUrl({ adv: JSON.stringify(criteria) });
            } catch (e) {
                console.error("Failed to serialize criteria", e);
            }
        } else {
            updateUrl({ adv: null });
        }
    };
    // Column Resize Handler
    const handleColumnResize = (key: string, width: number) => {
        // We'll update the column width in INITIAL_COLUMNS (requires state or memo update if we want persistence but memo is computed)
        // For now, simpler implementation:
        // Actually INITIAL_COLUMNS is memoized. We might need a state for column definitions if we want them resizable.
        // But for "Manager", we likely just want the labels.
        // Let's just use INITIAL_COLUMNS for finding labels.
    };

    const getColumnLabel = (key: string) => {
        const col = INITIAL_COLUMNS.find(c => c.key === key);
        return col?.label || key;
    };

    const handleExportExcel = async () => {
        // Columns for export
        // 1. Filter out Charts and 2. Use visibleColumns order
        const cols = visibleColumns
            .filter(key => key !== 'daily_chart_data' && key !== 'daily_chart_data_large')
            .map(key => {
                const def = INITIAL_COLUMNS.find(c => c.key === key);
                let type: 'string' | 'number' | 'percentage' | 'date' = 'string';

                if (key.includes('percentage') || key.includes('deviation_')) {
                    type = 'percentage';
                } else if (['current_price', 'market_cap', 'realized_pl', 'composite_rating', 'rs_rating', 'slope_5ma', 'slope_20ma', 'slope_50ma', 'slope_200ma'].includes(key)) {
                    type = 'number';
                } else if (key.includes('date') || key.includes('updated_at')) {
                    type = 'date';
                }

                return {
                    key: key,
                    header: def?.label || key,
                    width: def?.width ? def.width / 7 : 15,
                    type: type
                };
            });

        // Info Sheet Data
        const summary: Record<string, string | number> = {
            '出力日時': new Date().toLocaleString(),
            '銘柄数': sortedStocks.length,
            '表示タブ': activeTab === 'stock' ? '個別株' : '指数',
            'フィルタモード': filterMode,
            '検索ワード': appliedQuery || '(なし)',
        };

        if (activeCriteria) {
            summary['詳細フィルタ'] = Object.entries(activeCriteria)
                .filter(([_, v]) => v !== undefined && v !== null && v !== false)
                .map(([k, v]) => `${k}:${v}`)
                .join(', ');
        }

        const activeColFilters = Object.entries(columnFilters).filter(([_, v]) => v !== null);
        if (activeColFilters.length > 0) {
            summary['列フィルタ'] = activeColFilters.map(([k, v]) => {
                if ('min' in v || 'max' in v) return `${k}(${v.min ?? ''}~${v.max ?? ''})`;
                if ('selected' in v) return `${k}(${v.selected?.length})`;
                return k;
            }).join(', ');
        }

        await exportToExcel({
            fileName: `dashboard_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
            sheetName: 'Stocks',
            summaryData: summary,
            columns: cols,
            data: sortedStocks // Export filtered and sorted data
        });
    };

    const handleColumnFilterChange = (key: string, value: ColumnFilterValue | null) => {
        setColumnFilters(prev => {
            const next = { ...prev };
            if (value === null) {
                delete next[key];
            } else {
                next[key] = value;
            }
            return next;
        });
    };

    // Reset page when criteria changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeCriteria]);

    // Filtering Logic
    const filteredStocks = useMemo(() => {
        return stocks.filter(stock => {
            // 1. Text Search (Symbol, Company, Sector)
            if (appliedQuery) {
                const q = appliedQuery.toLowerCase();
                const match = stock.symbol.toLowerCase().includes(q) ||
                    stock.company_name.toLowerCase().includes(q) ||
                    stock.sector?.toLowerCase().includes(q) ||
                    (stock.note || '').toLowerCase().includes(q) ||
                    (stock.latest_analysis || '').toLowerCase().includes(q);
                if (!match) return false;
            }

            // 2. Tab Filter (Managed by API but good to double check or if mixed)
            // API handles asset_type, so we can assume stocks here are correct type unless mixed list.
            if (activeTab === 'index') return true; // Bypass other filters for indices

            // 3. Quick Filters
            if (filterMode === 'holding') {
                if (stock.status !== 'Holding') return false;
            } else if (filterMode === 'past') {
                if (stock.status !== 'Past Trade') return false;
            } else if (filterMode === 'trending') {
                if (!stock.is_in_uptrend) return false;
            } else if (filterMode === 'notes') {
                if (!stock.note) return false;
            } else if (filterMode === 'star') {
                if (!stock.is_buy_candidate) return false;
            } else if (filterMode === 'doubleCircle') {
                if (!((stock.composite_rating || 0) >= 95)) return false;
            } else if (filterMode === 'circle') {
                if (!((stock.composite_rating || 0) >= 80 && (stock.composite_rating || 0) < 95)) return false;
            } else if (filterMode === 'buyCandidate') {
                if (!(stock.is_buy_candidate === true)) return false;
            }

            // Group Filter
            if (selectedGroupId && !groupMemberSymbols.has(stock.symbol)) {
                return false;
            }

            // 4. Advanced Filters
            if (activeCriteria) {
                if (activeCriteria.status && activeCriteria.status !== 'None' && stock.status !== activeCriteria.status) return false;
                if (activeCriteria.industry && activeCriteria.industry !== 'Any' && stock.industry !== activeCriteria.industry) return false;

                if (activeCriteria.min_composite_rating && (stock.composite_rating || 0) < activeCriteria.min_composite_rating) return false;
                if (activeCriteria.min_rs_rating && (stock.rs_rating || 0) < activeCriteria.min_rs_rating) return false;
                if (activeCriteria.min_atr && (stock.atr_14 || 0) < activeCriteria.min_atr) return false;

                // Financials Filters
                if (activeCriteria.min_forward_pe && (stock.forward_pe || 0) < activeCriteria.min_forward_pe) return false;
                if (activeCriteria.max_forward_pe && (stock.forward_pe || 0) > activeCriteria.max_forward_pe) return false;
                if (activeCriteria.min_dividend_yield && (stock.dividend_yield || 0) < activeCriteria.min_dividend_yield) return false;
                if (activeCriteria.min_roe && (stock.return_on_equity || 0) < activeCriteria.min_roe) return false;

                if (activeCriteria.is_in_uptrend && !stock.is_in_uptrend) return false;
                if (activeCriteria.has_note && !stock.note) return false;
                if (activeCriteria.has_analysis && !stock.latest_analysis) return false;

                // Dynamic Signal Checks
                // Iterate over keys starting with 'signal_' in activeCriteria
                for (const key in activeCriteria) {
                    if (key.startsWith('signal_') && (activeCriteria as any)[key] === true) {
                        // Check if stock has this signal = 1
                        if ((stock as any)[key] !== 1) return false;
                    }
                }
            }

            // 5. Column Filters
            for (const [key, filterVal] of Object.entries(columnFilters)) {
                if (!filterVal) continue;

                const val = (stock as any)[key];

                // Range Filter
                if ('min' in filterVal || 'max' in filterVal) {
                    const numVal = Number(val);
                    if (isNaN(numVal)) continue; // skip check if value is not number
                    if (filterVal.min !== undefined && numVal < filterVal.min) return false;
                    if (filterVal.max !== undefined && numVal > filterVal.max) return false;
                }

                // Text Filter
                if (filterVal.type === 'text' && filterVal.text) {
                    // Map virtual columns to actual data properties
                    const dataKey = key === 'note_multiline' ? 'note' : key;
                    const val = String((stock as any)[dataKey] || '').toLowerCase();
                    if (!val.includes(filterVal.text.toLowerCase())) return false;
                }

                // Select Filter
                if ('selected' in filterVal && filterVal.selected) { // check if selected exists
                    if (filterVal.selected.length > 0) {
                        // Check if current value matches any selected
                        // Special handling for (空白)
                        const hasEmptySelection = filterVal.selected.includes('(空白)');
                        const valStr = String(val || '');

                        let match = false;
                        if (hasEmptySelection && (!val || valStr.trim() === '')) {
                            match = true;
                        } else if (filterVal.selected.includes(valStr)) {
                            match = true;
                        }

                        if (!match) return false;
                    }
                }

                // Date Range Filter
                if ('startDate' in filterVal || 'endDate' in filterVal) {
                    if (!val) return false; // No date value = filtered out if filter active?
                    // Check logic: if val exists, parse it.
                    // Assumes val is YYYY-MM-DD string or ISO.
                    const d = new Date(String(val));
                    const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD

                    if (filterVal.startDate) {
                        if (dateStr < filterVal.startDate) return false;
                    }
                    if (filterVal.endDate) {
                        if (dateStr > filterVal.endDate) return false;
                    }
                }
            }

            return true;
        });
    }, [stocks, appliedQuery, filterMode, activeCriteria, columnFilters]);

    // Sorting Logic
    const sortedStocks = useMemo(() => {
        if (!sortConfig) return filteredStocks;
        return [...filteredStocks].sort((a, b) => {
            // Handle nulls/undefined always at end
            const aVal = (a as any)[sortConfig.key];
            const bVal = (b as any)[sortConfig.key];

            if (aVal === bVal) return 0;
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            if (aVal < bVal) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aVal > bVal) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [filteredStocks, sortConfig]);

    // Pagination Logic
    const totalPages = Math.ceil(sortedStocks.length / ITEMS_PER_PAGE);
    const currentStocks = sortedStocks.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Batch Gemini Run
    const handleBatchGeminiRun = async () => {
        if (!selectedBatchPromptId) return;
        const promptTemplate = prompts.find(p => p.id == selectedBatchPromptId)?.content;
        if (!promptTemplate) return;

        // Use filtered stocks as targets
        const targets = filteredStocks;

        setShowBatchDialog(false); // Close dialog immediately
        abortBatchRef.current = false;
        setBatchProgress({ current: 0, total: targets.length, status: 'running', message: 'Starting...', detail: '' });

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < targets.length; i++) {
            if (abortBatchRef.current) {
                setBatchProgress(prev => ({ ...prev, status: 'paused', message: 'Cancelled' }));
                break;
            }
            const stock = targets[i];

            setBatchProgress({
                current: i + 1,
                total: targets.length,
                status: 'running',
                message: `Processing ${stock.symbol}...`,
                detail: stock.company_name
            });

            let retries = 0;
            const MAX_RETRIES = 3;
            let success = false;

            while (retries < MAX_RETRIES && !success) {
                if (abortBatchRef.current) break;
                try {
                    const stockData = `
Price: ${stock.current_price}
CR: ${stock.composite_rating} / RS: ${stock.rs_rating}
Sector: ${stock.sector} / Industry: ${stock.industry}
Market Cap: ${stock.market_cap}
`.trim();
                    const today = new Date().toISOString().split('T')[0];
                    const prompt = promptTemplate
                        .replace(/%COMPANYNAME%/g, stock.company_name || stock.symbol)
                        .replace(/%SYMBOL%/g, stock.symbol)
                        .replace(/%DATE%/g, today)
                        .replace(/%STOCKDATA%/g, stockData);

                    const text = await generateText(prompt);

                    // Validation: Check for Error string
                    if (!text || text.trim().startsWith("Error") || text.includes("Error uploading image")) {
                        throw new Error("Generated text indicates error: " + text.slice(0, 50));
                    }

                    if (text) {
                        await saveStockNote(stock.symbol, text);
                        setStocks(prev => prev.map(s => s.symbol === stock.symbol ? { ...s, note: text } : s));
                        successCount++;
                        success = true;
                    }
                } catch (e) {
                    console.error(`Failed to generate for ${stock.symbol} (Attempt ${retries + 1})`, e);
                    retries++;
                    if (retries < MAX_RETRIES) {
                        setBatchProgress(prev => ({
                            ...prev,
                            detail: `${stock.company_name} (Retry ${retries}/${MAX_RETRIES})`
                        }));
                        await new Promise(r => setTimeout(r, 5000)); // Wait 5s before retry
                    } else {
                        failCount++;
                    }
                }
            }

            // Small delay
            await new Promise(r => setTimeout(r, 1000));
        }
        setBatchProgress(prev => ({ ...prev, status: 'complete', message: `Completed. Success: ${successCount}, Failed: ${failCount}`, detail: '' }));
    };

    // Reset page when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [totalPages]);



    const handleAddResearch = (symbol: string) => {
        addResearchTicker(symbol);
        setToastMsg(t('addedToResearch').replace('{{symbol}}', symbol));
    };



    const handleGlobalKeyDown = (e: React.KeyboardEvent) => {
        // Ignore if input/textarea is focused
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
            return;
        }

        if (e.key === 'ArrowLeft') {
            setCurrentPage(p => Math.max(1, p - 1));
        } else if (e.key === 'ArrowRight') {
            setCurrentPage(p => Math.min(totalPages, p + 1));
        }
    };

    const renderCell = (stock: Stock, key: string) => {
        switch (key) {
            case 'is_buy_candidate':
                return (
                    <button
                        onClick={async (e) => {
                            e.stopPropagation();
                            const newValue = !stock.is_buy_candidate;
                            try {
                                await updateStock(stock.symbol, { is_buy_candidate: newValue });
                                // Optimistic update or refresh
                                setStocks(prev => prev.map(s => s.symbol === stock.symbol ? { ...s, is_buy_candidate: newValue } : s));
                            } catch (error) {
                                console.error("Failed to update buy mark", error);
                            }
                        }}
                        className={`text-lg focus:outline-none transition-colors ${stock.is_buy_candidate ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'text-gray-700 hover:text-gray-500'}`}
                        title={stock.is_buy_candidate ? "Remove Buy Candidate" : "Mark as Buy Candidate"}
                    >
                        {stock.is_buy_candidate ? '★' : '☆'}
                    </button>
                );
            case 'symbol':
                return (
                    <div className="flex items-center gap-2">
                        <Link href={`/stocks/${stock.symbol}`} className="font-bold text-blue-400 hover:text-blue-300 hover:underline">
                            {stock.symbol}
                        </Link>
                        {/* Trade button hidden as OpenD is not available in JP
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setTradingSymbol(stock.symbol);
                                setIsTradingOpen(true);
                            }}
                            className="px-1.5 py-0.5 bg-green-900 text-green-300 text-[10px] rounded hover:bg-green-800 border border-green-700 font-bold"
                            title="Trade"
                        >
                            $
                        </button>
                        */}
                        <div className="flex gap-1">
                            {/* Base Formation Badge (Icon) */}
                            {stock.signal_base_formation === 1 && (
                                <span title="Base Formation (Tight Area)" className="cursor-help">🧱</span>
                            )}
                            <a
                                href={`https://research.investors.com/ibdchartsenlarged.aspx?symbol=${stock.symbol}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-50 hover:opacity-100 transition"
                                onClick={(e) => e.stopPropagation()}
                                title="IBD Chart"
                            >
                                <span className="text-[10px] bg-yellow-600 text-white px-1 py-0.5 rounded font-bold">I</span>
                            </a>
                            <a
                                href={`https://www.tradingview.com/chart/?symbol=${stock.symbol}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-50 hover:opacity-100 transition"
                                onClick={(e) => e.stopPropagation()}
                                title="TradingView"
                            >
                                <span className="text-[10px] bg-blue-600 text-white px-1 py-0.5 rounded font-bold">T</span>
                            </a>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setAddToGroupSymbol(stock.symbol);
                                    setIsAddToGroupDialogOpen(true);
                                }}
                                className="opacity-50 hover:opacity-100 transition"
                                title="Add to Group"
                            >
                                <span className="text-lg leading-none">📁</span>
                            </button>
                            {/* Add to Research Icon (Restored) */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddResearch(stock.symbol);
                                }}
                                className="opacity-50 hover:opacity-100 transition"
                                title={t('addToDeepResearch')}
                            >
                                <span className="text-lg leading-none">🧠</span>
                            </button>
                            {/* Alert Icon (Conditional) */}
                            {alertMap[stock.symbol] && (
                                <Link
                                    href="/alerts"
                                    className="flex items-center text-gray-400 hover:text-white group relative ml-1"
                                    title={t('alert') || 'Alert'}
                                >
                                    <div className="w-5 h-5 flex items-center justify-center rounded-full group-hover:bg-gray-800 transition relative">
                                        🔔
                                        {alertMap[stock.symbol].triggered && (
                                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            )}
                        </div>
                    </div >
                );

            case 'sector':
            case 'industry':
                return (
                    <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700 whitespace-nowrap block truncate max-w-[120px]" title={String(stock[key as keyof Stock])}>
                        {String(stock[key as keyof Stock])}
                    </span>
                );

            case 'company_name':
                return <div className="truncate max-w-[150px]" title={stock.company_name}>{stock.company_name}</div>;

            case 'note':
                if (editingNoteId === stock.symbol) {
                    return (
                        <input
                            type="text"
                            value={editingNoteValue}
                            onChange={(e) => setEditingNoteValue(e.target.value)}
                            onBlur={() => handleNoteSave(stock.symbol)}
                            onKeyDown={(e) => handleNoteKeyDown(e, stock.symbol)}
                            autoFocus
                            className="bg-gray-700 text-white p-1 rounded w-full border border-blue-500 outline-none"
                            onClick={(e) => e.stopPropagation()}
                        />
                    );
                }
                return (
                    <div
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleNoteDoubleClick(stock);
                        }}
                        className="cursor-text min-h-[20px] hover:bg-gray-800/50 rounded px-1 transition truncate max-w-[200px]"
                        title={stock.note}
                    >
                        {stock.note || null}
                    </div>
                );

            case 'note_multiline':
                if (editingNoteId === stock.symbol) {
                    return (
                        <textarea
                            value={editingNoteValue}
                            onChange={(e) => setEditingNoteValue(e.target.value)}
                            onBlur={() => handleNoteSave(stock.symbol)}
                            onKeyDown={(e) => {
                                // Shift+Enter for newline, Enter to save
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleNoteSave(stock.symbol);
                                }
                            }}
                            autoFocus
                            className="bg-gray-700 text-white p-1 rounded w-full h-28 border border-blue-500 outline-none text-sm"
                            onClick={(e) => e.stopPropagation()}
                        />
                    );
                }
                return (
                    <div
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleNoteDoubleClick(stock);
                        }}
                        className="cursor-text h-28 overflow-y-auto whitespace-pre-wrap text-sm hover:bg-gray-800/50 rounded px-1 transition border border-gray-800/50"
                        title={stock.note}
                    >
                        {stock.note || null}
                    </div>
                );

            case 'status':
                let color = 'bg-gray-700 text-gray-300';
                let label = '';
                if (stock.status === 'Holding') {
                    color = 'bg-green-900 text-green-300 border border-green-700';
                    label = '保有中';
                } else if (stock.status === 'Past Trade') {
                    color = 'bg-blue-900 text-blue-300 border border-blue-700';
                    label = '過去の取引';
                } else {
                    return null; // None -> Empty
                }
                return <span className={`text-xs px-2 py-0.5 rounded border ${color}`}>{label}</span>;

            case 'latest_analysis':
                if (!stock.latest_analysis) return null;
                return (
                    <div
                        className="truncate max-w-[150px] text-xs text-gray-200 font-medium"
                        title={stock.latest_analysis}
                    >
                        {stock.latest_analysis}
                    </div>
                );

            case 'composite_rating':
                const crVal = stock[key as keyof Stock];
                return <span className={getRatingColor(Number(crVal))}>{crVal || '-'}</span>;

            case 'rs_rating':
                const rsVal = stock[key as keyof Stock];
                return <span className={getRatingColor(Number(rsVal))}>{rsVal || '-'}</span>;

            case 'change_percentage_1d':
            case 'change_percentage_5d':
            case 'change_percentage_20d':
            case 'change_percentage_50d':
            case 'change_percentage_200d':
            case 'deviation_5ma_pct':
            case 'deviation_20ma_pct':
            case 'deviation_50ma_pct':
            case 'deviation_200ma_pct':
                const p = stock[key as keyof Stock] as number;
                if (p === undefined || p === null) return <div className="text-right text-gray-700 font-mono">-</div>;
                return (
                    <div className={`text-right font-mono ${p > 0 ? 'text-red-400' : p < 0 ? 'text-blue-400' : 'text-gray-500'}`}>
                        {p > 0 ? '+' : ''}{p.toFixed(2)}%
                    </div>
                );

            case 'realized_pl':
                const pl = stock.realized_pl as number;
                if (pl === undefined || pl === null || pl === 0) return null;
                return (
                    <div className={`text-right font-mono ${pl > 0 ? 'text-red-400' : pl < 0 ? 'text-blue-400' : 'text-gray-500'}`}>
                        {pl > 0 ? '+' : ''}{Math.round(pl).toLocaleString()}
                    </div>
                );

            case 'predicted_price_today':
            case 'predicted_price_next':
                const predVal = stock[key as keyof Stock] as number | undefined | null;
                if (predVal === undefined || predVal === null) {
                    return <div className="text-right text-gray-600 font-mono">-</div>;
                }

                let predColor = 'text-white'; // Default equal
                if (stock.current_price !== undefined && stock.current_price !== null) {
                    if (predVal > stock.current_price) predColor = 'text-red-400';
                    else if (predVal < stock.current_price) predColor = 'text-blue-400';
                }

                return (
                    <div className={`text-right font-mono ${predColor}`}>
                        {predVal.toFixed(2)}
                    </div>
                );

            case 'first_import_date':
            case 'updated_at':
            case 'last_buy_date':
            case 'last_sell_date':
                const d = stock[key as keyof Stock];
                return d ? new Date(String(d)).toISOString().split('T')[0] : null;

            case 'daily_chart_data':
                return (
                    <div
                        onMouseEnter={() => handleChartEnter(stock)}
                        onMouseLeave={handleChartLeave}
                        className="relative"
                    >
                        <MiniCandleChart dataJson={stock.daily_chart_data as string} />
                    </div>
                );

            case 'daily_chart_data_large':
                return <MiniCandleChart dataJson={stock.daily_chart_data as string} width={384} height={144} />;

            case 'market_cap':
                const mc = Number(stock.market_cap);
                if (!mc) return <div className="text-right">-</div>;
                return <div className="text-right font-mono text-xs">{(mc / 1e9).toFixed(2)}B</div>;

            case 'volume':
                const vol = Number(stock.volume);
                if (!vol) return <div className="text-right">-</div>;
                if (vol >= 1e9) return <div className="text-right font-mono text-xs">{(vol / 1e9).toFixed(2)}B</div>;
                if (vol >= 1e6) return <div className="text-right font-mono text-xs">{(vol / 1e6).toFixed(2)}M</div>;
                if (vol >= 1e3) return <div className="text-right font-mono text-xs">{(vol / 1e3).toFixed(0)}K</div>;
                return <div className="text-right font-mono text-xs">{vol.toLocaleString()}</div>;

            case 'volume_increase_pct':
                const vp = stock.volume_increase_pct;
                if (vp === undefined || vp === null) return <div className="text-right text-gray-700 font-mono">-</div>;
                return (
                    <div className={`text-right font-mono ${vp > 20 ? 'text-red-500 font-bold' : vp > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                        {vp > 0 ? '+' : ''}{vp.toFixed(1)}%
                    </div>
                );

            case 'last_earnings_date':
            case 'next_earnings_date':
                const ed = stock[key as keyof Stock];
                return ed ? <div className="text-right text-xs text-gray-400">{new Date(String(ed)).toISOString().split('T')[0]}</div> : null;

            case 'current_price':
                const price = stock.current_price;
                return price !== undefined && price !== null ? (
                    <div className="text-right font-mono">{Number(price).toFixed(2)}</div>
                ) : (
                    <div className="text-right">-</div>
                );

            case 'signal_base_formation':
                return stock.signal_base_formation ? (
                    <div className="flex justify-center">
                        <span className="inline-block px-2 py-0.5 bg-indigo-900 border border-indigo-700 text-indigo-300 rounded text-xs font-bold shadow-[0_0_10px_rgba(99,102,241,0.3)] animate-pulse">
                            BASE
                        </span>
                    </div>
                ) : null;

            default:
                const v = stock[key as keyof Stock];
                return v !== undefined && v !== null ? String(v) : '-';
        }
    };

    // Focus Refresh (Buy Mark Sync Fix)
    useEffect(() => {
        const handleFocus = () => {
            // Refresh data when window gains focus
            loadStocks(true); // silent refresh
            refreshAlerts();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [activeTab, sortConfig, currentPage, searchQuery, filterMode, appliedQuery]);

    // Derived Activity State
    const isBackgroundActive = loading || importStatus === 'loading' || (batchProgress && batchProgress.status === 'running') || false;
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (isMenuOpen && !target.closest('.menu-container')) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    return (
        <div className="min-h-screen bg-black text-gray-200 font-sans cursor-default" onKeyDown={handleGlobalKeyDown} tabIndex={-1}>
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold flex items-center gap-4">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        {t('dashboard')}
                    </span>
                    {/* Tab Switcher */}
                    <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700 ml-4">
                        <button
                            onClick={() => handleTabChange('stock')}
                            className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${activeTab === 'stock' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Stock
                        </button>
                        <button
                            onClick={() => handleTabChange('index')}
                            className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${activeTab === 'index' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Index
                        </button>
                    </div>
                </h1>
                <div className="flex items-center gap-4">
                    {/* Activity Indicator */}
                    {/* Activity Indicator */}
                    {isBackgroundActive && (
                        <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-900 rounded-full border border-blue-900/50 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="relative">
                                <div className="w-3 h-3 bg-blue-500 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-75"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-blue-300">
                                    {batchProgress?.status === 'running'
                                        ? `一括生成中 (${batchProgress.current}/${batchProgress.total})`
                                        : importStatus === 'loading'
                                            ? 'データ取込中...'
                                            : '処理中...'}
                                </span>
                                {batchProgress?.status === 'running' && batchProgress.detail && (
                                    <span className="text-[10px] text-gray-400 max-w-[150px] truncate">
                                        {batchProgress.detail}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    <SystemStatusBanner />

                    {/* Alert Toggle Button */}
                    <button
                        onClick={() => router.push('/alerts')}
                        className={`p-2 rounded-lg border transition-colors relative ${triggeredAlertCount > 0 ? 'bg-gray-700 text-yellow-400 border-yellow-500/50' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}
                        title="Alerts"
                    >
                        🔔
                        {triggeredAlertCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                        )}
                    </button>

                    {/* Menu Button */}
                    <div className="relative menu-container">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2 border border-gray-700"
                        >
                            <span className="text-xl">≡</span>
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                <div className="p-2 space-y-1">
                                    <button
                                        onClick={() => { setIsMenuOpen(false); router.push('/calendar'); }}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-200 flex items-center gap-2 transition"
                                    >
                                        <span>📅</span> Earnings Calendar
                                    </button>
                                    <button
                                        onClick={() => { setIsMenuOpen(false); handleRefresh(); }}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-200 flex items-center gap-2 transition"
                                    >
                                        <span>🔄</span> {t('refresh')}
                                    </button>
                                    <button
                                        onClick={() => { setIsMenuOpen(false); handleImport(); }}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-200 flex items-center gap-2 transition"
                                    >
                                        <span>📥</span> {t('import')}
                                    </button>
                                    <button
                                        onClick={() => { setIsMenuOpen(false); setShowBatchDialog(true); }}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-200 flex items-center gap-2 transition"
                                    >
                                        <span>⚡</span> Gemini一括分析
                                    </button>
                                    <div className="h-px bg-gray-700 my-1"></div>
                                    <button
                                        onClick={() => { setIsMenuOpen(false); handleExportExcel(); }}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-200 flex items-center gap-2 transition"
                                    >
                                        <span>📤</span> Excelエクスポート
                                    </button>
                                    <div className="h-px bg-gray-700 my-1"></div>
                                    <button
                                        onClick={() => { setIsMenuOpen(false); router.push('/deep-research'); }}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-200 flex items-center gap-2 transition"
                                    >
                                        <span>🧠</span> ディープリサーチ
                                    </button>
                                    <button
                                        onClick={() => { setIsMenuOpen(false); router.push('/heatmap'); }}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-200 flex items-center gap-2 transition"
                                    >
                                        <span>🗺️</span> セクターマップ
                                    </button>
                                    <button
                                        onClick={() => { setIsMenuOpen(false); router.push('/groups'); }}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-200 flex items-center gap-2 transition"
                                    >
                                        <span>📁</span> グループ管理
                                    </button>
                                    <button
                                        onClick={() => { setIsMenuOpen(false); router.push('/historical-analysis'); }}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-200 flex items-center gap-2 transition"
                                    >
                                        <span>📈</span> 過去検証
                                    </button>
                                    <div className="h-px bg-gray-700 my-1"></div>
                                    <button
                                        onClick={() => { setIsMenuOpen(false); router.push('/settings'); }}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-200 flex items-center gap-2 transition"
                                    >
                                        <span>⚙️</span> {t('settings')}
                                    </button>
                                </div>
                                {/* Hidden File Input for Menu */}

                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="p-4">
                {/* Controls & Filter Bar */}
                <div className="flex flex-wrap gap-4 mb-6 items-center bg-gray-900/50 p-4 rounded-xl border border-gray-800 backdrop-blur-sm">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder={t('searchPlaceholder' as any) || "銘柄、名前、メモを検索..."}
                            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 pl-10 focus:outline-none focus:border-blue-500 w-64 transition-all"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <span className="absolute left-3 top-2.5 text-gray-500">🔍</span>
                        {searchQuery && (
                            <button onClick={handleClearSearch} className="absolute right-3 top-2.5 text-gray-500 hover:text-white text-xs">✕</button>
                        )}
                    </div>

                    <div className="h-8 w-px bg-gray-700 mx-2"></div>

                    {/* Ticker Jump Input */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="銘柄コードへ移動..."
                            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 pl-9 focus:outline-none focus:border-green-500 w-40 transition-all font-mono"
                            onKeyDown={(e) => {
                                e.stopPropagation(); // Stop global listeners
                                if (e.key === 'Enter') {
                                    const val = e.currentTarget.value.trim().toUpperCase();
                                    if (val) {
                                        router.push(`/stocks/${val}`);
                                    }
                                }
                            }}
                        />
                        <span className="absolute left-3 top-2.5 text-gray-500">🚀</span>
                    </div>

                    <div className="h-8 w-px bg-gray-700 mx-2"></div>

                    {/* Index Add Button (Restored) */}
                    {activeTab === 'index' && (
                        <div className="flex items-center gap-2 bg-purple-900/20 p-2 rounded border border-purple-700/50 mr-2">
                            <input
                                type="text"
                                placeholder="Index ID (e.g. ^N225)"
                                className="bg-gray-800 border border-purple-700 text-white rounded px-3 py-1 text-sm w-40 font-mono focus:outline-none focus:border-purple-500"
                                value={indexSymbol}
                                onChange={(e) => setIndexSymbol(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddIndex()}
                            />
                            <button
                                onClick={handleAddIndex}
                                className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded text-sm font-bold text-white transition"
                            >
                                Add
                            </button>
                            {msg && <span className="text-xs text-purple-300 ml-2 animate-pulse">{msg}</span>}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={() => handleFilterChange('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterMode === 'all'
                                ? 'bg-gray-700 text-white shadow-md ring-1 ring-gray-600'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            {t('all')}
                        </button>
                        <button
                            onClick={() => handleFilterChange('holding')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterMode === 'holding'
                                ? 'bg-blue-900/50 text-blue-400 shadow-md ring-1 ring-blue-700'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            {t('holding')} ({stocks.filter(s => s.status === 'Holding').length})
                        </button>
                        <button
                            onClick={() => handleFilterChange('past')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterMode === 'past'
                                ? 'bg-gray-700 text-gray-300 shadow-md ring-1 ring-gray-600'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            {t('pastTrade')}
                        </button>
                        <button
                            onClick={() => handleFilterChange('star')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1 ${filterMode === 'star'
                                ? 'bg-yellow-900/50 text-yellow-400 shadow-md ring-1 ring-yellow-700'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            <span>★</span>
                        </button>
                    </div>

                    <div className="h-8 w-px bg-gray-700 mx-2"></div>

                    {/* Group Filter */}
                    <div className="relative">
                        <select
                            value={selectedGroupId || ""}
                            onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-blue-500 appearance-none min-w-[120px]"
                        >
                            <option value="">All Groups</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                        <span className="absolute right-3 top-2.5 text-gray-500 pointer-events-none">▼</span>
                    </div>

                    {/* Filter List & Advanced Filter */}
                    <div className="flex items-center gap-2">
                        <FilterSelect
                            onSelect={(criteria) => {
                                if (criteria) handleApplyAdvancedFilter(criteria);
                                else {
                                    setActiveCriteria(null);
                                    setFilterMode(filterMode === 'all' ? 'all' : filterMode); // Keep basic filter if any
                                }
                            }}
                            currentCriteria={activeCriteria}
                            onOpenDialog={() => setIsFilterDialogOpen(true)}
                            refreshKey={isFilterDialogOpen ? 1 : 0}
                        />
                        <FilterDialog
                            isOpen={isFilterDialogOpen}
                            onClose={() => setIsFilterDialogOpen(false)}
                            onApply={handleApplyAdvancedFilter}
                            initialCriteria={activeCriteria || undefined}
                        />
                    </div>

                    <ColumnManager
                        allColumns={INITIAL_COLUMNS}
                        visibleColumns={visibleColumns}
                        onUpdateColumns={setVisibleColumns}
                        selectedViewId={selectedViewId}
                        onSelectView={setSelectedViewId}
                        viewType="dashboard"
                    />
                </div>

                {/* Filters Summary */}
                <div className="text-xs text-gray-500 mb-2 flex justify-between">
                    <span className="text-sm font-bold text-white">
                        Stocks: <span className="text-yellow-400">{filteredStocks.length}</span> <span className="text-gray-400">/</span> {stocks.length}
                    </span>
                    <span>Page {currentPage} of {totalPages}</span>
                </div>

                {/* Table */}
                <div className="overflow-auto max-h-[75vh] rounded-lg border border-gray-800 shadow-xl bg-gray-900">
                    {loading ? (
                        <div className="p-12 text-center text-gray-500 animate-pulse">
                            {t('loading')}
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left min-w-max">
                            <thead className="text-xs text-gray-400 uppercase bg-black border-b border-gray-700 sticky top-0 z-20">
                                <tr>
                                    {visibleColumns.map(colKey => {
                                        const def = INITIAL_COLUMNS.find(c => c.key === colKey);
                                        const isNumeric = ['current_price', 'market_cap', 'volume', 'realized_pl', 'composite_rating', 'rs_rating'].includes(colKey) || colKey.includes('percentage') || colKey.includes('deviation_') || colKey === 'volume_increase_pct';
                                        return (
                                            <th key={colKey} className="px-4 py-3 whitespace-nowrap group" style={{ minWidth: def?.width, width: def?.width }}>
                                                <div className={`flex flex-col gap-1 ${isNumeric ? 'items-end' : ''}`}>
                                                    <div
                                                        className="flex items-center cursor-pointer hover:text-white"
                                                        onClick={() => handleSort(colKey as keyof Stock)}
                                                    >
                                                        {def?.header || def?.label}
                                                        <SortIcon colKey={colKey as keyof Stock} sortConfig={sortConfig} />
                                                    </div>
                                                    {/* Header Filter Input */}
                                                    <HeaderFilter
                                                        columnKey={colKey}
                                                        title={def?.label || colKey}
                                                        dataType={
                                                            ['last_buy_date', 'last_sell_date', 'first_import_date', 'updated_at', 'ibd_rating_date', 'last_earnings_date', 'next_earnings_date'].includes(colKey) ? 'date' :
                                                                ['symbol', 'company_name', 'sector', 'industry', 'note', 'note_multiline', 'status', 'latest_analysis', 'is_buy_candidate'].includes(colKey) ? 'string' : 'number'
                                                        }
                                                        onApply={(val) => handleColumnFilterChange(colKey, val)}
                                                        currentFilter={columnFilters[colKey]}
                                                        mode={['note', 'note_multiline', 'latest_analysis'].includes(colKey) ? 'text' : undefined}
                                                        // Unique Value Generation could be expensive for dates, but we don't need it for date range mode
                                                        uniqueValues={
                                                            ['symbol', 'company_name', 'sector', 'industry', 'status'].includes(colKey)
                                                                ? (() => {
                                                                    return Array.from(new Set(stocks.map(s => String((s as any)[colKey] || '')).filter(Boolean))).sort();
                                                                })()
                                                                : undefined
                                                        }
                                                    />
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {currentStocks.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleColumns.length} className="p-12 text-center text-gray-500">
                                            {t('noStocksFound')}
                                        </td>
                                    </tr>
                                ) : (
                                    currentStocks.map(stock => (
                                        <tr
                                            key={stock.symbol}
                                            className="hover:bg-gray-800/50 transition duration-75 group cursor-pointer"
                                            onDoubleClick={() => router.push(`/stocks/${stock.symbol}`)}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                setContextMenu({ x: e.pageX, y: e.pageY, stock });
                                            }}
                                        >
                                            {visibleColumns.map(colKey => (
                                                <td key={colKey} className="px-4 py-2 whitespace-nowrap">
                                                    {renderCell(stock, colKey)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {
                    totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-6">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-50"
                            >
                                {t('prev')}
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
                                    let p = i + 1;
                                    if (totalPages > 10) {
                                        // Simple sliding window logic or just show first 10
                                        // For now simple: if current > 6, shift
                                        if (currentPage > 6) p = currentPage - 5 + i;
                                        if (p > totalPages) return null;
                                    }
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setCurrentPage(p)}
                                            className={`w-8 h-8 flex items-center justify-center rounded ${currentPage === p ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-50"
                            >
                                {t('next')}
                            </button>
                        </div>
                    )
                }
            </main >

            {/* Chart Popup */}
            {
                hoveredChartStock && (
                    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded shadow-2xl p-2 animate-in fade-in zoom-in duration-200 pointer-events-none">
                        <div className="text-xs font-bold text-gray-400 mb-1 flex justify-between">
                            <span>{hoveredChartStock.symbol} Daily Chart</span>
                        </div>
                        <MiniCandleChart dataJson={hoveredChartStock.daily_chart_data as string} width={600} height={300} />
                    </div>
                )
            }

            {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg('')} />}

            <TradingDialog
                isOpen={isTradingOpen}
                onClose={() => setIsTradingOpen(false)}
                initialSymbol={tradingSymbol}
            />

            <AddToGroupDialog
                symbol={addToGroupSymbol}
                isOpen={isAddToGroupDialogOpen}
                onClose={() => setIsAddToGroupDialogOpen(false)}
            />

            {/* Batch Gemini Dialog */}
            {
                showBatchDialog && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
                        <div className="bg-gray-800 p-6 rounded-lg w-[500px] border border-gray-700 shadow-xl">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <span>⚡</span> メモ一括生成 (Batch Gemini)
                            </h2>

                            <p className="text-gray-300 mb-4 text-sm">
                                現在のリストに表示されている銘柄のうち、<br />
                                <span className="text-yellow-400 font-bold">メモが空欄</span> の銘柄に対してGeminiを一括実行します。
                            </p>

                            <div className="mb-6">
                                <label className="block text-sm text-gray-400 mb-2">使用するプロンプト:</label>
                                <select
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                                    value={selectedBatchPromptId}
                                    onChange={e => setSelectedBatchPromptId(e.target.value)}
                                >
                                    <option value="" className="bg-gray-900 text-white">選択してください</option>
                                    {prompts.map(p => (
                                        <option key={p.id} value={p.id} className="bg-gray-900 text-white">{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 w-full">
                                <button
                                    onClick={() => setShowBatchDialog(false)}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleBatchGeminiRun}
                                    disabled={!selectedBatchPromptId}
                                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white font-bold"
                                >
                                    実行開始
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            <AlertDialog
                isOpen={showAlertDialog}
                onClose={() => {
                    setShowAlertDialog(false);
                    setInitialAlertCondition(undefined);
                }}
                targetSymbol={alertTargetSymbol}
                initialCondition={initialAlertCondition}
                onSuccess={() => {
                    refreshAlerts();
                    setAlertTargetSymbol('');
                    setInitialAlertCondition(undefined);
                }}
            />



            {
                toastMsg && (
                    <Toast
                        message={toastMsg}
                        onClose={() => setToastMsg('')}
                    />
                )
            }

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setContextMenu(null)}
                        onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
                    />
                    <div
                        className="absolute z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[160px]"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <div className="p-2 border-b border-gray-700">
                            <span className="text-xs text-gray-500 font-bold px-2">{contextMenu.stock.symbol}</span>
                        </div>
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm flex items-center gap-2"
                            onClick={() => {
                                setAddToGroupSymbol(contextMenu.stock.symbol);
                                setIsAddToGroupDialogOpen(true);
                                setContextMenu(null);
                            }}
                        >
                            <span>📁</span> グループに追加
                        </button>
                        <button
                            className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm flex items-center gap-2"
                            onClick={() => {
                                router.push(`/stocks/${contextMenu.stock.symbol}`);
                                setContextMenu(null);
                            }}
                        >
                            <span>🔍</span> 詳細を表示
                        </button>
                    </div>
                </>
            )}
        </div >
    );
}
