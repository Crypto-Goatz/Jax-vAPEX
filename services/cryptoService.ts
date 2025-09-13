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

/**
 * Constructs a public URL for a file in Firebase Storage.
 * @param path The full path to the file within the bucket.
 * @returns A publicly accessible URL to download the file.
 */
const buildStorageUrl = (path: string): string => {
    const encodedPath = encodeURIComponent(path);
    return `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_PROJECT_ID}.appspot.com/o/${encodedPath}?alt=media`;
};


const COINGECKO_API_KEY = 'CG-NvkZx9oodFdjaz1zB3Z2t4Zj';
const COINGECKO_FALLBACK_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false';

// In-memory "database" to act as a cache for the live data feed.
const cryptoDataStore: { [key: string]: CryptoPrice } = {};

const staticFallbackData: CryptoPrice[] = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 65432.10, change24h: 1.25, marketCap: 1300000000000 },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 3510.50, change24h: -0.55, marketCap: 420000000000 },
    { id: 'solana', symbol: 'SOL', name: 'Solana', price: 150.75, change24h: 3.10, marketCap: 69000000000 },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB', price: 580.20, change24h: 0.15, marketCap: 85000000000 },
    { id: 'ripple', symbol: 'XRP', name: 'XRP', price: 0.48, change24h: -1.20, marketCap: 26000000000 },
    { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', price: 0.125, change24h: 5.50, marketCap: 18000000000 },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano', price: 0.39, change24h: 0.80, marketCap: 14000000000 },
    { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', price: 25.50, change24h: 2.10, marketCap: 10000000000 },
    { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', price: 14.20, change24h: -2.30, marketCap: 8000000000 },
    { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', price: 5.90, change24h: 1.10, marketCap: 8200000000 },
];

/**
 * Fetches live pricing data from the CoinGecko API.
 * This is the primary data source.
 */
const fetchFromCoinGecko = async (): Promise<CryptoPrice[]> => {
    console.log("Fetching live pricing from primary source (CoinGecko)...");
    const response = await fetch(COINGECKO_FALLBACK_URL, {
        method: 'GET',
        headers: {
            'x-cg-demo-api-key': COINGECKO_API_KEY,
            'Accept': 'application/json',
        }
    });

    if (!response.ok) {
        throw new Error(`CoinGecko API request failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
        throw new Error('CoinGecko API did not return an array.');
    }

    const prices: CryptoPrice[] = data.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price ?? 0,
        change24h: coin.price_change_percentage_24h ?? 0,
        marketCap: coin.market_cap ?? 0,
    })).filter(p => p.price > 0);

    return prices;
};

/**
 * Main function to fetch live pricing data.
 * It tries the reliable CoinGecko API. If that fails, it returns
 * the last known cached data or a static fallback.
 */
export const fetchLivePricing = async (): Promise<CryptoPrice[]> => {
  try {
    const prices = await fetchFromCoinGecko();
    console.log("Successfully fetched data from primary source (CoinGecko).");

    // Update cache with fresh data
    Object.keys(cryptoDataStore).forEach(key => delete cryptoDataStore[key]);
    prices.forEach(p => { cryptoDataStore[p.id] = p; });
    return prices;

  } catch (primaryError) {
    console.error("Primary data fetch (CoinGecko) failed:", primaryError);
    const cachedData = Object.values(cryptoDataStore);
    if (cachedData.length > 0) {
        console.log("Returning cached data as a fallback.");
        return cachedData;
    } else {
        console.warn("Cache is empty. Returning static fallback data. App will have limited functionality.");
        return staticFallbackData;
    }
  }
};


// In-memory cache for fetched historical data.
const historicalDataCache: { [key: string]: HistoricalData } = {};

/**
 * Generates plausible mock OHLCV data for a given crypto symbol if real data fetching fails.
 * @param symbol The crypto symbol (e.g., 'BTC').
 * @param numDays The number of days of data to generate.
 * @returns An array of mock OHLCV data.
 */
const generateMockOhlcvData = (symbol: string, numDays: number): OhlcvData[] => {
    const mockData: OhlcvData[] = [];
    let price: number;

    // Set a plausible starting price based on symbol
    const s = symbol.toUpperCase();
    if (s === 'BTC') price = 65000;
    else if (s === 'ETH') price = 3500;
    else if (s === 'SOL') price = 150;
    else price = 100 + Math.random() * 200; // Generic price for others

    const now = new Date();
    // Start from the past, so we generate data up to 'now'
    const startTime = new Date(now);
    startTime.setDate(now.getDate() - numDays);

    // Generate hourly data points for better granularity, especially for the 24h view
    for (let i = 0; i < numDays * 24; i++) {
        const pointTime = new Date(startTime);
        pointTime.setHours(startTime.getHours() + i);

        // Don't generate data for the future
        if (pointTime > now) break;

        const volatility = 0.02; // 2% hourly volatility
        // Sine wave for some pattern + random noise
        const trend = Math.sin(i / (24 * 2)); // A 4-day cycle
        const change = (Math.random() - 0.5 + trend * 0.2) * price * volatility;
        
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * price * (volatility / 4);
        const low = Math.min(open, close) - Math.random() * price * (volatility / 4);
        const volume = Math.random() * 1000000;

        mockData.push({
            time: Math.floor(pointTime.getTime() / 1000),
            open,
            high,
            low,
            close,
            volume,
        });

        price = Math.max(0.0001, close); // ensure price doesn't go negative
    }

    return mockData;
};


/**
 * Fetches the OHLCV data for a single coin on a single day from Firebase Storage.
 * @param coinSymbol The coin's ticker symbol (e.g., 'BTC').
 * @param date The date to fetch data for.
 * @returns A promise resolving to an array of OHLCV data, or an empty array on failure.
 */
const fetchOhlcvForDay = async (coinSymbol: string, date: Date): Promise<OhlcvData[]> => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    const path = `historical/coins/${coinSymbol.toUpperCase()}/${year}/${month}/${coinSymbol.toUpperCase()}_${dateString}.json`;
    const url = buildStorageUrl(path);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            // This is not an error, the file might just not exist for that day.
            // console.warn(`Historical data for ${coinSymbol} on ${dateString} not found. Status: ${response.status}`);
            return [];
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
             console.warn(`Historical data for ${coinSymbol} on ${dateString} is not an array.`);
             return [];
        }
        return data;
    } catch (error) {
        console.error(`Error fetching historical data for ${coinSymbol} on ${dateString}:`, error);
        return [];
    }
};

/**
 * Fetches and processes historical data for a specific coin and timeframe from Firebase Storage.
 * It fetches multiple daily files and aggregates them to be suitable for charting.
 * @param coinSymbol The coin's ticker symbol (e.g., 'BTC').
 * @param timeframe The desired timeframe ('24h', '7d', '30d', '1y').
 * @returns A promise resolving to chart-ready historical data.
 */
export const fetchHistoricalData = async (coinSymbol: string, timeframe: string): Promise<HistoricalData> => {
    const cacheKey = `${coinSymbol}-${timeframe}`;
    if (historicalDataCache[cacheKey]) {
        console.log(`Returning cached data for ${cacheKey}`);
        return historicalDataCache[cacheKey];
    }

    console.log(`Fetching real historical data from Firebase Storage for: ${cacheKey}`);
    
    const now = new Date();
    const datesToFetch: Date[] = [];
    let numDays = 0;

    switch (timeframe) {
        case '24h': numDays = 2; break; // Fetch today and yesterday for a complete 24h window
        case '7d': numDays = 7; break;
        case '30d': numDays = 30; break;
        case '1y': numDays = 365; break;
        default: numDays = 30;
    }

    for (let i = 0; i < numDays; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        datesToFetch.push(d);
    }
    
    const promises = datesToFetch.map(date => fetchOhlcvForDay(coinSymbol, date));
    const dailyDataArrays = await Promise.all(promises);
    let allOhlcv = dailyDataArrays.flat().sort((a, b) => a.time - b.time);

    if (allOhlcv.length === 0) {
        console.warn(`No historical data found for ${coinSymbol} in the requested timeframe. Generating mock data.`);
        allOhlcv = generateMockOhlcvData(coinSymbol, numDays);
    }
    
    let labels: string[] = [];
    let prices: number[] = [];
    
    if (timeframe === '24h') {
        const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);
        const recentData = allOhlcv.filter(d => d.time * 1000 >= twentyFourHoursAgo);
        labels = recentData.map(d => new Date(d.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        prices = recentData.map(d => d.close);
    } else {
        // For longer timeframes, aggregate data to avoid overcrowding the chart.
        const dailyCloses = new Map<string, number>();
        allOhlcv.forEach(d => {
            const dateString = new Date(d.time * 1000).toISOString().split('T')[0];
            dailyCloses.set(dateString, d.close);
        });
        
        const sortedEntries = Array.from(dailyCloses.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

        if (timeframe === '1y') {
            // Aggregate daily data into monthly for the 1-year view
            const monthlyCloses = new Map<string, number[]>();
             sortedEntries.forEach(([dateStr, price]) => {
                const monthString = new Date(dateStr + 'T12:00:00Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
                if (!monthlyCloses.has(monthString)) {
                    monthlyCloses.set(monthString, []);
                }
                monthlyCloses.get(monthString)!.push(price);
            });
            labels = Array.from(monthlyCloses.keys());
            // Use the last price of the month as the representative close
            prices = Array.from(monthlyCloses.values()).map(priceArray => priceArray[priceArray.length - 1]);
        } else { // 7d, 30d
            labels = sortedEntries.map(([ds]) => new Date(ds + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
            prices = sortedEntries.map(([, price]) => price);
        }
    }
    
    if (prices.length === 0) {
        // This case should be rare now with mock data, but as a safeguard:
        throw new Error(`Could not process historical data for ${coinSymbol}`);
    }

    const data = { labels, prices };
    historicalDataCache[cacheKey] = data; // Cache the processed data
    return data;
};

/**
 * Fetches the historical market snapshot for a specific date from a JSON file in Firebase Storage.
 * @param date The date in 'YYYY-MM-DD' format.
 * @returns A promise that resolves to an array of historical crypto price data.
 */
export const fetchHistoricalSnapshot = async (date: string): Promise<HistoricalCryptoPrice[]> => {
    const path = `historical/top50_cc_historical_${date}.json`;
    const url = buildStorageUrl(path);
    console.log(`Fetching historical snapshot from: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Historical data for ${date} not found. Status: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error("Historical data is not in the expected array format.");
        }
        return data;
    } catch (error) {
        console.error("Error fetching historical snapshot:", error);
        throw new Error(`Failed to load historical market data for ${date}. The file may not exist.`);
    }
};