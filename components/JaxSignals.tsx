import React, { useState, useEffect, useMemo } from 'react';
import { signalsService, AvailableSignal, SignalEvent } from '../services/signalsService';
import { BellIcon, CheckCircleIcon, SearchIcon } from './Icons';
import { CryptoPrice } from '../services/cryptoService';
import { getSmartSignalSearch } from '../services/geminiService';
import { LoadingSpinner } from './LoadingSpinner';

// Helper
const formatCurrency = (value: number | undefined | null) => {
    if (value === null || value === undefined) return "—";
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: Math.abs(value) > 0 && Math.abs(value) < 1 ? 6 : 2 });
}

// Signal Card
const ActivatedSignalCard: React.FC<{ signal: AvailableSignal; allCoins: CryptoPrice[] }> = ({ signal, allCoins }) => {
    const triggerCoin = allCoins.find(c => c.symbol.toUpperCase() === signal.trigger_asset.toUpperCase());
    const affectedCoin = allCoins.find(c => c.symbol.toUpperCase() === signal.affected_asset.toUpperCase());

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 animate-fade-in-up shadow-md">
            <div className="flex justify-between items-start">
                <h4 className="font-bold text-gray-900 text-lg">{signal.title}</h4>
                <span className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-green-800 bg-green-100 rounded-full">
                    <CheckCircleIcon className="w-4 h-4" /> Active
                </span>
            </div>
            <p className="text-sm text-gray-700 mt-2 italic">"{signal.description}"</p>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm border border-gray-200 space-y-1">
                <p>
                    <span className="font-bold text-purple-700">IF:</span>{" "}
                    <span className="font-semibold text-gray-800">{signal.trigger_asset}</span> shows pattern{" "}
                    {triggerCoin && (
                        <span className="ml-2 text-blue-600 font-mono">(Live {formatCurrency(triggerCoin.price)})</span>
                    )}
                </p>
                <p>
                    <span className="font-bold text-purple-700">THEN:</span>{" "}
                    <span className="font-semibold text-gray-800 uppercase">{signal.trade_direction}</span>{" "}
                    <span className="font-semibold text-gray-800">{signal.affected_asset}</span>{" "}
                    {affectedCoin && (
                        <span className="ml-2 text-blue-600 font-mono">(Live {formatCurrency(affectedCoin.price)})</span>
                    )}
                </p>
            </div>
        </div>
    );
};

// Event Row
const SignalEventRow: React.FC<{ event: SignalEvent; allCoins: CryptoPrice[] }> = ({ event, allCoins }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const livePrice = event.livePrice; // Use the price from the service

    const pnlSinceTrigger = useMemo(() => {
        if (typeof livePrice !== 'number') return null;
        const priceChange = livePrice - event.triggeredPrice;
        return event.signal.trade_direction.toUpperCase() === 'BUY' ? priceChange : -priceChange;
    }, [livePrice, event.triggeredPrice, event.signal.trade_direction]);

    const pnlPercentage = useMemo(() => {
        if (pnlSinceTrigger === null || event.triggeredPrice === 0) return null;
        return (pnlSinceTrigger / event.triggeredPrice) * 100;
    }, [pnlSinceTrigger, event.triggeredPrice]);

    return (
        <React.Fragment>
            <tr className="border-b border-gray-200 animate-fade-in-down hover:bg-gray-50">
                {/* Signal & Action */}
                <td className="p-3 align-top">
                    <p className="font-semibold text-gray-800">{event.signal.title}</p>
                    <p className="text-xs text-gray-500">{event.signal.affected_asset} → {event.signal.trade_direction.toUpperCase()}</p>
                </td>
                
                {/* Prices */}
                <td className="p-3 font-mono text-gray-700 align-top">
                    <div><span className="text-xs text-gray-500">Trigger:</span> {formatCurrency(event.triggeredPrice)}</div>
                    {typeof livePrice === 'number' && (
                        <div><span className="text-xs text-blue-600">Current:</span> {formatCurrency(livePrice)}</div>
                    )}
                </td>

                {/* Triggered At / P&L */}
                <td className="p-3 text-sm text-gray-500 align-top">
                    <div>{new Date(event.triggeredAt).toLocaleString()}</div>
                    {pnlSinceTrigger !== null && pnlPercentage !== null ? (
                        <div className={`font-semibold font-mono text-xs ${pnlSinceTrigger >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                           P/L: {pnlSinceTrigger >= 0 ? '+' : ''}{formatCurrency(pnlSinceTrigger)} ({pnlPercentage.toFixed(2)}%)
                        </div>
                    ) : (
                        <div className="text-xs text-gray-400">P/L: —</div>
                    )}
                </td>

                {/* Details Button */}
                <td className="p-3 text-center align-top">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)} 
                        className="px-3 py-1 text-xs font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-full transition-colors"
                    >
                        {isExpanded ? 'Hide' : 'Details'}
                    </button>
                </td>
            </tr>
            {isExpanded && (
                <tr className="animate-fade-in bg-gray-50">
                    <td colSpan={4} className="p-4 border-b border-gray-200">
                        <h5 className="font-bold text-sm text-purple-700">Trigger Condition Met:</h5>
                        <p className="text-sm text-gray-700 italic mt-1">"{event.signal.description}"</p>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
};


// Main Component
interface JaxSignalsProps {
    allCoins: CryptoPrice[];
}

export const JaxSignals: React.FC<JaxSignalsProps> = ({ allCoins }) => {
    const [activatedSignals, setActivatedSignals] = useState<AvailableSignal[]>([]);
    const [signalEvents, setSignalEvents] = useState<SignalEvent[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [filteredSignalIds, setFilteredSignalIds] = useState<Set<string> | null>(null);

    useEffect(() => {
        const handleUpdate = () => {
            setActivatedSignals(signalsService.getActivatedSignals());
            setSignalEvents(signalsService.getSignalEvents());
        };

        signalsService.subscribe(handleUpdate);
        handleUpdate();

        return () => signalsService.unsubscribe(handleUpdate);
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setFilteredSignalIds(null);
            return;
        }
        setIsSearching(true);
        try {
            const allSignals = signalsService.getActivatedSignals();
            const matchingIds = await getSmartSignalSearch(searchQuery, allSignals);
            setFilteredSignalIds(new Set(matchingIds));
        } catch (error) {
            console.error("Smart search failed:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setFilteredSignalIds(null);
    };

    const displayedSignals = filteredSignalIds === null
        ? activatedSignals
        : activatedSignals.filter(s => filteredSignalIds.has(s.id));

    return (
        <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><BellIcon /> Jax Signals</h2>
                <p className="text-sm text-gray-500">Monitor activated signals with live prices and event logs.</p>
            </div>

            <div className="flex-1 p-4 grid grid-cols-1 xl:grid-cols-2 gap-6 overflow-hidden bg-gray-50">
                {/* Activated Signals */}
                <div className="flex flex-col gap-4 overflow-hidden">
                    <h3 className="text-lg font-bold text-purple-700">Activated Signals ({displayedSignals.length})</h3>
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Smart search signals... (e.g., 'bullish BTC signals')"
                            className="w-full flex-grow bg-white border border-gray-300 rounded-lg p-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        <button type="submit" disabled={isSearching} className="px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors disabled:bg-gray-400">
                            {isSearching ? <LoadingSpinner /> : <SearchIcon />}
                        </button>
                    </form>
                    <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4">
                        {activatedSignals.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                                <BellIcon className="w-12 h-12 mb-3 text-gray-400"/>
                                <p className="font-semibold">No signals have been activated yet.</p>
                                <p className="text-sm">Promote a successful experiment from the 'Experiments' tab to activate a signal.</p>
                            </div>
                        ) : displayedSignals.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                                <p className="font-semibold">No signals found for "{searchQuery}".</p>
                                <button onClick={handleClearSearch} className="mt-2 text-sm text-purple-600 hover:underline">Clear search</button>
                            </div>
                        ) : (
                            displayedSignals.map(signal => (
                                <ActivatedSignalCard key={signal.id} signal={signal} allCoins={allCoins} />
                            ))
                        )}
                    </div>
                </div>

                {/* Signal Event Log */}
                <div className="flex flex-col overflow-hidden">
                    <h3 className="text-lg font-bold text-purple-700 mb-4">Signal Event Log</h3>
                    <div className="flex-1 overflow-y-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0">
                                <tr>
                                    <th className="p-3">Signal & Action</th>
                                    <th className="p-3">Prices</th>
                                    <th className="p-3">Triggered At / P&L</th>
                                    <th className="p-3 text-center">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {signalEvents.length > 0 ? (
                                    signalEvents.map(event => (
                                        <SignalEventRow key={event.eventId} event={event} allCoins={allCoins} />
                                    ))
                                ) : (
                                    <tr><td colSpan={4} className="text-center p-8 text-gray-500">Awaiting signal events...</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fade-in-up { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
                @keyframes fade-in-down { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-down { animation: fade-in-down 0.4s ease-out forwards; }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};