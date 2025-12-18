"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import { fetchStocks, Stock, triggerImport, createStock } from '@/lib/api';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import FilterDialog, { FilterCriteria } from '@/components/FilterDialog';
import FilterSelect from '@/components/FilterSelect';
import SystemStatusBanner from '@/components/SystemStatusBanner';

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Initialize state from URL params
  const initialSearch = searchParams.get('q') || '';
  const initialFilter = (searchParams.get('filter') as 'all' | 'holding' | 'past' | 'trending') || 'all';
  const initialSortKey = searchParams.get('sort') as keyof Stock | null;
  const initialSortDir = (searchParams.get('order') as 'asc' | 'desc') || 'asc';
  const initialSortConfig = initialSortKey ? { key: initialSortKey, direction: initialSortDir } : null;

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [importPath, setImportPath] = useState('');
  const [msg, setMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [appliedQuery, setAppliedQuery] = useState(initialSearch); // Debounced search term for filtering
  const [sortConfig, setSortConfig] = useState<{ key: keyof Stock; direction: 'asc' | 'desc' } | null>(initialSortConfig);
  const [filterMode, setFilterMode] = useState<'all' | 'holding' | 'past' | 'trending' | 'notes' | 'star' | 'doubleCircle' | 'circle'>(initialFilter);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 100;
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stock' | 'index'>('stock');
  const activeTabRef = useRef(activeTab);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const [indexSymbol, setIndexSymbol] = useState('');

  // Advanced Filter
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [activeCriteria, setActiveCriteria] = useState<FilterCriteria | null>(null);
  const [filterRefreshKey, setFilterRefreshKey] = useState(0);

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

  // Restore from LocalStorage on mount if URL has no params
  useEffect(() => {
    if (Array.from(searchParams.keys()).length === 0) {
      const savedParams = localStorage.getItem('dashboardParams');
      if (savedParams) {
        router.replace(`${pathname}?${savedParams}`);
      }
    }
  }, []); // Run once on mount

  const handleFilterChange = (mode: 'all' | 'holding' | 'past' | 'trending' | 'notes' | 'star' | 'doubleCircle' | 'circle') => {
    const newMode = filterMode === mode ? 'all' : mode;
    setFilterMode(newMode);
    updateUrl({ filter: newMode === 'all' ? null : newMode });
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

  useEffect(() => {
    if (isInitialized) {
      loadStocks();
    }
  }, [activeTab, isInitialized]); // Reload when tab changes

  // Sync state from URL params on change (Fix for back navigation)
  useEffect(() => {
    const q = searchParams.get('q') || '';
    const f = (searchParams.get('filter') as 'all' | 'holding' | 'past' | 'trending' | 'notes' | 'star' | 'doubleCircle' | 'circle') || 'all';
    const sKey = searchParams.get('sort') as keyof Stock | null;
    const sDir = (searchParams.get('order') as 'asc' | 'desc') || 'asc';
    const advParam = searchParams.get('adv');
    const tabParam = searchParams.get('tab') as 'stock' | 'index' | null;

    setSearchQuery(q);
    setAppliedQuery(q);
    setFilterMode(f);
    if (sKey) {
      setSortConfig({ key: sKey, direction: sDir });
    }
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }

    if (advParam) {
      try {
        const criteria = JSON.parse(decodeURIComponent(advParam));
        setActiveCriteria(criteria);
      } catch (e) {
        console.error("Failed to parse adv filter param", e);
      }
      // If user navigates back and URL doesn't have it, we should clear it to reflect URL state.
      setActiveCriteria(null);
    }

    setIsInitialized(true);
  }, [searchParams]);

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

  const handleTabChange = (tab: 'stock' | 'index') => {
    setStocks([]); // Clear data to avoid showing stale table content
    setActiveTab(tab);
    setCurrentPage(1);
    updateUrl({ tab });
  };

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
    if (!importPath) return;
    try {
      await triggerImport([importPath]);
      await loadStocks(); // Refresh data
      setMsg(t('importCompleted'));
    } catch (e) {
      setMsg(t('importFailed'));
    }
  }

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

  // Filter Logic
  const filteredStocks = useMemo(() => {
    return stocks.filter((stock) => {
      // 1. Symbol Filters (Quick check)
      if (filterMode === 'star') {
        const n = (stock.note || '') + (stock.latest_analysis || '');
        return n.includes('★');
      }
      if (filterMode === 'doubleCircle') {
        const n = (stock.note || '') + (stock.latest_analysis || '');
        return n.includes('◎');
      }
      if (filterMode === 'circle') {
        const n = (stock.note || '') + (stock.latest_analysis || '');
        return n.includes('〇');
      }

      // Initialize status flags
      let passesAdvancedFilter = true;
      let passesQuickFilter = true;

      // 2. Advanced Filter
      if (activeCriteria) {
        if (activeCriteria.is_in_uptrend && !stock.is_in_uptrend) passesAdvancedFilter = false;
        // Note: stock.note can be empty string, which is falsy. This is correct for "Has Note" check.
        if (activeCriteria.has_note && !stock.note) passesAdvancedFilter = false;
        if (activeCriteria.has_analysis && !stock.latest_analysis) passesAdvancedFilter = false;
        if (activeCriteria.min_composite_rating && (stock.composite_rating || 0) < activeCriteria.min_composite_rating) passesAdvancedFilter = false;
        if (activeCriteria.min_rs_rating && (stock.rs_rating || 0) < activeCriteria.min_rs_rating) passesAdvancedFilter = false;

        // Signal Checks
        const signals: (keyof FilterCriteria)[] = [
          'signal_higher_200ma', 'signal_near_200ma', 'signal_over_50ma', 'signal_higher_50ma_than_200ma',
          'signal_sameslope_50_200', 'signal_uptrand_200ma', 'signal_high_volume',
          'signal_newhigh', 'signal_newhigh_200days', 'signal_newhigh_100days', 'signal_newhigh_50days',
          'signal_price_up', 'signal_break_atr', 'signal_high_slope5ma'
        ];
        for (const sig of signals) {
          if (activeCriteria[sig] && !stock[sig as keyof Stock]) passesAdvancedFilter = false;
        }

        if (passesAdvancedFilter && activeCriteria.status && activeCriteria.status !== 'Any') {
          if (activeCriteria.status === 'None' && (stock.status === 'Holding' || stock.status === 'Past Trade')) passesAdvancedFilter = false;
          if (activeCriteria.status !== 'None' && stock.status !== activeCriteria.status) passesAdvancedFilter = false;
        }
      }

      if (!passesAdvancedFilter) return false;

      // 3. Quick Filters (AND logic with Advanced)
      // If 'all', we pass unless advanced filter failed.
      if (filterMode === 'holding') passesQuickFilter = stock.status === 'Holding';
      else if (filterMode === 'past') passesQuickFilter = stock.status === 'Past Trade';
      else if (filterMode === 'trending') passesQuickFilter = !!stock.is_in_uptrend;
      else if (filterMode === 'notes') passesQuickFilter = !!stock.note;

      return passesQuickFilter;
    }).filter((stock) => {
      // Free text search
      if (!appliedQuery) return true;
      const q = appliedQuery.toLowerCase();
      // Use local variables to avoid repeating lowercasing
      const symbol = (stock.symbol || '').toLowerCase();
      const company = (stock.company_name || '').toLowerCase();
      const sector = (stock.sector || '').toLowerCase();
      const industry = (stock.industry || '').toLowerCase();
      const note = (stock.note || '').toLowerCase();
      const analysis = (stock.latest_analysis || '').toLowerCase();

      return (
        symbol.includes(q) ||
        company.includes(q) ||
        sector.includes(q) ||
        industry.includes(q) ||
        note.includes(q) ||
        analysis.includes(q)
      );
    });
  }, [stocks, appliedQuery, filterMode, activeCriteria]);

  const sortedStocks = [...filteredStocks].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const aVal = a[key];
    const bVal = b[key];

    if (aVal === bVal) return 0;
    // Handle nulls
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination Logic
  const totalPages = Math.ceil(sortedStocks.length / ITEMS_PER_PAGE);
  const paginatedStocks = sortedStocks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const SortIcon = ({ colKey }: { colKey: keyof Stock }) => {
    if (sortConfig?.key !== colKey) return <span className="text-gray-600 ml-1">⇅</span>;
    return <span className="text-blue-400 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100 pb-20">
      <SystemStatusBanner />

      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            {t('dashboardTitle')}
          </h1>
          <div className="flex gap-4">
            <Link href="/deep-research" className="px-4 py-2 bg-blue-900/40 hover:bg-blue-800/60 rounded border border-blue-700/50 transition flex items-center gap-2 text-blue-200">
              <span>🧠</span> Deep Research
            </Link>
            <Link href="/prompts" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded border border-gray-600 transition flex items-center gap-2">
              <span>🤖</span> Gemini Prompts
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-700 pb-2">
          <button
            onClick={() => handleTabChange('stock')}
            className={`px-4 py-2 font-bold transition border-b-2 ${activeTab === 'stock' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            Stocks
          </button>
          <button
            onClick={() => handleTabChange('index')}
            className={`px-4 py-2 font-bold transition border-b-2 ${activeTab === 'index' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            Indices / ETFs
          </button>
        </div>

        <div className="mb-8 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <div className="flex gap-4 items-center">
            {activeTab === 'stock' ? (
              <>
                <h2 className="text-xl font-bold">{t('runImport')}</h2>
                <input
                  type="text"
                  className="p-2 rounded bg-gray-700 border border-gray-600 w-full md:w-96 text-white"
                  placeholder={t('importPlaceholder')}
                  value={importPath}
                  onChange={(e) => setImportPath(e.target.value)}
                />
                <button onClick={handleImport} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold transition">
                  {t('runImport')}
                </button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold">Add Index / ETF</h2>
                <input
                  type="text"
                  className="p-2 rounded bg-gray-700 border border-gray-600 w-full md:w-96 text-white"
                  placeholder="Enter Yahoo Finance Symbol (e.g., ^GSPC, SPY)"
                  value={indexSymbol}
                  onChange={(e) => setIndexSymbol(e.target.value)}
                />
                <button onClick={handleAddIndex} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold transition">
                  Add Symbol
                </button>
              </>
            )}

            <button
              onClick={loadStocks}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded transition flex items-center gap-2"
              title={t('refreshAnalysis')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden md:inline">{t('refreshAnalysis')}</span>
            </button>
            <span className={msg.includes('Failed') ? 'text-red-400' : 'text-green-400'}>{msg}</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl mb-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleFilterChange('all')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition border ${filterMode === 'all' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
              >
                {t('filterAll')}
              </button>
              <button
                onClick={() => handleFilterChange('holding')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition border ${filterMode === 'holding' ? 'bg-green-700 border-green-600 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
              >
                {t('filterHolding')}
              </button>
              <button
                onClick={() => handleFilterChange('past')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition border ${filterMode === 'past' ? 'bg-purple-900 border-purple-700 text-purple-200' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
              >
                {t('filterPast')}
              </button>
              <button
                onClick={() => handleFilterChange('trending')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition border ${filterMode === 'trending' ? 'bg-red-900 border-red-700 text-red-200' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
              >
                {t('filterTrending')}
              </button>
              <button
                onClick={() => handleFilterChange('notes')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition border ${filterMode === 'notes' ? 'bg-indigo-900 border-indigo-700 text-indigo-200' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
              >
                {t('filterNotes')}
              </button>
              <button
                onClick={() => handleFilterChange('star')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition border ${filterMode === 'star' ? 'bg-yellow-900 border-yellow-700 text-yellow-200' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
              >
                ★
              </button>
              <button
                onClick={() => handleFilterChange('doubleCircle')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition border ${filterMode === 'doubleCircle' ? 'bg-pink-900 border-pink-700 text-pink-200' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
              >
                ◎
              </button>
              <button
                onClick={() => handleFilterChange('circle')}
                className={`px-4 py-2 rounded-full text-sm font-bold transition border ${filterMode === 'circle' ? 'bg-cyan-900 border-cyan-700 text-cyan-200' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
              >
                〇
              </button>
            </div>

            {/* Search & Advanced Filter */}
            <div className="flex flex-wrap items-center gap-4 mt-4 w-full md:w-auto md:ml-auto md:mt-0 justify-end">
              <FilterSelect onSelect={handleApplyAdvancedFilter} refreshKey={filterRefreshKey} />

              <button
                onClick={() => setIsFilterDialogOpen(true)}
                className={`px-3 py-1 rounded text-sm font-bold transition flex items-center gap-1 ${activeCriteria ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                {activeCriteria ? 'Filter Active' : 'Advanced Filter'}
              </button>

              {activeCriteria && (
                <button
                  onClick={handleClearAdvancedFilter}
                  className="px-3 py-1 rounded text-sm font-bold bg-gray-700 text-gray-300 hover:bg-red-900 hover:text-red-200 border border-gray-600 transition flex items-center justify-center ml-2"
                  title="Clear Advanced Filter"
                >
                  ✕
                </button>
              )}

              <div className="relative w-full">
                <input
                  type="text"
                  placeholder={t('searchPlaceholder') || "Search Ticker, Company, Sector..."}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 px-4 pl-10 focus:outline-none focus:border-blue-500 transition"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-2.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-white transition"
                    title="Clear Search"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="text-gray-400 text-sm">
                {t('showingStocks').replace('{{count}}', filteredStocks.length.toString()).replace('{{total}}', stocks.length.toString())}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 text-gray-500 animate-pulse">{t('loading')}</div>
          ) : filteredStocks.length === 0 ? (
            <div className="text-center py-20 text-gray-500">{activeTab === 'stock' ? t('noStocksFound') : "No Indices / ETFs found"}</div>
          ) : (
            <div className="overflow-x-auto rounded-xl">
              {/* Pagination Controls (Top) */}
              {filteredStocks.length > ITEMS_PER_PAGE && (
                <div className="flex justify-end items-center gap-4 mb-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50 hover:bg-gray-700 transition text-sm text-gray-300"
                  >
                    &larr; {t('prev') || 'Prev'}
                  </button>
                  <span className="text-gray-400 text-sm">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50 hover:bg-gray-700 transition text-sm text-gray-300"
                  >
                    {t('next') || 'Next'} &rarr;
                  </button>
                </div>
              )}

              <table className="w-full text-sm text-left text-gray-400">
                <thead className="text-xs text-gray-300 uppercase bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('symbol')}>
                      {t('ticker')} <SortIcon colKey="symbol" />
                    </th>
                    <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('company_name')}>
                      {t('company')} <SortIcon colKey="company_name" />
                    </th>
                    {activeTab === 'stock' && (
                      <>
                        <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('sector')}>
                          {t('sector')} <SortIcon colKey="sector" />
                        </th>
                        <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('industry')}>
                          {t('industry')} <SortIcon colKey="industry" />
                        </th>
                        <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('composite_rating')}>
                          CR <SortIcon colKey="composite_rating" />
                        </th>
                        <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('rs_rating')}>
                          RS <SortIcon colKey="rs_rating" />
                        </th>
                        <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('note')}>
                          {t('myNotes')} <SortIcon colKey="note" />
                        </th>
                        <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('status')}>
                          {t('status')} <SortIcon colKey="status" />
                        </th>
                      </>
                    )}


                    <th scope="col" className="px-4 py-3 cursor-pointer text-right hover:bg-gray-600" onClick={() => handleSort('change_percentage_1d')}>
                      1D <SortIcon colKey="change_percentage_1d" />
                    </th>
                    <th scope="col" className="px-4 py-3 cursor-pointer text-right hover:bg-gray-600" onClick={() => handleSort('change_percentage_5d')}>
                      {t('change5d')} <SortIcon colKey="change_percentage_5d" />
                    </th>
                    <th scope="col" className="px-4 py-3 cursor-pointer text-right hover:bg-gray-600" onClick={() => handleSort('change_percentage_20d')}>
                      {t('change20d')} <SortIcon colKey="change_percentage_20d" />
                    </th>
                    <th scope="col" className="px-4 py-3 cursor-pointer text-right hover:bg-gray-600" onClick={() => handleSort('change_percentage_50d')}>
                      {t('change50d')} <SortIcon colKey="change_percentage_50d" />
                    </th>
                    <th scope="col" className="px-4 py-3 cursor-pointer text-right hover:bg-gray-600" onClick={() => handleSort('change_percentage_200d')}>
                      {t('change200d')} <SortIcon colKey="change_percentage_200d" />
                    </th>

                    {activeTab === 'stock' && (
                      <>
                        <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('last_buy_date')}>
                          {t('lastBuy')} <SortIcon colKey="last_buy_date" />
                        </th>
                        <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('last_sell_date')}>
                          {t('lastSell')} <SortIcon colKey="last_sell_date" />
                        </th>
                        <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-600 text-right" onClick={() => handleSort('realized_pl')}>
                          {t('totalPL')} <SortIcon colKey="realized_pl" />
                        </th>
                        <th scope="col" className="px-4 py-3 cursor-pointer text-right hover:bg-gray-600" onClick={() => handleSort('first_import_date')}>
                          Imported <SortIcon colKey="first_import_date" />
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedStocks.map((stock) => (
                    <tr
                      key={stock.symbol}
                      className="border-b border-gray-700 hover:bg-gray-750 cursor-pointer"
                      onDoubleClick={() => router.push(`/stocks/${stock.symbol}`)}
                    >
                      <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                        <Link href={`/stocks/${stock.symbol}`} className="hover:text-blue-400">
                          {stock.symbol}
                        </Link>
                        <div className="flex gap-1">
                          <a href={`https://research.investors.com/ibdchartsenlarged.aspx?symbol=${stock.symbol}`} target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-100" title="IBD Chart">
                            <span className="text-xs bg-yellow-600 text-white px-1.5 py-0.5 rounded font-bold">I</span>
                          </a>
                          <a href={`https://www.tradingview.com/chart/?symbol=${stock.symbol}`} target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-100" title="TradingView">
                            <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">T</span>
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4">{stock.company_name}</td>
                      {activeTab === 'stock' && (
                        <>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300 border border-gray-600">
                              {stock.sector}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700">
                              {stock.industry}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center font-bold text-yellow-500">
                            {stock.composite_rating || '-'}
                          </td>
                          <td className="px-4 py-4 text-center font-bold text-blue-400">
                            {stock.rs_rating || '-'}
                          </td>
                          <td className="px-6 py-4">
                            {stock.note && (
                              <div className="flex items-center gap-1 text-xs text-yellow-300 mb-1" title={stock.note}>
                                <span>📝</span>
                                <span className="truncate max-w-[150px]">{stock.note}</span>
                              </div>
                            )}
                            {stock.latest_analysis && (
                              <div className="flex items-center gap-1 text-xs text-purple-400 italic" title={stock.latest_analysis}>
                                <span>🤖</span>
                                <span className="truncate max-w-[150px]">{stock.latest_analysis}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {stock.status === 'Holding' && (
                              <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-xs font-bold border border-green-700">
                                {t('holding')}
                              </span>
                            )}
                            {stock.status === 'Past Trade' && (
                              <span className="px-2 py-1 bg-gray-700 text-gray-400 rounded text-xs border border-gray-600">
                                {t('pastTrade')}
                              </span>
                            )}
                          </td>
                        </>
                      )}

                      <td className={`px-4 py-4 text-right font-mono ${(stock.change_percentage_1d || 0) > 0 ? 'text-red-400' : (stock.change_percentage_1d || 0) < 0 ? 'text-blue-400' : 'text-gray-400'
                        }`}>
                        {stock.change_percentage_1d !== undefined && stock.change_percentage_1d !== null ? `${stock.change_percentage_1d > 0 ? '+' : ''}${stock.change_percentage_1d.toFixed(1)}%` : '-'}
                      </td>

                      <td className={`px-4 py-4 text-right font-mono ${(stock.change_percentage_5d || 0) > 0 ? 'text-red-400' : (stock.change_percentage_5d || 0) < 0 ? 'text-blue-400' : 'text-gray-400'
                        }`}>
                        {stock.change_percentage_5d ? `${stock.change_percentage_5d > 0 ? '+' : ''}${stock.change_percentage_5d.toFixed(1)}%` : '-'}
                      </td>
                      {/* 20D */}
                      <td className={`px-4 py-4 text-right font-mono text-xs ${(stock.change_percentage_20d || 0) > 0 ? 'text-red-400' : (stock.change_percentage_20d || 0) < 0 ? 'text-blue-400' : 'text-gray-500'
                        }`}>
                        {stock.change_percentage_20d ? `${stock.change_percentage_20d > 0 ? '+' : ''}${stock.change_percentage_20d.toFixed(2)}%` : '-'}
                      </td>
                      {/* 50D */}
                      <td className={`px-4 py-4 text-right font-mono text-xs ${(stock.change_percentage_50d || 0) > 0 ? 'text-red-400' : (stock.change_percentage_50d || 0) < 0 ? 'text-blue-400' : 'text-gray-500'
                        }`}>
                        {stock.change_percentage_50d ? `${stock.change_percentage_50d > 0 ? '+' : ''}${stock.change_percentage_50d.toFixed(2)}%` : '-'}
                      </td>
                      {/* 200D */}
                      <td className={`px-4 py-4 text-right font-mono text-xs ${(stock.change_percentage_200d || 0) > 0 ? 'text-red-400' : (stock.change_percentage_200d || 0) < 0 ? 'text-blue-400' : 'text-gray-500'
                        }`}>
                        {stock.change_percentage_200d ? `${stock.change_percentage_200d > 0 ? '+' : ''}${stock.change_percentage_200d.toFixed(2)}%` : '-'}
                      </td>

                      {activeTab === 'stock' && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap">{stock.last_buy_date || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{stock.last_sell_date || '-'}</td>
                          <td className={`px-6 py-4 text-right font-bold ${(stock.realized_pl || 0) > 0 ? 'text-red-400' : (stock.realized_pl || 0) < 0 ? 'text-blue-400' : 'text-gray-500'
                            }`}>
                            {stock.realized_pl ? `${stock.realized_pl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-4 py-4 text-right text-xs text-gray-500">
                            {stock.first_import_date ? new Date(stock.first_import_date).toLocaleDateString() : '-'}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedStocks.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  {activeTab === 'stock' ? t('noStocksFound') : "No Indices / ETFs found"}
                </div>
              )}
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && filteredStocks.length > 0 && (
            <div className="flex justify-center items-center gap-4 mt-6 pb-20">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-800 rounded disabled:opacity-50 hover:bg-gray-700 transition font-bold"
              >
                &larr; {t('prev') || 'Prev'}
              </button>
              <span className="text-gray-400">
                Page <span className="text-white font-bold">{currentPage}</span> of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-gray-800 rounded disabled:opacity-50 hover:bg-gray-700 transition font-bold"
              >
                {t('next') || 'Next'} &rarr;
              </button>
            </div>
          )}
        </div>
        <FilterDialog
          isOpen={isFilterDialogOpen}
          onClose={() => setIsFilterDialogOpen(false)}
          onApply={handleApplyAdvancedFilter}
          onSaved={() => setFilterRefreshKey(p => p + 1)}
          initialCriteria={activeCriteria || {}}
        />
      </div>
    </main >
  );
}
