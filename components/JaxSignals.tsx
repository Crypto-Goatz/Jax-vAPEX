import React, { useState, useEffect, useMemo } from 'react';
import { signalsService, AvailableSignal, SignalEvent } from '../services/signalsService';
import { getSmartSignalSearch } from '../services/geminiService';
import { CryptoPrice } from '../services/cryptoService';
import { LoadingSpinner } from './LoadingSpinner';
import { SearchIcon, BellIcon, TrendingUpIcon, TrendingDownIcon, ClockIcon } from './Icons';

// --- HELPER ---
const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    const fractionDigits = (Math.abs(value) > 0 && Math.abs(value) < 1) ? 6 : 2;
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: fractionDigits
    });
};

// --- SUB-COMPONENTS ---

const SignalEventCard: React.FC<{
    event: SignalEvent;
    livePrice: number | undefined;
}> = ({ event, livePrice }) => {
    const { signal, triggeredAt, triggeredPrice } = event;
    const isBuySignal = signal.trade_direction === 'buy';
    
    let performance = 0;
    let performanceColor = 'text-gray-400';
    if (livePrice !== undefined) {
        performance = ((livePrice - triggeredPrice) / triggeredPrice) * 100;
        if (!isBuySignal) performance *= -1; // Invert for shorts
        if (performance > 0.01) performanceColor = 'text-green-400';
        if (performance < -0.01) performanceColor = 'text-red-400';
    }

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 space-y-3 animate-fade-in-down">
            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center font-bold text-purple-400 text-lg flex-shrink-0">
                    {signal.affected_asset.charAt(0)}
                </div>
                <div>
                    <p className="font-bold text-white">{signal.affected_asset}</p>
                    <p className="text-xs text-gray-400">{signal.title}</p>
                </div>
            </div>
            
            <p className="text-sm text-gray-300 italic">"{signal.description.split('. Shall I')[0]}"</p>

            <div className="pt-3 border-t border-gray-700/50 grid grid-cols-2 gap-3 text-sm">
                <div>
                    <p className="text-xs text-gray-400">Triggered At</p>
                    <p className="font-mono text-white">{formatCurrency(triggeredPrice)}</p>
                </div>
                 <div className="text-right">
                    <p className="text-xs text-gray-400">Performance</p>
                    <p className={`font-mono font-bold text-lg ${performanceColor}`}>
                        {performance >= 0 ? '+' : ''}{performance.toFixed(2)}%
                    </p>
                </div>
            </div>
            <div className="text-xs text-gray-500 flex items-center justify-end space-x-1">
                <ClockIcon className="w-3 h-3"/>
                <span>{new Date(triggeredAt).toLocaleString()}</span>
            </div>
        </div>
    );
};


// --- MAIN COMPONENT ---
interface JaxSignalsProps {
    allCoins: CryptoPrice[];
}

export const JaxSignals: React.FC<JaxSignalsProps> = ({ allCoins }) => {
    const [activatedSignals, setActivatedSignals] = useState<AvailableSignal[]>([]);
    const [signalEvents, setSignalEvents] = useState<SignalEvent[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [filteredSignalIds, setFilteredSignalIds] = useState<string[] | null>(null);
    const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

    useEffect(() => {
        const updateState = () => {
            setActivatedSignals(signalsService.getActivatedSignals());
            setSignalEvents(signalsService.getSignalEvents());
        };
        signalsService.subscribe(updateState);
        updateState(); // Initial load
        return () => signalsService.unsubscribe(updateState);
    }, []);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredSignalIds(null);
            return;
        }

        const handler = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await getSmartSignalSearch(searchQuery, activatedSignals);
                setFilteredSignalIds(results);
            } catch (error) {
                console.error("Smart search failed:", error);
                setFilteredSignalIds([]); // Show no results on error
            } finally {
                setIsSearching(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(handler);
    }, [searchQuery, activatedSignals]);

    const displayedSignals = useMemo(() => {
        if (filteredSignalIds === null) {
            return activatedSignals;
        }
        return activatedSignals.filter(signal => filteredSignalIds.includes(signal.id));
    }, [activatedSignals, filteredSignalIds]);
    
    const displayedEvents = useMemo(() => {
        if (selectedSignalId === null) {
            return signalEvents;
        }
        return signalEvents.filter(event => event.signal.id === selectedSignalId);
    }, [signalEvents, selectedSignalId]);

    const livePriceMap = useMemo(() => new Map(allCoins.map(c => [c.symbol.toUpperCase(), c.price])), [allCoins]);

    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">Jax Signals</h2>
                <p className="text-sm text-gray-400">Live feed of your activated AI-driven market signals.</p>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Left Column: Signal Library */}
                <div className="w-full md:w-1/3 lg:w-1/4 p-4 border-b md:border-b-0 md:border-r border-gray-700 flex flex-col">
                    <h3 className="text-lg font-bold text-purple-400 mb-2">Signal Library</h3>
                    <div className="relative mb-4">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><LoadingSpinner /></div>}
                        <input
                            type="text"
                            placeholder="AI Smart Search (e.g., 'ETH spikes')"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 pl-10 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2">
                        {displayedSignals.map(signal => (
                            <button
                                key={signal.id}
                                onClick={() => setSelectedSignalId(prev => prev === signal.id ? null : signal.id)}
                                className={`w-full text-left p-3 rounded-lg transition-colors border-l-4 ${selectedSignalId === signal.id ? 'bg-purple-600/20 border-purple-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-700/50'}`}
                            >
                                <p className="font-semibold text-white">{signal.title}</p>
                                <p className="text-xs text-gray-400">{signal.affected_asset} based on {signal.trigger_asset}</p>
                            </button>
                        ))}
                         {filteredSignalIds !== null && displayedSignals.length === 0 && (
                            <div className="text-center p-4 text-sm text-gray-500">No signals match your search.</div>
                         )}
                    </div>
                </div>

                {/* Right Column: Active Signal Feed */}
                <div className="flex-1 p-4 overflow-y-auto">
                    <h3 className="text-lg font-bold text-purple-400 mb-4">
                        {selectedSignalId ? 'Filtered Signal Events' : 'Live Signal Feed'}
                    </h3>
                    {displayedEvents.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {displayedEvents.map(event => (
                                <SignalEventCard 
                                    key={event.eventId} 
                                    event={event} 
                                    livePrice={livePriceMap.get(event.signal.affected_asset.toUpperCase())}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                             <BellIcon className="w-12 h-12 mb-3 text-gray-600"/>
                             <p className="font-semibold">Awaiting Signal Events</p>
                             <p className="text-sm">When an activated signal's conditions are met, it will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
             <style>{`
                @keyframes fade-in-down {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-down {
                animation: fade-in-down 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};
