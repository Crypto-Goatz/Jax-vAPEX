import React, { useState, useEffect, useRef, useMemo } from 'react';
import { googleSheetService } from '../services/googleSheetService';
import { LoadingSpinner } from './LoadingSpinner';
import { fetchHistoricalData } from '../services/cryptoService'; // Import historical data fetcher

interface MasterDataRow {
    Symbol: string;
    Price: number;
    Volume: number;
}

// Sparkline Chart Component (embedded for simplicity)
const SparklineChart: React.FC<{ prices: number[] }> = ({ prices }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);

    const isUp = useMemo(() => {
        if (prices.length < 2) return true;
        return prices[prices.length - 1] >= prices[0];
    }, [prices]);

    useEffect(() => {
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }
        if (canvasRef.current && prices.length > 1) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                chartInstanceRef.current = new window.Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: Array.from({ length: prices.length }, (_, i) => i),
                        datasets: [{
                            data: prices,
                            borderColor: isUp ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)',
                            borderWidth: 1.5,
                            pointRadius: 0,
                            tension: 0.4,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { x: { display: false }, y: { display: false } },
                        plugins: { legend: { display: false }, tooltip: { enabled: false } },
                        animation: { duration: 0 },
                    }
                });
            }
        }
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
        };
    }, [prices, isUp]);

    if (prices.length < 2) return null;

    return <div className="w-24 h-8 mx-auto"><canvas ref={canvasRef}></canvas></div>;
};

// Logo Cell Component
const LogoCell: React.FC<{ symbol: string; name: string; }> = ({ symbol, name }) => {
    const [logoError, setLogoError] = useState(false);
    useEffect(() => { setLogoError(false); }, [symbol]);

    return (
        <div className="flex items-center space-x-3">
            {logoError ? (
                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center font-bold text-purple-600 text-xs border border-gray-200 flex-shrink-0">
                    {symbol.charAt(0)}
                </div>
            ) : (
                <img 
                    src={`https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`} 
                    alt={`${name} logo`}
                    className="w-6 h-6 rounded-full flex-shrink-0"
                    onError={() => setLogoError(true)}
                />
            )}
            <span className="font-semibold">{symbol}</span>
        </div>
    );
};

const normalizeData = (rawData: any[]): MasterDataRow[] => {
    return rawData.map(item => {
        // Find keys case-insensitively, as headers might vary slightly
        const findKey = (name: string) => Object.keys(item).find(k => k.toLowerCase() === name.toLowerCase()) || '';
        
        const symbolKey = findKey('symbol');
        const priceKey = findKey('price');
        const volumeKey = findKey('volume');

        return {
            Symbol: item[symbolKey] || 'N/A',
            Price: parseFloat(item[priceKey]) || 0,
            Volume: parseFloat(item[volumeKey]) || 0,
        };
    }).filter(item => item.Symbol !== 'N/A' && item.Price > 0);
};


export const MergedMasterTable: React.FC = () => {
    const [data, setData] = useState<MasterDataRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [priceChanges, setPriceChanges] = useState<Map<string, 'up' | 'down'>>(new Map());
    const prevPricesRef = useRef<Map<string, number>>(new Map());
    const [historicalData, setHistoricalData] = useState<Map<string, number[]>>(new Map());

    useEffect(() => {
        let priceChangeTimer: NodeJS.Timeout | undefined;

        const fetchData = async () => {
            try {
                const rawData = await googleSheetService.fetchData<any>('mergedMaster');
                const newData = normalizeData(rawData);
                const sortedData = newData.sort((a,b) => b.Volume - a.Volume);

                const changes = new Map<string, 'up' | 'down'>();
                const currentPrices = new Map<string, number>();

                sortedData.forEach(item => {
                    const prevPrice = prevPricesRef.current.get(item.Symbol);
                    if (prevPrice !== undefined && prevPrice !== 0) {
                        if (item.Price > prevPrice) {
                            changes.set(item.Symbol, 'up');
                        } else if (item.Price < prevPrice) {
                            changes.set(item.Symbol, 'down');
                        }
                    }
                    currentPrices.set(item.Symbol, item.Price);
                });

                setData(sortedData);
                prevPricesRef.current = currentPrices;
                setPriceChanges(changes);

                priceChangeTimer = setTimeout(() => {
                    setPriceChanges(new Map());
                }, 1500);

                // Fetch historical data for sparklines
                const historicalDataPromises = sortedData.map(coin => 
                    fetchHistoricalData(coin.Symbol, '24h')
                        .then(data => ({ symbol: coin.Symbol, prices: data.prices }))
                );

                const historicalResults = await Promise.allSettled(historicalDataPromises);
                const newHistoricalData = new Map<string, number[]>();
                historicalResults.forEach(result => {
                    if (result.status === 'fulfilled' && result.value.prices.length > 0) {
                        newHistoricalData.set(result.value.symbol, result.value.prices);
                    }
                });
                setHistoricalData(newHistoricalData);

            } catch (error) {
                console.error("Failed to fetch merged master data:", error);
            } finally {
                if(loading) setLoading(false);
            }
        };

        fetchData();

        return () => {
            if (priceChangeTimer) {
                clearTimeout(priceChangeTimer);
            }
        };
    }, []);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: Math.abs(value) < 1 ? 6 : 2,
        });
    }
    
    const formatVolume = (value: number) => {
         return new Intl.NumberFormat('en-US', {
            notation: 'compact',
            compactDisplay: 'short',
            maximumFractionDigits: 2,
        }).format(value);
    }

    if (loading) {
        return (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg flex items-center justify-center min-h-[200px]">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-bold text-purple-700">Merged Master Feed</h3>
            <div className="mt-4 overflow-y-auto max-h-[400px]">
                <table className="w-full text-sm">
                    <thead className="text-left text-gray-600 sticky top-0 bg-white z-10">
                        <tr className="border-b border-gray-200/60">
                            <th className="py-2 pr-4">Symbol</th>
                            <th className="py-2 pr-4 text-right">Price</th>
                            <th className="py-2 px-2 text-center">Trend (24h)</th>
                            <th className="py-2 pl-4 text-right">Volume (24h)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map(item => {
                            const change = priceChanges.get(item.Symbol);
                            const priceClass =
                                change === 'up' ? 'text-green-600' :
                                change === 'down' ? 'text-red-600' :
                                'text-gray-800';
                            const rowClass =
                                change === 'up' ? 'bg-green-100/50' :
                                change === 'down' ? 'bg-red-100/50' :
                                '';
                            const sparklinePrices = historicalData.get(item.Symbol);

                            return (
                                <tr key={item.Symbol} className={`border-b border-gray-100 transition-colors duration-1000 ${rowClass}`}>
                                    <td className="py-2 pr-4">
                                        <LogoCell symbol={item.Symbol} name={item.Symbol} />
                                    </td>
                                    <td className={`py-2 pr-4 text-right font-mono transition-colors duration-300 ${priceClass}`}>
                                        {formatCurrency(item.Price)}
                                    </td>
                                    <td className="py-1 px-2">
                                        {sparklinePrices ? (
                                            <SparklineChart prices={sparklinePrices} />
                                        ) : (
                                            <div className="w-24 h-8 mx-auto flex items-center justify-center">
                                                <span className="text-gray-300 text-xs">-</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-2 pl-4 text-right font-mono text-gray-600">
                                        {formatVolume(item.Volume)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};