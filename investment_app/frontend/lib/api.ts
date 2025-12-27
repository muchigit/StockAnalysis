const API_URL = 'http://192.168.10.115:8000'; // LAN Access

export interface Stock {
  symbol: string;
  company_name: string;
  sector: string;
  industry: string;
  market_cap: number;
  exchange: string;
  description: string;
  status: 'None' | 'Holding' | 'Past Trade';
  holding_quantity: number;
  trade_count: number;
  is_hidden?: boolean;
  last_buy_date?: string;
  last_sell_date?: string;
  realized_pl?: number;
  unrealized_pl?: number;
  average_cost?: number;
  change_percentage_1d?: number;
  atr_14?: number;
  change_percentage_5d?: number;
  change_percentage_20d?: number;
  change_percentage_50d?: number;
  change_percentage_200d?: number;

  // New Fields
  is_buy_candidate?: boolean;

  // Financials
  forward_pe?: number;
  trailing_pe?: number;
  price_to_book?: number;
  dividend_yield?: number;
  return_on_equity?: number;
  revenue_growth?: number;
  ebitda?: number;
  target_mean_price?: number;
  high_52_week?: number;
  low_52_week?: number;




  volume?: number;
  volume_increase_pct?: number;
  last_earnings_date?: string;
  next_earnings_date?: string;

  // Predictions
  predicted_price_next?: number;
  predicted_price_today?: number;

  // Deviations
  deviation_5ma_pct?: number;
  deviation_20ma_pct?: number;
  deviation_50ma_pct?: number;
  deviation_200ma_pct?: number;

  // Slopes
  slope_5ma?: number;
  slope_20ma?: number;
  slope_50ma?: number;
  slope_200ma?: number;



  current_price?: number;
  rs_5d?: number;
  rs_20d?: number;
  rs_50d?: number;
  rs_200d?: number;

  is_in_uptrend?: boolean;
  note?: string;
  latest_analysis?: string;
  composite_rating?: number;
  rs_rating?: number;
  ibd_rating_date?: string;
  first_import_date?: string;
  analysis_file_path?: string;

  // Signals
  signal_higher_200ma?: number;
  signal_near_200ma?: number;
  signal_over_50ma?: number;
  signal_higher_50ma_than_200ma?: number;
  signal_uptrand_200ma?: number;
  signal_sameslope_50_200?: number;
  signal_newhigh?: number;
  signal_newhigh_200days?: number;
  signal_newhigh_100days?: number;
  signal_newhigh_50days?: number;
  signal_high_volume?: number;
  signal_price_up?: number;
  signal_break_atr?: number;
  signal_high_slope5ma?: number;
  signal_rebound_5ma?: number;
  signal_base_formation?: number;

  // News
  news_summary_jp?: string;


  updated_at?: string;
  daily_chart_data?: string; // JSON
  asset_type?: string;
  trading_value?: number;
  float_shares_ratio?: number;
}

// --- Group API ---

export interface StockGroup {
  id: number;
  name: string;
  description?: string;
  group_type: 'watchlist' | 'portfolio';
  created_at: string;
}

export interface StockGroupMember {
  id: number;
  group_id: number;
  symbol: string;
  added_at: string;
}



export async function fetchGroups(): Promise<StockGroup[]> {
  const res = await fetch(`${API_URL}/groups/`);
  if (!res.ok) throw new Error('Failed to fetch groups');
  return res.json();
}

export async function createGroup(name: string, description?: string, group_type: string = 'watchlist'): Promise<StockGroup> {
  const res = await fetch(`${API_URL}/groups/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, group_type })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create group');
  }
  return res.json();
}

export async function deleteGroup(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/groups/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete group');
}

export async function fetchGroupMembers(groupId: number): Promise<Stock[]> {
  const res = await fetch(`${API_URL}/groups/${groupId}/members`);
  if (!res.ok) throw new Error('Failed to fetch group members');
  return res.json();
}

export async function addGroupMember(groupId: number, symbol: string): Promise<StockGroupMember> {
  const res = await fetch(`${API_URL}/groups/${groupId}/members?symbol=${symbol}&group_id=${groupId}`, {
    method: 'POST'
  });
  // Note: The POST endpoint in python was defined as (group_id, symbol) query params by default if not body.
  // Let's check router: def add_member(group_id: int, symbol: str, ...)
  // FastAPI defaults to query params for scalars.
  if (!res.ok) throw new Error('Failed to add member to group');
  return res.json();
}

export async function removeGroupMember(groupId: number, symbol: string): Promise<void> {
  const res = await fetch(`${API_URL}/groups/${groupId}/members/${symbol}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove member from group');
}

export async function fetchEarningsCalendar(startDate: string, endDate: string): Promise<any[]> {
  const res = await fetch(`${API_URL}/calendar/earnings?start_date=${startDate}&end_date=${endDate}`);
  if (!res.ok) throw new Error('Failed to fetch earnings calendar');
  return res.json();
}

// --- Trading API ---

export interface TradingUnlockRequest {
  password: string;
}

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  order_type: 'NORMAL' | 'MARKET' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'TRAILING_STOP_LIMIT';
  price?: number;
  stop_price?: number;
  time_in_force?: 'DAY' | 'GTC';
  fill_outside_rth?: boolean;
  // Advanced
  stop_loss_enabled?: boolean;
  stop_loss_price?: number;
  // Trailing
  trail_type?: 'RATIO' | 'AMOUNT';
  trail_value?: number;
  trail_spread?: number;
}

export const unlockTrade = async (password: string) => {
  const res = await fetch(`${API_URL}/trading/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!res.ok) throw new Error('Failed to unlock');
  return res.json();
};

export const placeOrder = async (order: OrderRequest) => {
  const res = await fetch(`${API_URL}/trading/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
  });
  return res.json();
};

export const getAccountInfo = async () => {
  const res = await fetch(`${API_URL}/trading/account`);
  if (!res.ok) throw new Error('Failed to fetch account info');
  return res.json();
};

export interface ChartData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  [key: string]: any;
  analysis_linked_at?: string;
}

export interface StockFinancials {
  id: number;
  symbol: string;
  report_date: string; // ISO Date 
  period: 'annual' | 'quarterly';
  revenue: number | null;
  net_income: number | null;
  eps: number | null;
}

export interface TradeHistory {
  id: number;
  symbol: string;
  company_name?: string;
  trade_type: string;
  quantity: number;
  price: number;
  trade_date: string;
  system_fee?: number;
  tax?: number;
  total_amount?: number;
  note?: string;
  // Computed/Frontend fields
  realized_pl?: number;
  roi_pct?: number;
  cost_basis?: number;
  avg_cost?: number;
  return_1d?: number;
  return_5d?: number;
  return_20d?: number;
  return_50d?: number;
}

export interface HistoryAnalytics {
  stats: {
    total_pl: number;
    win_rate: number;
    total_trades: number;
    monthly: Record<string, number>;
    weekly: Record<string, number>;
    yearly: Record<string, number>;
  };
  history: (TradeHistory & { realized_pl: number; roi_pct: number; cost_basis: number; avg_cost: number })[];
}

export const fetchHistoryAnalytics = async (): Promise<HistoryAnalytics> => {
  const res = await fetch(`${API_URL}/history/analytics`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch history');
  }
  return res.json();
};

export interface StockNote {
  symbol: string;
  content: string;
  updated_at: string;
}

export interface AnalysisResult {
  id: number;
  symbol: string;
  content: string;
  created_at: string;
  file_path?: string;
}

export async function openFile(path: string): Promise<void> {
  const res = await fetch(`${API_URL}/system/open_file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
  if (!res.ok) throw new Error("Failed to open file");
  const json = await res.json();
  if (json.status === 'error') throw new Error(json.message);
}

export async function openAnalysisFolder(): Promise<void> {
  const res = await fetch(`${API_URL}/system/open_analysis_folder`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error("Failed to open analysis folder");
  const json = await res.json();
  if (json.status === 'error') throw new Error(json.message);
}

export async function pickFile(initialPath?: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/system/pick_file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initial_path: initialPath || "" })
    });
    const data = await res.json();
    if (data.status === 'success' && data.path) {
      return data.path;
    }
    return null;
  } catch (e) {
    console.error("Pick file failed", e);
    return null;
  }
}

export async function fetchStockNote(symbol: string): Promise<StockNote> {
  const res = await fetch(`${API_URL}/stocks/${symbol}/note`);
  return res.json();
}

export async function saveStockNote(symbol: string, content: string): Promise<StockNote> {
  const res = await fetch(`${API_URL}/stocks/${symbol}/note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  return res.json();
}

export async function triggerVisualAnalysis(symbol: string): Promise<void> {
  const res = await fetch(`${API_URL}/stocks/${symbol}/analysis/visual`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to trigger visual analysis');
  }
}

export async function fetchStockAnalysis(symbol: string): Promise<AnalysisResult[]> {
  const res = await fetch(`${API_URL}/stocks/${symbol}/analysis`);
  return res.json();
}

export async function deleteAnalysisResult(symbol: string, id: number): Promise<void> {
  const res = await fetch(`${API_URL}/stocks/${symbol}/analysis/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to delete analysis result');
  }
}

export async function fetchStocks(offset = 0, limit = 2000, asset_type: string = "stock", show_hidden_only: boolean = false, lite: boolean = false): Promise<Stock[]> {
  const res = await fetch(`${API_URL}/stocks/?offset=${offset}&limit=${limit}&asset_type=${asset_type}&show_hidden_only=${show_hidden_only}&lite=${lite}`);
  if (!res.ok) throw new Error('Failed to fetch stocks');
  return res.json();
}

export async function createStock(symbol: string, asset_type: string): Promise<Stock> {
  const res = await fetch(`${API_URL}/stocks/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, asset_type })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create stock");
  }
  return res.json();
}

export async function fetchStockDetail(symbol: string): Promise<Stock> {
  const res = await fetch(`${API_URL}/stocks/${symbol}`);
  if (!res.ok) throw new Error('Failed to fetch stock detail');
  return res.json();
}

export async function deleteStock(symbol: string): Promise<void> {
  const res = await fetch(`${API_URL}/stocks/${symbol}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete stock');
}

export async function fetchStockHistory(symbol: string): Promise<TradeHistory[]> {
  const res = await fetch(`${API_URL}/stocks/${symbol}/history`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function fetchStockPriceHistory(symbol: string, days = 100): Promise<any[]> {
  const res = await fetch(`${API_URL}/stocks/${symbol}/price_history?days=${days}`);
  if (!res.ok) throw new Error('Failed to fetch price history');
  return res.json();
}

export async function fetchStockChart(symbol: string, period = '2y', interval = '1d'): Promise<ChartData[]> {
  const res = await fetch(`${API_URL}/stocks/${symbol}/chart?period=${period}&interval=${interval}`);
  if (!res.ok) throw new Error('Failed to fetch chart data');
  return res.json();
}

export async function fetchStockSignals(symbol: string): Promise<Record<string, number>> {
  const res = await fetch(`${API_URL}/stocks/${symbol}/signals`);
  if (!res.ok) throw new Error('Failed to fetch signals');
  return res.json();
}

export async function updateStock(symbol: string, data: Partial<Stock>): Promise<Stock> {
  const res = await fetch(`${API_URL}/stocks/${symbol}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update stock');
  return res.json();
}

// Automation
export async function triggerImport(files: string[]) {
  const res = await fetch(`${API_URL}/automation/import/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_paths: files }),
  });
  return res.json();
}

// Filters
export interface SavedFilter {
  id: number;
  name: string;
  criteria_json: string;
  created_at: string;
}

export async function fetchFilters(): Promise<SavedFilter[]> {
  const res = await fetch(`${API_URL}/filters/`);
  return res.json();
}

export async function saveFilter(name: string, criteria_json: string): Promise<SavedFilter> {
  const res = await fetch(`${API_URL}/filters/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, criteria_json })
  });
  return res.json();
}

export async function deleteFilter(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/filters/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete filter');
}

export async function updateFilter(id: number, name: string, criteria_json: string): Promise<SavedFilter> {
  const res = await fetch(`${API_URL}/filters/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, criteria_json })
  });
  if (!res.ok) throw new Error('Failed to update filter');
  return res.json();
}

// System
export interface SystemStatus {
  status: 'idle' | 'running' | 'waiting_retry' | 'completed' | 'error';
  message: string;
  progress: number;
  total: number;
  last_completed: string | null;
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_URL}/system/status`);
  return res.json();
}

export async function triggerSystemUpdate(): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/system/update/start`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to start update');
  return res.json();
}

export interface GeminiPrompt {
  id: number;
  name: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

// Prompts
export async function fetchPrompts(): Promise<GeminiPrompt[]> {
  const res = await fetch(`${API_URL}/prompts/`);
  if (!res.ok) throw new Error('Failed to fetch prompts');
  return res.json();
}

export async function createPrompt(name: string, content: string): Promise<GeminiPrompt> {
  const res = await fetch(`${API_URL}/prompts/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, content }),
  });
  if (!res.ok) throw new Error('Failed to create prompt');
  return res.json();
}

export async function updatePrompt(id: number, name: string, content: string): Promise<GeminiPrompt> {
  const res = await fetch(`${API_URL}/prompts/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, content }),
  });
  if (!res.ok) throw new Error('Failed to update prompt');
  return res.json();
}

export async function deletePrompt(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/prompts/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete prompt');
}

// Deep Research Automation
export interface ResearchStatus {
  is_running: boolean;
  current_symbol: string | null;
  total: number;
  processed: number;
  status: string;
  logs: string[];
}

export async function fetchResearchStatus(): Promise<ResearchStatus> {
  const res = await fetch(`${API_URL}/automation/research/status`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

export async function startResearch(symbols: string[], prompt_content: string): Promise<void> {
  const res = await fetch(`${API_URL}/automation/research/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols, prompt_id: 0, prompt_content }),
  });
  if (!res.ok) throw new Error('Failed to start research');
}

export async function stopResearch(): Promise<void> {
  const res = await fetch(`${API_URL}/automation/research/stop`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to stop research');
}



// Table View Config
export interface TableViewConfig {
  id: number;
  name: string;
  view_type: string;
  columns_json: string;
  is_default: boolean;
  created_at?: string;
}

export async function fetchViewConfigs(viewType: string = "dashboard"): Promise<TableViewConfig[]> {
  const res = await fetch(`${API_URL}/views/?view_type=${viewType}`);
  if (!res.ok) throw new Error('Failed to fetch views');
  return res.json();
}

export async function saveViewConfig(name: string, columnsJson: string, viewType: string = "dashboard"): Promise<TableViewConfig> {
  const res = await fetch(`${API_URL}/views/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, columns_json: columnsJson, view_type: viewType })
  });
  if (!res.ok) throw new Error('Failed to save view');
  return res.json();
}

export async function updateViewConfig(id: number, updates: { name?: string; columns_json?: string; is_default?: boolean }): Promise<TableViewConfig> {
  const res = await fetch(`${API_URL}/views/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update view');
  return res.json();
}

export async function deleteViewConfig(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/views/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete view');
}
// Historical Analysis
export interface HistoricalSignalRequest {
  target_date: string; // YYYY-MM-DD
  end_date?: string;
  universe?: string;
}

export interface SignalResult {
  symbol: string;
  company_name: string;
  entry_price: number;
  current_price: number;
  return_pct: number;
  max_return_pct: number;
  min_return_pct: number;
  active_signals: string[];
  status: string;
  daily_change_pct?: number;
  dev_ma5?: number;
  dev_ma20?: number;
  dev_ma50?: number;
  dev_ma200?: number;
  asset_type?: string;
}

export async function analyzeHistoricalSignals(req: HistoricalSignalRequest, onProgress?: (current: number, total: number) => void): Promise<SignalResult[]> {
  const res = await fetch(`${API_URL}/analytics/historical-signal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });

  if (!res.ok) {
    throw new Error(`Analysis failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Response body is not readable");

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResults: SignalResult[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === 'progress') {
          if (onProgress) onProgress(event.current, event.total);
        } else if (event.type === 'complete') {
          finalResults = event.data;
        }
      } catch (e) {
        console.error("Error parsing stream line:", line, e);
      }
    }
  }

  return finalResults;
}

// Gemini
export async function generateText(prompt: string): Promise<string> {
  const res = await fetch(`${API_URL}/automation/research/gen_content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) throw new Error('Failed to generate text: ' + res.status);
  const data = await res.json();
  return data.text;
}

export async function updateTradeNote(tradeId: number, note: string): Promise<void> {
  const res = await fetch(`${API_URL}/history/${tradeId}/note`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note })
  });
  if (!res.ok) throw new Error('Failed to update note');
}

// Alerts
export interface StockAlert {
  id?: number;
  symbol: string;
  condition_json: string; // Stored as JSON string
  stages_json?: string; // List of stages
  current_stage_index?: number;
  is_active: boolean;
  created_at?: string;
  last_triggered_at?: string;
  triggered: boolean;
}

export interface AlertCondition {
  metric: string; // 'current_price', 'deviation_5ma_pct', etc.
  op: 'gte' | 'lte' | 'eq';
  value: number;
}

export async function fetchAlerts(symbol?: string): Promise<StockAlert[]> {
  const query = symbol ? `?symbol=${symbol}` : '';
  const res = await fetch(`${API_URL}/alerts/${query}`, { headers: { 'Cache-Control': 'no-cache' } });
  return res.json();
}

export async function createAlert(alert: StockAlert): Promise<StockAlert> {
  const res = await fetch(`${API_URL}/alerts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alert)
  });
  return res.json();
}

export async function updateAlert(id: number, alert: Partial<StockAlert>): Promise<StockAlert> {
  const res = await fetch(`${API_URL}/alerts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alert)
  });
  return res.json();
}

export async function deleteAlert(id: number): Promise<void> {
  await fetch(`${API_URL}/alerts/${id}`, { method: 'DELETE' });
}

export async function checkAlerts(): Promise<StockAlert[]> {
  const res = await fetch(`${API_URL}/alerts/check`, { method: 'POST' });
  return res.json();
}

// Alert Templates
export interface AlertTemplate {
  id?: number;
  name: string;
  description?: string;
  stages_json: string;
  created_at?: string;
}

export async function fetchAlertTemplates(): Promise<AlertTemplate[]> {
  const res = await fetch(`${API_URL}/alerts/templates`);
  return res.json();
}

export async function createAlertTemplate(template: AlertTemplate): Promise<AlertTemplate> {
  const res = await fetch(`${API_URL}/alerts/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template)
  });
  if (!res.ok) throw new Error('Failed to create template');
  return res.json();
}

export async function deleteAlertTemplate(id: number): Promise<void> {
  await fetch(`${API_URL}/alerts/templates/${id}`, { method: 'DELETE' });
}

export interface StockNews {
  id?: number;
  symbol: string;
  title: string;
  publisher: string;
  link: string;
  provider_publish_time: string;
  type: string;
  thumbnail_url?: string;
  related_tickers_json?: string;
  related_tickers?: string[]; // Parsed
}

export async function fetchStockNews(symbol: string): Promise<StockNews[]> {
  const res = await fetch(`${API_URL}/stocks/${symbol}/news`);
  if (!res.ok) throw new Error('Failed to fetch news');
  const data = await res.json();
  return data.map((d: any) => ({
    ...d,
    related_tickers: d.related_tickers_json ? JSON.parse(d.related_tickers_json) : []
  }));
}

export async function summarizeNews(symbol: string, news: StockNews[]): Promise<string> {
  const payload = {
    symbol,
    news_items: news.map(n => ({
      title: n.title,
      date: typeof n.provider_publish_time === 'string' ? n.provider_publish_time : new Date(n.provider_publish_time).toISOString()
    }))
  };

  const res = await fetch(`${API_URL}/automation/research/news/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to summarize news');
  }

  const data = await res.json();
  if (data.error) throw new Error(data.summary);
  return data.summary;
}

export async function fetchStockFinancials(symbol: string): Promise<StockFinancials[]> {
  const response = await fetch(`${API_URL}/stocks/${symbol}/financials`);
  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error('Failed to fetch stock financials');
  }
  return response.json();
}

export async function refreshFinancials(symbol: string): Promise<Stock> {
  const res = await fetch(`${API_URL}/stocks/${symbol}/refresh_financials`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to refresh financials');
  return res.json();
}
