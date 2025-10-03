
// This service parses and manages the large historical BTC dataset provided by the user.
// It's designed to be initialized once and then provide fast lookups.
import { googleSheetService } from './googleSheetService';

export interface BtcHistoryEntry {
  date: string; // YYYY-MM-DD
  price: number;
  dailyChange: number;
  volatility: number;
  volumeChange: number;
  eventType: string;
  direction: string;
  intensityScore: number;
  status: string;
  // --- NEW, ENRICHED FIELDS FOR FUTURE EXPANSION ---
  event_source?: string;
  sentiment_impact?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  related_news_url?: string;
}

// --- NEW TYPES for Pattern Backtesting ---
export interface Pattern {
    id: string;
    name: string;
    metric: 'dailyChange' | 'volatility';
    operator: 'gt' | 'lt'; // greater than | less than
    value: number; // The value to compare against (e.g., 5 for 5%)
    analysisWindow: number; // How many days forward to analyze
}

export interface BacktestMatch {
    date: string;
    performance: number; // percentage
}

export interface BacktestSummary {
    total: number;
    successes: number; // performance > 0
    totalReturn: number;
}

export interface BacktestResult {
    matches: BacktestMatch[];
    summary: BacktestSummary;
}

class BtcHistoryService {
    private history: BtcHistoryEntry[] = [];
    private historyByDate: Map<string, BtcHistoryEntry[]> = new Map();
    private dateRange: { min: string; max: string } = { min: '', max: '' };
    private isInitialized = false;

    constructor() {
        // Initialization is now handled by the async init() method.
    }

    public async init() {
        if (this.isInitialized) {
            return;
        }
        try {
            const historicalData = await googleSheetService.fetchData<any>('historicalArchive');
            this.processSheetData(historicalData);
            this.isInitialized = true;
        } catch (error) {
            console.error("Failed to initialize BtcHistoryService:", error);
            throw error;
        }
    }

    private formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private processSheetData(sheetData: any[]) {
        const parsedData: BtcHistoryEntry[] = [];
        sheetData.forEach(item => {
            if (!item['Date'] || item['Price'] === undefined) {
                console.warn("Skipping malformed sheet row:", item);
                return;
            }
            try {
                const entry: BtcHistoryEntry = {
                    date: this.formatDate(item['Date']),
                    price: Number(item['Price']),
                    dailyChange: Number(item['Daily Change']),
                    volatility: Number(item['Volatility']),
                    volumeChange: Number(item['Volume Change']),
                    eventType: String(item['Event Type'] || '').trim(),
                    direction: String(item['Direction'] || '').trim(),
                    intensityScore: Number(item['Intensity Score']),
                    status: String(item['Status'] || '').trim(),
                };
                parsedData.push(entry);
            } catch (e) {
                console.warn("Skipping malformed sheet row:", item, e);
            }
        });

        // Group by date
        parsedData.forEach(entry => {
            const dateEntries = this.historyByDate.get(entry.date) || [];
            dateEntries.push(entry);
            this.historyByDate.set(entry.date, dateEntries);
        });
        
        // Create a flat, sorted array for slicing and range finding
        this.history = Array.from(this.historyByDate.values()).flat().sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (this.history.length > 0) {
            this.dateRange = {
                min: this.history[0].date,
                max: this.history[this.history.length - 1].date,
            };
        }
    }

    getBtcHistory(): BtcHistoryEntry[] {
        return this.history;
    }
    
    getDateRange(): { min: string; max: string } {
        return this.dateRange;
    }

    getDataForDate(date: string): BtcHistoryEntry[] {
        return this.historyByDate.get(date) || [];
    }
    
    getSurroundingEvents(date: string, count: number): { before: BtcHistoryEntry[], after: BtcHistoryEntry[] } {
        const significantEvents = this.history.filter(e => e.intensityScore > 5);
        const targetDate = new Date(date + 'T00:00:00');

        const before = significantEvents
            .filter(e => new Date(e.date + 'T00:00:00') < targetDate)
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, count)
            .reverse();

        const after = significantEvents
            .filter(e => new Date(e.date + 'T00:00:00') > targetDate)
            .slice(0, count);

        return { before, after };
    }

    getDataSlice(date: string, count: number, direction: 'before' | 'after'): BtcHistoryEntry[] {
        const dateIndex = this.history.findIndex(e => e.date === date);
        if (dateIndex === -1) return [];

        if (direction === 'before') {
            const startIndex = Math.max(0, dateIndex - count);
            return this.history.slice(startIndex, dateIndex + 1);
        } else {
            const endIndex = Math.min(this.history.length, dateIndex + count + 1);
            return this.history.slice(dateIndex, endIndex);
        }
    }

    getChartDataForDate(date: string, windowDays: number): { labels: string[], prices: number[] } | null {
        const dateIndex = this.history.findIndex(e => e.date === date);
        if (dateIndex === -1) return null;
        
        const startIndex = Math.max(0, dateIndex - windowDays);
        const endIndex = Math.min(this.history.length, dateIndex + windowDays + 1);
        
        const dataSlice = this.history.slice(startIndex, endIndex);

        const dailyPrices = new Map<string, number>();
        dataSlice.forEach(d => {
            dailyPrices.set(d.date, d.price);
        });

        const sortedEntries = Array.from(dailyPrices.entries()).sort((a,b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

        return {
            labels: sortedEntries.map(([dateStr]) => dateStr),
            prices: sortedEntries.map(([, price]) => price),
        };
    }

    backtestPattern(pattern: Pattern): BacktestResult {
        const matches: BacktestMatch[] = [];
        const summary: BacktestSummary = { total: 0, successes: 0, totalReturn: 0 };
        
        for (let i = 0; i < this.history.length - pattern.analysisWindow; i++) {
            const currentDay = this.history[i];
            const metricValue = currentDay[pattern.metric];

            let conditionMet = false;
            if (pattern.operator === 'gt' && metricValue > pattern.value) {
                conditionMet = true;
            } else if (pattern.operator === 'lt' && metricValue < pattern.value) {
                conditionMet = true;
            }
            
            if (conditionMet) {
                const futureDay = this.history[i + pattern.analysisWindow];
                const performance = ((futureDay.price - currentDay.price) / currentDay.price) * 100;
                
                matches.push({ date: currentDay.date, performance });
                
                summary.total++;
                summary.totalReturn += performance;
                if (performance > 0) {
                    summary.successes++;
                }
            }
        }
        return { matches, summary };
    }
}

export const btcHistoryService = new BtcHistoryService();
