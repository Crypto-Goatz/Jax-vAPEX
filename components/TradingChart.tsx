import React, { useState, useEffect, useRef, useMemo } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { fetchRawOhlcvData } from '../services/cryptoService';
import type { CryptoPrice } from '../services/cryptoService';
import type { Trade } from '../services/tradeSimulatorService';
import { LoadingSpinner } from './LoadingSpinner';

interface TradingChartProps {
    coin: CryptoPrice;
    trade: Trade | null;
    allCoins: CryptoPrice[];
    onCoinChange: (coin: CryptoPrice) => void;
}

const formatPlotLine = (value: number, label: string, color: string) => ({
    value,
    color,
    width: 2,
    zIndex: 4,
    label: {
        text: `${label}: ${value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
        align: 'right',
        x: -10,
        style: {
            color: '#fff',
            background: color,
            padding: '2px 5px',
            borderRadius: '3px',
            fontSize: '10px'
        },
    },
});

export const TradingChart: React.FC<TradingChartProps> = ({ coin, trade, allCoins, onCoinChange }) => {
    const [ohlc, setOhlc] = useState<number[][]>([]);
    const [volume, setVolume] = useState<number[][]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        // Fetch last 90 days of data, Highcharts will handle grouping for different timeframes
        fetchRawOhlcvData(coin.symbol, 90)
            .then(data => {
                if (data.length === 0) {
                    setError(`No historical data available for ${coin.symbol}.`);
                    setOhlc([]);
                    setVolume([]);
                    return;
                }
                const newOhlc: number[][] = [];
                const newVolume: number[][] = [];
                data.forEach(d => {
                    const timeMs = d.time * 1000;
                    newOhlc.push([timeMs, d.open, d.high, d.low, d.close]);
                    newVolume.push([timeMs, d.volume]);
                });
                setOhlc(newOhlc);
                setVolume(newVolume);
            })
            .catch(err => {
                console.error("Chart data fetch error:", err);
                setError("Failed to load chart data.");
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [coin.symbol]);
    
    const plotLines = useMemo(() => {
        const lines = [];
        if (trade) {
            if (trade.entryPrice) {
                lines.push(formatPlotLine(trade.entryPrice, 'Entry', '#3b82f6')); // blue-500
            }
            if (trade.takeProfitPrice) {
                lines.push(formatPlotLine(trade.takeProfitPrice, 'Take Profit', '#22c55e')); // green-500
            }
            if (trade.stopLossPrice) {
                lines.push(formatPlotLine(trade.stopLossPrice, 'Stop Loss', '#ef4444')); // red-500
            }
        }
        return lines;
    }, [trade]);

    const chartOptions = useMemo<Highcharts.Options>(() => ({
        chart: {
            backgroundColor: '#ffffff',
            height: '100%',
        },
        rangeSelector: {
            buttons: [{
                type: 'hour', count: 1, text: '1h',
            }, {
                type: 'day', count: 1, text: '1D',
            }, {
                type: 'week', count: 1, text: '1W',
            }, {
                type: 'month', count: 1, text: '1M',
            }, {
                type: 'ytd', text: 'YTD',
            }, {
                type: 'year', count: 1, text: '1y',
            }, {
                type: 'all', text: 'All'
            }],
            selected: 3, // Default to 1M
            inputEnabled: false,
            buttonTheme: {
                fill: '#f3f4f6',
                stroke: '#e5e7eb',
                'stroke-width': 1,
                r: 8,
                style: { color: '#4b5563', fontWeight: '600' },
                states: { hover: { fill: '#e5e7eb' }, select: { fill: '#a855f7', style: { color: 'white' } } }
            },
        },
        navigator: {
            adaptToUpdatedData: false,
            series: { data: ohlc }
        },
        scrollbar: { enabled: false },
        title: { text: ``, style: { display: 'none' } },
        yAxis: [{
            labels: { align: 'right', x: -3, style: { color: '#4b5563' } },
            title: { text: 'Price (USD)', style: { color: '#4b5563' } },
            height: '65%',
            lineWidth: 2,
            resize: { enabled: true },
            plotLines: plotLines,
        }, {
            labels: { align: 'right', x: -3, style: { color: '#4b5563' } },
            title: { text: 'Volume', style: { color: '#4b5563' } },
            top: '70%',
            height: '30%',
            offset: 0,
            lineWidth: 2,
        }],
        series: [{
            type: 'candlestick',
            name: `${coin.symbol} Price`,
            data: ohlc,
            yAxis: 0,
            color: '#ef4444', // red-500 for down candles
            upColor: '#22c55e', // green-500 for up candles
            lineColor: '#ef4444',
            upLineColor: '#22c55e'
        }, {
            type: 'column',
            name: 'Volume',
            data: volume,
            yAxis: 1,
            color: '#d1d5db' // gray-300
        }],
        credits: { enabled: false },
    }), [ohlc, volume, coin, plotLines]);
    
    return (
        <div className="h-full w-full flex flex-col">
            <div className="flex-shrink-0 mb-2">
                <select
                    value={coin.id}
                    onChange={(e) => {
                        const newCoin = allCoins.find(c => c.id === e.target.value);
                        if (newCoin) onCoinChange(newCoin);
                    }}
                    className="w-full sm:w-auto bg-gray-100 border border-gray-300 rounded-md p-1.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                    {allCoins.map(c => <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>)}
                </select>
            </div>
            <div className="flex-grow h-full w-full relative">
                {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10"><LoadingSpinner /></div>}
                {error && <div className="absolute inset-0 flex items-center justify-center text-red-500 text-sm p-4 text-center">{error}</div>}
                {!isLoading && !error && (
                    <HighchartsReact
                        highcharts={Highcharts}
                        constructorType={'stockChart'}
                        options={chartOptions}
                    />
                )}
            </div>
        </div>
    );
};