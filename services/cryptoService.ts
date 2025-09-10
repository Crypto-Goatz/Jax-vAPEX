
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

// Explicitly use the user-provided URL and convert it to the correct CSV format.
const USER_PROVIDED_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSc5lzT8YRDvyb1vqo0NiDD6xvp5tbffuPToSSi_P-a-F8J_AA0nrkpWzXii_1b_hbKydqdmOnRST0p/pubhtml';
const LIVE_PRICING_URL = USER_PROVIDED_URL.replace('/pubhtml', '/pub?output=csv');

const COINGECKO_API_KEY = 'CG-NvkZx9oodFdjaz1zB3Z2t4Zj';
const COINGECKO_FALLBACK_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false';

// An updated and expanded list of CORS proxies to try in sequence for better reliability.
const PROXY_URLS = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// In-memory "database" to act as a cache for the live data feed.
const cryptoDataStore: { [key: string]: CryptoPrice } = {};

/**
 * Tries to fetch a URL using a list of CORS proxies until one succeeds.
 */
const fetchWithProxyFallbacks = async (targetUrl: string): Promise<Response> => {
    let lastError: Error | null = null;
    for (const buildProxyUrl of PROXY_URLS) {
        const proxyUrl = buildProxyUrl(targetUrl);
        try {
            const proxyName = new URL(proxyUrl).hostname;
            console.log(`Attempting fetch via proxy: ${proxyName}...`);
            const response = await fetch(proxyUrl, {
                method: 'GET',
                cache: 'no-store',
                redirect: 'follow',
            });
            if (response.ok) {
                console.log(`Proxy ${proxyName} succeeded.`);
                return response; // Success!
            }
            lastError = new Error(`Proxy ${proxyName} returned a non-OK status: ${response.status} ${response.statusText}`);
            console.warn(lastError.message);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const proxyName = new URL(proxyUrl).hostname;
            console.warn(`Proxy ${proxyName} failed to fetch:`, lastError.message);
        }
    }
    // If the loop completes, all proxies have failed.
    throw new Error(`All CORS proxies failed. Last error: ${lastError?.message || 'Unknown error'}`);
};


/**
 * Fetches live pricing data from the Google Sheet via CORS proxies.
 * This is now a secondary data source due to unreliability.
 */
const fetchFromGoogleSheet = async (): Promise<CryptoPrice[]> => {
    console.log("Attempting to fetch live pricing from secondary source (Google Sheet)...");
    
    const targetUrl = `${LIVE_PRICING_URL}&t=${new Date().getTime()}`;
    const response = await fetchWithProxyFallbacks(targetUrl);

    let csvText = await response.text();
    
    if (!csvText || !csvText.includes('CoinGecko ID')) {
      throw new Error("Invalid or non-CSV content received from Google Sheet.");
    }

    if (csvText.charCodeAt(0) === 0xFEFF) {
        csvText = csvText.substring(1);
    }
    
    const lines = csvText.trim().split(/\r?\n/).filter(line => line);
    
    if (lines.length < 2) {
      throw new Error("CSV data is empty or has no content rows.");
    }

    const headers = lines[0].split(',').map(h => h.trim());
    
    const headerMapping = {
        id: 'CoinGecko ID',
        symbol: 'Symbol',
        name: 'Name',
        price: 'Current Price (USD)',
        change24h: '24h Change %',
        marketCap: 'Market Cap (USD)',
    };
    
    const idIndex = headers.indexOf(headerMapping.id);
    const symbolIndex = headers.indexOf(headerMapping.symbol);
    const nameIndex = headers.indexOf(headerMapping.name);
    const priceIndex = headers.indexOf(headerMapping.price);
    const change24hIndex = headers.indexOf(headerMapping.change24h);
    const marketCapIndex = headers.indexOf(headerMapping.marketCap);

    if ([idIndex, symbolIndex, nameIndex, priceIndex, change24hIndex].includes(-1)) {
        const missing = Object.values(headerMapping).filter(h => !headers.includes(h) && h !== headerMapping.marketCap);
        throw new Error(`CSV is missing required headers: [${missing.join(', ')}].`);
    }

    const prices = lines.slice(1).map((line): CryptoPrice | null => {
        const values = line.split(',').map(v => v.trim());
        if (values.length < headers.length) return null;

        const id = values[idIndex];
        const priceStr = values[priceIndex].replace(/[$,]/g, '');
        const changeStr = values[change24hIndex].replace('%', '');
        const marketCapStr = marketCapIndex !== -1 ? values[marketCapIndex]?.replace(/[$,]/g, '') : undefined;
        
        const priceVal = parseFloat(priceStr);
        const changeVal = parseFloat(changeStr);
        const marketCapVal = marketCapStr ? parseFloat(marketCapStr) : undefined;
        
        if (!id || isNaN(priceVal) || isNaN(changeVal)) return null;

        return {
            id,
            symbol: values[symbolIndex],
            name: values[nameIndex],
            price: priceVal,
            change24h: changeVal,
            marketCap: marketCapVal && !isNaN(marketCapVal) ? marketCapVal : undefined,
        };
    }).filter((p): p is CryptoPrice => p !== null);

    if (prices.length === 0) {
      throw new Error("CSV parsing resulted in zero valid price entries.");
    }
    
    console.log("Successfully fetched and parsed data from secondary source (Google Sheet).");
    return prices;
};


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
 * It first tries the reliable CoinGecko API. If that fails, it falls back
 * to the less reliable Google Sheet method. If both fail, it returns
 * the last known cached data.
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
    console.warn("Primary fetch (CoinGecko) failed:", primaryError);
    console.log("Attempting fallback to Google Sheet...");
    
    try {
        const sheetPrices = await fetchFromGoogleSheet();
        console.log("Successfully fetched data from fallback source (Google Sheet).");

        // Update cache with fresh data from fallback
        Object.keys(cryptoDataStore).forEach(key => delete cryptoDataStore[key]);
        sheetPrices.forEach(price => { cryptoDataStore[price.id] = price; });
        return sheetPrices;

    } catch (fallbackError) {
        console.error("Fallback fetch (Google Sheet) also failed:", fallbackError);
        console.log("Returning cached data as a last resort.");
        return Object.values(cryptoDataStore);
    }
  }
};


// In-memory cache to simulate permanent storage of fetched historical data.
const historicalDataCache: { [key: string]: HistoricalData } = {};

const generateRandomWalk = (startPrice: number, points: number, volatility: number): number[] => {
    const data: number[] = [];
    let currentPrice = startPrice * (1 - (volatility * points / 2) + Math.random() * volatility);
    for (let i = 0; i < points; i++) {
        const change = (Math.random() - 0.48) * 2 * volatility * currentPrice; // Slight bullish bias
        currentPrice += change;
        if (currentPrice < 0) currentPrice = 0; // Price can't be negative
        data.push(currentPrice);
    }
    return data;
};

// This function simulates fetching historical data for a specific crypto.
export const fetchHistoricalData = async (coinId: string, timeframe: string): Promise<HistoricalData> => {
    const cacheKey = `${coinId}-${timeframe}`;
    if (historicalDataCache[cacheKey]) {
        console.log(`Returning cached data for ${cacheKey}`);
        return historicalDataCache[cacheKey];
    }
    
    console.log(`Simulating API fetch for historical data: ${cacheKey}`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    const basePrice = cryptoDataStore[coinId]?.price || 100;
    let points = 0;
    let labels: string[] = [];

    const now = new Date();

    switch (timeframe) {
        case '24h':
            points = 24;
            labels = Array.from({ length: points }, (_, i) => `${points - 1 - i}h ago`).reverse();
            break;
        case '7d':
            points = 7;
            labels = Array.from({ length: points }, (_, i) => `${points - 1 - i}d ago`).reverse();
            break;
        case '30d':
            points = 30;
             labels = Array.from({ length: points }, (_, i) => {
                const d = new Date(now);
                d.setDate(now.getDate() - (points - 1 - i));
                return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            });
            break;
        case '1y':
            points = 12;
            labels = Array.from({ length: points }, (_, i) => {
                const d = new Date(now);
                d.setMonth(now.getMonth() - (points - 1 - i));
                return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
            });
            break;
        default:
            points = 30;
            labels = Array.from({ length: points }, (_, i) => `Day ${i + 1}`);
    }

    const prices = generateRandomWalk(basePrice, points, 0.05); // 5% volatility
    const data = { labels, prices };
    
    // "Permanently" store the fetched data in the cache
    historicalDataCache[cacheKey] = data;

    return data;
};
