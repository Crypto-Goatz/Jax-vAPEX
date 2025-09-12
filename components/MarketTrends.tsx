import React, { useState, useEffect, useCallback } from 'react';
import { fetchLivePricing, CryptoPrice } from '../services/cryptoService';
import { getMarketNarratives } from '../services/geminiService';
import { LoadingSpinner } from './LoadingSpinner';
import { FunnelIcon, SignalIcon, RocketIcon, HoldIcon, ExitIcon, TrendingUpIcon, TrendingDownIcon, CheckCircleIcon, RefreshIcon, ClockIcon } from './Icons';

// --- TYPE DEFINITIONS ---
interface Narrative {
    title: string;
    summary: string;
    pipeline_stage: string;
    key_indicators: string[];
    affected_assets: string[];
    timestamp: string;
}
interface MoverComment {
    symbol: string;
    comment: string;
}

// --- SUB-COMPONENTS ---

const PipelineStageCard: React.FC<{
    icon: React.ReactNode;
    stage: number;
    title: string;
    count: number;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, stage, title, count, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full text-left p-3 rounded-lg border-l-4 transition-all duration-200 ${isActive ? 'bg-purple-600/20 border-purple-500 scale-105 shadow-lg' : 'bg-gray-800 border-gray-600 hover:bg-gray-700/50'}`}
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                    {icon}
                </div>
                <div>
                    <p className={`font-bold text-sm ${isActive ? 'text-purple-300' : 'text-gray-300'}`}>Stage {stage}: {title}</p>
                </div>
            </div>
            <p className={`font-mono font-bold text-lg ${isActive ? 'text-white' : 'text-gray-400'}`}>{count}</p>
        </div>
    </button>
);

const NarrativeCard: React.FC<{ narrative: Narrative }> = ({ narrative }) => {
    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 animate-fade-in-up break-inside-avoid mb-4 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/20 hover:border-purple-500/50 hover:-translate-y-1">
            <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-lg text-white">{narrative.title}</h3>
                <div className="flex items-center space-x-1.5 text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
                    <ClockIcon className="w-3.5 h-3.5" />
                    <span>{new Date(narrative.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
            </div>
            <p className="text-sm text-purple-400 font-semibold my-1">Pipeline Stage: {narrative.pipeline_stage}</p>
            <p className="text-sm text-gray-300 mt-2">{narrative.summary}</p>
            <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Key Indicators</p>
                <ul className="space-y-2">
                    {narrative.key_indicators.map((indicator, index) => (
                        <li key={index} className="flex items-start space-x-2 text-sm text-gray-300">
                            <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-400" />
                            <span>{indicator}</span>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
                {narrative.affected_assets.map(asset => (
                    <span key={asset} className="px-2 py-1 text-xs font-mono bg-gray-700 text-gray-300 rounded-md">
                        ${asset}
                    </span>
                ))}
            </div>
        </div>
    );
};


const MarketMoverCard: React.FC<{ 
    coin: CryptoPrice; 
    comment: string;
}> = ({ coin, comment }) => {
    const isGainer = coin.change24h >= 0;
    return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 break-inside-avoid">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center font-bold text-purple-400 text-xs">
                        {coin.symbol.charAt(0)}
                    </div>
                    <div>
                        <p className="font-semibold text-sm text-white">{coin.symbol}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className={`font-mono font-semibold text-sm ${isGainer ? 'text-green-400' : 'text-red-400'}`}>
                        {isGainer ? '+' : ''}{coin.change24h.toFixed(2)}%
                    </p>
                </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 italic">
                <span className="font-bold text-purple-400">Jax-Comment:</span> {comment}
            </p>
        </div>
    );
};


// --- MAIN COMPONENT ---
export const MarketTrends: React.FC = () => {
    const [narrativesData, setNarrativesData] = useState<{ narratives: Narrative[], market_movers_commentary: MoverComment[] } | null>(null);
    const [marketData, setMarketData] = useState<CryptoPrice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedStage, setSelectedStage] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [narratives, prices] = await Promise.all([
                getMarketNarratives(),
                fetchLivePricing()
            ]);
            setNarrativesData(narratives);
            setMarketData(prices);
        } catch (err) {
            console.error("Failed to fetch market data:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleStageSelect = (stageTitle: string) => {
        setSelectedStage(prev => (prev === stageTitle ? null : stageTitle));
    };

    const topGainers = marketData.sort((a, b) => b.change24h - a.change24h).slice(0, 5);
    const topLosers = marketData.sort((a, b) => a.change24h - b.change24h).slice(0, 5);

    const getCommentForSymbol = (symbol: string): string => {
        const found = narrativesData?.market_movers_commentary.find(c => c.symbol.toUpperCase() === symbol.toUpperCase());
        return found?.comment || "General market volatility.";
    };

    const renderContent = () => {
        if (isLoading && !narrativesData) { // Only show full-page loader on initial load
            return (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center space-y-3 text-center">
                        <LoadingSpinner />
                        <p className="text-purple-300 font-semibold">JaxSpot AI is synthesizing market narratives...</p>
                        <p className="text-sm text-gray-400">Analyzing on-chain data, sentiment, and order books.</p>
                    </div>
                </div>
            );
        }

        if (error || !narrativesData) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="font-semibold text-red-400">Failed to Load Narratives</p>
                        <p className="text-sm text-gray-300 mt-1">{error}</p>
                    </div>
                </div>
            );
        }

        const pipelineStages = [
            { icon: <FunnelIcon className="w-5 h-5"/>, title: 'Watchlist', count: 152 },
            { icon: <SignalIcon className="w-5 h-5"/>, title: 'Signal', count: 18 },
            { icon: <RocketIcon className="w-5 h-5"/>, title: 'Spot', count: 3 },
            { icon: <HoldIcon className="w-5 h-5"/>, title: 'Hold', count: 2 },
            { icon: <ExitIcon className="w-5 h-5"/>, title: 'Exit', count: 1 }
        ];

        const filteredNarratives = selectedStage
            ? narrativesData.narratives.filter(n => n.pipeline_stage.toLowerCase().includes(selectedStage.toLowerCase()))
            : narrativesData.narratives;


        return (
             <div className="flex flex-col md:flex-row gap-6 h-full">
                {/* Left Column: Pipeline (Funnel) */}
                <div className="w-full md:w-1/3 lg:w-1/4 space-y-3 flex flex-col">
                    <h3 className="text-lg font-bold text-purple-400">Intelligence Funnel</h3>
                    <div className="space-y-3">
                        {pipelineStages.map((stage, index) => (
                             <PipelineStageCard 
                                key={stage.title}
                                icon={stage.icon}
                                stage={index + 1}
                                title={stage.title}
                                count={stage.count}
                                isActive={selectedStage === stage.title}
                                onClick={() => handleStageSelect(stage.title)}
                            />
                        ))}
                    </div>
                </div>

                {/* Right-side Container for Center and Right columns */}
                <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col lg:flex-row gap-6">
                    {/* Center Column: Narratives */}
                    <div className="w-full lg:w-2/3">
                         <h3 className="text-lg font-bold text-purple-400 mb-4">
                            {selectedStage ? `Narratives: ${selectedStage}` : 'Emerging Narratives'}
                         </h3>
                         <div className="md:columns-2 gap-4">
                            {filteredNarratives.length > 0 ? (
                               filteredNarratives.map((narrative, index) => (
                                  <NarrativeCard key={index} narrative={narrative} />
                               ))
                            ) : (
                               <div className="text-center text-gray-500 p-4 bg-gray-800 rounded-lg break-inside-avoid">
                                  No narratives match the selected stage.
                               </div>
                            )}
                         </div>
                    </div>

                    {/* Right Column: Market Movers */}
                    <div className="w-full lg:w-1/3 space-y-4">
                         <h3 className="text-lg font-bold text-purple-400 flex items-center"><TrendingUpIcon className="text-green-400 mr-2"/> Top Gainers</h3>
                         <div className="space-y-3">
                            {topGainers.map(coin => <MarketMoverCard key={coin.id} coin={coin} comment={getCommentForSymbol(coin.symbol)} />)}
                         </div>

                         <h3 className="text-lg font-bold text-purple-400 pt-4 flex items-center"><TrendingDownIcon className="text-red-400 mr-2"/> Top Losers</h3>
                          <div className="space-y-3">
                            {topLosers.map(coin => <MarketMoverCard key={coin.id} coin={coin} comment={getCommentForSymbol(coin.symbol)} />)}
                         </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-white">Market Narratives</h2>
                    <p className="text-sm text-gray-400">Live AI synthesis of what's driving the crypto market.</p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={isLoading}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                    aria-label="Refresh data"
                >
                    {isLoading ? <LoadingSpinner /> : <RefreshIcon />}
                </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
                {renderContent()}
            </div>
            <style>{`
                @keyframes fade-in-up {
                from { opacity: 0; transform: translateY(15px); }
                to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                animation: fade-in-up 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};