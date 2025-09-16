import React, { useState, useMemo } from 'react';
import { fetchLivePricing, CryptoPrice, NewsSentiment } from '../services/cryptoService';
import { LoadingSpinner } from './LoadingSpinner';
import { TrendingUpIcon, TrendingDownIcon, RefreshIcon, ClockIcon, ExternalLinkIcon } from './Icons';

// --- SUB-COMPONENTS ---

const NarrativeCard: React.FC<{ narrative: string }> = ({ narrative }) => {
    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 animate-fade-in-up transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/20 hover:border-purple-500/50 hover:-translate-y-1">
            <p className="text-sm text-gray-300">{narrative}</p>
        </div>
    );
};

const TopStoryCard: React.FC<{ story: NewsSentiment['top_story'] }> = ({ story }) => (
    <div className="bg-gradient-to-br from-purple-900/50 to-gray-800 p-6 rounded-lg border border-purple-700 shadow-xl">
        <p className="text-sm font-semibold text-purple-400 uppercase tracking-wider">Top Story</p>
        <h3 className="text-2xl font-bold text-white mt-2">{story.headline}</h3>
        <div className="mt-4 flex justify-between items-center">
             <p className="text-sm text-gray-400">Source: {story.source}</p>
             <a 
                href={story.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
                Read More <ExternalLinkIcon className="w-4 h-4"/>
            </a>
        </div>
    </div>
);


const MarketMoverCard: React.FC<{ coin: CryptoPrice }> = ({ coin }) => {
    const isGainer = coin.change24h >= 0;
    return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
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
        </div>
    );
};


// --- MAIN COMPONENT ---
interface MarketTrendsProps {
    allCoins: CryptoPrice[];
    newsSentiment: NewsSentiment | null;
}

export const MarketTrends: React.FC<MarketTrendsProps> = ({ allCoins, newsSentiment }) => {
    
    const topGainers = useMemo(() => {
      return [...allCoins].sort((a, b) => b.change24h - a.change24h).slice(0, 5)
    }, [allCoins]);

    const topLosers = useMemo(() => {
      return [...allCoins].sort((a, b) => a.change24h - b.change24h).slice(0, 5);
    }, [allCoins]);


    const renderContent = () => {
        if (!newsSentiment) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center space-y-3 text-center">
                        <LoadingSpinner />
                        <p className="text-purple-300 font-semibold">Synthesizing market data...</p>
                    </div>
                </div>
            );
        }

        return (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* Left & Center Column: Narratives */}
                <div className="lg:col-span-2 space-y-6">
                    <TopStoryCard story={newsSentiment.top_story} />
                    <div>
                        <h3 className="text-lg font-bold text-purple-400 mb-4">Trending Narratives</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {newsSentiment.trending_narratives.map((narrative, index) => (
                                <NarrativeCard key={index} narrative={narrative} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Market Movers */}
                <div className="lg:col-span-1 space-y-4">
                     <h3 className="text-lg font-bold text-purple-400 flex items-center"><TrendingUpIcon className="text-green-400 mr-2"/> Top Gainers</h3>
                     <div className="space-y-3">
                        {topGainers.map(coin => <MarketMoverCard key={coin.id} coin={coin} />)}
                     </div>

                     <h3 className="text-lg font-bold text-purple-400 pt-4 flex items-center"><TrendingDownIcon className="text-red-400 mr-2"/> Top Losers</h3>
                      <div className="space-y-3">
                        {topLosers.map(coin => <MarketMoverCard key={coin.id} coin={coin} />)}
                     </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-white">Market Trends</h2>
                    <p className="text-sm text-gray-400">Live synthesis of what's driving the crypto market.</p>
                </div>
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