import React, { useState, useMemo, useEffect } from 'react';
import { fetchLivePricing, CryptoPrice, NewsSentiment, Narrative } from '../services/cryptoService';
import { LoadingSpinner } from './LoadingSpinner';
import { TrendingUpIcon, TrendingDownIcon, RefreshIcon, ClockIcon, ExternalLinkIcon } from './Icons';

// --- SUB-COMPONENTS ---

const NarrativeCard: React.FC<{ narrative: Narrative }> = ({ narrative }) => {
    const { headline, posVotes, negVotes } = narrative;
    const totalVotes = posVotes + negVotes;
    const positivePercentage = totalVotes > 0 ? (posVotes / totalVotes) * 100 : 50;

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 animate-fade-in-up transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/10 hover:border-purple-300 hover:-translate-y-1 flex flex-col justify-between">
            <p className="text-sm text-gray-700 flex-grow">{headline}</p>
            <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <div className="flex items-center gap-1 font-semibold text-green-600">
                        <span>👍</span>
                        <span>{posVotes}</span>
                    </div>
                     <div className="flex items-center gap-1 font-semibold text-red-600">
                        <span>{negVotes}</span>
                        <span>👎</span>
                    </div>
                </div>
                <div title={`${positivePercentage.toFixed(0)}% Positive`} className="w-full bg-red-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: `${positivePercentage}%` }}></div>
                </div>
            </div>
        </div>
    );
};

const TopStoryCard: React.FC<{ story: NewsSentiment['top_story'] }> = ({ story }) => (
    <div className="bg-gradient-to-br from-purple-100 to-white p-6 rounded-lg border border-purple-200 shadow-xl">
        <p className="text-sm font-semibold text-purple-700 uppercase tracking-wider">Top Story</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-2">{story.headline}</h3>
        <div className="mt-4 flex justify-between items-center">
             <p className="text-sm text-gray-600">Source: {story.source}</p>
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
    const [logoError, setLogoError] = useState(false);
    useEffect(() => { setLogoError(false); }, [coin.symbol]);
    
    const isGainer = coin.change24h >= 0;
    const logoUrl = `https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`;
    
    return (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    {logoError ? (
                        <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center font-bold text-purple-600 text-xs border border-gray-200">
                            {coin.symbol.charAt(0)}
                        </div>
                    ) : (
                        <img 
                            src={logoUrl} 
                            alt={`${coin.name} logo`}
                            className="w-7 h-7 rounded-full"
                            onError={() => setLogoError(true)}
                        />
                    )}
                    <div>
                        <p className="font-semibold text-sm text-gray-800">{coin.symbol}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className={`font-mono font-semibold text-sm ${isGainer ? 'text-green-600' : 'text-red-600'}`}>
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
                        <p className="text-purple-600 font-semibold">Synthesizing market data...</p>
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
                        <h3 className="text-lg font-bold text-purple-700 mb-4">Trending Narratives</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {newsSentiment.trending_narratives.map((narrative, index) => (
                                <NarrativeCard key={index} narrative={narrative} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Market Movers */}
                <div className="lg:col-span-1 space-y-4 bg-white p-4 rounded-lg border border-gray-200">
                     <h3 className="text-lg font-bold text-purple-700 flex items-center"><TrendingUpIcon className="text-green-500 mr-2"/> Top Gainers</h3>
                     <div className="space-y-3">
                        {topGainers.map(coin => <MarketMoverCard key={coin.id} coin={coin} />)}
                     </div>

                     <h3 className="text-lg font-bold text-purple-700 pt-4 flex items-center"><TrendingDownIcon className="text-red-500 mr-2"/> Top Losers</h3>
                      <div className="space-y-3">
                        {topLosers.map(coin => <MarketMoverCard key={coin.id} coin={coin} />)}
                     </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Market Trends</h2>
                    <p className="text-sm text-gray-500">Live synthesis of what's driving the crypto market.</p>
                </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
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