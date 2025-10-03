import React, { useState, useEffect, useRef } from 'react';
import { fetchHistoricalData, HistoricalData } from '../services/cryptoService';
import { LoadingSpinner } from './LoadingSpinner';
import { CloseIcon } from './Icons';
import type { Trade } from '../services/tradeSimulatorService';

declare global {
  interface Window { Chart: any; }
}

type Timeframe = '24h' | '7d' | '30d' | '1y';

interface CryptoChartModalProps {
  trade: Trade;
  onClose: () => void;
  initialTimeframe?: Timeframe;
}

const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || !isFinite(value)) {
        return 'N/A';
    }
    const fractionDigits = (Math.abs(value) > 0 && Math.abs(value) < 1) ? 6 : 2;
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: Math.max(2, fractionDigits)
    });
};


export const CryptoChartModal: React.FC<CryptoChartModalProps> = ({ trade, onClose, initialTimeframe }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe || '30d');
  const [chartData, setChartData] = useState<HistoricalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { coin } = trade;
  
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
        setChartData(null); // Clear data on error
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
        
        // --- Dynamic Highlighting Logic ---
        let tpCrossed = false;
        let slCrossed = false;

        if (trade.takeProfitPrice && trade.stopLossPrice) {
            for (const price of chartData.prices) {
                if (trade.direction === 'buy') {
                    if (price >= trade.takeProfitPrice) tpCrossed = true;
                    if (price <= trade.stopLossPrice) slCrossed = true;
                } else { // 'sell'
                    if (price <= trade.takeProfitPrice) tpCrossed = true;
                    if (price >= trade.stopLossPrice) slCrossed = true;
                }
            }
        }
        
        const annotations: any = {};
        const isClosed = trade.status === 'closed';

        // --- ENHANCEMENT: Add a shaded box to represent P/L on closed trades ---
        if (isClosed && trade.closePrice) {
            const isProfit = trade.pnl !== null && trade.pnl >= 0;
            annotations.pnlBox = {
                type: 'box',
                yMin: Math.min(trade.entryPrice, trade.closePrice),
                yMax: Math.max(trade.entryPrice, trade.closePrice),
                backgroundColor: isProfit ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                borderColor: isProfit ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                borderWidth: 1,
            };
        }

        // --- ENHANCEMENT: Highlight entry line on closed trades ---
        annotations.entryLine = {
            type: 'line',
            yMin: trade.entryPrice,
            yMax: trade.entryPrice,
            borderColor: 'rgb(59, 130, 246)', // blue-500
            borderWidth: isClosed ? 3 : 2, // Thicker if closed
            borderDash: [6, 6],
            label: {
                content: `Entry: ${formatCurrency(trade.entryPrice)}`,
                enabled: true,
                position: 'end',
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                color: 'white',
                font: { size: 10, weight: isClosed ? 'bold' : 'normal' }
            }
        };

        // --- ENHANCEMENT: Highlight close line (it only exists on closed trades) ---
        if (trade.closePrice) {
            annotations.closeLine = {
                type: 'line',
                yMin: trade.closePrice,
                yMax: trade.closePrice,
                borderColor: 'rgb(107, 114, 128)', // gray-500
                borderWidth: 3, // Always thicker as it only shows when closed
                label: {
                    content: `Close: ${formatCurrency(trade.closePrice)}`,
                    enabled: true,
                    position: 'end',
                    backgroundColor: 'rgba(107, 114, 128, 0.9)',
                    color: 'white',
                    font: { size: 10, weight: 'bold' }
                }
            };
        }

        if (trade.takeProfitPrice) {
            annotations.tpLine = {
                type: 'line',
                yMin: trade.takeProfitPrice,
                yMax: trade.takeProfitPrice,
                borderColor: tpCrossed ? 'rgb(34, 197, 94)' : 'rgba(34, 197, 94, 0.5)', // green-500
                borderWidth: tpCrossed ? 3 : 2,
                label: {
                    content: `TP: ${formatCurrency(trade.takeProfitPrice)}`,
                    enabled: true,
                    position: 'end',
                    backgroundColor: tpCrossed ? 'rgba(34, 197, 94, 0.9)' : 'rgba(34, 197, 94, 0.6)',
                    color: 'white',
                    font: { size: 10, weight: tpCrossed ? 'bold' : 'normal' }
                }
            };
        }

        if (trade.stopLossPrice) {
            annotations.slLine = {
                type: 'line',
                yMin: trade.stopLossPrice,
                yMax: trade.stopLossPrice,
                borderColor: slCrossed ? 'rgb(239, 68, 68)' : 'rgba(239, 68, 68, 0.5)', // red-500
                borderWidth: slCrossed ? 3 : 2,
                label: {
                    content: `SL: ${formatCurrency(trade.stopLossPrice)}`,
                    enabled: true,
                    position: 'end',
                    backgroundColor: slCrossed ? 'rgba(239, 68, 68, 0.9)' : 'rgba(239, 68, 68, 0.6)',
                    color: 'white',
                    font: { size: 10, weight: slCrossed ? 'bold' : 'normal' }
                }
            };
        }

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
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: { color: '#6b7280' } // gray-500
              },
              y: {
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: { 
                    color: '#6b7280', // gray-500
                    callback: (value: string | number) => `$${Number(value).toLocaleString()}`
                }
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: '#ffffff', // white
                titleColor: '#1f2937', // gray-800
                bodyColor: '#4b5563', // gray-600
                footerColor: '#6b7280', // gray-500
                borderColor: '#e5e7eb', // gray-200
                borderWidth: 1,
                displayColors: false,
                padding: 10,
                callbacks: {
                  label: (context: any) => `Price: ${formatCurrency(context.parsed.y)}`,
                  afterBody: () => [
                    '', // Spacer
                    `Entry: ${formatCurrency(trade.entryPrice)}`,
                    `TP:    ${formatCurrency(trade.takeProfitPrice)}`,
                    `SL:    ${formatCurrency(trade.stopLossPrice)}`,
                  ],
                },
              },
              annotation: {
                annotations: annotations
              }
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
  }, [chartData, coin.symbol, trade]);

  const timeframes: Timeframe[] = ['24h', '7d', '30d', '1y'];
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="chart-title"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl h-[70vh] bg-white border border-gray-200 rounded-lg shadow-2xl flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex justify-between items-center border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-bold text-purple-600 text-sm">
                {coin.symbol.charAt(0)}
            </div>
            <h2 id="chart-title" className="text-xl font-semibold text-gray-900">{coin.name} ({coin.symbol}) Trade Analysis</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Close chart modal">
            <CloseIcon />
          </button>
        </div>
        <div className="p-4 flex items-center justify-center space-x-2 border-b border-gray-200 flex-shrink-0">
          {timeframes.map(tf => (
            <button 
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                timeframe === tf ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
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
                    <p className="text-gray-500">Loading chart data...</p>
                </div>
            </div>
          ) : chartData ? (
            <canvas ref={chartCanvasRef}></canvas>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-red-500">Could not load chart data.</p>
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