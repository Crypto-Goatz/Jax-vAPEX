import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { btcHistoryService, BtcHistoryEntry } from '../services/btcHistoryService';
import { analyzeBtcPatterns } from '../services/geminiService';
import { LoadingSpinner } from './LoadingSpinner';
import { RewindIcon, TrendingUpIcon, TrendingDownIcon, LightbulbIcon } from './Icons';

// --- HELPER FUNCTIONS ---
const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatSimpleDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Simple markdown-like parser for AI response
const formatAIResponse = (content: string) => {
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/(\r\n|\n|\r)/g, '<br />')
        .replace(/(\d+\.\s)/g, '<br/><strong class="text-purple-300 mt-2 block">$1</strong>');
};

// --- SUB-COMPONENTS ---

const TimelineEventCard: React.FC<{ event: BtcHistoryEntry }> = ({ event }) => (
    <div className="relative pl-6">
        <div className="absolute top-1 left-0 w-3 h-3 bg-gray-600 rounded-full border-2 border-gray-800"></div>
        <p className="text-xs text-purple-300 font-semibold">{formatSimpleDate(event.date)}</p>
        <p className="text-sm text-gray-300">{event.eventType}</p>
    </div>
);

const DailySnapshotCard: React.FC<{ 
    dayData: BtcHistoryEntry[],
    onAnalyzeEvent: (event: BtcHistoryEntry) => void,
    isAnalyzing: boolean
}> = ({ dayData, onAnalyzeEvent, isAnalyzing }) => {
    if (dayData.length === 0) return null;
    const primaryEntry = dayData.sort((a,b) => b.intensityScore - a.intensityScore)[0];
    const isPositive = primaryEntry.dailyChange >= 0;

    return (
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-2xl shadow-purple-900/20">
            <h3 className="text-2xl font-bold text-white">{new Date(primaryEntry.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center md:text-left">
                    <p className="text-sm text-gray-400">Closing Price</p>
                    <p className="text-4xl font-mono font-bold text-white">{formatCurrency(primaryEntry.price)}</p>
                </div>
                <div className="text-center md:text-left">
                    <p className="text-sm text-gray-400">Daily Change</p>
                    <p className={`text-4xl font-mono font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{primaryEntry.dailyChange.toFixed(2)}%
                    </p>
                </div>
                <div className="col-span-2 md:col-span-1 text-center md:text-left">
                    <p className="text-sm text-gray-400">Volatility</p>
                    <p className="text-4xl font-mono font-bold text-white">{primaryEntry.volatility.toFixed(2)}%</p>
                </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-700/50">
                <h4 className="text-lg font-semibold text-purple-300">Market Events on this Day</h4>
                <div className="space-y-3 mt-2">
                    {dayData.map((event, idx) => {
                        const isAnalyzable = event.status === 'EVENT DETECTED';
                        const cursorClass = isAnalyzing ? 'cursor-wait opacity-70' : 'cursor-pointer hover:bg-gray-800 hover:border-purple-500/50';
                        return (
                            <div 
                                key={idx} 
                                className={`bg-gray-900/50 p-3 rounded-lg transition-all border border-transparent ${isAnalyzable ? cursorClass : ''}`}
                                onClick={isAnalyzable && !isAnalyzing ? () => onAnalyzeEvent(event) : undefined}
                                title={isAnalyzable ? 'Click to analyze this event with AI' : ''}
                            >
                                 <div className="flex justify-between items-center">
                                    <p className={`font-semibold text-sm flex items-center gap-2 ${isAnalyzable ? 'text-purple-300' : 'text-gray-300'}`}>
                                        {isAnalyzable && <LightbulbIcon className="w-4 h-4 text-purple-400" />}
                                        {event.eventType}
                                    </p>
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${event.direction === 'POSITIVE' ? 'bg-green-500/20 text-green-300' : event.direction === 'NEGATIVE' ? 'bg-red-500/20 text-red-300' : 'bg-gray-600 text-gray-200'}`}>{event.direction}</span>
                                </div>
                                <div className="mt-2">
                                    <p className="text-xs text-gray-400 mb-1">Intensity ({event.intensityScore}/10)</p>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${event.intensityScore * 10}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const HistoricalChart: React.FC<{ chartData: any; selectedDate: string; }> = ({ chartData, selectedDate }) => {
    const chartCanvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);

    useEffect(() => {
        if (chartInstanceRef.current) chartInstanceRef.current.destroy();
        if (chartCanvasRef.current && chartData) {
            const ctx = chartCanvasRef.current.getContext('2d');
            if (ctx) {
                chartInstanceRef.current = new window.Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: chartData.labels,
                        datasets: [{ data: chartData.prices, borderColor: '#a855f7', borderWidth: 2, pointRadius: 0, tension: 0.1 }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        scales: { x: { display: false }, y: { display: false } },
                        plugins: {
                            legend: { display: false }, tooltip: { enabled: false },
                            annotation: {
                                annotations: {
                                    line1: { type: 'line', xMin: selectedDate, xMax: selectedDate, borderColor: 'rgba(255,255,255,0.5)', borderWidth: 2, borderDash: [6, 6] }
                                }
                            }
                        }
                    }
                });
            }
        }
    }, [chartData, selectedDate]);
    
    return <div className="h-24 w-full"><canvas ref={chartCanvasRef}></canvas></div>;
};

// --- MAIN COMPONENT ---
export const MarketRewind: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [allHistory, setAllHistory] = useState<BtcHistoryEntry[]>([]);
    const [dateRange, setDateRange] = useState<{ min: string, max: string }>({ min: '', max: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Memoize derived data
    const { dayData, surroundingEvents, chartData } = useMemo(() => {
        if (!selectedDate || allHistory.length === 0) {
            return { dayData: [], surroundingEvents: { before: [], after: [] }, chartData: null };
        }
        return {
            dayData: btcHistoryService.getDataForDate(selectedDate),
            surroundingEvents: btcHistoryService.getSurroundingEvents(selectedDate, 3),
            chartData: btcHistoryService.getChartDataForDate(selectedDate, 30)
        };
    }, [selectedDate, allHistory]);
    
    useEffect(() => {
        try {
            const data = btcHistoryService.getBtcHistory();
            const range = btcHistoryService.getDateRange();
            setAllHistory(data);
            setDateRange(range);
            setSelectedDate(range.max); // Set initial date
            setIsLoading(false);
        } catch (e) {
            setError("Failed to load historical data service.");
            setIsLoading(false);
        }
    }, []);
    
    useEffect(() => {
        // Clear AI analysis when date changes
        setAiAnalysis(null);
    }, [selectedDate]);
    
    const handleAIAnalysis = useCallback(async () => {
        if (!selectedDate || dayData.length === 0) return;
        setIsAnalyzing(true);
        setAiAnalysis(null);
        const dataSlice = btcHistoryService.getDataSlice(selectedDate, 15, 'before');
        const primaryEvent = dayData.sort((a, b) => b.intensityScore - a.intensityScore)[0];
        try {
            const analysis = await analyzeBtcPatterns(dataSlice, selectedDate, primaryEvent.eventType);
            setAiAnalysis(analysis);
        } catch (e) {
            setAiAnalysis("Analysis failed due to an API error. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    }, [selectedDate, dayData]);

    const handleAnalyzeEvent = useCallback(async (event: BtcHistoryEntry) => {
        setIsAnalyzing(true);
        setAiAnalysis(null);
        // User requested preceding 3 days of data for specific event analysis.
        const dataSlice = btcHistoryService.getDataSlice(event.date, 3, 'before');
        try {
            const analysis = await analyzeBtcPatterns(dataSlice, event.date, event.eventType);
            setAiAnalysis(analysis);
        } catch (e) {
            setAiAnalysis("Analysis failed due to an API error. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    const renderMainContent = () => {
        if (isLoading) return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>;
        if (error) return <div className="flex-1 flex items-center justify-center text-red-400">{error}</div>;

        return (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-4 overflow-y-auto">
                {/* Before Events */}
                <div className="lg:col-span-1 xl:col-span-1 hidden lg:block">
                    <h3 className="text-lg font-bold text-gray-400 mb-4">Events Before</h3>
                    <div className="relative border-l-2 border-gray-700 space-y-6 ml-1.5">
                        {surroundingEvents.before.map((event, idx) => <TimelineEventCard key={idx} event={event} />)}
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-2 xl:col-span-3 space-y-6">
                    <DailySnapshotCard dayData={dayData} onAnalyzeEvent={handleAnalyzeEvent} isAnalyzing={isAnalyzing} />
                    {chartData && <HistoricalChart chartData={chartData} selectedDate={selectedDate} />}
                    <div>
                        <button onClick={handleAIAnalysis} disabled={isAnalyzing} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-600">
                            {isAnalyzing ? <LoadingSpinner /> : <LightbulbIcon />}
                            {isAnalyzing ? 'Analyzing...' : 'Analyze Primary Event (15d Lookback)'}
                        </button>
                    </div>
                    {aiAnalysis && (
                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 animate-fade-in-up" dangerouslySetInnerHTML={{ __html: formatAIResponse(aiAnalysis) }}></div>
                    )}
                </div>

                {/* After Events */}
                <div className="lg:col-span-1 xl:col-span-1 hidden lg:block">
                    <h3 className="text-lg font-bold text-gray-400 mb-4">Events After</h3>
                    <div className="relative border-l-2 border-gray-700 space-y-6 ml-1.5">
                        {surroundingEvents.after.map((event, idx) => <TimelineEventCard key={idx} event={event} />)}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        <RewindIcon /> Bitcoin Time Machine
                    </h2>
                    <p className="text-sm text-gray-400">A daily deep-dive into historical market events and AI-driven pattern analysis.</p>
                </div>
                <div className="flex-shrink-0">
                    <label htmlFor="date-picker" className="sr-only">Select Date</label>
                    <input
                        type="date"
                        id="date-picker"
                        value={selectedDate}
                        min={dateRange.min}
                        max={dateRange.max}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-lg p-2 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                </div>
            </div>
            {renderMainContent()}
        </div>
    );
};
