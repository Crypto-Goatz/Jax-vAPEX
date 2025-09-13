
import React, { useState, useMemo } from 'react';
import { CryptoPrice } from '../services/cryptoService';
import { simulateSignalCondition } from '../services/geminiService';
import { LoadingSpinner } from './LoadingSpinner';
import { FlowChartIcon, LineChartIcon, ChatBubbleIcon, WalletIcon } from './Icons';

// --- TYPE DEFINITIONS ---
type ConditionType = 'price' | 'volatility' | 'whale' | 'sentiment';
type Operator = 'gt' | 'lt';
type Timeframe = '1h' | '24h' | '7d';

interface Condition {
  type: ConditionType;
  operator: Operator;
  value: number;
  timeframe: Timeframe;
}

interface SimulationResult {
  patternName: string;
  outcomeDescription: string;
  historicalOccurrences: number;
  confidenceScore: number;
}

const CONDITION_OPTIONS: { [key in ConditionType]: { label: string; unit: string; } } = {
  price: { label: 'Price Change', unit: '%' },
  volatility: { label: 'Volatility Spike', unit: '%' },
  whale: { label: 'Whale Accumulation', unit: 'USD' },
  sentiment: { label: 'Social Sentiment', unit: '/100' },
};

// --- SUB-COMPONENTS ---

const CoinSelector: React.FC<{
    coins: CryptoPrice[];
    selectedCoinId: string | null;
    onSelect: (id: string) => void;
    placeholder?: string;
}> = ({ coins, selectedCoinId, onSelect, placeholder = "Select an asset..." }) => {
    return (
        <select
            value={selectedCoinId || ''}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
        >
            <option value="" disabled>{placeholder}</option>
            {coins.map(coin => (
                <option key={coin.id} value={coin.id}>
                    {coin.name} ({coin.symbol})
                </option>
            ))}
        </select>
    );
};

const ResultCard: React.FC<{ result: SimulationResult }> = ({ result }) => {
    const confidence = result.confidenceScore;
    const confidenceColor = confidence > 75 ? 'bg-green-500' : confidence > 50 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col justify-between animate-fade-in-up">
            <div>
                <h4 className="font-bold text-lg text-purple-300">{result.patternName}</h4>
                <p className="text-2xl font-bold text-white my-3">{result.outcomeDescription}</p>
            </div>
            <div className="space-y-3 mt-4">
                <div>
                    <p className="text-xs text-gray-400">Historical Occurrences</p>
                    <p className="font-mono text-xl font-bold text-white">{result.historicalOccurrences}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-400 mb-1">AI Confidence ({confidence.toFixed(0)}%)</p>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div className={`${confidenceColor} h-2.5 rounded-full`} style={{ width: `${confidence}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
export const SignalStudio: React.FC<{ allCoins: CryptoPrice[] }> = ({ allCoins }) => {
    const [triggerCoinId, setTriggerCoinId] = useState<string | null>(null);
    const [condition, setCondition] = useState<Condition>({ type: 'price', operator: 'gt', value: 5, timeframe: '24h' });
    const [outcomeCoinId, setOutcomeCoinId] = useState<string | null>(null);
    const [outcomeType, setOutcomeType] = useState<'price' | 'sentiment' | 'whale'>('price');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<SimulationResult[] | null>(null);

    const sortedCoins = useMemo(() => [...allCoins].sort((a, b) => a.name.localeCompare(b.name)), [allCoins]);

    const isReadyToSimulate = triggerCoinId && outcomeCoinId && condition.value > 0;

    const handleSimulate = async () => {
        if (!isReadyToSimulate) return;
        setIsLoading(true);
        setError(null);
        setResults(null);

        const triggerCoin = allCoins.find(c => c.id === triggerCoinId);
        const outcomeCoin = allCoins.find(c => c.id === outcomeCoinId);

        if (!triggerCoin || !outcomeCoin) {
            setError("Selected coins are not valid.");
            setIsLoading(false);
            return;
        }
        
        const outcomeTypeLabels = {
            price: 'price change',
            sentiment: 'sentiment shift',
            whale: 'whale activity'
        };

        const rule = {
            if: {
                coin: triggerCoin.symbol,
                condition: condition.type,
                details: `${condition.operator === 'gt' ? 'increases by >' : 'decreases by <'} ${condition.value}${CONDITION_OPTIONS[condition.type].unit} in ${condition.timeframe}`
            },
            then: {
                coin: outcomeCoin.symbol,
                ask: `What is the likely outcome in terms of ${outcomeTypeLabels[outcomeType]}?`
            }
        };

        try {
            const response = await simulateSignalCondition(rule);
            setResults(response.results);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred during simulation.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const resetSimulation = () => {
        setTriggerCoinId(null);
        setOutcomeCoinId(null);
        setCondition({ type: 'price', operator: 'gt', value: 5, timeframe: '24h' });
        setOutcomeType('price');
        setResults(null);
        setError(null);
        setIsLoading(false);
    };

    const OUTCOME_TYPE_OPTIONS = {
        price: { label: 'Price Change', icon: <LineChartIcon className="w-5 h-5" /> },
        sentiment: { label: 'Sentiment', icon: <ChatBubbleIcon className="w-5 h-5" /> },
        whale: { label: 'Whale Activity', icon: <WalletIcon className="w-5 h-5" /> },
    };

    const renderBuilder = () => (
        <div className="max-w-3xl mx-auto w-full space-y-8 animate-fade-in-up">
            {/* Step 1: IF */}
            <div className="space-y-4">
                <label className="text-4xl font-bold text-purple-400">IF</label>
                <CoinSelector coins={sortedCoins} selectedCoinId={triggerCoinId} onSelect={setTriggerCoinId} placeholder="Select a trigger asset..." />
            </div>

            {/* Step 2: THE TRIGGER */}
            {triggerCoinId && (
                <div className="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700 animate-fade-in-up">
                    <label className="text-2xl font-bold text-gray-300">The Trigger Is...</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <select
                            value={condition.type}
                            onChange={e => setCondition(c => ({ ...c, type: e.target.value as ConditionType }))}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            {Object.entries(CONDITION_OPTIONS).map(([key, { label }]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                        <select
                            value={condition.timeframe}
                            onChange={e => setCondition(c => ({ ...c, timeframe: e.target.value as Timeframe }))}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="1h">in 1 Hour</option>
                            <option value="24h">in 24 Hours</option>
                            <option value="7d">in 7 Days</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-4">
                         <select
                            value={condition.operator}
                            onChange={e => setCondition(c => ({ ...c, operator: e.target.value as Operator }))}
                            className="bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="gt">Greater than (&gt;)</option>
                            <option value="lt">Less than (&lt;)</option>
                        </select>
                        <div className="relative flex-grow">
                             <input
                                type="number"
                                value={condition.value}
                                onChange={e => setCondition(c => ({ ...c, value: parseFloat(e.target.value) || 0 }))}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 pl-3 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{CONDITION_OPTIONS[condition.type].unit}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: THEN */}
            {triggerCoinId && (
                <div className="space-y-4 animate-fade-in-up">
                    <label className="text-4xl font-bold text-purple-400">THEN</label>
                    <CoinSelector coins={sortedCoins} selectedCoinId={outcomeCoinId} onSelect={setOutcomeCoinId} placeholder="Select an outcome asset..." />
                </div>
            )}

            {/* NEW: Step 4: OUTCOME TYPE */}
            {outcomeCoinId && (
                <div className="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700 animate-fade-in-up">
                    <label className="text-2xl font-bold text-gray-300">Analyze The Outcome Based On...</label>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                        {(Object.keys(OUTCOME_TYPE_OPTIONS) as Array<keyof typeof OUTCOME_TYPE_OPTIONS>).map((key) => {
                            const option = OUTCOME_TYPE_OPTIONS[key];
                            const isSelected = outcomeType === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setOutcomeType(key)}
                                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                                        isSelected
                                            ? 'bg-purple-600 border-purple-400 text-white font-semibold'
                                            : 'bg-gray-700 border-gray-700 hover:border-gray-600 text-gray-300'
                                    }`}
                                >
                                    {option.icon}
                                    <span>{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {/* Action Button */}
            <div className="pt-4">
                <button
                    onClick={handleSimulate}
                    disabled={!isReadyToSimulate || isLoading}
                    className="w-full text-center px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xl shadow-lg hover:shadow-purple-500/40"
                >
                    {isLoading ? <LoadingSpinner /> : 'Simulate with JAX AI'}
                </button>
            </div>
        </div>
    );
    
    const renderResults = () => {
        if (!results) return null;
        const triggerCoin = allCoins.find(c => c.id === triggerCoinId);
        const outcomeCoin = allCoins.find(c => c.id === outcomeCoinId);
        const outcomeTypeLabels = {
            price: 'price change',
            sentiment: 'sentiment shift',
            whale: 'whale activity'
        };
        
        return (
            <div className="animate-fade-in-up">
                <div className="text-center mb-6">
                    <p className="text-gray-400">Showing simulation results for:</p>
                    <h3 className="text-xl md:text-2xl font-semibold text-white">
                        IF <span className="text-purple-300">{triggerCoin?.symbol}</span> {CONDITION_OPTIONS[condition.type].label.toLowerCase()} {condition.operator === 'gt' ? '>' : '<'} {condition.value}{CONDITION_OPTIONS[condition.type].unit}
                        , THEN what is the likely <span className="text-purple-300">{outcomeTypeLabels[outcomeType]}</span> for <span className="text-purple-300">{outcomeCoin?.symbol}</span>?
                    </h3>
                </div>

                {results.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {results.map((res, index) => <ResultCard key={index} result={res} />)}
                    </div>
                ) : (
                    <div className="text-center text-gray-500 bg-gray-800/50 p-8 rounded-lg">
                        <p className="font-semibold text-lg">No significant historical patterns found.</p>
                        <p>JAX AI could not find enough data for this specific scenario. Try a different condition or asset.</p>
                    </div>
                )}
                
                <div className="text-center mt-8">
                    <button onClick={resetSimulation} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors">
                        New Simulation
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <FlowChartIcon /> Signal Studio
                </h2>
                <p className="text-sm text-gray-400">Build and simulate 'If This, Then That' market scenarios with AI.</p>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <LoadingSpinner />
                        <p className="mt-4 font-semibold text-purple-300">JAX is searching petabytes of historical data...</p>
                        <p className="text-sm text-gray-400">Correlating on-chain events and calculating confidence scores.</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-red-400 bg-red-500/10 p-6 rounded-lg">
                        <p className="font-bold text-lg">Simulation Failed</p>
                        <p>{error}</p>
                         <button onClick={resetSimulation} className="mt-4 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors">
                            Try Again
                        </button>
                    </div>
                ) : results ? (
                    renderResults()
                ) : (
                    renderBuilder()
                )}
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
