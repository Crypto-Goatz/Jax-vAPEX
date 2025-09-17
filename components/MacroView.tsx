import React, { useRef, useEffect, useMemo } from 'react';
import { BtcHistoryEntry } from '../services/btcHistoryService';
import { HistoricalMacroDataPoint } from '../services/macroService';
import { GlobeIcon } from './Icons';
import { LoadingSpinner } from './LoadingSpinner';

declare global {
  interface Window { Chart: any; }
}

// --- UTILITY FUNCTIONS ---
const formatBtcPrice = (value: number) => `$${(value / 1000).toFixed(1)}k`;
const formatM2 = (value: number) => `$${value.toFixed(2)}T`;
const formatPercent = (value: number) => `${value.toFixed(2)}%`;


// --- REUSABLE CHART COMPONENT ---
interface MacroChartProps {
  chartData: {
    labels: string[];
    btcPrices: number[];
    macroData: number[];
  };
  btcLabel: string;
  macroLabel: string;
  macroUnit: 'currency' | 'percent';
}

const MacroChart: React.FC<MacroChartProps> = ({ chartData, btcLabel, macroLabel, macroUnit }) => {
    const chartCanvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);

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
                        datasets: [
                            {
                                label: macroLabel,
                                data: chartData.macroData,
                                borderColor: 'rgba(52, 211, 153, 1)', // emerald-400
                                backgroundColor: 'rgba(52, 211, 153, 0.1)',
                                borderWidth: 2,
                                yAxisID: 'yMacro',
                                tension: 0.1,
                                pointRadius: 0,
                            },
                            {
                                label: btcLabel,
                                data: chartData.btcPrices,
                                borderColor: 'rgba(168, 85, 247, 1)', // purple-500
                                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                borderWidth: 2,
                                yAxisID: 'yBtc',
                                tension: 0.1,
                                pointRadius: 0,
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        scales: {
                            x: {
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: '#9ca3af', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
                            },
                            yMacro: {
                                type: 'linear',
                                position: 'left',
                                grid: { color: 'rgba(52, 211, 153, 0.1)' },
                                ticks: {
                                    color: '#6ee7b7', // emerald-300
                                    callback: (value: any) => macroUnit === 'percent' ? formatPercent(value) : formatM2(value)
                                }
                            },
                            yBtc: {
                                type: 'linear',
                                position: 'right',
                                grid: { drawOnChartArea: false },
                                ticks: {
                                    color: '#c4b5fd', // violet-300
                                    callback: (value: any) => formatBtcPrice(value)
                                }
                            }
                        },
                        plugins: {
                            legend: { labels: { color: '#d1d5db' } },
                            tooltip: {
                                backgroundColor: '#1f2937',
                                titleColor: '#f9fafb',
                                bodyColor: '#d1d5db',
                            }
                        }
                    }
                });
            }
        }
        return () => {
            if (chartInstanceRef.current) chartInstanceRef.current.destroy();
        };
    }, [chartData, macroLabel, btcLabel, macroUnit]);

    return <div className="h-64 w-full"><canvas ref={chartCanvasRef}></canvas></div>;
};


// --- DATA PROCESSING HOOK ---
const useCombinedChartData = (
    btcHistory: BtcHistoryEntry[],
    macroHistory: HistoricalMacroDataPoint[],
    macroKey: keyof HistoricalMacroDataPoint
) => {
    return useMemo(() => {
        if (btcHistory.length === 0 || macroHistory.length === 0) {
            return null;
        }

        const btcPriceMap = new Map<string, number>();
        btcHistory.forEach(entry => {
            // Only store one price per day to match macro data frequency
            if (!btcPriceMap.has(entry.date)) {
                btcPriceMap.set(entry.date, entry.price);
            }
        });

        const labels: string[] = [];
        const btcPrices: number[] = [];
        const macroData: number[] = [];

        macroHistory.forEach(macroPoint => {
            const yearMonth = macroPoint.date.substring(0, 7);
            
            // Find a BTC price from that month. Simple approach: find first available day.
            const btcDate = Array.from(btcPriceMap.keys()).find(d => d.startsWith(yearMonth));
            
            if (btcDate) {
                const btcPrice = btcPriceMap.get(btcDate);
                if (btcPrice) {
                    labels.push(new Date(macroPoint.date).toLocaleDateString('en-US', { year: '2-digit', month: 'short' }));
                    btcPrices.push(btcPrice);
                    macroData.push(macroPoint[macroKey] as number);
                }
            }
        });

        return { labels, btcPrices, macroData };
    }, [btcHistory, macroHistory, macroKey]);
};


// --- MAIN COMPONENT ---
interface MacroViewProps {
    btcHistory: BtcHistoryEntry[];
    macroHistory: HistoricalMacroDataPoint[];
}

export const MacroView: React.FC<MacroViewProps> = ({ btcHistory, macroHistory }) => {
    
    const m2ChartData = useCombinedChartData(btcHistory, macroHistory, 'm2Supply');
    const inflationChartData = useCombinedChartData(btcHistory, macroHistory, 'inflationRate');
    const interestChartData = useCombinedChartData(btcHistory, macroHistory, 'interestRate');
    
    const isLoading = !m2ChartData || !inflationChartData || !interestChartData;

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <LoadingSpinner />
                    <p className="mt-4 text-purple-300">Correlating historical data...</p>
                </div>
            );
        }

        return (
             <div className="flex-1 p-4 overflow-y-auto space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <div>
                        <h3 className="text-2xl font-bold text-white">M2 Money Supply vs. BTC</h3>
                        <p className="text-gray-400 mt-2">
                            M2 represents the total amount of currency in circulation. Historically, an increase in M2 (monetary expansion) has often preceded bullish periods for scarce assets like Bitcoin, as more currency chases fewer goods.
                        </p>
                    </div>
                    {m2ChartData && <MacroChart chartData={m2ChartData} btcLabel="BTC Price" macroLabel="M2 Supply" macroUnit="currency" />}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-gray-800 p-6 rounded-lg border border-gray-700">
                     <div>
                        <h3 className="text-2xl font-bold text-white">US Inflation (CPI) vs. BTC</h3>
                        <p className="text-gray-400 mt-2">
                           Inflation erodes the purchasing power of fiat currency. Bitcoin's fixed supply of 21 million coins positions it as a potential hedge against inflation, making it attractive to investors when the value of their cash is declining.
                        </p>
                    </div>
                    {inflationChartData && <MacroChart chartData={inflationChartData} btcLabel="BTC Price" macroLabel="Inflation Rate" macroUnit="percent" />}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-gray-800 p-6 rounded-lg border border-gray-700">
                     <div>
                        <h3 className="text-2xl font-bold text-white">Fed Funds Rate vs. BTC</h3>
                        <p className="text-gray-400 mt-2">
                            The Federal Funds Rate influences the cost of borrowing. Lower rates can encourage investment in riskier assets like crypto. Conversely, higher rates can make traditional savings more attractive, potentially drawing capital away from crypto markets.
                        </p>
                    </div>
                    {interestChartData && <MacroChart chartData={interestChartData} btcLabel="BTC Price" macroLabel="Fed Funds Rate" macroUnit="percent" />}
                </div>
            </div>
        );
    }
    
    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <GlobeIcon /> Macro Analysis
                </h2>
                <p className="text-sm text-gray-400">Correlating global financial metrics with Bitcoin's performance.</p>
            </div>
            {renderContent()}
        </div>
    );
};
