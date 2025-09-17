import { btcHistoryService } from './btcHistoryService';

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

export interface NewsSentiment {
  sentiment_score: number;
  trending_narratives: string[];
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

export interface PrimaryDataResponse {
  news_sentiment: NewsSentiment;
  global_liquidity: GlobalLiquidity;
  live_pricing: any[]; // Raw pricing data
}


// A more specific type for the historical snapshot data.
export interface HistoricalCryptoPrice {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
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
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSc5lzT8YRDvyb1vqo0NiDD6xvp5tbffuPToSSi_P-a-F8J_AA0nrkpWzXii_1b_hbKydqdmOnRST0p/pub?output=csv';


// Mock data for non-pricing related features to keep them functional as per the user's request.
const MOCK_STATIC_DATA = {
  global_liquidity: {
    total_market_cap: 2570000000000,
    btc_dominance: 51.8,
    stablecoin_supply: 150000000000,
    defi_tvl: 95000000000,
  },
  news_sentiment: {
    sentiment_score: 0.68,
    trending_narratives: [
      "AI tokens gain traction as tech giants invest.",
      "Regulatory clarity in the EU boosts institutional interest.",
      "Layer-2 solutions see record high transaction volumes.",
      "Bitcoin ETFs continue to see net positive inflows.",
      "The 'Real World Asset' (RWA) narrative is heating up."
    ],
    top_story: {
      headline: "Major Investment Bank Announces Plans for Crypto Custody Services",
      source: "CryptoNews Today",
      url: "#",
    },
  },
};


// --- SERVICE-LEVEL CACHING ---
let primaryDataCache: PrimaryDataResponse | null = null;
let lastFetchTimestamp = 0;
const CACHE_DURATION = 10000; // Cache for 10 seconds to prevent rapid re-fetching from different components
const cryptoDataStore: { [key: string]: CryptoPrice } = {};

// --- FAIL-SAFE CACHE ---
let lastPriceCache: Map<string, number> = new Map();


/**
 * Constructs a public URL for a file in Firebase Storage.
 * @param path The full path to the file within the bucket.
 * @returns A publicly accessible URL to download the file.
 */
const buildStorageUrl = (path: string): string => {
    const encodedPath = encodeURIComponent(path);
    return `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_PROJECT_ID}.appspot.com/o/${encodedPath}?alt=media`;
};

/**
 * Parses raw CSV text into an array of objects.
 * @param csvText The raw CSV string.
 * @returns An array of objects representing the rows.
 */
const parseCsvData = (csvText: string): any[] => {
    const rows = csvText.trim().split('\n');
    const headers = rows.shift()?.split(',') || [];
    return rows.map(row => {
        const values = row.split(',');
        const obj: any = {};
        headers.forEach((header, index) => {
            obj[header.trim()] = values[index]?.trim();
        });
        return obj;
    });
};

/**
 * Fail-safe function to check for inconsistent price data.
 * @param newPrices The newly fetched list of crypto prices.
 */
const checkPriceConsistency = (newPrices: CryptoPrice[]) => {
    if (lastPriceCache.size === 0) {
        // First fetch, populate cache and skip check
        newPrices.forEach(p => lastPriceCache.set(p.id, p.price));
        return;
    }

    const top10 = newPrices.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0)).slice(0, 10);
    let inconsistentCount = 0;
    const inconsistencyThreshold = 0.50; // 50% change is considered inconsistent

    top10.forEach(coin => {
        const oldPrice = lastPriceCache.get(coin.id);
        if (oldPrice && oldPrice > 0) {
            const change = Math.abs((coin.price - oldPrice) / oldPrice);
            if (change > inconsistencyThreshold) {
                inconsistentCount++;
            }
        }
    });

    if (inconsistentCount > 5) { // If more than half of the top 10 are inconsistent
        const errorMessage = `FAIL-SAFE TRIGGERED: Inconsistent pricing data detected from the source. More than 5 of the top 10 coins changed by over ${inconsistencyThreshold * 100}%. Please investigate the data source. Notification should be sent to mike@rocketopp.com.`;
        console.error(errorMessage);
        // In a real application, this would trigger a backend service to send an email.
        // For this frontend-only implementation, we log a critical error to the console.
    }

    // Update cache with the new, validated prices
    newPrices.forEach(p => lastPriceCache.set(p.id, p.price));
};


/**
 * Fetches the primary composite data. Pricing is fetched from the Google Sheet,
 * while other data comes from a static mock to preserve UI functionality.
 * Uses a short-term cache to avoid redundant processing.
 */
const fetchPrimaryData = async (): Promise<PrimaryDataResponse> => {
    const now = Date.now();
    if (primaryDataCache && (now - lastFetchTimestamp < CACHE_DURATION)) {
        return primaryDataCache;
    }

    try {
        const response = await fetch(GOOGLE_SHEET_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to fetch from Google Sheet: ${response.statusText}`);
        }
        const csvText = await response.text();
        const parsedData = parseCsvData(csvText);

        const live_pricing = parsedData.map((d: any) => ({
            id: d.id,
            symbol: d.symbol.toUpperCase(),
            name: d.name,
            current_price: parseFloat(d.current_price),
            market_cap: parseInt(d.market_cap, 10),
            price_change_percentage_24h: parseFloat(d.price_change_percentage_24h),
        })).filter(d => d.id && d.symbol && !isNaN(d.current_price) && d.current_price > 0);

        const result: PrimaryDataResponse = {
            live_pricing,
            ...MOCK_STATIC_DATA
        };

        primaryDataCache = result;
        lastFetchTimestamp = now;

        return result;
    } catch (error) {
        console.error("Error fetching or parsing pricing data from Google Sheet:", error);
        if (primaryDataCache) {
            console.warn("Returning stale cache due to fetch failure.");
            return primaryDataCache;
        }
        throw error; // Re-throw if no cache is available
    }
};

/**
 * Main function to get live pricing. Relies on the Google Sheet source of truth.
 * Returns an empty array if all sources fail.
 */
export const fetchLivePricing = async (): Promise<CryptoPrice[]> => {
  try {
    const data = await fetchPrimaryData();
    
    const prices: CryptoPrice[] = data.live_pricing.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price ?? 0,
        change24h: coin.price_change_percentage_24h ?? 0,
        marketCap: coin.market_cap ?? 0,
    })).filter(p => p.price > 0 && p.symbol);
    
    // Run the fail-safe check against the last known prices
    checkPriceConsistency(prices);
    
    // Update short-term cache (cryptoDataStore) used for immediate fallbacks
    Object.keys(cryptoDataStore).forEach(key => delete cryptoDataStore[key]);
    prices.forEach(p => { cryptoDataStore[p.id] = p; });
    return prices;
    
  } catch (primaryError) {
    console.warn("Primary data source failed:", (primaryError as Error).message);
    const cachedData = Object.values(cryptoDataStore);
    if (cachedData.length > 0) {
        console.log("Returning cached pricing data as a fallback.");
        return cachedData;
    } else {
        console.error("Primary data source failed and cache is empty. Unable to fetch live pricing.");
        return [];
    }
  }
};

/**
 * Gets the news and sentiment data from the static mock.
 */
export const getNewsSentiment = async (): Promise<NewsSentiment | null> => {
    try {
        const data = await fetchPrimaryData(); // Ensures cache is used if available
        return data.news_sentiment;
    } catch (error) {
        console.warn("Could not retrieve news sentiment due to data source failure.", (error as Error).message);
        return null;
    }
};

/**
 * Gets the global liquidity data from the static mock.
 */
export const getGlobalLiquidity = async (): Promise<GlobalLiquidity | null> => {
    try {
        const data = await fetchPrimaryData(); // Ensures cache is used if available
        return data.global_liquidity;
    } catch (error) {
        console.warn("Could not retrieve global liquidity due to data source failure.", (error as Error).message);
        return null;
    }
};


// --- HISTORICAL DATA (UNCHANGED) ---

const historicalDataCache: { [key: string]: HistoricalData } = {};

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

export const fetchHistoricalData = async (coinSymbol: string, timeframe: string): Promise<HistoricalData> => {
    const cacheKey = `${coinSymbol}-${timeframe}`;
    if (historicalDataCache[cacheKey]) return historicalDataCache[cacheKey];

    let numDays = 30;
    if (timeframe === '24h') numDays = 2;
    else if (timeframe === '7d') numDays = 7;
    else if (timeframe === '1y') numDays = 365;

    const datesToFetch = Array.from({ length: numDays }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d;
    });

    const dailyDataArrays = await Promise.all(datesToFetch.map(date => fetchOhlcvForDay(coinSymbol, date)));
    let allOhlcv = dailyDataArrays.flat().sort((a, b) => a.time - b.time);

    if (allOhlcv.length === 0) {
        console.error(`No historical data found for ${coinSymbol}. All sources failed.`);
        throw new Error(`Historical data for ${coinSymbol} is currently unavailable.`);
    }

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

export const fetchHistoricalSnapshot = async (date: string): Promise<HistoricalCryptoPrice[]> => {
    const path = `historical/top50_cc_historical_${date}.json`;
    const url = buildStorageUrl(path);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Historical data for ${date} not found.`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Historical data is not an array.");
        return data;
    } catch (error) {
        console.error("Error fetching historical snapshot:", error);
        throw error;
    }
};