// This service parses and manages the large historical BTC dataset provided by the user.
// It's designed to be initialized once and then provide fast lookups.

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


// Data fetched from the user-provided Google Sheet and embedded here to ensure offline functionality and prevent network/CORS errors.
const HISTORICAL_BTC_CSV_DATA = `Date,Price,Daily Change,Volatility,Volume Change,Event Type,Direction,Intensity Score,Status
1/1/2021,29374.15,1.2,-0.5,20,"New Year Market Optimism","NEUTRAL",3,"NORMAL"
1/2/2021,32127.27,9.37,4.8,35,"Weekend Retail Surge","POSITIVE",6,"EVENT DETECTED"
1/3/2021,32782.02,2.04,2.1,10,"Price Consolidation","NEUTRAL",2,"NORMAL"
1/4/2021,31971.91,-2.47,-1.5,-15,"Institutional Profit Taking","NEGATIVE",4,"EVENT DETECTED"
1/5/2021,33992.43,6.32,3.2,25,"Renewed Bullish Momentum","POSITIVE",5,"NORMAL"
1/6/2021,36824.36,8.33,4.1,30,"OCC Letter Greenlights Banks for Stablecoins/Blockchains","POSITIVE",8,"EVENT DETECTED"
1/7/2021,39371.04,6.92,3.5,28,"Price Discovery Continues","POSITIVE",6,"NORMAL"
1/8/2021,40797.61,3.62,1.8,15,"All-Time High Breakout","POSITIVE",7,"EVENT DETECTED"
1/9/2021,40254.55,-1.33,-0.7,-10,"Minor Pullback","NEUTRAL",2,"NORMAL"
1/10/2021,38356.44,-4.71,-2.4,-20,"Correction Begins","NEGATIVE",5,"NORMAL"
1/11/2021,35566.66,-7.27,-3.7,-30,"Significant Market Correction","NEGATIVE",7,"EVENT DETECTED"
1/12/2021,33922.96,-4.62,-2.3,-18,"FCA Warns on Crypto Risks","NEGATIVE",6,"EVENT DETECTED"
1/13/2021,37315.35,9.99,5.1,40,"Market Rebound","POSITIVE",7,"NORMAL"
1/14/2021,39187.33,5.02,2.5,22,"ECB's Lagarde Calls for Bitcoin Regulation","NEGATIVE",5,"EVENT DETECTED"
1/15/2021,36643.04,-6.49,-3.3,-25,"Regulatory Concerns Weigh on Price","NEGATIVE",5,"NORMAL"
1/21/2021,30825.68,-8.42,-4.2,-35,"Janet Yellen Expresses Crypto Concerns","NEGATIVE",7,"EVENT DETECTED"
1/27/2021,30432.54,-4.18,-2.1,-15,"Market Bottoms Out","NEUTRAL",3,"NORMAL"
1/29/2021,34316.39,12.76,6.5,50,"Elon Musk Adds #bitcoin to Twitter Bio","POSITIVE",9,"EVENT DETECTED"
2/8/2021,46196.46,19.5,9.8,70,"Tesla Announces $1.5B Bitcoin Purchase","POSITIVE",10,"EVENT DETECTED"
2/11/2021,47909.17,4.01,2.0,18,"Mastercard Announces Support for Crypto","POSITIVE",8,"EVENT DETECTED"
2/16/2021,47563.27,-3.82,-1.9,-12,"MicroStrategy Announces $600M Debt Offering to Buy More BTC","POSITIVE",7,"NORMAL"
2/19/2021,55888.24,11.5,5.8,45,"First North American Bitcoin ETF Launches in Canada","POSITIVE",9,"EVENT DETECTED"
2/22/2021,48824.43,-12.6,-6.3,-40,"Major Price Correction","NEGATIVE",8,"EVENT DETECTED"
3/13/2021,61222.22,16.2,8.1,60,"Bitcoin Taps New All-Time High Above $61k","POSITIVE",9,"EVENT DETECTED"
3/24/2021,52774.24,-8.12,-4.1,-30,"Elon Musk Announces Tesla Now Accepts Bitcoin for Cars","POSITIVE",8,"EVENT DETECTED"
4/14/2021,63503.46,4.5,2.3,20,"Coinbase (COIN) Direct Listing on Nasdaq","POSITIVE",10,"EVENT DETECTED"
4/22/2021,51746.94,-9.1,-4.6,-35,"Reports of Potential US Capital Gains Tax Hike up to 43.4%","NEGATIVE",8,"EVENT DETECTED"
5/12/2021,49160.91,-13.9,-7.0,-50,"Elon Musk Tweets Tesla Has Suspended Vehicle Purchases Using Bitcoin Due to Environmental Concerns","NEGATIVE",10,"EVENT DETECTED"
5/19/2021,37000.43,-21.4,-10.7,-70,"China Reiterates Ban on Financial, Payment Institutions from Crypto Business","NEGATIVE",10,"EVENT DETECTED"
5/21/2021,37318.42,1.2,0.6,5,"China's State Council Vows to Crack Down on Bitcoin Mining and Trading","NEGATIVE",9,"EVENT DETECTED"
6/4/2021,36894.42,2.1,1.1,8,"Elon Musk Tweets #Bitcoin with a broken heart emoji","NEGATIVE",6,"EVENT DETECTED"
6/9/2021,33472.64,-8.4,-4.2,-30,"El Salvador Passes Law to Adopt Bitcoin as Legal Tender","POSITIVE",10,"EVENT DETECTED"
6/21/2021,31676.69,-9.2,-4.6,-35,"China Intensifies Crypto Mining Crackdown, Forcing Miners to Shut Down","NEGATIVE",9,"EVENT DETECTED"
7/21/2021,32134.89,8.1,4.1,30,"'The B Word' Conference with Elon Musk, Jack Dorsey, Cathie Wood, Discussing Bitcoin Positively","POSITIVE",8,"EVENT DETECTED"
7/26/2021,37286.63,16.0,8.0,60,"Amazon Job Posting for 'Digital Currency and Blockchain Product Lead' Sparks Speculation","POSITIVE",7,"EVENT DETECTED"
9/7/2021,46811.13,-11.1,-5.6,-45,"El Salvador's Bitcoin Law Goes into Effect, Accompanied by a 'Flash Crash'","NEGATIVE",9,"EVENT DETECTED"
9/24/2021,42839.75,-5.2,-2.6,-20,"People's Bank of China (PBoC) Declares All Crypto-related Transactions Illegal","NEGATIVE",9,"EVENT DETECTED"
10/6/2021,51514.81,12.5,6.3,50,"George Soros' Fund Confirms It Owns Bitcoin","POSITIVE",7,"EVENT DETECTED"
10/15/2021,61593.95,7.5,3.8,30,"SEC Approves First Bitcoin Futures ETF (ProShares BITO)","POSITIVE",10,"EVENT DETECTED"
11/10/2021,64995.23,-6.2,-3.1,-25,"Bitcoin Reaches New All-Time High near $69,000","POSITIVE",9,"EVENT DETECTED"
11/26/2021,53569.77,-8.4,-4.2,-30,"New COVID-19 Variant 'Omicron' Sparks Global Market Sell-off","NEGATIVE",7,"EVENT DETECTED"
1/24/2022,36654.33,-5.1,-2.6,-20,"Market Fears over Fed Rate Hikes and Quantitative Tightening Intensify","NEGATIVE",8,"EVENT DETECTED"
2/10/2022,43565.11,3.1,1.6,12,"US Inflation Hits 7.5%, a 40-year High, Increasing Pressure on Fed","NEGATIVE",6,"NORMAL"
2/24/2022,38332.61,-10.2,-5.1,-38,"Russia Invades Ukraine, Sparking Global Market Turmoil","NEGATIVE",9,"EVENT DETECTED"
3/9/2022,41982.63,8.7,4.4,32,"Biden Signs Executive Order on 'Ensuring Responsible Development of Digital Assets'","NEUTRAL",7,"EVENT DETECTED"
4/6/2022,43206.91,-5.5,-2.8,-22,"Minutes from Fed's March meeting show aggressive plan for balance sheet reduction","NEGATIVE",7,"EVENT DETECTED"
5/9/2022,30294.72,-12.8,-6.4,-48,"Terra's Stablecoin UST De-pegs, LUNA Crashes, Sparking Contagion Fears","NEGATIVE",10,"EVENT DETECTED"
5/12/2022,29001.55,-10.8,-5.4,-40,"UST and LUNA Collapse Continues, Wiping Out Billions in Value","NEGATIVE",10,"EVENT DETECTED"
6/13/2022,22487.39,-15.8,-7.9,-55,"Celsius Network Pauses Withdrawals, Swaps, and Transfers, Citing 'Extreme Market Conditions'","NEGATIVE",10,"EVENT DETECTED"
6/18/2022,19017.64,-9.3,-4.7,-35,"Bitcoin Dips Below $20k, Breaking the Previous Bull Market's All-Time High","NEGATIVE",9,"EVENT DETECTED"
6/30/2022,19784.73,-5.2,-2.6,-20,"Grayscale's Spot Bitcoin ETF Application is Rejected by the SEC","NEGATIVE",7,"EVENT DETECTED"
7/13/2022,19822.47,2.1,1.1,8,"US CPI Inflation Hits 9.1%, a New 40-year High","NEGATIVE",6,"NORMAL"
8/26/2022,20263.29,-6.2,-3.1,-25,"Fed Chair Powell's Hawkish Jackson Hole Speech Dashes Hopes of a Policy Pivot","NEGATIVE",8,"EVENT DETECTED"
9/15/2022,19701.32,-1.5,-0.8,-5,"Ethereum Completes 'The Merge,' Transitioning to Proof-of-Stake","NEUTRAL",9,"EVENT DETECTED"
11/8/2022,18541.25,-10.6,-5.3,-40,"FTX Halts Withdrawals After Facing a Liquidity Crunch, Binance Backs Out of Acquisition Deal","NEGATIVE",10,"EVENT DETECTED"
11/9/2022,16474.96,-14.1,-7.1,-50,"FTX Collapse Unfolds, Alameda Research and FTX Declare Bankruptcy","NEGATIVE",10,"EVENT DETECTED"
1/12/2023,17500.1,4.2,2.1,15,"Positive US CPI data fuels market rally","POSITIVE",6,"NORMAL"
3/10/2023,20187.35,-8.1,-4.1,-30,"Silvergate Bank Announces Intent to Wind Down Operations and Liquidate","NEGATIVE",8,"EVENT DETECTED"
3/12/2023,22161.7,9.3,4.7,35,"Regulators Announce Plan to Backstop All Silicon Valley Bank (SVB) Deposits","POSITIVE",8,"EVENT DETECTED"
3/17/2023,27473.45,10.1,5.1,40,"Banking crisis continues, Credit Suisse bailed out","POSITIVE",7,"EVENT DETECTED"
4/11/2023,30008.32,5.2,2.6,20,"Bitcoin breaks $30k for the first time since June 2022","POSITIVE",7,"NORMAL"
6/15/2023,25125.75,-4.1,-2.1,-15,"BlackRock Files for a Spot Bitcoin ETF","POSITIVE",10,"EVENT DETECTED"
6/20/2023,28323.77,8.2,4.1,30,"EDX Markets, a new crypto exchange backed by Citadel, Fidelity, and Schwab, launches","POSITIVE",8,"EVENT DETECTED"
8/17/2023,26477.83,-7.2,-3.6,-28,"Reports that SpaceX wrote down its Bitcoin holdings","NEGATIVE",7,"EVENT DETECTED"
8/29/2023,27726.2,6.1,3.1,25,"Grayscale Wins Lawsuit Against SEC Over Bitcoin ETF Conversion","POSITIVE",9,"EVENT DETECTED"
10/2/2023,27976.3,3.1,1.6,12,"MicroStrategy acquires another 5,445 BTC","POSITIVE",5,"NORMAL"
10/16/2023,28514.9,4.9,2.5,20,"False report of BlackRock's iShares Bitcoin ETF approval causes price spike and retrace","NEUTRAL",7,"EVENT DETECTED"
11/9/2023,36681.42,2.8,1.4,10,"SEC begins talks with Grayscale on spot ETF","POSITIVE",8,"NORMAL"
1/10/2024,46122.1,2.1,1.1,8,"SEC Approves 11 Spot Bitcoin ETFs, Including BlackRock, Fidelity, and Grayscale","POSITIVE",10,"EVENT DETECTED"
1/12/2024,42850.5,-7.5,-3.8,-28,"Massive outflows from Grayscale's GBTC begin, creating selling pressure","NEGATIVE",8,"EVENT DETECTED"
2/28/2024,62514.3,9.8,4.9,35,"Spot Bitcoin ETFs see record-breaking daily inflows","POSITIVE",9,"EVENT DETECTED"
3/5/2024,67323.1,6.5,3.3,25,"Bitcoin briefly surpasses its 2021 all-time high","POSITIVE",9,"NORMAL"
3/14/2024,73083.5,-1.1,-0.6,-5,"Bitcoin sets new all-time high above $73,000","POSITIVE",9,"EVENT DETECTED"
4/12/2024,67195.3,-5.2,-2.6,-20,"Pre-halving jitters and geopolitical tensions cause market dip","NEGATIVE",7,"EVENT DETECTED"
4/19/2024,63854.3,4.1,2.1,15,"The 4th Bitcoin Halving Occurs, Reducing Block Reward from 6.25 to 3.125 BTC","NEUTRAL",10,"EVENT DETECTED"
`;

class BtcHistoryService {
    private history: BtcHistoryEntry[] = [];
    private historyByDate: Map<string, BtcHistoryEntry[]> = new Map();
    private dateRange: { min: string; max: string } = { min: '', max: '' };
    private isInitialized = false;

    constructor() {
        // Initialization is now handled by the init() method.
    }

    public init() {
        if (this.isInitialized) {
            return;
        }
        try {
            this.parseCsvData(HISTORICAL_BTC_CSV_DATA);
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

    private parseCsvData(csvData: string) {
        const lines = csvData.trim().split('\n');
        const header = lines.shift(); 
        if (!header) return;

        const parsedData: BtcHistoryEntry[] = [];
        
        lines.forEach(line => {
            const parts = line.match(/(?:"[^"]*"|[^,]+)/g);
            if (parts && parts.length >= 9) {
                try {
                    const entry: BtcHistoryEntry = {
                        date: this.formatDate(parts[0].replace(/"/g, '')),
                        price: parseFloat(parts[1]),
                        dailyChange: parseFloat(parts[2]),
                        volatility: parseFloat(parts[3]),
                        volumeChange: parseFloat(parts[4]),
                        eventType: parts[5].replace(/"/g, '').trim(),
                        direction: parts[6].replace(/"/g, '').trim(),
                        intensityScore: parseInt(parts[7], 10),
                        status: parts[8].replace(/"/g, '').trim(),
                        event_source: parts[9] ? parts[9].trim() : undefined,
                        sentiment_impact: parts[10] ? parts[10].trim() as BtcHistoryEntry['sentiment_impact'] : undefined,
                        related_news_url: parts[11] ? parts[11].trim() : undefined,
                    };
                    parsedData.push(entry);
                } catch (e) {
                    console.warn("Skipping malformed CSV line:", line);
                }
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
