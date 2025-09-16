import { build } from "esbuild";

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
  live_pricing: any[]; // Raw pricing data from the script
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
// This URL seems to be consistently failing. We will prioritize fallbacks.
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJE0UtXQSjZ3wsSYHLm066ZUtbfcMShgHN04p7_cDZDtKNr0IlRYlo_p4jHmu_2GeTeQ/exec';

// FIX: Removed the hardcoded CoinGecko demo API key to use the public, keyless API, which is more reliable and avoids rate-limiting issues from a shared key.
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_PRICING_FALLBACK_URL = `${COINGECKO_BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false`;
const COINGECKO_GLOBAL_FALLBACK_URL = `${COINGECKO_BASE_URL}/global`;


// --- SERVICE-LEVEL CACHING ---
let primaryDataCache: PrimaryDataResponse | null = null;
let lastFetchTimestamp = 0;
const CACHE_DURATION = 10000; // Cache for 10 seconds to prevent rapid re-fetching from different components

const cryptoDataStore: { [key: string]: CryptoPrice } = {};

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
 * Fetches the primary composite data from the Google Apps Script.
 * Uses a short-term cache to avoid redundant network calls.
 */
const fetchFromGoogleScript = async (): Promise<PrimaryDataResponse> => {
    const now = Date.now();
    if (primaryDataCache && (now - lastFetchTimestamp < CACHE_DURATION)) {
        console.log("Returning cached primary data.");
        return primaryDataCache;
    }
    console.log("Fetching live data from primary source (Google Script)...");
    
    // FIX: Add specific try/catch for the fetch call to handle network errors gracefully.
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        if (!response.ok) {
            throw new Error(`Google Script request failed with status ${response.status}`);
        }
        const data = await response.json();
        if (!data.live_pricing || !data.news_sentiment || !data.global_liquidity) {
            throw new Error("Google Script response is missing required data fields.");
        }
        primaryDataCache = data;
        lastFetchTimestamp = now;
        return data;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            // This is the specific network error the user is seeing.
            throw new Error('Network error: Unable to connect to the primary data source.');
        }
        // Re-throw other errors
        throw error;
    }
};

/**
 * Fetches live pricing data from the CoinGecko API as a fallback.
 */
const fetchFromCoinGecko = async (): Promise<CryptoPrice[]> => {
    console.log("Fetching live pricing from fallback source (CoinGecko)...");
    try {
        const response = await fetch(COINGECKO_PRICING_FALLBACK_URL);
        if (!response.ok) throw new Error(`CoinGecko API request failed: ${response.statusText}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('CoinGecko API did not return an array.');
        
        return data.map((coin: any) => ({
            id: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            price: coin.current_price ?? 0,
            change24h: coin.price_change_percentage_24h ?? 0,
            marketCap: coin.market_cap ?? 0,
        })).filter(p => p.price > 0);

    } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
             throw new Error('Network error: Unable to connect to the CoinGecko API.');
        }
        throw error;
    }
};

/**
 * NEW: Fetches global liquidity data from CoinGecko as a fallback.
 */
const fetchGlobalLiquidityFromFallback = async (): Promise<GlobalLiquidity> => {
    console.log("Fetching global liquidity from fallback source (CoinGecko)...");
    try {
        const response = await fetch(COINGECKO_GLOBAL_FALLBACK_URL);
        if (!response.ok) throw new Error(`CoinGecko Global API request failed: ${response.statusText}`);
        const data = await response.json();
        
        return {
            total_market_cap: data.data.total_market_cap.usd,
            btc_dominance: data.data.market_cap_percentage.btc,
            // These are not available from this endpoint, so we provide reasonable static values.
            stablecoin_supply: 160_000_000_000,
            defi_tvl: 95_000_000_000
        };
    } catch (error) {
        console.error("CoinGecko Global fallback failed:", error);
        // Re-throw the error to be handled by the caller.
        throw error;
    }
};


/**
 * Main function to get live pricing. Tries the Google Script first, then CoinGecko, then cache.
 * Returns an empty array if all sources fail.
 */
export const fetchLivePricing = async (): Promise<CryptoPrice[]> => {
  try {
    const data = await fetchFromGoogleScript();
    const prices: CryptoPrice[] = data.live_pricing.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price ?? 0,
        change24h: coin.price_change_percentage_24h ?? 0,
        marketCap: coin.market_cap ?? 0,
    })).filter(p => p.price > 0 && p.symbol);
    
    // Update cache with fresh data
    Object.keys(cryptoDataStore).forEach(key => delete cryptoDataStore[key]);
    prices.forEach(p => { cryptoDataStore[p.id] = p; });
    return prices;
    
  } catch (primaryError) {
    console.warn("Primary data fetch (Google Script) failed:", (primaryError as Error).message);
    try {
        const prices = await fetchFromCoinGecko();
        Object.keys(cryptoDataStore).forEach(key => delete cryptoDataStore[key]);
        prices.forEach(p => { cryptoDataStore[p.id] = p; });
        return prices;
    } catch (fallbackError) {
        console.error("Fallback data fetch (CoinGecko) also failed:", (fallbackError as Error).message);
        const cachedData = Object.values(cryptoDataStore);
        if (cachedData.length > 0) {
            console.log("Returning cached data as a last resort.");
            return cachedData;
        } else {
            console.warn("All data sources failed and cache is empty. Returning empty array.");
            return [];
        }
    }
  }
};

/**
 * Gets the news and sentiment data. Returns null if the primary source fails.
 */
export const getNewsSentiment = async (): Promise<NewsSentiment | null> => {
    try {
        const data = await fetchFromGoogleScript();
        return data.news_sentiment;
    } catch (error) {
        console.warn("Primary source for news sentiment failed. No fallback available.", (error as Error).message);
        return null;
    }
};

/**
 * Gets the global liquidity data. Uses CoinGecko as a fallback and returns null if both sources fail.
 */
export const getGlobalLiquidity = async (): Promise<GlobalLiquidity | null> => {
    try {
        const data = await fetchFromGoogleScript();
        return data.global_liquidity;
    } catch (error) {
        console.warn("Primary source for global liquidity failed. Using fallback.", (error as Error).message);
        try {
            return await fetchGlobalLiquidityFromFallback();
        } catch (fallbackError) {
            console.error("Global liquidity fallback also failed. No data available.", (fallbackError as Error).message);
            return null;
        }
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