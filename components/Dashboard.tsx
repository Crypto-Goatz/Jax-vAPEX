
import React, { useState, useMemo } from 'react';
import type { CryptoPrice, NewsSentiment } from '../services/cryptoService';
import type { MacroData } from '../services/macroService';
import { watchlistService } from '../services/watchlistService';
import { tradeSimulatorService } from '../services/tradeSimulatorService';
import { ExternalLinkIcon, CloseIcon } from './Icons';
import { LoadingSpinner } from './LoadingSpinner';

// --- HELPER ---
const formatCompact = (value: number) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2 }).format(value);
const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatCurrency = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });


// --- CARD SUB-COMPONENTS ---

const MarketOverviewCard: React.FC<{ allCoins: CryptoPrice[] }> = ({ allCoins }) => {
    const btc = allCoins.find(c => c.symbol === 'BTC');
    const eth = allCoins.find(c => c.symbol === 'ETH');
    const movers = useMemo(() => {
        if (allCoins.length < 5) return [];
        const sorted = [...allCoins].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
        return sorted.slice(0, 5);
    }, [allCoins]);
    const pipelineScore = tradeSimulatorService.getSettings().aiConfidence;

    return (
        <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 shadow-lg h-full flex flex-col">
            <h3 className="text-xl font-bold text-white mb-4">Market Overview</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
                {btc && <CoinStat coin={btc} />}
                {eth && <CoinStat coin={eth} />}
            </div>
            <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Top Movers (24h)</h4>
                <ul className="space-y-2">
                    {movers.map(coin => <MoverRow key={coin.id} coin={coin} />)}
                </ul>
            </div>
            <div className="mt-auto pt-4">
                <p className="text-sm text-gray-400">AI Pipeline Confidence</p>
                <p className="text-3xl font-bold text-blue-400">{pipelineScore.toFixed(1)}%</p>
            </div>
        </div>
    );
};

const CoinStat: React.FC<{ coin: CryptoPrice }> = ({ coin }) => {
    const isUp = coin.change24h >= 0;
    return (
        <div>
            <p className="text-lg font-semibold text-gray-200">{coin.symbol}</p>
            <p className="font-mono text-xl font-bold text-white">{formatCurrency(coin.price)}</p>
            <p className={`font-mono font-semibold text-sm ${isUp ? 'text-green-400' : 'text-red-400'}`}>{isUp ? '+' : ''}{coin.change24h.toFixed(2)}%</p>
        </div>
    );
};

const MoverRow: React.FC<{ coin: CryptoPrice }> = ({ coin }) => {
    const isUp = coin.change24h >= 0;
    return (
        <li className="flex justify-between items-center text-sm">
            <span className="font-semibold text-gray-300">{coin.symbol}</span>
            <span className={`font-mono font-semibold ${isUp ? 'text-green-400' : 'text-red-400'}`}>{isUp ? '+' : ''}{coin.change24h.toFixed(2)}%</span>
        </li>
    );
};

const MacroSnapshotCard: React.FC<{ macroData: MacroData | null }> = ({ macroData }) => (
    <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 shadow-lg h-full">
        <h3 className="text-xl font-bold text-white mb-4">Macro Snapshot</h3>
        {macroData ? (
            <div className="space-y-4">
                <MacroStat title="M2 Money Supply" value={`$${macroData.m2Supply}T`} color="text-green-400" />
                <MacroStat title="US Inflation Rate (CPI)" value={formatPercent(macroData.inflationRate)} color="text-green-400" />
                <MacroStat title="Fed Funds Rate" value={formatPercent(macroData.interestRate)} color="text-green-400" />
            </div>
        ) : <LoadingSpinner />}
    </div>
);

const MacroStat: React.FC<{ title: string; value: string; color: string; }> = ({ title, value, color }) => (
    <div>
        <p className="text-sm text-gray-400">{title}</p>
        <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
    </div>
);


const NewsHighlightsCard: React.FC<{ news: NewsSentiment | null }> = ({ news }) => (
    <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 shadow-lg h-full flex flex-col">
        <h3 className="text-xl font-bold text-white mb-4">News Highlights</h3>
        {news ? (
            <>
                <div className="bg-gradient-to-br from-purple-900/50 to-gray-800/30 p-4 rounded-lg border border-purple-700 mb-4">
                    <p className="text-sm font-semibold text-purple-400">Top Story</p>
                    <h4 className="font-bold text-white mt-1">{news.top_story.headline}</h4>
                    <a href={news.top_story.url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-300 hover:underline mt-2 inline-flex items-center gap-1">Read More <ExternalLinkIcon className="w-3 h-3"/></a>
                </div>
                <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Trending Narratives</h4>
                    <div className="space-y-2">
                        {news.trending_narratives.slice(0, 3).map((narrative, i) => (
                            <div key={i} className="bg-gray-700/50 p-2 rounded-md text-sm text-gray-300">{narrative}</div>
                        ))}
                    </div>
                </div>
                 <div className="mt-auto pt-4">
                    <p className="text-sm text-gray-400">Overall Sentiment Score</p>
                    <p className="text-3xl font-bold text-orange-400">{news.sentiment_score.toFixed(2)}</p>
                </div>
            </>
        ) : <LoadingSpinner />}
    </div>
);

const WatchlistCard: React.FC<{
    watchlist: string[];
    allCoins: CryptoPrice[];
    onCoinClick: (coin: CryptoPrice) => void;
}> = ({ watchlist, allCoins, onCoinClick }) => {
    const [newItem, setNewItem] = useState('');
    
    const watchlistData = useMemo(() => {
        return watchlist
            .map(symbol => allCoins.find(c => c.symbol.toUpperCase() === symbol.toUpperCase()))
            .filter((c): c is CryptoPrice => !!c);
    }, [watchlist, allCoins]);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newItem.trim()) {
            watchlistService.addToWatchlist(newItem);
            setNewItem('');
        }
    };
    
    return (
        <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 shadow-lg h-full flex flex-col">
            <h3 className="text-xl font-bold text-white mb-4">Personal Watchlist</h3>
            <div className="flex-grow space-y-2 mb-4">
                {watchlistData.slice(0, 5).map(coin => (
                    <button key={coin.id} onClick={() => onCoinClick(coin)} className="w-full text-left flex justify-between items-center bg-gray-700/50 p-2 rounded-md hover:bg-gray-700 transition-colors">
                        <div className="flex items-center gap-2">
                            <img src={`https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`} alt="" className="w-5 h-5 rounded-full"/>
                            <span className="font-semibold text-white">{coin.symbol}</span>
                        </div>
                        <div className="text-right">
                             <p className="font-mono text-white">{formatCurrency(coin.price)}</p>
                        </div>
                         <button onClick={(e) => { e.stopPropagation(); watchlistService.removeFromWatchlist(coin.symbol);}} className="p-1 text-gray-500 hover:text-red-400"><CloseIcon className="w-3 h-3"/></button>
                    </button>
                ))}
            </div>
            <form onSubmit={handleAdd} className="mt-auto flex gap-2">
                <input
                    type="text"
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    placeholder="Add symbol (e.g., SOL)"
                    className="flex-grow bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button type="submit" className="px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">Add</button>
            </form>
        </div>
    );
};

// --- MAIN DASHBOARD COMPONENT ---

interface DashboardProps {
    allCoins: CryptoPrice[];
    newsSentiment: NewsSentiment | null;
    macroData: MacroData | null;
    watchlist: string[];
    onShowCoinDetail: (coin: CryptoPrice) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ allCoins, newsSentiment, macroData, watchlist, onShowCoinDetail }) => {
    if (allCoins.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                    <LoadingSpinner />
                    <p className="mt-2 text-purple-300">Loading market data...</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="w-full h-full p-2 md:p-0">
             <div className="mb-6 text-center">
                <h1 className="text-4xl font-bold text-white">JAX AI Hub</h1>
                <p className="text-lg text-gray-400">Your integrated crypto intelligence dashboard.</p>
             </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-6">
                <div className="2xl:col-span-1"><MarketOverviewCard allCoins={allCoins} /></div>
                <div className="2xl:col-span-1"><MacroSnapshotCard macroData={macroData} /></div>
                <div className="2xl:col-span-1"><NewsHighlightsCard news={newsSentiment} /></div>
                <div className="2xl:col-span-1"><WatchlistCard watchlist={watchlist} allCoins={allCoins} onCoinClick={onShowCoinDetail} /></div>
            </div>
        </div>
    );
};
