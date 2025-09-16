import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { BrainIcon, HistoryIcon, TargetIcon, BellIcon, TrashIcon, AlertTriangleIcon, CloseIcon, TrendingUpIcon, TrendingDownIcon, LineChartIcon } from './Icons';
import { fetchLivePricing, CryptoPrice, fetchHistoricalData, HistoricalData } from '../services/cryptoService';
import { tradeSimulatorService, Trade } from '../services/tradeSimulatorService';

// --- TYPE DEFINITIONS & HELPERS ---
interface PriceAlert {
  id: string;
  coin: CryptoPrice;
  targetPrice: number;
  condition: 'above' | 'below';
  status: 'active' | 'triggered';
}
type Timeframe = '24h' | '7d' | '30d' | '1y';

const ALERTS_STORAGE_KEY = 'jaxspot_price_alerts';

const formatCurrency = (value: number | null | undefined, compact = false) => {
    if (value === null || value === undefined) return '$0.00';
    
    // For compact notation, Intl.NumberFormat handles digits automatically.
    // For standard, we want more precision for smaller values.
    const maxDigits = compact ? 1 : (Math.abs(value) > 0 && Math.abs(value) < 1.0) ? 6 : 2;
    const minDigits = compact ? 0 : 2;
    
    // Guard against invalid range
    if (compact && minDigits > maxDigits) {
       return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1
       });
    }

    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: compact ? 'compact' : 'standard',
        minimumFractionDigits: minDigits,
        maximumFractionDigits: maxDigits,
    });
};

// --- SKELETON COMPONENTS ---
const ActiveMonitorSkeleton: React.FC = () => (
    <div className="space-y-4 animate-pulse">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                    <div>
                        <div className="h-5 w-24 bg-gray-700 rounded"></div>
                        <div className="h-4 w-12 bg-gray-700 rounded mt-1"></div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="h-7 w-32 bg-gray-700 rounded"></div>
                    <div className="h-4 w-16 bg-gray-700 rounded mt-1"></div>
                </div>
            </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="h-5 w-48 bg-gray-700 rounded mb-3"></div>
            <div className="grid grid-cols-2 gap-3">
                <div className="h-5 bg-gray-700 rounded"></div>
                <div className="h-5 bg-gray-700 rounded"></div>
                <div className="h-5 bg-gray-700 rounded"></div>
                <div className="h-5 bg-gray-700 rounded"></div>
            </div>
        </div>
    </div>
);

const PriceAlertsSkeleton: React.FC = () => (
    <div className="animate-pulse">
        <div className="h-8 w-40 bg-gray-700 rounded mb-2"></div>
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 mb-4 space-y-3">
            <div className="h-10 bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-700 rounded"></div>
        </div>
        <div className="space-y-2">
            <div className="h-12 bg-gray-800 rounded"></div>
            <div className="h-12 bg-gray-800 rounded"></div>
            <div className="h-12 bg-gray-800 rounded"></div>
        </div>
    </div>
);

const LiveTradeBlotterSkeleton: React.FC = () => (
    <div className="animate-pulse">
        <table className="w-full text-sm text-left">
            <thead className="bg-gray-700/50 text-xs text-transparent uppercase sticky top-0">
                <tr>
                    <th className="p-2"><div className="h-4 bg-gray-600 rounded">Asset</div></th>
                    <th className="p-2"><div className="h-4 bg-gray-600 rounded">Side</div></th>
                    <th className="p-2"><div className="h-4 bg-gray-600 rounded">Price</div></th>
                    <th className="p-2"><div className="h-4 bg-gray-600 rounded">Size</div></th>
                </tr>
            </thead>
            <tbody>
                {[...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-700/50">
                        <td className="p-2"><div className="h-5 bg-gray-700 rounded"></div></td>
                        <td className="p-2"><div className="h-5 bg-gray-700 rounded"></div></td>
                        <td className="p-2"><div className="h-5 bg-gray-700 rounded"></div></td>
                        <td className="p-2"><div className="h-5 bg-gray-700 rounded"></div></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

// --- SUB-COMPONENTS ---

const ActiveMonitor: React.FC<{ coin: CryptoPrice | null }> = React.memo(({ coin }) => {
    const [logoError, setLogoError] = useState(false);
    const prevPriceRef = useRef<number | null>(null);
    const [priceColor, setPriceColor] = useState('text-gray-200');

    useEffect(() => {
        if (coin) {
            if (prevPriceRef.current !== null) {
                if (coin.price > prevPriceRef.current) setPriceColor('text-green-400');
                else if (coin.price < prevPriceRef.current) setPriceColor('text-red-400');
            }
            prevPriceRef.current = coin.price;
            const timer = setTimeout(() => setPriceColor('text-gray-200'), 500);
            return () => clearTimeout(timer);
        }
    }, [coin?.price]);

    useEffect(() => {
        if(coin) setLogoError(false); // Reset on new coin
    }, [coin?.id]);

    if (!coin) {
        return <div className="h-full flex items-center justify-center text-gray-500">Awaiting asset for analysis...</div>;
    }
    
    const logoUrl = `https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`;
    const isUp = coin.change24h >= 0;

    return (
        <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        {logoError ? (
                            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center font-bold text-purple-400 text-lg">{coin.symbol.charAt(0)}</div>
                        ) : (
                            <img src={logoUrl} alt={`${coin.name} logo`} className="w-10 h-10 rounded-full" onError={() => setLogoError(true)} />
                        )}
                        <div>
                            <h3 className="text-xl font-bold text-white">{coin.name}</h3>
                            <p className="text-sm text-gray-400">{coin.symbol}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={`text-2xl font-mono font-bold transition-colors duration-300 ${priceColor}`}>{formatCurrency(coin.price)}</p>
                        <p className={`text-sm font-semibold ${isUp ? 'text-green-400' : 'text-red-400'}`}>{isUp ? '+' : ''}{coin.change24h.toFixed(2)}% (24h)</p>
                        {coin.marketCap && (
                            <p className="text-xs text-gray-400 mt-1">
                                MCap: <span className="font-semibold text-gray-300">{formatCurrency(coin.marketCap, true)}</span>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <h4 className="text-md font-bold text-purple-400 mb-3">Simulated Signal Metrics</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between border-b border-gray-700/50 pb-1">
                        <span className="text-gray-400">RSI (14)</span>
                        <span className="font-mono text-white">{(40 + Math.random() * 30).toFixed(2)}</span>
                    </div>
                     <div className="flex justify-between border-b border-gray-700/50 pb-1">
                        <span className="text-gray-400">Sentiment Score</span>
                        <span className="font-mono text-green-400">{(0.6 + Math.random() * 0.3).toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-700/50 pb-1">
                        <span className="text-gray-400">Funding Rate</span>
                        <span className="font-mono text-white">{(Math.random() * 0.04 - 0.01).toFixed(4)}%</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-700/50 pb-1">
                        <span className="text-gray-400">On-Chain Flow (1h)</span>
                        <span className="font-mono text-red-400">{formatCurrency(Math.random() * 500000 - 250000, true)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

const LiveTradeRow: React.FC<{ trade: Trade }> = React.memo(({ trade }) => {
    const isBuy = trade.direction === 'buy';
    return (
        <tr className="border-b border-gray-700/50 animate-fade-in-down">
            <td className="p-2">
                <span className="font-bold text-white">{trade.coin.symbol}</span>
            </td>
            <td className="p-2">
                <span className={`font-semibold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>{trade.direction.toUpperCase()}</span>
            </td>
            <td className="p-2 font-mono text-gray-300">{formatCurrency(trade.entryPrice)}</td>
            <td className="p-2 font-mono text-gray-300">{formatCurrency(trade.sizeUSD, true)}</td>
        </tr>
    );
});

const PriceAlerts: React.FC<{
    alerts: PriceAlert[];
    coins: CryptoPrice[];
    onAddAlert: (alertData: Omit<PriceAlert, 'id' | 'status'>) => void;
    onRemoveAlert: (alertId: string) => void;
}> = ({ alerts, coins, onAddAlert, onRemoveAlert }) => {
    const [selectedCoinId, setSelectedCoinId] = useState<string>(coins[0]?.id || '');
    const [targetPrice, setTargetPrice] = useState('');
    const [condition, setCondition] = useState<'above' | 'below'>('above');
    const selectedCoinPrice = coins.find(c => c.id === selectedCoinId)?.price || 0;

    useEffect(() => {
        if (!selectedCoinId && coins.length > 0) {
            setSelectedCoinId(coins[0].id);
        }
    }, [coins, selectedCoinId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const coin = coins.find(c => c.id === selectedCoinId);
        const price = parseFloat(targetPrice);
        if (coin && !isNaN(price) && price > 0) {
            onAddAlert({ coin, targetPrice: price, condition });
            setTargetPrice('');
        }
    };

    const activeAlerts = alerts.filter(a => a.status === 'active');

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-lg font-bold text-purple-400 mb-2">Price Alerts</h3>
            <form onSubmit={handleSubmit} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 mb-4 space-y-3">
                <div>
                    <label htmlFor="coin-select" className="sr-only">Coin</label>
                    <select id="coin-select" value={selectedCoinId} onChange={e => setSelectedCoinId(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500">
                        {coins.map(c => <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="target-price" className="sr-only">Target Price</label>
                    <input type="number" id="target-price" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} placeholder={`Current: ${formatCurrency(selectedCoinPrice)}`} step="any" min="0" required className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-gray-400" />
                </div>
                <div className="flex items-center justify-around">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="radio" name="condition" value="above" checked={condition === 'above'} onChange={() => setCondition('above')} className="form-radio bg-gray-700 text-purple-500 border-gray-600 focus:ring-purple-500" />
                        <span className="text-sm text-gray-300">Price Above</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="radio" name="condition" value="below" checked={condition === 'below'} onChange={() => setCondition('below')} className="form-radio bg-gray-700 text-purple-500 border-gray-600 focus:ring-purple-500" />
                        <span className="text-sm text-gray-300">Price Below</span>
                    </label>
                </div>
                <button type="submit" className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors">
                    <BellIcon className="w-4 h-4 mr-2" /> Set Alert
                </button>
            </form>
            <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2">
                {activeAlerts.length > 0 ? (
                    activeAlerts.map(alert => (
                        <div key={alert.id} className="bg-gray-800 p-2 rounded-md flex justify-between items-center animate-fade-in-down">
                            <div>
                                <p className="font-bold text-sm text-white">{alert.coin.symbol}</p>
                                <p className="text-xs text-gray-400 font-mono flex items-center">
                                    {alert.condition === 'above' ? <TrendingUpIcon className="w-3 h-3 mr-1 text-green-400" /> : <TrendingDownIcon className="w-3 h-3 mr-1 text-red-400" />}
                                    {formatCurrency(alert.targetPrice)}
                                </p>
                            </div>
                            <button onClick={() => onRemoveAlert(alert.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded-full" aria-label="Remove alert">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="flex items-center justify-center h-full text-center text-gray-500">
                        <p>No active alerts.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const AlertBanner: React.FC<{
    alert: PriceAlert;
    onDismiss: () => void;
}> = ({ alert, onDismiss }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(true); // Fade in
        const timer = setTimeout(() => {
            handleDismiss();
        }, 8000); // Auto-dismiss after 8 seconds
        return () => clearTimeout(timer);
    }, [alert.id, onDismiss]); // Dependency on onDismiss ensures timer resets correctly if function identity changes

    const handleDismiss = useCallback(() => {
        setVisible(false);
        setTimeout(onDismiss, 300); // Allow fade-out animation to complete
    }, [onDismiss]);

    const isAbove = alert.condition === 'above';

    return (
        <div className={`transition-all duration-300 ease-in-out ${visible ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0'} overflow-hidden`}>
            <div className="bg-purple-600/20 border border-purple-500/50 text-white p-3 rounded-lg flex items-center justify-between shadow-lg">
                <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 text-purple-400">
                        <AlertTriangleIcon />
                    </div>
                    <p className="text-sm">
                        <span className="font-bold">{alert.coin.symbol} Price Alert:</span> Now {isAbove ? 'above' : 'below'} your target of {formatCurrency(alert.targetPrice)}.
                    </p>
                </div>
                <button onClick={handleDismiss} className="text-purple-300 hover:text-white p-1 rounded-full hover:bg-white/10" aria-label="Dismiss notification">
                    <CloseIcon className="w-5 h-5"/>
                </button>
            </div>
        </div>
    );
};


const HistoricalChart: React.FC<{
    allCoins: CryptoPrice[];
    selectedCoin: CryptoPrice | null;
    onCoinChange: (coin: CryptoPrice) => void;
}> = ({ allCoins, selectedCoin, onCoinChange }) => {
    const [timeframe, setTimeframe] = useState<Timeframe>('30d');
    const [chartData, setChartData] = useState<HistoricalData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const chartCanvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);

    // Fetch data when coin or timeframe changes
    useEffect(() => {
        if (!selectedCoin) return;

        const getData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await fetchHistoricalData(selectedCoin.symbol, timeframe);
                setChartData(data);
            } catch (err) {
                console.error("Failed to fetch historical chart data:", err);
                setError(err instanceof Error ? err.message : "Could not load chart data.");
                setChartData(null);
            } finally {
                setIsLoading(false);
            }
        };

        getData();
    }, [selectedCoin, timeframe]);

    // Render chart when data changes
    useEffect(() => {
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }
        if (chartCanvasRef.current && chartData) {
            const ctx = chartCanvasRef.current.getContext('2d');
            if (ctx) {
                chartInstanceRef.current = new window.Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: chartData.labels,
                        datasets: [{
                            label: `${selectedCoin?.symbol} Price`,
                            data: chartData.prices,
                            borderColor: 'rgba(168, 85, 247, 1)',
                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                            borderWidth: 2,
                            pointRadius: 0,
                            tension: 0.1,
                            fill: true,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
                            y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', callback: (value: any) => formatCurrency(value, true) } }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                backgroundColor: '#1f2937',
                                titleColor: '#f9fafb',
                                bodyColor: '#d1d5db',
                                displayColors: false,
                                callbacks: {
                                    label: (context: any) => `Price: ${formatCurrency(context.parsed.y)}`,
                                }
                            }
                        }
                    }
                });
            }
        }
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
        };
    }, [chartData]);
    
    const timeframes: Timeframe[] = ['24h', '7d', '30d', '1y'];

    return (
        <div className="flex flex-col h-full bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                 <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2"><LineChartIcon /> Historical Chart</h3>
                 <div className="flex-grow sm:flex-grow-0">
                     <select
                        value={selectedCoin?.id || ''}
                        onChange={(e) => {
                            const coin = allCoins.find(c => c.id === e.target.value);
                            if(coin) onCoinChange(coin);
                        }}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                        {allCoins.map(c => <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>)}
                    </select>
                 </div>
            </div>
            <div className="flex items-center justify-center space-x-2 mb-3">
                 {timeframes.map(tf => (
                    <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            timeframe === tf ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                    >
                        {tf.toUpperCase()}
                    </button>
                ))}
            </div>
            <div className="flex-1 relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center"><LoadingSpinner /></div>
                ) : error ? (
                    <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">{error}</div>
                ) : (
                    <canvas ref={chartCanvasRef}></canvas>
                )}
            </div>
        </div>
    );
};


// --- MAIN COMPONENT ---
export const SpotLive: React.FC = () => {
    const [activeCoin, setActiveCoin] = useState<CryptoPrice | null>(null);
    const [allCoins, setAllCoins] = useState<CryptoPrice[]>([]);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [alerts, setAlerts] = useState<PriceAlert[]>([]);
    const [notificationBannerAlert, setNotificationBannerAlert] = useState<PriceAlert | null>(null);
    const alertsRef = useRef(alerts);


    useEffect(() => {
        alertsRef.current = alerts;
    }, [alerts]);
    
    // Load alerts from localStorage on mount
    useEffect(() => {
        try {
            const storedAlerts = localStorage.getItem(ALERTS_STORAGE_KEY);
            if (storedAlerts) {
                setAlerts(JSON.parse(storedAlerts));
            }
        } catch (error) {
            console.error("Failed to load alerts from localStorage:", error);
        }
    }, []);

    // Save alerts to localStorage whenever they change
    useEffect(() => {
        try {
            // Don't save triggered alerts, they are ephemeral notifications
            const activeAlerts = alerts.filter(a => a.status === 'active');
            localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(activeAlerts));
        } catch (error) {
            console.error("Failed to save alerts to localStorage:", error);
        }
    }, [alerts]);

    // Initial data fetch
    useEffect(() => {
        const getInitialData = async () => {
            setIsLoading(true);
            try {
                const prices = await fetchLivePricing();
                if (prices.length > 0) {
                    setAllCoins(prices);
                    setActiveCoin(prices[0]);
                }
            } catch (error) { console.error("Failed to fetch initial data for SpotLive:", error); }
            finally { setIsLoading(false); }
        };
        getInitialData();
    }, []);

    // Price fetching and alert checking effect
    useEffect(() => {
        const checkAlerts = (livePrices: CryptoPrice[]) => {
            const priceMap = new Map(livePrices.map(p => [p.id, p.price]));
            let firstNewlyTriggered: PriceAlert | null = null;
            let didTrigger = false;
            
            const updatedAlerts = alertsRef.current.map((alert): PriceAlert => {
                if (alert.status === 'active') {
                    const currentPrice = priceMap.get(alert.coin.id);
                    if (currentPrice === undefined) return alert;

                    let triggered = false;
                    if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
                        triggered = true;
                    } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
                        triggered = true;
                    }
                    
                    if (triggered) {
                        didTrigger = true;
                        if (!firstNewlyTriggered) {
                            firstNewlyTriggered = alert;
                        }
                        return { ...alert, status: 'triggered' };
                    }
                }
                return alert;
            });
            
            if (didTrigger) {
                setAlerts(updatedAlerts);
                if (firstNewlyTriggered) {
                    setNotificationBannerAlert(firstNewlyTriggered);
                }
            }
        };
        
        const fetchAndCheck = async () => {
            if (isLoading) return;
            try {
                const livePrices = await fetchLivePricing();
                if (livePrices.length > 0) {
                    setAllCoins(livePrices);
                    // Update Active Monitor coin if it's still being tracked
                    if (activeCoin) {
                        const updatedActiveCoin = livePrices.find(c => c.id === activeCoin.id);
                        if (updatedActiveCoin) setActiveCoin(updatedActiveCoin);
                    }
                    checkAlerts(livePrices);
                }
            } catch (error) {
                console.warn("Periodic price fetch failed:", error);
            }
        };

        const priceInterval = setInterval(fetchAndCheck, 7000);
        return () => clearInterval(priceInterval);

    }, [isLoading, activeCoin]);


    // Subscribe to trades
    useEffect(() => {
        const updateTrades = () => {
            const latestTrades = tradeSimulatorService.getAllTrades().slice(0, 10);
            setTrades(latestTrades);
        };
        tradeSimulatorService.subscribe(updateTrades);
        updateTrades();
        return () => tradeSimulatorService.unsubscribe(updateTrades);
    }, []);

    // Simulation engine for active monitor switching
    useEffect(() => {
        if (isLoading || allCoins.length === 0) return;
        const interval = setInterval(() => {
            if (Math.random() > 0.8) {
                const newActiveCoin = allCoins[Math.floor(Math.random() * allCoins.length)];
                setActiveCoin(newActiveCoin);
            }
        }, 3500);
        return () => clearInterval(interval);
    }, [isLoading, allCoins]);


    const handleAddAlert = (alertData: Omit<PriceAlert, 'id' | 'status'>) => {
        const newAlert: PriceAlert = {
            ...alertData,
            id: `${alertData.coin.id}-${alertData.targetPrice}-${Date.now()}`,
            status: 'active',
        };
        setAlerts(prev => [newAlert, ...prev.filter(a => a.status === 'active')]);
    };
    
    const handleRemoveAlert = (alertId: string) => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
    };


    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">SpotLive AI Command Center</h2>
                <p className="text-sm text-gray-400">Real-time AI strategy analysis, execution, and price alerts.</p>
            </div>
            <div className="flex-1 p-4 flex flex-col overflow-hidden relative">
                {notificationBannerAlert && (
                    <div className="absolute top-4 left-4 right-4 z-10">
                        <AlertBanner
                            alert={notificationBannerAlert}
                            onDismiss={() => setNotificationBannerAlert(null)}
                        />
                    </div>
                )}
                 {/* Main Grid Layout */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    
                    {/* Top-Left Quadrant: Historical Chart */}
                    <div className="h-[50vh] lg:h-auto">
                        {isLoading || !activeCoin ? <div className="h-full bg-gray-900/50 rounded-lg p-4 border border-gray-700/50 flex items-center justify-center"><LoadingSpinner /></div> : (
                            <HistoricalChart
                                allCoins={allCoins}
                                selectedCoin={activeCoin}
                                onCoinChange={setActiveCoin}
                            />
                        )}
                    </div>
                    
                    {/* Top-Right Quadrant: Active Monitoring */}
                    <div className="h-[50vh] lg:h-auto flex flex-col">
                        <h3 className="text-lg font-bold text-purple-400 mb-2">Active Monitoring</h3>
                        <div className="flex-1">
                            {isLoading ? <ActiveMonitorSkeleton /> : <ActiveMonitor coin={activeCoin} />}
                        </div>
                    </div>
                    
                    {/* Bottom-Left Quadrant: Price Alerts */}
                    <div className="h-[50vh] lg:h-auto">
                         {isLoading ? <PriceAlertsSkeleton /> : (
                            <PriceAlerts
                                alerts={alerts}
                                coins={allCoins}
                                onAddAlert={handleAddAlert}
                                onRemoveAlert={handleRemoveAlert}
                            />
                        )}
                    </div>
                    
                    {/* Bottom-Right Quadrant: Trade Blotter */}
                    <div className="h-[50vh] lg:h-auto flex flex-col">
                         <h3 className="text-lg font-bold text-purple-400 mb-2">Live Trade Blotter</h3>
                        <div className="flex-1 overflow-y-auto bg-gray-900/50 rounded-lg border border-gray-700/50">
                           {isLoading ? <LiveTradeBlotterSkeleton /> : (
                               <table className="w-full text-sm text-left">
                                   <thead className="bg-gray-700/50 text-xs text-gray-400 uppercase sticky top-0">
                                       <tr>
                                           <th className="p-2">Asset</th>
                                           <th className="p-2">Side</th>
                                           <th className="p-2">Price</th>
                                           <th className="p-2">Size</th>
                                       </tr>
                                   </thead>
                                   <tbody>
                                       {trades.length > 0 ? (
                                           trades.map(trade => <LiveTradeRow key={trade.id} trade={trade} />)
                                       ) : (
                                           <tr><td colSpan={4} className="text-center p-4 text-gray-500">Awaiting trades...</td></tr>
                                       )}
                                   </tbody>
                               </table>
                           )}
                        </div>
                    </div>

                </div>
            </div>
             <style>{`
                @keyframes fade-in-down {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-down { animation: fade-in-down 0.5s ease-out forwards; }
                
                @keyframes slide-in-left {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-slide-in-left { animation: slide-in-left 0.4s ease-out forwards; }

                /* Custom scrollbar for columns */
                .overflow-y-auto::-webkit-scrollbar { width: 6px; }
                .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
                .overflow-y-auto::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
                .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #6b7280; }
            `}</style>
        </div>
    );
};