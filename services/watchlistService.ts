
import { CryptoPrice } from './cryptoService';
const WATCHLIST_STORAGE_KEY = 'jaxspot_watchlist';

class WatchlistService {
    private watchlistSymbols: Set<string> = new Set();
    private listeners: (() => void)[] = [];

    constructor() {
        this.loadWatchlist();
    }

    subscribe(listener: () => void) {
        this.listeners.push(listener);
    }

    unsubscribe(listener: () => void) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    private notifyListeners() {
        this.listeners.forEach(l => l());
    }

    private loadWatchlist() {
        try {
            const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
            if (stored) {
                this.watchlistSymbols = new Set(JSON.parse(stored));
            } else {
                 // Add some defaults for the first run
                this.watchlistSymbols = new Set(['BTC', 'ETH', 'SOL']);
                this.saveWatchlist();
            }
        } catch (error) {
            console.error("Failed to load watchlist:", error);
            this.watchlistSymbols = new Set();
        }
    }

    private saveWatchlist() {
        try {
            localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(Array.from(this.watchlistSymbols)));
        } catch (error) {
            console.error("Failed to save watchlist:", error);
        }
    }

    getWatchlistSymbols(): string[] {
        return Array.from(this.watchlistSymbols);
    }

    addToWatchlist(symbol: string) {
        const upperSymbol = symbol.toUpperCase().trim();
        if (upperSymbol && !this.watchlistSymbols.has(upperSymbol)) {
            this.watchlistSymbols.add(upperSymbol);
            this.saveWatchlist();
            this.notifyListeners();
        }
    }
    
    removeFromWatchlist(symbol: string) {
        const upperSymbol = symbol.toUpperCase().trim();
        if (this.watchlistSymbols.has(upperSymbol)) {
            this.watchlistSymbols.delete(upperSymbol);
            this.saveWatchlist();
            this.notifyListeners();
        }
    }
}

export const watchlistService = new WatchlistService();
