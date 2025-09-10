import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getHistoricalEvents } from '../services/geminiService';
import { fetchHistoricalData, HistoricalData } from '../services/cryptoService';
import { LoadingSpinner } from './LoadingSpinner';
import { NewsIcon, BankIcon, PipelineIcon, SocialIcon } from './Icons';

// --- TYPE DEFINITIONS ---
type EventCategory = 'News & Narrative' | 'Economic' | 'On-Chain & Technical' | 'Social & Community';

interface MarketEvent {
    category: EventCategory;
    title: string;
    description: string;
}

interface HistoricalAnalysis {
    analysisSummary: string;
    events: MarketEvent[];
}

// --- SUB-COMPONENTS ---
const EventCard: React.FC<{ event: MarketEvent }> = ({ event }) => {
    const getIcon = () => {
        switch (event.category) {
            case 'News & Narrative': return <NewsIcon className="text-blue-400" />;
            case 'Economic': return <BankIcon className="text-green-400" />;
            case 'On-Chain & Technical': return <PipelineIcon className="text-yellow-400" />;
            case 'Social & Community': return <SocialIcon className="text-pink-400" />;
            default: return null;
        }
    };

    return (
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center mt-1">
                {getIcon()}
            </div>
            <div>
                <p className="font-bold text-white">{event.title}</p>
                <p className="text-sm text-gray-400">{event.description}</p>
            </div>
        </div>
    );
};

const DateSelector: React.FC<{ onAnalyze: (date: string) => void, isLoading: boolean }> = ({ onAnalyze, isLoading }) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const maxDate = yesterday.toISOString().split('T')[0];

    const threeYearsAgo = new Date(today);
    threeYearsAgo.setFullYear(today.getFullYear() - 3);
    const minDate = threeYearsAgo.toISOString().split('T')[0];
    
    const [selectedDate, setSelectedDate] = useState(maxDate);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAnalyze(selectedDate);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-4 p-4 border-b border-gray-700 bg-gray-900/50">
            <div>
                <label htmlFor="historical-date" className="sr-only">Select Date</label>
                <input
                    type="date"
                    id="historical-date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={minDate}
                    max={maxDate}
                    className="bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    aria-label="Select a date for historical analysis"
                />
            </div>
            <button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center"
            >
                {isLoading ? <LoadingSpinner /> : 'Analyze Date'}
            </button>
        </form>
    );
};

// --- MAIN COMPONENT ---
export const MarketRewind: React.FC = () => {
    const [analysis, setAnalysis] = useState<HistoricalAnalysis | null>(null);
    const [chartData, setChartData] = useState<HistoricalData | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const chartCanvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);

    const handleAnalyze = useCallback(async (date: string) => {
        setIsLoading(true);
        setError(null);
        setAnalysis(null);
        setChartData(null);
        setSelectedDate(date);

        try {
            // We fetch for 'bitcoin' and a '30d' timeframe for demonstration
            const [eventsData, priceData] = await Promise.all([
                getHistoricalEvents(date),
                fetchHistoricalData('bitcoin', '30d') 
            ]);
            setAnalysis(eventsData);
            setChartData(priceData);

        } catch (err) {
            console.error("Failed to fetch historical analysis:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
        }
        if (chartCanvasRef.current && chartData && selectedDate) {
          const ctx = chartCanvasRef.current.getContext('2d');
          const selectedDateIndex = chartData.labels.findIndex(label => {
             // This is a rough match for the simulated labels. A real implementation would parse dates.
             const d = new Date(selectedDate);
             const labelDateStr = `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
             return label.includes(labelDateStr);
          });

          if (ctx) {
            chartInstanceRef.current = new window.Chart(ctx, {
              type: 'line',
              data: {
                labels: chartData.labels,
                datasets: [{
                  label: `BTC Price`,
                  data: chartData.prices,
                  borderColor: 'rgba(168, 85, 247, 0.8)',
                  backgroundColor: 'rgba(168, 85, 247, 0.1)',
                  borderWidth: 2,
                  pointRadius: 0,
                  tension: 0.4,
                  fill: true,
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#9ca3af' } },
                  y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#9ca3af', callback: (v: any) => `$${Number(v).toLocaleString()}` } }
                },
                plugins: {
                  legend: { display: false },
                  tooltip: { mode: 'index', intersect: false },
                  annotation: {
                      annotations: {
                          line1: {
                              type: 'line',
                              xMin: selectedDateIndex !== -1 ? selectedDateIndex : 15, // Default to middle if not found
                              xMax: selectedDateIndex !== -1 ? selectedDateIndex : 15,
                              borderColor: 'rgba(255, 255, 255, 0.5)',
                              borderWidth: 2,
                              borderDash: [6, 6],
                              label: {
                                  content: `Selected: ${selectedDate}`,
                                  enabled: true,
                                  position: 'start',
                                  backgroundColor: 'rgba(31, 41, 55, 0.8)',
                                  color: '#d1d5db',
                                  yAdjust: -10,
                              }
                          }
                      }
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
      }, [chartData, selectedDate]);

    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">Market Rewind</h2>
                <p className="text-sm text-gray-400">Analyze historical price action with AI-correlated events.</p>
            </div>
            
            <DateSelector onAnalyze={handleAnalyze} isLoading={isLoading} />
            
            <div className="flex-1 p-4 overflow-y-auto">
                {!selectedDate && (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500 text-lg">Select a date to begin analysis.</p>
                    </div>
                )}
                {isLoading && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center space-y-3">
                            <LoadingSpinner />
                            <p className="font-semibold text-purple-300">JaxAI is analyzing historical data for {selectedDate}...</p>
                            <p className="text-sm text-gray-400">This may take a moment.</p>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="flex items-center justify-center h-full">
                         <div className="text-center p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="font-semibold text-red-400">Failed to Load Analysis</p>
                            <p className="text-sm text-gray-300 mt-1">{error}</p>
                        </div>
                    </div>
                )}

                {analysis && chartData && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full animate-fade-in">
                        {/* Left Side: Chart */}
                        <div className="lg:col-span-2 bg-gray-900/50 p-4 rounded-lg border border-gray-700 h-[60vh]">
                            <h3 className="text-lg font-bold text-white mb-2">BTC/USD Price Action (30-Day View)</h3>
                            <div className="relative h-[90%]">
                                <canvas ref={chartCanvasRef}></canvas>
                            </div>
                        </div>

                        {/* Right Side: AI Analysis */}
                        <div className="lg:col-span-1 h-[60vh] flex flex-col gap-4">
                            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                <h3 className="text-lg font-bold text-purple-400 mb-2">JaxAI's Analysis for {selectedDate}</h3>
                                <p className="text-sm text-gray-300 italic">"{analysis.analysisSummary}"</p>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 -mr-2">
                                {analysis.events.map((event, index) => <EventCard key={index} event={event} />)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
             <style>{`
                @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }

                /* Custom scrollbar for events panel */
                .overflow-y-auto::-webkit-scrollbar { width: 8px; }
                .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
                .overflow-y-auto::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
                .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #6b7280; }
            `}</style>
        </div>
    );
};