import React, { useState, useEffect, useRef } from 'react';
import { CryptoPrice, fetchHistoricalData, HistoricalData } from '../services/cryptoService';
import { LoadingSpinner } from './LoadingSpinner';
import { CloseIcon } from './Icons';

declare global {
  interface Window { Chart: any; }
}

type Timeframe = '24h' | '7d' | '30d' | '1y';

interface CryptoChartModalProps {
  coin: CryptoPrice;
  onClose: () => void;
}

export const CryptoChartModal: React.FC<CryptoChartModalProps> = ({ coin, onClose }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [chartData, setChartData] = useState<HistoricalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    const getData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchHistoricalData(coin.id, timeframe);
        setChartData(data);
      } catch (error) {
        console.error("Failed to fetch historical data:", error);
        setChartData(null); // Clear data on error
      } finally {
        setIsLoading(false);
      }
    };
    getData();
  }, [coin.id, timeframe]);

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
              borderColor: 'rgba(168, 85, 247, 1)', // purple-500
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
              x: {
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: '#9ca3af' } // gray-400
              },
              y: {
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { 
                    color: '#9ca3af', // gray-400
                    callback: (value: string | number) => `$${Number(value).toLocaleString()}`
                }
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: '#1f2937', // gray-800
                titleColor: '#f9fafb', // gray-50
                bodyColor: '#d1d5db', // gray-300
                displayColors: false, // Hides the color box for a cleaner look
                callbacks: {
                  label: (context: any) => {
                    let label = 'Price:';
                    if (context.parsed.y !== null) {
                      label = `Price: ${new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(context.parsed.y)}`;
                    }
                    return label;
                  },
                },
              },
            },
          },
        });
      }
    }
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
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
        className="w-full max-w-3xl h-[60vh] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex justify-between items-center border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center font-bold text-purple-400 text-sm">
                {coin.symbol.charAt(0)}
            </div>
            <h2 id="chart-title" className="text-xl font-semibold text-white">{coin.name} ({coin.symbol}) Price Chart</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close chart modal">
            <CloseIcon />
          </button>
        </div>
        <div className="p-4 flex items-center justify-center space-x-2 border-b border-gray-700 flex-shrink-0">
          {timeframes.map(tf => (
            <button 
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                timeframe === tf ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex-grow p-4 relative">
          {isLoading ? (
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center space-y-2">
                    <LoadingSpinner />
                    <p className="text-gray-400">Loading chart data...</p>
                </div>
            </div>
          ) : chartData ? (
            <canvas ref={chartCanvasRef}></canvas>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-red-400">Could not load chart data.</p>
            </div>
          )}
        </div>
      </div>
      {/* Add fade-in animation */}
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