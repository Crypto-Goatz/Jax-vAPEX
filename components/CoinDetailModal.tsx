
import React, { useState, useEffect, useRef } from 'react';
import { fetchHistoricalData, HistoricalData } from '../services/cryptoService';
import { LoadingSpinner } from './LoadingSpinner';
import { CloseIcon, ChatBubbleIcon, WalletIcon } from './Icons';
import type { CryptoPrice } from '../services/cryptoService';

declare global {
  interface Window { Chart: any; }
}

type Timeframe = '24h' | '7d' | '30d' | '1y';

interface CoinDetailModalProps {
  coin: CryptoPrice;
  onClose: () => void;
}

const formatCurrency = (value: number | null | undefined, compact = false) => {
    if (value === null || value === undefined) return '$0.00';
    const maxDigits = compact ? 1 : (Math.abs(value) > 0 && Math.abs(value) < 1.0) ? 6 : 2;
    const minDigits = compact ? 0 : 2;
    if (compact && minDigits > maxDigits) {
       return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
    }
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', notation: compact ? 'compact' : 'standard', minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits });
};

export const CoinDetailModal: React.FC<CoinDetailModalProps> = ({ coin, onClose }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [chartData, setChartData] = useState<HistoricalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    const getData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchHistoricalData(coin.symbol, timeframe);
        setChartData(data);
      } catch (error) {
        console.error("Failed to fetch historical data:", error);
        setChartData(null);
      } finally {
        setIsLoading(false);
      }
    };
    getData();
  }, [coin.symbol, timeframe]);

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
              label: `${coin.symbol} Price`,
              data: chartData.prices,
              borderColor: 'rgba(168, 85, 247, 1)',
              backgroundColor: 'rgba(168, 85, 247, 0.2)',
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
              x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#9ca3af' } },
              y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#9ca3af', callback: (value: any) => formatCurrency(value, true) }}
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
                callbacks: { label: (context: any) => `Price: ${formatCurrency(context.parsed.y)}` },
              }
            },
          },
        });
      }
    }
    return () => { if (chartInstanceRef.current) chartInstanceRef.current.destroy(); };
  }, [chartData, coin.symbol]);

  const timeframes: Timeframe[] = ['24h', '7d', '30d', '1y'];
  
  return (
    <div 
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="chart-title"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl h-[80vh] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex justify-between items-center border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <img src={`https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`} alt={`${coin.name} logo`} className="w-8 h-8 rounded-full"/>
            <h2 id="chart-title" className="text-xl font-semibold text-white">{coin.name} ({coin.symbol})</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close modal">
            <CloseIcon />
          </button>
        </div>
        
        <div className="flex-grow p-4 overflow-y-auto">
            <div className="h-1/2 flex flex-col">
                <div className="flex items-center justify-center space-x-2 mb-2 flex-shrink-0">
                    {timeframes.map(tf => (
                        <button key={tf} onClick={() => setTimeframe(tf)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${timeframe === tf ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                        {tf.toUpperCase()}
                        </button>
                    ))}
                </div>
                <div className="flex-grow relative">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center"><LoadingSpinner /></div>
                    ) : chartData ? (
                        <canvas ref={chartCanvasRef}></canvas>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-red-400">Could not load chart data.</div>
                    )}
                </div>
            </div>
            <div className="h-1/2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-bold text-purple-300 flex items-center gap-2"><ChatBubbleIcon /> Social Sentiment</h3>
                    <div className="flex items-center justify-center h-full text-gray-500">Data feed coming soon...</div>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-bold text-purple-300 flex items-center gap-2"><WalletIcon /> On-Chain Data</h3>
                    <div className="flex items-center justify-center h-full text-gray-500">Data feed coming soon...</div>
                </div>
            </div>
        </div>

      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
