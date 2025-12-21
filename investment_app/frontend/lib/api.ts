const API_URL = 'http://localhost:8000';

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
  last_buy_date?: string;
  last_sell_date?: string;
  realized_pl?: number;
  change_percentage_1d?: number;
  atr_14?: number;
  change_percentage_5d?: number;
  change_percentage_20d?: number;
  change_percentage_50d?: number;
  change_percentage_200d?: number;

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

  updated_at?: string;
  daily_chart_data?: string; // JSON
  asset_type?: string;
}

export interface ChartData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  [key: string]: any;
}

export interface TradeHistory {
  id: number;
  symbol: string;
  trade_type: string;
  quantity: number;
  price: number;
  trade_date: string;
  system_fee?: number;
  tax?: number;
  total_amount?: number;
}

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

export async function fetchStockAnalysis(symbol: string): Promise<AnalysisResult[]> {
  const res = await fetch(`${API_URL}/stocks/${symbol}/analysis`);
  return res.json();
}

export async function fetchStocks(offset = 0, limit = 2000, asset_type: string = "stock"): Promise<Stock[]> {
  const res = await fetch(`${API_URL}/stocks/?offset=${offset}&limit=${limit}&asset_type=${asset_type}`);
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
  columns_json: string;
  is_default: boolean;
  created_at?: string;
}

export async function fetchViewConfigs(): Promise<TableViewConfig[]> {
  const res = await fetch(`${API_URL}/views/`);
  if (!res.ok) throw new Error('Failed to fetch views');
  return res.json();
}

export async function saveViewConfig(name: string, columns_json: string, is_default = false): Promise<TableViewConfig> {
  const res = await fetch(`${API_URL}/views/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, columns_json, is_default })
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
