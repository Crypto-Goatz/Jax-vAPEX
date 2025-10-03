import { googleSheetService } from './googleSheetService';

export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap?: number;
}

export interface HistoricalData {
    labels: string[];
    prices: number[];
}

export interface Narrative {
  headline: string;
  posVotes: number;
  negVotes: number;
}

export interface NewsSentiment {
  sentiment_score: number;
  trending_narratives: Narrative[];
  top_story: {
    headline: string;
    source: string;
    url: string;
  };
}

export interface GlobalLiquidity {
  total_market_cap: number;
  btc_dominance: number;
  stablecoin_supply: number;
  defi_tvl: number;
}

// Represents the structure of the per-coin, per-day historical data files.
export interface OhlcvData {
    time: number; // unix timestamp (seconds)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

const FIREBASE_PROJECT_ID = "cryptogoatz-official";

const normalizeHeaders = (data: any[]): any[] => {
    return data.map(item => {
        const newItem: any = {};
        for (const key in item) {
            const newKey = key.toLowerCase().replace(/ /g, '_');
            newItem[newKey] = item[key];
        }
        return newItem;
    });
};

/**
 * Fetches live pricing data from the 'mergedMaster' Google Sheet.
 */
export const fetchLivePricing = async (): Promise<CryptoPrice[]> => {
  try {
    const rawData = await googleSheetService.fetchData<any>('mergedMaster');
    const normalizedData = normalizeHeaders(rawData);
    
    return normalizedData
      .map((coin: any) => ({
        id: coin.symbol?.toLowerCase() || Math.random().toString(),
        symbol: coin.symbol?.toUpperCase() || 'N/A',
        name: coin.name || coin.symbol || 'Unknown',
        price: coin.price ?? 0,
        change24h: coin.price_change_percentage_24h ?? coin['24h'] ?? 0,
        marketCap: coin.market_cap ?? 0,
    })).filter(p => p.price > 0 && p.symbol !== 'N/A');
    
  } catch (error) {
    console.error("Failed to fetch live pricing from Google Sheet:", error);
    return []; // Return empty array on failure
  }
};

/**
 * Gets the news and sentiment data from the 'news_data' sheet.
 */
export const getNewsSentiment = async (): Promise<NewsSentiment | null> => {
    try {
        const newsItems = await googleSheetService.fetchData<any>('news');
        if (newsItems.length === 0) return null;

        // Simple aggregation for sentiment score
        const totalVotes = newsItems.reduce((acc, item) => acc + (item.PosVotes || 0) + (item.NegVotes || 0), 0);
        const positiveVotes = newsItems.reduce((acc, item) => acc + (item.PosVotes || 0), 0);
        const sentiment_score = totalVotes > 0 ? positiveVotes / totalVotes : 0.5;
        
        // Extract narratives and top story
        const trending_narratives: Narrative[] = newsItems.slice(0, 5).map(item => ({
            headline: item.Title || 'No title',
            posVotes: item.PosVotes || 0,
            negVotes: item.NegVotes || 0,
        }));

        const top_story = {
            headline: newsItems[0].Title || 'No headline',
            source: newsItems[0].Domain || 'Unknown Source',
            url: newsItems[0].URL || '#'
        };

        return { sentiment_score, trending_narratives, top_story };
    } catch (error) {
        console.warn("Could not retrieve news sentiment from Google Sheet.", error);
        return null;
    }
};

/**
 * Gets global liquidity data by fetching from various sheets.
 */
export const getGlobalLiquidity = async (): Promise<GlobalLiquidity | null> => {
    try {
        const [socialData, defiData, priceData] = await Promise.all([
            googleSheetService.fetchData<any>('lunarSocial'),
            googleSheetService.fetchData<any>('defiLlama'),
            googleSheetService.fetchData<any>('mergedMaster')
        ]);

        const normalizedSocial = normalizeHeaders(socialData);
        const normalizedDefi = normalizeHeaders(defiData);

        const total_market_cap = priceData.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
        const btcData = priceData.find(c => c.Symbol?.toUpperCase() === 'BTC');
        const btc_dominance = (btcData?.market_cap && total_market_cap > 0) ? (btcData.market_cap / total_market_cap) * 100 : 50;

        const defi_tvl = normalizedDefi.reduce((sum, protocol) => sum + (protocol.tvl || 0), 0);
        
        // Stablecoin supply is not available in the sheets, so it's mocked.
        const stablecoin_supply = 160000000000;

        return {
            total_market_cap,
            btc_dominance,
            stablecoin_supply,
            defi_tvl
        };
    } catch (error) {
        console.warn("Could not retrieve global liquidity from Google Sheets.", error);
        // Fallback with mocked data to prevent UI from breaking
        return {
            total_market_cap: 2.5e12,
            btc_dominance: 51.5,
            stablecoin_supply: 160e9,
            defi_tvl: 100e9,
        };
    }
};


// --- HISTORICAL DATA (UNCHANGED) ---

const historicalDataCache: { [key: string]: HistoricalData } = {};
const buildStorageUrl = (path: string): string => {
    const encodedPath = encodeURIComponent(path);
    return `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_PROJECT_ID}.appspot.com/o/${encodedPath}?alt=media`;
};
const fetchOhlcvForDay = async (coinSymbol: string, date: Date): Promise<OhlcvData[]> => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    const path = `historical/coins/${coinSymbol.toUpperCase()}/${year}/${month}/${coinSymbol.toUpperCase()}_${dateString}.json`;
    const url = buildStorageUrl(path);

    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error(`Error fetching historical data for ${coinSymbol} on ${dateString}:`, error);
        return [];
    }
};

export const fetchRawOhlcvData = async (coinSymbol: string, days: number): Promise<OhlcvData[]> => {
    const datesToFetch = Array.from({ length: days }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d;
    });

    const dailyDataArrays = await Promise.all(datesToFetch.map(date => fetchOhlcvForDay(coinSymbol, date)));
    
    const allOhlcv = dailyDataArrays
        .flat()
        .sort((a, b) => a.time - b.time);
        
    if (allOhlcv.length === 0) {
        console.warn(`No raw OHLCV data found for ${coinSymbol} in the last ${days} days.`);
    }

    return allOhlcv;
};


export const fetchHistoricalData = async (coinSymbol: string, timeframe: string): Promise<HistoricalData> => {
    const cacheKey = `${coinSymbol}-${timeframe}`;
    if (historicalDataCache[cacheKey]) return historicalDataCache[cacheKey];

    let numDays = 30;
    if (timeframe === '24h') numDays = 2;
    else if (timeframe === '7d') numDays = 7;
    else if (timeframe === '1y') numDays = 365;

    const datesToFetch = Array.from({ length: numDays }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d; });
    const dailyDataArrays = await Promise.all(datesToFetch.map(date => fetchOhlcvForDay(coinSymbol, date)));
    let allOhlcv = dailyDataArrays.flat().sort((a, b) => a.time - b.time);

    if (allOhlcv.length === 0) { throw new Error(`Historical data for ${coinSymbol} is currently unavailable.`); }

    let labels: string[] = [];
    let prices: number[] = [];
    
    if (timeframe === '24h') {
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentData = allOhlcv.filter(d => d.time * 1000 >= twentyFourHoursAgo);
        labels = recentData.map(d => new Date(d.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        prices = recentData.map(d => d.close);
    } else {
        const dailyCloses = new Map<string, number>();
        allOhlcv.forEach(d => dailyCloses.set(new Date(d.time * 1000).toISOString().split('T')[0], d.close));
        const sortedEntries = Array.from(dailyCloses.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
        if (timeframe === '1y') {
            const monthlyCloses = new Map<string, number[]>();
            sortedEntries.forEach(([dateStr, price]) => {
                const monthString = new Date(dateStr + 'T12:00:00Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
                if (!monthlyCloses.has(monthString)) monthlyCloses.set(monthString, []);
                monthlyCloses.get(monthString)!.push(price);
            });
            labels = Array.from(monthlyCloses.keys());
            prices = Array.from(monthlyCloses.values()).map(priceArray => priceArray[priceArray.length - 1]);
        } else {
            labels = sortedEntries.map(([ds]) => new Date(ds + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
            prices = sortedEntries.map(([, price]) => price);
        }
    }
    
    if (prices.length === 0) throw new Error(`Could not process historical data for ${coinSymbol}`);

    const data = { labels, prices };
    historicalDataCache[cacheKey] = data;
    return data;
};