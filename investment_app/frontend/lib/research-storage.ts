
const STORAGE_KEY = 'deep_research_tickers';

export function getResearchTickers(): string[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch (e) {
        console.error("Failed to parse research tickers", e);
        return [];
    }
}

export function saveResearchTickers(tickers: string[]) {
    if (typeof window === 'undefined') return;
    // Unique and sorted
    const unique = Array.from(new Set(tickers)).sort();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
    // Dispatch event for sync
    window.dispatchEvent(new Event('research-storage-updated'));
}

export function addResearchTicker(symbol: string) {
    const current = getResearchTickers();
    if (!current.includes(symbol)) {
        saveResearchTickers([...current, symbol]);
    }
}

export function clearResearchTickers() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('research-storage-updated'));
}
