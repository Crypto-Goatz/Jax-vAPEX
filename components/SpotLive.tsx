import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { BrainIcon, HistoryIcon, TargetIcon, BellIcon, TrashIcon, AlertTriangleIcon, CloseIcon, TrendingUpIcon, TrendingDownIcon, LineChartIcon, RefreshIcon } from './Icons';
import { fetchLivePricing, CryptoPrice } from '../services/cryptoService';
import { tradeSimulatorService, Trade } from '../services/tradeSimulatorService';
import { TradingChart } from './TradingChart';

// --- TYPE DEFINITIONS & HELPERS ---
interface PriceAlert {
  id: string;
  coin: CryptoPrice;
  targetPrice: number;
  condition: 'above' | 'below';
  status: 'active' | 'triggered';
}

const ALERTS_STORAGE_KEY = 'jaxspot_price_alerts';

const formatCurrency = (value: number | null | undefined, compact = false) => {
    if (value === null || value === undefined) return '$0.00';
    
    const maxDigits = compact ? 1 : (Math.abs(value) > 0 && Math.abs(value) < 1.0) ? 6 : 2;
    const minDigits = compact ? 0 : 2;
    
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
        <div className="bg-gray-100 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div>
                        <div className="h-5 w-24 bg-gray-200 rounded"></div>
                        <div className="h-4 w-12 bg-gray-200 rounded mt-1"></div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="h-7 w-32 bg-gray-200 rounded"></div>
                    <div className="h-4 w-16 bg-gray-200 rounded mt-1"></div>
                </div>
            </div>
        </div>
        <div className="bg-gray-100 p-4 rounded-lg border border-gray-200">
            <div className="h-5 w-48 bg-gray-200 rounded mb-3"></div>
            <div className="grid grid-cols-2 gap-3">
                <div className="h-5 bg-gray-200 rounded"></div>
                <div className="h-5 bg-gray-200 rounded"></div>
                <div className="h-5 bg-gray-200 rounded"></div>
                <div className="h-5 bg-gray-200 rounded"></div>
            </div>
        </div>
    </div>
);

const PriceAlertsSkeleton: React.FC = () => (
    <div className="animate-pulse">
        <div className="h-8 w-40 bg-gray-200 rounded mb-2"></div>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 mb-4 space-y-3">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
        </div>
        <div className="space-y-2">
            <div className="h-12 bg-gray-100 rounded"></div>
            <div className="h-12 bg-gray-100 rounded"></div>
            <div className="h-12 bg-gray-100 rounded"></div>
        </div>
    </div>
);

const LiveTradeBlotterSkeleton: React.FC = () => (
    <div className="animate-pulse">
        <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-xs text-transparent uppercase sticky top-0">
                <tr>
                    <th className="p-2"><div className="h-4 bg-gray-200 rounded">Asset</div></th>
                    <th className="p-2"><div className="h-4 bg-gray-200 rounded">Side</div></th>
                    <th className="p-2"><div className="h-4 bg-gray-200 rounded">Price</div></th>
                    <th className="p-2"><div className="h-4 bg-gray-200 rounded">Size</div></th>
                </tr>
            </thead>
            <tbody>
                {[...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-200">
                        <td className="p-2"><div className="h-5 bg-gray-200 rounded"></div></td>
                        <td className="p-2"><div className="h-5 bg-gray-200 rounded"></div></td>
                        <td className="p-2"><div className="h-5 bg-gray-200 rounded"></div></td>
                        <td className="p-2"><div className="h-5 bg-gray-200 rounded"></div></td>
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
    const [priceColor, setPriceColor] = useState('text-gray-800');

    useEffect(() => {
        if (coin) {
            if (prevPriceRef.current !== null) {
                if (coin.price > prevPriceRef.current) setPriceColor('text-green-600');
                else if (coin.price < prevPriceRef.current) setPriceColor('text-red-600');
            }
            prevPriceRef.current = coin.price;
            const timer = setTimeout(() => setPriceColor('text-gray-800'), 500);
            return () => clearTimeout(timer);
        }
    }, [coin?.price]);

    useEffect(() => {
        if(coin) setLogoError(false); // Reset on new coin
    }, [coin?.id]);

    if (!coin) {
        return <div className="h-full flex items-center justify-center text-gray-500">Awaiting asset for analysis...</div>;
    }

    const handleBuy = () => {
        tradeSimulatorService.executeTrade(coin, 'buy');
    };
    
    const handleSell = () => {
        tradeSimulatorService.executeTrade(coin, 'sell');
    };
    
    const logoUrl = `https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`;
    const isUp = coin.change24h >= 0;

    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        {logoError ? (
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-purple-600 text-lg">{coin.symbol.charAt(0)}</div>
                        ) : (
                            <img src={logoUrl} alt={`${coin.name} logo`} className="w-10 h-10 rounded-full" onError={() => setLogoError(true)} />
                        )}
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">{coin.name}</h3>
                            <p className="text-sm text-gray-500">{coin.symbol}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={`text-2xl font-mono font-bold transition-colors duration-300 ${priceColor}`}>{formatCurrency(coin.price)}</p>
                        <p className={`text-sm font-semibold ${isUp ? 'text-green-600' : 'text-red-600'}`}>{isUp ? '+' : ''}{coin.change24h.toFixed(2)}% (24h)</p>
                        {coin.marketCap && (
                            <p className="text-xs text-gray-500 mt-1">
                                MCap: <span className="font-semibold text-gray-700">{formatCurrency(coin.marketCap, true)}</span>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={handleBuy}
                    className="w-full py-3 bg-green-600 text-white text-lg font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                    BUY
                </button>
                <button
                    onClick={handleSell}
                    className="w-full py-3 bg-red-600 text-white text-lg font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                    SELL
                </button>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <h4 className="text-md font-bold text-purple-700 mb-3">Simulated Signal Metrics</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between border-b border-gray-200 pb-1">
                        <span className="text-gray-500">RSI (14)</span>
                        <span className="font-mono text-gray-800">{(40 + Math.random() * 30).toFixed(2)}</span>
                    </div>
                     <div className="flex justify-between border-b border-gray-200 pb-1">
                        <span className="text-gray-500">Sentiment Score</span>
                        <span className="font-mono text-green-600">{(0.6 + Math.random() * 0.3).toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-1">
                        <span className="text-gray-500">Funding Rate</span>
                        <span className="font-mono text-gray-800">{(Math.random() * 0.04 - 0.01).toFixed(4)}%</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-1">
                        <span className="text-gray-500">On-Chain Flow (1h)</span>
                        <span className="font-mono text-red-600">{formatCurrency(Math.random() * 500000 - 250000, true)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

const LiveTradeRow: React.FC<{ trade: Trade }> = React.memo(({ trade }) => {
    const [logoError, setLogoError] = useState(false);
    useEffect(() => { setLogoError(false); }, [trade.coin.symbol]);
    
    const isBuy = trade.direction === 'buy';
    return (
        <tr className="border-b border-gray-200 animate-fade-in-down hover:bg-gray-50">
            <td className="p-2">
                 <div className="flex items-center space-x-2">
                    {logoError ? (
                        <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center font-bold text-purple-600 text-xs border border-gray-200 flex-shrink-0">
                            {trade.coin.symbol.charAt(0)}
                        </div>
                    ) : (
                        <img 
                            src={`https://assets.coincap.io/assets/icons/${trade.coin.symbol.toLowerCase()}@2x.png`} 
                            alt={`${trade.coin.name} logo`}
                            className="w-6 h-6 rounded-full flex-shrink-0"
                            onError={() => setLogoError(true)}
                        />
                    )}
                    <span className="font-bold text-gray-800">{trade.coin.symbol}</span>
                </div>
            </td>
            <td className="p-2">
                <span className={`font-semibold ${isBuy ? 'text-green-700' : 'text-red-700'}`}>{trade.direction.toUpperCase()}</span>
            </td>
            <td className="p-2 font-mono text-gray-600">{formatCurrency(trade.entryPrice)}</td>
            <td className="p-2 font-mono text-gray-600">{formatCurrency(trade.sizeUSD, true)}</td>
        </tr>
    );
});

const AlertRow: React.FC<{ alert: PriceAlert; onRemoveAlert: (id: string) => void }> = ({ alert, onRemoveAlert }) => {
    const [logoError, setLogoError] = useState(false);
    useEffect(() => { setLogoError(false); }, [alert.coin.symbol]);

    return (
        <div className="bg-white p-2 rounded-md flex justify-between items-center animate-fade-in-down border border-gray-200">
            <div className="flex items-center space-x-2">
                {logoError ? (
                    <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center font-bold text-purple-600 text-xs flex-shrink-0">
                        {alert.coin.symbol.charAt(0)}
                    </div>
                ) : (
                    <img 
                        src={`https://assets.coincap.io/assets/icons/${alert.coin.symbol.toLowerCase()}@2x.png`} 
                        alt={`${alert.coin.name} logo`}
                        className="w-5 h-5 rounded-full flex-shrink-0"
                        onError={() => setLogoError(true)}
                    />
                )}
                <div>
                    <p className="font-bold text-sm text-gray-800">{alert.coin.symbol}</p>
                    <p className="text-xs text-gray-500 font-mono flex items-center">
                        {alert.condition === 'above' ? <TrendingUpIcon className="w-3 h-3 mr-1 text-green-600" /> : <TrendingDownIcon className="w-3 h-3 mr-1 text-red-600" />}
                        {formatCurrency(alert.targetPrice)}
                    </p>
                </div>
            </div>
            <button onClick={() => onRemoveAlert(alert.id)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-100 rounded-full" aria-label="Remove alert">
                <TrashIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

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
            <h3 className="text-lg font-bold text-purple-700 mb-2">Price Alerts</h3>
            <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-3 border border-gray-200 mb-4 space-y-3">
                <div>
                    <label htmlFor="coin-select" className="sr-only">Coin</label>
                    <select id="coin-select" value={selectedCoinId} onChange={e => setSelectedCoinId(e.target.value)} className="w-full bg-white border border-gray-300 rounded-md p-2 text-gray-800 focus:outline-none focus:ring-1 focus:ring-purple-500">
                        {coins.map(c => <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="target-price" className="sr-only">Target Price</label>
                    <input type="number" id="target-price" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} placeholder={`Current: ${formatCurrency(selectedCoinPrice)}`} step="any" min="0" required className="w-full bg-white border border-gray-300 rounded-md p-2 text-gray-800 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-gray-400" />
                </div>
                <div className="flex items-center justify-around">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="radio" name="condition" value="above" checked={condition === 'above'} onChange={() => setCondition('above')} className="form-radio bg-gray-200 text-purple-600 border-gray-300 focus:ring-purple-500" />
                        <span className="text-sm text-gray-700">Price Above</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="radio" name="condition" value="below" checked={condition === 'below'} onChange={() => setCondition('below')} className="form-radio bg-gray-200 text-purple-600 border-gray-300 focus:ring-purple-500" />
                        <span className="text-sm text-gray-700">Price Below</span>
                    </label>
                </div>
                <button type="submit" className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors">
                    <BellIcon className="w-4 h-4 mr-2" /> Set Alert
                </button>
            </form>
            <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2">
                {activeAlerts.length > 0 ? (
                    activeAlerts.map(alert => (
                        <AlertRow key={alert.id} alert={alert} onRemoveAlert={onRemoveAlert} />
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
    }, [alert.id, onDismiss]); 

    const handleDismiss = useCallback(() => {
        setVisible(false);
        setTimeout(onDismiss, 300); // Allow fade-out animation to complete
    }, [onDismiss]);

    const isAbove = alert.condition === 'above';

    return (
        <div className={`transition-all duration-300 ease-in-out ${visible ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0'} overflow-hidden`}>
            <div className="bg-purple-100 border border-purple-200 text-purple-800 p-3 rounded-lg flex items-center justify-between shadow-lg">
                <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 text-purple-600">
                        <AlertTriangleIcon />
                    </div>
                    <p className="text-sm">
                        <span className="font-bold">{alert.coin.symbol} Price Alert:</span> Now {isAbove ? 'above' : 'below'} your target of {formatCurrency(alert.targetPrice)}.
                    </p>
                </div>
                <button onClick={handleDismiss} className="text-purple-700 hover:text-purple-900 p-1 rounded-full hover:bg-black/10" aria-label="Dismiss notification">
                    <CloseIcon className="w-5 h-5"/>
                </button>
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

    useEffect(() => { alertsRef.current = alerts; }, [alerts]);
    
    useEffect(() => {
        try {
            const storedAlerts = localStorage.getItem(ALERTS_STORAGE_KEY);
            if (storedAlerts) setAlerts(JSON.parse(storedAlerts));
        } catch (error) { console.error("Failed to load alerts from localStorage:", error); }
    }, []);

    useEffect(() => {
        try {
            const activeAlerts = alerts.filter(a => a.status === 'active');
            localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(activeAlerts));
        } catch (error) { console.error("Failed to save alerts to localStorage:", error); }
    }, [alerts]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const livePrices = await fetchLivePricing();
            if (livePrices.length > 0) {
                setAllCoins(livePrices);
                const currentActiveCoin = activeCoin;
                if (currentActiveCoin) {
                    const updatedActiveCoin = livePrices.find(c => c.id === currentActiveCoin.id);
                    if (updatedActiveCoin) {
                        setActiveCoin(updatedActiveCoin);
                    } else {
                        setActiveCoin(livePrices[0]);
                    }
                } else {
                    setActiveCoin(livePrices[0]);
                }

                // Check alerts
                const priceMap = new Map(livePrices.map(p => [p.id, p.price]));
                let firstNewlyTriggered: PriceAlert | null = null;
                let didTrigger = false;
                
                const updatedAlerts = alertsRef.current.map((alert): PriceAlert => {
                    if (alert.status === 'active') {
                        const currentPrice = priceMap.get(alert.coin.id);
                        if (currentPrice === undefined) return alert;

                        let triggered = false;
                        if (alert.condition === 'above' && currentPrice >= alert.targetPrice) triggered = true;
                        else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) triggered = true;
                        
                        if (triggered) {
                            didTrigger = true;
                            if (!firstNewlyTriggered) firstNewlyTriggered = alert;
                            return { ...alert, status: 'triggered' };
                        }
                    }
                    return alert;
                });
                
                if (didTrigger) {
                    setAlerts(updatedAlerts);
                    if (firstNewlyTriggered) setNotificationBannerAlert(firstNewlyTriggered);
                }
            }
        } catch (error) { 
            console.error("Failed to fetch data for SpotLive:", error);
        } finally {
            setIsLoading(false);
        }
    }, [activeCoin, alertsRef]);

    useEffect(() => {
        fetchData();
    }, []); // Changed dependency to only run once on mount

    useEffect(() => {
        const updateTrades = () => {
            const latestTrades = tradeSimulatorService.getAllTrades();
            setTrades(latestTrades);
        };
        tradeSimulatorService.subscribe(updateTrades);
        updateTrades();
        return () => tradeSimulatorService.unsubscribe(updateTrades);
    }, []);

    const activeTrade = useMemo(() => {
        if (!activeCoin) return null;
        return trades
            .filter(t => t.status === 'open' && t.coin.id === activeCoin.id)
            .sort((a, b) => b.openTimestamp - a.openTimestamp)[0] || null;
    }, [trades, activeCoin]);

    const handleRefresh = () => {
        fetchData();
    };

    const handleAddAlert = (alertData: Omit<PriceAlert, 'id' | 'status'>) => {
        const newAlert: PriceAlert = { ...alertData, id: `${alertData.coin.id}-${alertData.targetPrice}-${Date.now()}`, status: 'active' };
        setAlerts(prev => [newAlert, ...prev.filter(a => a.status === 'active')]);
    };
    
    const handleRemoveAlert = (alertId: string) => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
    };

    return (
        <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">SpotLive AI Command Center</h2>
                    <p className="text-sm text-gray-500">AI strategy analysis, execution, and price alerts.</p>
                </div>
                 <button
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Refresh data"
                >
                    {isLoading ? <LoadingSpinner /> : <RefreshIcon className="w-5 h-5" />}
                    <span>Refresh</span>
                </button>
            </div>
            <div className="flex-1 p-4 flex flex-col overflow-hidden relative bg-gray-50">
                {notificationBannerAlert && (
                    <div className="absolute top-4 left-4 right-4 z-10">
                        <AlertBanner alert={notificationBannerAlert} onDismiss={() => setNotificationBannerAlert(null)} />
                    </div>
                )}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="h-[50vh] lg:h-auto">
                        {isLoading || !activeCoin ? (
                            <div className="h-full bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-center"><LoadingSpinner /></div>
                        ) : (
                            <div className="flex flex-col h-full bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                                <TradingChart coin={activeCoin} allCoins={allCoins} onCoinChange={setActiveCoin} trade={activeTrade} />
                            </div>
                        )}
                    </div>
                    
                    <div className="h-[50vh] lg:h-auto flex flex-col">
                        <h3 className="text-lg font-bold text-purple-700 mb-2">Active Monitoring</h3>
                        <div className="flex-1">
                            {isLoading ? <ActiveMonitorSkeleton /> : <ActiveMonitor coin={activeCoin} />}
                        </div>
                    </div>
                    
                    <div className="h-[50vh] lg:h-auto">
                         {isLoading ? <PriceAlertsSkeleton /> : (
                            <PriceAlerts alerts={alerts} coins={allCoins} onAddAlert={handleAddAlert} onRemoveAlert={handleRemoveAlert} />
                        )}
                    </div>
                    
                    <div className="h-[50vh] lg:h-auto flex flex-col">
                         <h3 className="text-lg font-bold text-purple-700 mb-2">Live Trade Blotter</h3>
                        <div className="flex-1 overflow-y-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                           {isLoading ? <LiveTradeBlotterSkeleton /> : (
                               <table className="w-full text-sm text-left">
                                   <thead className="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0">
                                       <tr>
                                           <th className="p-2">Asset</th>
                                           <th className="p-2">Side</th>
                                           <th className="p-2">Price</th>
                                           <th className="p-2">Size</th>
                                       </tr>
                                   </thead>
                                   <tbody>
                                       {trades.filter(t => t.status === 'open').length > 0 ? (
                                           trades.filter(t => t.status === 'open').slice(0, 10).map(trade => <LiveTradeRow key={trade.id} trade={trade} />)
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
                @keyframes fade-in-down { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-down { animation: fade-in-down 0.5s ease-out forwards; }
                
                .overflow-y-auto::-webkit-scrollbar { width: 6px; }
                .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
                .overflow-y-auto::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
                .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
            `}</style>
        </div>
    );
};