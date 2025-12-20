"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import { fetchStocks, Stock, triggerImport, createStock, pickFile, updateStock, openAnalysisFolder } from '@/lib/api';
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


const DEFAULT_COLUMNS = ['symbol', 'company_name', 'sector', 'industry', 'composite_rating', 'rs_rating', 'note', 'latest_analysis', 'status', 'change_percentage_1d', 'change_percentage_5d', 'change_percentage_20d', 'change_percentage_50d', 'change_percentage_200d', 'last_buy_date', 'last_sell_date', 'daily_chart_data', 'daily_chart_data_large', 'market_cap', 'realized_pl', 'first_import_date'];

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Column Definitions (Memoized for translation)
  const ALL_COLUMNS = useMemo(() => [
    { key: 'symbol', label: t('ticker') || 'ティッカー' },
    { key: 'company_name', label: t('companyName') || '会社名' },
    { key: 'sector', label: t('sector') || 'セクター' },
    { key: 'industry', label: t('industry') || '業界' },
    { key: 'composite_rating', label: 'CR' },
    { key: 'rs_rating', label: 'RS' },
    { key: 'note', label: t('note') || 'メモ', width: 200 },
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
    { key: 'daily_chart_data_large', label: t('chartLarge') || 'チャート(大)', width: 400 },
    { key: 'realized_pl', label: t('realizedPL') || '確定損益' },
    { key: 'first_import_date', label: t('importedAt') || '取込日' },
    { key: 'updated_at', label: 'Updated' },
    { key: 'current_price', label: t('price') || '価格' },
    { key: 'market_cap', label: 'Market Cap' },
    { key: 'deviation_5ma_pct', label: t('dev5') || '乖離5MA' },
    { key: 'deviation_20ma_pct', label: t('dev20') || '乖離20MA' },
    { key: 'deviation_50ma_pct', label: t('dev50') || '乖離50MA' },
    { key: 'deviation_200ma_pct', label: t('dev200') || '乖離200MA' },
  ], [t]);

  // State
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Stock; direction: 'asc' | 'desc' } | null>(null);
  const [activeTab, setActiveTab] = useState<'stock' | 'index'>('stock');
  const activeTabRef = useRef(activeTab); // Ref to track current tab in async calls

  useEffect(() => {
    activeTabRef.current = activeTab;
    loadStocks();
  }, [activeTab]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  // Import Status
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Filter
  const [filterMode, setFilterMode] = useState<'all' | 'holding' | 'past' | 'trending' | 'notes' | 'star' | 'doubleCircle' | 'circle'>('all');
  const [selectedViewId, setSelectedViewId] = useState<string>("");

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


  // Initial Data Load
  useEffect(() => {
    // Restore from localStorage if URL is clean (empty params)
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
      // Simple object comparison is hard, but usually fine to just set.
      // Or check if changed. For now, setter is likely fine if effect doesn't run often.
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
        // Deep compare is expensive, JSON string compare is easy
        if (JSON.stringify(activeCriteria) !== adv) {
          setActiveCriteria(parsed);
        }
      } catch (e) { }
    }

    loadStocks();

    // const interval = setInterval(loadStocks, 30000); // Poll every 30s
    // return () => clearInterval(interval);
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

  async function loadStocks() {
    setLoading(true);
    const targetTab = activeTab; // Capture fetch scope
    try {
      const data = await fetchStocks(0, 2000, targetTab); // Added limit and offset and asset_type

      // Guard: Only update if we are still on the same tab
      if (activeTabRef.current === targetTab) {
        setStocks(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (activeTabRef.current === targetTab) {
        setLoading(false);
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
      await triggerImport([path]);
      await loadStocks(); // Refresh data
      setImportStatus('success');
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
      await updateStock(symbol, { note: editingNoteValue });
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

  const handleFilterChange = (mode: 'all' | 'holding' | 'past' | 'trending' | 'notes' | 'star' | 'doubleCircle' | 'circle') => {
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

  const handleClearAdvancedFilter = () => {
    setActiveCriteria(null);
    updateUrl({ adv: null });
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

  // Filtering Logic
  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      // 1. Text Search (Symbol, Company, Sector)
      if (appliedQuery) {
        const q = appliedQuery.toLowerCase();
        const match = stock.symbol.toLowerCase().includes(q) ||
          stock.company_name.toLowerCase().includes(q) ||
          stock.sector?.toLowerCase().includes(q);
        if (!match) return false;
      }

      // 2. Tab Filter (Managed by API but good to double check or if mixed)
      // API handles asset_type, so we can assume stocks here are correct type unless mixed list.

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
        if (!stock.latest_analysis?.includes('★')) return false;
      } else if (filterMode === 'doubleCircle') {
        if (!stock.latest_analysis?.includes('◎')) return false;
      } else if (filterMode === 'circle') {
        if (!stock.latest_analysis?.includes('○')) return false;
      }

      // 4. Advanced Filters
      if (activeCriteria) {
        if (activeCriteria.status && activeCriteria.status !== 'None' && stock.status !== activeCriteria.status) return false;
        if (activeCriteria.industry && activeCriteria.industry !== 'Any' && stock.industry !== activeCriteria.industry) return false;

        if (activeCriteria.min_composite_rating && (stock.composite_rating || 0) < activeCriteria.min_composite_rating) return false;
        if (activeCriteria.min_rs_rating && (stock.rs_rating || 0) < activeCriteria.min_rs_rating) return false;
        if (activeCriteria.min_atr && (stock.atr_14 || 0) < activeCriteria.min_atr) return false;

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

        // Select Filter
        if ('selected' in filterVal) {
          if (filterVal.selected && filterVal.selected.length > 0 && !filterVal.selected.includes(String(val))) return false;
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

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [totalPages]);

  const [toastMsg, setToastMsg] = useState('');

  const handleAddResearch = (symbol: string) => {
    addResearchTicker(symbol);
    setToastMsg(t('addedToResearch').replace('{{symbol}}', symbol));
  };

  const SortIcon = ({ colKey }: { colKey: keyof Stock }) => {
    if (sortConfig?.key !== colKey) return <span className="text-gray-600 ml-1">⇅</span>;
    return <span className="text-blue-400 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
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
      case 'symbol':
        return (
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-400">{stock.symbol}</span>
            <div className="flex gap-1">
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
            </div>
          </div>
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
        const cr = Number(crVal);
        let crClass = 'text-gray-500 font-mono';
        if (cr >= 95) crClass = 'text-yellow-400 font-bold font-mono'; // Elite
        else if (cr >= 90) crClass = 'text-yellow-500 font-bold font-mono';
        else if (cr >= 80) crClass = 'text-green-400 font-mono';
        else if (cr >= 70) crClass = 'text-yellow-600 font-mono';
        return <span className={crClass}>{crVal || '-'}</span>;

      case 'rs_rating':
        const rsVal = stock[key as keyof Stock];
        const rs = Number(rsVal);
        let rsClass = 'text-gray-500 font-mono';
        if (rs >= 95) rsClass = 'text-blue-300 font-bold font-mono'; // Elite
        else if (rs >= 90) rsClass = 'text-blue-400 font-bold font-mono';
        else if (rs >= 80) rsClass = 'text-green-400 font-mono';
        else if (rs >= 70) rsClass = 'text-yellow-600 font-mono';
        return <span className={rsClass}>{rsVal || '-'}</span>;

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
            {pl.toFixed(2)}
          </div>
        );

      case 'first_import_date':
      case 'updated_at':
      case 'last_buy_date':
      case 'last_sell_date':
        const d = stock[key as keyof Stock];
        return d ? new Date(String(d)).toLocaleDateString() : null;

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
        if (!mc) return '-';
        if (mc >= 1e9) return <span className="font-mono text-xs">{(mc / 1e9).toFixed(2)}B</span>;
        if (mc >= 1e6) return <span className="font-mono text-xs">{(mc / 1e6).toFixed(2)}M</span>;
        return <span className="font-mono text-xs">{mc.toLocaleString()}</span>;

      default:
        const v = stock[key as keyof Stock];
        return v !== undefined && v !== null ? String(v) : '-';
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 font-sans cursor-default" onKeyDown={handleGlobalKeyDown} tabIndex={-1}>
      {/* Header */}
      <header className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 sticky top-0 z-10 backdrop-blur">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {t('dashboardTitle')}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => handleTabChange('stock')}
              className={`px-3 py-1 rounded text-sm font-bold transition ${activeTab === 'stock' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              STOCKS
            </button>
            <button
              onClick={() => handleTabChange('index')}
              className={`px-3 py-1 rounded text-sm font-bold transition ${activeTab === 'index' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              INDICES
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Deep Research Link (Restored) */}
          <div className="flex items-center gap-2">
            {/* Index Adder (Only for Index tab) */}
            {activeTab === 'index' && (
              <div className="flex items-center gap-1 mr-2">
                <input
                  type="text"
                  value={indexSymbol}
                  onChange={e => setIndexSymbol(e.target.value.toUpperCase())}
                  placeholder="Index Sym"
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white uppercase w-20"
                />
                <button
                  onClick={handleAddIndex}
                  className="bg-green-700 hover:bg-green-600 text-white rounded px-2 py-1 text-xs"
                >
                  +
                </button>
              </div>
            )}
            {msg && <span className="text-xs text-green-400 animate-pulse mr-2">{msg}</span>}

            <Link
              href="/deep-research"
              className="flex items-center gap-2 bg-purple-700 hover:bg-purple-600 text-white px-3 py-1.5 rounded shadow shadow-purple-900/50 transition font-bold text-sm"
            >
              <span>🧠</span>
              <span>{t('deepResearchTitle') || 'Deep Research'}</span>
            </Link>
          </div>

          {/* AI Analysis Folder Button (Restored) */}
          <button
            onClick={() => openAnalysisFolder().catch(e => alert(e))}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded shadow shadow-blue-900/50 transition font-bold text-sm"
            title="Open Analysis Folder"
          >
            <span>📂</span>
            <span>AI分析</span>
          </button>

          {/* Import Button (Moved here) */}
          <button
            onClick={handleImport}
            disabled={importStatus === 'loading'}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-sm font-bold shadow shadow-blue-900/50 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {importStatus === 'loading' ? (
              <span className="animate-spin">↻</span>
            ) : (
              <span>📥</span>
            )}
            {importStatus === 'loading' ? t('importing') : t('runImport')}
          </button>
          {importStatus === 'success' && <span className="text-green-500 text-sm">✓</span>}
          {importStatus === 'error' && <span className="text-red-500 text-sm">✕</span>}

          {/* System Status */}
          <SystemStatusBanner />

        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        {/* Controls Bar */}
        <div className="flex flex-wrap gap-4 items-end mb-6 bg-gray-900 p-4 rounded-lg border border-gray-800">
          {/* Search */}
          <div className="flex-1 min-w-[300px] flex gap-2">
            {/* Ticker Navigation (New) */}
            <div>
              <label className="text-xs uppercase font-bold text-gray-500 mb-1 block tracking-wider">Ticker</label>
              <input
                type="text"
                placeholder="W"
                className="w-16 bg-black border border-gray-700 rounded px-2 py-2 text-white text-center font-bold font-mono focus:border-blue-500 outline-none uppercase"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value.trim().toUpperCase();
                    if (val) router.push(`/stocks/${val}`);
                  }
                }}
              />
            </div>

            <div className="flex-1">
              <label className="text-xs uppercase font-bold text-gray-500 mb-1 block tracking-wider">Search</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('searchPlaceholder').toString()}
                  className="w-full bg-black border border-gray-700 rounded px-4 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Filters */}
          <div>
            <label className="text-xs uppercase font-bold text-gray-500 mb-1 block tracking-wider">Filter</label>
            <div className="flex bg-black rounded p-1 border border-gray-700">
              <button onClick={() => handleFilterChange('all')} className={`px-3 py-1 rounded text-sm ${filterMode === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>{t('filterAll')}</button>
              <button onClick={() => handleFilterChange('holding')} className={`px-3 py-1 rounded text-sm ${filterMode === 'holding' ? 'bg-green-900 text-green-100' : 'text-gray-400 hover:text-white'}`}>{t('filterHolding')}</button>
              <button onClick={() => handleFilterChange('past')} className={`px-3 py-1 rounded text-sm ${filterMode === 'past' ? 'bg-blue-900 text-blue-100' : 'text-gray-400 hover:text-white'}`}>{t('filterPast')}</button>
              <button onClick={() => handleFilterChange('trending')} className={`px-3 py-1 rounded text-sm ${filterMode === 'trending' ? 'bg-purple-900 text-purple-100' : 'text-gray-400 hover:text-white'}`}>{t('filterTrending')}</button>
              <button onClick={() => handleFilterChange('notes')} className={`px-3 py-1 rounded text-sm ${filterMode === 'notes' ? 'bg-yellow-900 text-yellow-100' : 'text-gray-400 hover:text-white'}`}>Has Notes</button>
              <button onClick={() => handleFilterChange('star')} className={`px-3 py-1 rounded text-sm ${filterMode === 'star' ? 'bg-yellow-600 text-black' : 'text-gray-400 hover:text-white'}`}>★</button>
              <button onClick={() => handleFilterChange('doubleCircle')} className={`px-3 py-1 rounded text-sm ${filterMode === 'doubleCircle' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>◎</button>
              <button onClick={() => handleFilterChange('circle')} className={`px-3 py-1 rounded text-sm ${filterMode === 'circle' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>○</button>
            </div>
          </div>



          {/* Filter Select (Advanced Settings embedded) + Saved Views */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <label className="text-xs uppercase font-bold text-gray-500 mb-1 block tracking-wider">Config</label>
              <FilterSelect
                onSelect={(criteria) => {
                  if (criteria) handleApplyAdvancedFilter(criteria);
                  else {
                    setActiveCriteria(null);
                    setFilterMode('all');
                  }
                }}
                currentCriteria={activeCriteria}
                onOpenDialog={() => setIsFilterDialogOpen(true)}
                refreshKey={isFilterDialogOpen ? 1 : 0} // simple trigger to reload list if saved
              />
              <FilterDialog // Render Dialog here since we removed the block
                isOpen={isFilterDialogOpen}
                onClose={() => setIsFilterDialogOpen(false)}
                onApply={handleApplyAdvancedFilter}
                initialCriteria={activeCriteria || undefined}
              />
            </div>
          </div>

          <ColumnManager
            allColumns={ALL_COLUMNS}
            visibleColumns={visibleColumns}
            onUpdateColumns={setVisibleColumns}
            selectedViewId={selectedViewId}
            onSelectView={setSelectedViewId}
          />
        </div>

        {/* Active Filter Chips (Simplified: Show only CR/RS, hide detailed signals) */}
        {
          activeCriteria && (
            <div className="flex flex-wrap gap-2 mb-4 px-1">
              {activeCriteria.min_composite_rating && <span className="text-xs bg-gray-800 border border-gray-600 px-2 py-1 rounded">CR &gt; {activeCriteria.min_composite_rating}</span>}
              {activeCriteria.min_rs_rating && <span className="text-xs bg-gray-800 border border-gray-600 px-2 py-1 rounded">RS &gt; {activeCriteria.min_rs_rating}</span>}
              {/* Hidden Signals as requested */}
            </div>
          )
        }

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
          ) : currentStocks.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {t('noStocksFound')}
            </div>
          ) : (
            <table className="w-full text-sm text-left min-w-max">
              <thead className="text-xs text-gray-400 uppercase bg-black border-b border-gray-700 sticky top-0 z-20">
                <tr>
                  {ALL_COLUMNS.map(c => c.key).filter(key => visibleColumns.includes(key)).map(colKey => {
                    const def = ALL_COLUMNS.find(c => c.key === colKey);
                    return (
                      <th key={colKey} className="px-4 py-3 whitespace-nowrap group" style={{ minWidth: def?.width, width: def?.width }}>
                        <div className="flex flex-col gap-1">
                          <div
                            className="flex items-center cursor-pointer hover:text-white"
                            onClick={() => handleSort(colKey as keyof Stock)}
                          >
                            {def?.label}
                            <SortIcon colKey={colKey as keyof Stock} />
                          </div>
                          {/* Header Filter Input */}
                          <HeaderFilter
                            columnKey={colKey}
                            title={def?.label || colKey}
                            dataType={['symbol', 'company_name', 'sector', 'industry', 'note', 'status'].includes(colKey) ? 'string' : 'number'}
                            onApply={(val) => handleColumnFilterChange(colKey, val)}
                            currentFilter={columnFilters[colKey]}
                          />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {currentStocks.map(stock => (
                  <tr
                    key={stock.symbol}
                    className="hover:bg-gray-800/50 transition duration-75 group cursor-pointer"
                    onDoubleClick={() => router.push(`/stocks/${stock.symbol}`)}
                  >
                    {ALL_COLUMNS.map(c => c.key).filter(key => visibleColumns.includes(key)).map(colKey => (
                      <td key={colKey} className="px-4 py-2 whitespace-nowrap">
                        {renderCell(stock, colKey)}
                      </td>
                    ))}
                  </tr>
                ))}
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
    </div >
  );
}
