import React, { useState, useEffect, useCallback } from 'react';
import { getHistoricalEvents } from '../services/geminiService';
import { fetchHistoricalSnapshot, HistoricalCryptoPrice } from '../services/cryptoService';
import { LoadingSpinner } from './LoadingSpinner';
import { NewsIcon, BankIcon, PipelineIcon, SocialIcon, TrendingUpIcon, TrendingDownIcon } from './Icons';

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

const SnapshotMoverTable: React.FC<{ title: string; data: HistoricalCryptoPrice[]; isGainer: boolean }> = ({ title, data, isGainer }) => (
    <div className="flex-1">
        <h4 className="text-lg font-bold text-white mb-2 flex items-center">
            {isGainer ? <TrendingUpIcon className="text-green-400 mr-2" /> : <TrendingDownIcon className="text-red-400 mr-2" />}
            {title}
        </h4>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase bg-gray-700/30">
                    <tr>
                        <th className="p-2">Asset</th>
                        <th className="p-2 text-right">Price</th>
                        <th className="p-2 text-right">24h Change</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                    {data.map(coin => (
                        <tr key={coin.id}>
                            <td className="p-2 font-medium text-gray-200">{coin.symbol}</td>
                            <td className="p-2 text-right font-mono text-gray-300">${coin.price.toLocaleString()}</td>
                            <td className={`p-2 text-right font-mono font-semibold ${isGainer ? 'text-green-400' : 'text-red-400'}`}>
                                {isGainer ? '+' : ''}{coin.change24h.toFixed(2)}%
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);


const MarketSnapshot: React.FC<{ date: string; data: HistoricalCryptoPrice[] }> = ({ date, data }) => {
    const sortedData = [...data];
    const topGainers = sortedData.sort((a, b) => b.change24h - a.change24h).slice(0, 5);
    const topLosers = sortedData.sort((a, b) => a.change24h - b.change24h).slice(0, 5);
    
    return (
        <div className="flex flex-col h-full">
            <h3 className="text-xl font-bold text-white mb-4">Market Snapshot for {date}</h3>
            <div className="flex flex-col md:flex-row gap-6 flex-1">
                <SnapshotMoverTable title="Top Gainers" data={topGainers} isGainer={true} />
                <SnapshotMoverTable title="Top Losers" data={topLosers} isGainer={false} />
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
export const MarketRewind: React.FC = () => {
    const [analysis, setAnalysis] = useState<HistoricalAnalysis | null>(null);
    const [snapshotData, setSnapshotData] = useState<HistoricalCryptoPrice[] | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = useCallback(async (date: string) => {
        setIsLoading(true);
        setError(null);
        setAnalysis(null);
        setSnapshotData(null);
        setSelectedDate(date);

        try {
            const [eventsData, priceData] = await Promise.all([
                getHistoricalEvents(date),
                fetchHistoricalSnapshot(date) 
            ]);
            setAnalysis(eventsData);
            setSnapshotData(priceData);

        } catch (err) {
            console.error("Failed to fetch historical analysis:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    // Auto-load data for a valid date on initial render
    useEffect(() => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayString = yesterday.toISOString().split('T')[0];
        handleAnalyze(yesterdayString);
    }, [handleAnalyze]);


    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">Market Rewind</h2>
                <p className="text-sm text-gray-400">Analyze historical price action with AI-correlated events.</p>
            </div>
            
            <DateSelector onAnalyze={handleAnalyze} isLoading={isLoading} />
            
            <div className="flex-1 p-4 overflow-y-auto">
                {isLoading && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center space-y-3">
                            <LoadingSpinner />
                            <p className="font-semibold text-purple-300">JaxAI is analyzing historical data for {selectedDate}...</p>
                            <p className="text-sm text-gray-400">This may take a moment.</p>
                        </div>
                    </div>
                )}
                {error && !isLoading && (
                    <div className="flex items-center justify-center h-full">
                         <div className="text-center p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="font-semibold text-red-400">Failed to Load Analysis</p>
                            <p className="text-sm text-gray-300 mt-1">{error}</p>
                        </div>
                    </div>
                )}

                {analysis && snapshotData && !isLoading && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full animate-fade-in">
                        {/* Left Side: Market Snapshot */}
                         <div className="lg:col-span-2 bg-gray-900/50 p-4 rounded-lg border border-gray-700 h-[60vh] flex flex-col">
                            <MarketSnapshot date={selectedDate!} data={snapshotData} />
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