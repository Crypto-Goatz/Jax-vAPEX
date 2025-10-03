import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BtcHistoryEntry, Pattern, BacktestResult } from '../services/btcHistoryService';
import { CryptoPrice } from '../services/cryptoService';
import { btcHistoryService } from '../services/btcHistoryService';
import { patternHistoryService } from '../services/patternHistoryService';
import { scenarioService, Scenario, Condition } from '../services/scenarioService';
import { simulateSignalCondition } from '../services/geminiService';
import { LoadingSpinner } from './LoadingSpinner';
import { FlowChartIcon, PlayIcon, BookmarkIcon, TrashIcon, ShareIcon, CheckCircleIcon, LineChartIcon, ChatBubbleIcon, WalletIcon } from './Icons';

declare global {
  interface Window { Chart: any; }
}

// --- TYPE DEFINITIONS & CONSTANTS ---
interface SimulationResult {
  patternName: string;
  outcomeDescription: string;
  historicalOccurrences: number;
  confidenceScore: number;
}
const CONDITION_OPTIONS: { [key in Condition['type']]: { label: string; unit: string; } } = {
  price: { label: 'Price Change', unit: '%' },
  volatility: { label: 'Volatility Spike', unit: '%' },
  whale: { label: 'Whale Accumulation', unit: 'USD' },
  sentiment: { label: 'Social Sentiment', unit: '/100' },
};
const OUTCOME_TYPE_OPTIONS: { [key in Scenario['outcomeType']]: { label: string, icon: JSX.Element } } = {
    price: { label: 'Price Change', icon: <LineChartIcon className="w-5 h-5" /> },
    sentiment: { label: 'Sentiment', icon: <ChatBubbleIcon className="w-5 h-5" /> },
    whale: { label: 'Whale Activity', icon: <WalletIcon className="w-5 h-5" /> },
};


// --- HELPER FUNCTIONS ---
const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

// --- UI SUB-COMPONENTS ---
const MainChart: React.FC<{ history: BtcHistoryEntry[]; highlightDates: string[]; }> = ({ history, highlightDates }) => {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    if (chartCanvasRef.current && history.length > 0) {
      const ctx = chartCanvasRef.current.getContext('2d');
      if (ctx) {
        const annotations = highlightDates.reduce((acc, date) => {
          acc[`line-${date}`] = { type: 'line', xMin: date, xMax: date, borderColor: 'rgba(45, 212, 191, 0.7)', borderWidth: 2, borderDash: [5,5] };
          return acc;
        }, {} as any);

        chartInstanceRef.current = new window.Chart(ctx, {
          type: 'line',
          data: {
            labels: history.map(d => d.date),
            datasets: [{
              label: 'BTC Price',
              data: history.map(d => d.price),
              borderColor: 'rgba(168, 85, 247, 1)',
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              borderWidth: 2, pointRadius: 0, tension: 0.1, fill: true,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
              x: { grid: { color: 'rgba(0, 0, 0, 0.05)' }, ticks: { color: '#6b7280', maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
              y: { position: 'right', grid: { color: 'rgba(0, 0, 0, 0.05)' }, ticks: { color: '#6b7280', callback: (v: any) => `$${Number(v/1000).toFixed(0)}k` }}
            },
            plugins: {
              legend: { display: false },
              tooltip: { mode: 'index', intersect: false, backgroundColor: '#ffffff', titleColor: '#1f2937', bodyColor: '#4b5563', borderColor: '#e5e7eb', borderWidth: 1,},
              annotation: { annotations }
            }
          }
        });
      }
    }
    return () => { if (chartInstanceRef.current) chartInstanceRef.current.destroy(); };
  }, [history, highlightDates]);

  return <div className="w-full h-full"><canvas ref={chartCanvasRef}></canvas></div>;
};

// --- MAIN COMPONENT ---
interface SignalLabProps {
    btcHistory: BtcHistoryEntry[];
    allCoins: CryptoPrice[];
}

export const SignalLab: React.FC<SignalLabProps> = ({ btcHistory, allCoins }) => {
    const [mode, setMode] = useState<'backtest' | 'simulate'>('backtest');
    const [savedListMode, setSavedListMode] = useState<'patterns' | 'scenarios'>('patterns');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sortedCoins = useMemo(() => [...allCoins].sort((a, b) => a.name.localeCompare(b.name)), [allCoins]);

    const [backtestPattern, setBacktestPattern] = useState<Pattern>({ id: '', name: 'Custom Pattern', metric: 'dailyChange', operator: 'gt', value: 5, analysisWindow: 7 });
    const [savedPatterns, setSavedPatterns] = useState<Pattern[]>([]);
    const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);

    const [triggerCoinId, setTriggerCoinId] = useState<string | null>(null);
    const [condition, setCondition] = useState<Condition>({ type: 'price', operator: 'gt', value: 5, timeframe: '24h' });
    const [outcomeCoinId, setOutcomeCoinId] = useState<string | null>(null);
    const [outcomeType, setOutcomeType] = useState<Scenario['outcomeType']>('price');
    const [simulationResults, setSimulationResults] = useState<SimulationResult[] | null>(null);
    const [savedScenarios, setSavedScenarios] = useState<Scenario[]>([]);

    useEffect(() => {
        setSavedPatterns(patternHistoryService.getSavedPatterns());
        setSavedScenarios(scenarioService.getSavedScenarios());

        const updatePatterns = () => setSavedPatterns(patternHistoryService.getSavedPatterns());
        const updateScenarios = () => setSavedScenarios(scenarioService.getSavedScenarios());

        patternHistoryService.subscribe(updatePatterns);
        scenarioService.subscribe(updateScenarios);
        
        return () => {
            patternHistoryService.unsubscribe(updatePatterns);
            scenarioService.unsubscribe(updateScenarios);
        };
    }, []);

    const handleRunBacktest = useCallback(() => {
        setIsLoading(true);
        setBacktestResult(null);
        setTimeout(() => {
            const results = btcHistoryService.backtestPattern(backtestPattern);
            setBacktestResult(results);
            setIsLoading(false);
        }, 500);
    }, [backtestPattern]);

    const handleSavePattern = () => {
        const name = prompt("Enter a name for this pattern:", backtestPattern.name || 'New Pattern');
        if (name) {
            const newPattern = { ...backtestPattern, name, id: backtestPattern.id || Date.now().toString() };
            patternHistoryService.savePattern(newPattern);
        }
    };

    const handleRunSimulation = async () => {
        const triggerCoin = allCoins.find(c => c.id === triggerCoinId);
        const outcomeCoin = allCoins.find(c => c.id === outcomeCoinId);
        if (!triggerCoin || !outcomeCoin) return;

        setIsLoading(true);
        setError(null);
        setSimulationResults(null);
        
        const outcomeTypeLabels = { price: 'price change', sentiment: 'sentiment shift', whale: 'whale activity' };
        const rule = {
            if: { coin: triggerCoin.symbol, condition: condition.type, details: `${condition.operator === 'gt' ? 'increases by >' : 'decreases by <'} ${condition.value}${CONDITION_OPTIONS[condition.type].unit} in ${condition.timeframe}` },
            then: { coin: outcomeCoin.symbol, ask: `What is the likely outcome in terms of ${outcomeTypeLabels[outcomeType]}?` }
        };

        try {
            const response = await simulateSignalCondition(rule);
            setSimulationResults(response.results);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveScenario = () => {
        const name = prompt("Enter a name for this scenario:");
        if (name && triggerCoinId && outcomeCoinId) {
            const triggerCoin = allCoins.find(c => c.id === triggerCoinId);
            const outcomeCoin = allCoins.find(c => c.id === outcomeCoinId);
            if(triggerCoin && outcomeCoin) {
                const newScenario: Scenario = { id: Date.now().toString(), name, triggerCoinId, triggerCoinSymbol: triggerCoin.symbol, condition, outcomeCoinId, outcomeCoinSymbol: outcomeCoin.symbol, outcomeType };
                scenarioService.saveScenario(newScenario);
            }
        }
    };
    
    const highlightDates = useMemo(() => backtestResult?.matches.map(m => m.date) || [], [backtestResult]);
    const isSimulateReady = triggerCoinId && outcomeCoinId && condition.value > 0;
    
    return (
        <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><FlowChartIcon /> Signal Lab</h2>
                <p className="text-sm text-gray-500">Backtest historical patterns and simulate AI-powered 'If-Then' scenarios.</p>
            </div>
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 overflow-hidden bg-gray-50">
                <div className="lg:col-span-1 xl:col-span-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button onClick={() => setMode('backtest')} className={`flex-1 p-2 text-sm font-semibold rounded-md transition-colors ${mode === 'backtest' ? 'bg-purple-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'}`}>Backtest Mode</button>
                        <button onClick={() => setMode('simulate')} className={`flex-1 p-2 text-sm font-semibold rounded-md transition-colors ${mode === 'simulate' ? 'bg-purple-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'}`}>Simulate Mode</button>
                    </div>

                    {mode === 'backtest' ? (
                        <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-200">
                            <div>
                                <label className="text-sm font-semibold text-gray-500">WHEN BTC...</label>
                                <div className="flex gap-2 mt-1">
                                    <select value={backtestPattern.metric} onChange={e => setBacktestPattern(p => ({...p, metric: e.target.value as any}))} className="flex-grow bg-gray-100 p-2 rounded-md text-gray-800 border border-gray-300">
                                        <option value="dailyChange">Price Change</option>
                                        <option value="volatility">Volatility</option>
                                    </select>
                                    <select value={backtestPattern.operator} onChange={e => setBacktestPattern(p => ({...p, operator: e.target.value as any}))} className="bg-gray-100 p-2 rounded-md text-gray-800 border border-gray-300">
                                        <option value="gt">&gt;</option>
                                        <option value="lt">&lt;</option>
                                    </select>
                                    <div className="relative">
                                        <input type="number" value={backtestPattern.value} onChange={e => setBacktestPattern(p => ({...p, value: parseInt(e.target.value) || 0}))} className="w-20 bg-gray-100 p-2 rounded-md text-gray-800 text-center border border-gray-300" />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="analysisWindow" className="text-sm font-semibold text-gray-500">THEN, ANALYZE PERFORMANCE OVER...</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <input id="analysisWindow" type="number" value={backtestPattern.analysisWindow} onChange={e => setBacktestPattern(p => ({...p, analysisWindow: parseInt(e.target.value) || 0}))} className="w-20 bg-gray-100 p-2 rounded-md text-gray-800 text-center border border-gray-300" />
                                    <span className="text-gray-700">days</span>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={handleRunBacktest} disabled={isLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-400">
                                    {isLoading ? <LoadingSpinner /> : <PlayIcon className="w-5 h-5"/>} Run Backtest
                                </button>
                                <button onClick={handleSavePattern} title="Save Pattern" className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors border border-gray-300"><BookmarkIcon /></button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-200">
                            <div>
                                <label className="text-lg font-bold text-purple-700">IF</label>
                                <select value={triggerCoinId || ''} onChange={(e) => setTriggerCoinId(e.target.value)} className="mt-1 w-full bg-gray-100 border border-gray-300 rounded-lg p-2 text-gray-800 font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500">
                                    <option value="" disabled>Select a trigger asset...</option>
                                    {sortedCoins.map(coin => <option key={coin.id} value={coin.id}>{coin.name} ({coin.symbol})</option>)}
                                </select>
                            </div>
                             <div>
                                <label className="text-sm font-semibold text-gray-500">THE TRIGGER IS...</label>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <select value={condition.type} onChange={e => setCondition(c => ({ ...c, type: e.target.value as Condition['type'] }))} className="bg-gray-100 p-2 rounded-md text-gray-800 border border-gray-300"><option value="price">Price Change</option><option value="volatility">Volatility</option></select>
                                    <select value={condition.timeframe} onChange={e => setCondition(c => ({ ...c, timeframe: e.target.value as Condition['timeframe'] }))} className="bg-gray-100 p-2 rounded-md text-gray-800 border border-gray-300"><option value="24h">in 24 Hours</option><option value="7d">in 7 Days</option></select>
                                    <select value={condition.operator} onChange={e => setCondition(c => ({ ...c, operator: e.target.value as Condition['operator'] }))} className="bg-gray-100 p-2 rounded-md text-gray-800 border border-gray-300"><option value="gt">&gt;</option><option value="lt">&lt;</option></select>
                                    <div className="relative"><input type="number" value={condition.value} onChange={e => setCondition(c => ({ ...c, value: parseFloat(e.target.value) || 0 }))} className="w-full bg-gray-100 p-2 rounded-md text-gray-800 text-center border border-gray-300" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">{CONDITION_OPTIONS[condition.type].unit}</span></div>
                                </div>
                            </div>
                            <div>
                                <label className="text-lg font-bold text-purple-700">THEN</label>
                                <select value={outcomeCoinId || ''} onChange={(e) => setOutcomeCoinId(e.target.value)} className="mt-1 w-full bg-gray-100 border border-gray-300 rounded-lg p-2 text-gray-800 font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500">
                                    <option value="" disabled>Select an outcome asset...</option>
                                    {sortedCoins.map(coin => <option key={coin.id} value={coin.id}>{coin.name} ({coin.symbol})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-500">ANALYZE THE OUTCOME OF...</label>
                                 <div className="flex items-center gap-2 mt-1">
                                    {(Object.keys(OUTCOME_TYPE_OPTIONS) as Array<keyof typeof OUTCOME_TYPE_OPTIONS>).map((key) => {
                                        const {label, icon} = OUTCOME_TYPE_OPTIONS[key];
                                        return <button key={key} onClick={() => setOutcomeType(key)} className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-md border-2 transition-all ${outcomeType === key ? 'bg-purple-600 border-purple-400 text-white shadow-inner' : 'bg-gray-100 border-gray-300 hover:border-gray-400'}`}>{icon} {label}</button>;
                                    })}
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={handleRunSimulation} disabled={!isSimulateReady || isLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-400">
                                    {isLoading ? <LoadingSpinner /> : <PlayIcon className="w-5 h-5"/>} Run Simulation
                                </button>
                                <button onClick={handleSaveScenario} disabled={!isSimulateReady} title="Save Scenario" className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors border border-gray-300 disabled:opacity-50"><BookmarkIcon /></button>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex-grow space-y-2">
                        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                            <button onClick={() => setSavedListMode('patterns')} className={`flex-1 p-2 text-xs font-semibold rounded-md transition-colors ${savedListMode === 'patterns' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Patterns ({savedPatterns.length})</button>
                            <button onClick={() => setSavedListMode('scenarios')} className={`flex-1 p-2 text-xs font-semibold rounded-md transition-colors ${savedListMode === 'scenarios' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Scenarios ({savedScenarios.length})</button>
                        </div>
                        {savedListMode === 'patterns' && (savedPatterns.length > 0 ? savedPatterns.map(p => (
                            <div key={p.id} className="group flex items-center justify-between p-2 bg-white rounded-md hover:bg-gray-100/50 border border-gray-200">
                                <button onClick={() => { setMode('backtest'); setBacktestPattern(p); }} className="text-left flex-grow"><p className="font-semibold text-gray-800 text-sm">{p.name}</p><p className="text-xs text-gray-500 font-mono">BTC {p.metric} {p.operator === 'gt' ? '>' : '<'} {p.value}% → {p.analysisWindow}d</p></button>
                                <button onClick={() => patternHistoryService.deletePattern(p.id)} className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4"/></button>
                            </div>)) : <p className="text-sm text-gray-500 italic text-center p-4">No patterns saved.</p>)
                        }
                        {savedListMode === 'scenarios' && (savedScenarios.length > 0 ? savedScenarios.map(s => (
                            <div key={s.id} className="group flex items-center justify-between p-2 bg-white rounded-md hover:bg-gray-100/50 border border-gray-200">
                                <button onClick={() => { setMode('simulate'); setTriggerCoinId(s.triggerCoinId); setCondition(s.condition); setOutcomeCoinId(s.outcomeCoinId); setOutcomeType(s.outcomeType); }} className="text-left flex-grow"><p className="font-semibold text-gray-800 text-sm">{s.name}</p><p className="text-xs text-gray-500 font-mono">IF {s.triggerCoinSymbol} → THEN {s.outcomeCoinSymbol}</p></button>
                                <button onClick={() => scenarioService.deleteScenario(s.id)} className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4"/></button>
                            </div>)) : <p className="text-sm text-gray-500 italic text-center p-4">No scenarios saved.</p>)
                        }
                    </div>
                </div>

                <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-4 overflow-hidden">
                    <div className="flex-grow-[3] bg-white rounded-lg p-4 border border-gray-200 min-h-[300px] flex flex-col shadow-sm">
                        <h3 className="text-lg font-bold text-purple-700 mb-2">Historical BTC Price Chart</h3>
                        <div className="flex-grow w-full h-full"><MainChart history={btcHistory} highlightDates={highlightDates} /></div>
                    </div>
                    <div className="flex-grow-[2] overflow-y-auto pr-2 custom-scrollbar">
                        {isLoading ? <div className="flex items-center justify-center h-full text-center"><div className="flex flex-col items-center gap-2"><LoadingSpinner/><p className="text-purple-600 font-semibold">JAX AI is processing...</p></div></div> :
                         error ? <div className="text-center p-4 bg-red-100 text-red-700 rounded-lg">{error}</div> :
                         mode === 'backtest' && backtestResult ? <BacktestResults results={backtestResult} pattern={backtestPattern} /> :
                         mode === 'simulate' && simulationResults ? <SimulationResults results={simulationResults} /> :
                         <div className="flex items-center justify-center h-full text-gray-500">Run a backtest or simulation to see results here.</div>
                        }
                    </div>
                </div>
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }`}</style>
        </div>
    );
};

const BacktestResults: React.FC<{ results: BacktestResult; pattern: Pattern; }> = ({ results, pattern }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const { matches, summary } = results;
  const successRate = summary.total > 0 ? (summary.successes / summary.total) * 100 : 0;
  const avgPerf = summary.total > 0 ? summary.totalReturn / summary.total : 0;

  const handleShare = () => {
    const text = `📈 JAX AI Pattern Backtest Result:\nWHEN: BTC ${pattern.metric} ${pattern.operator === 'gt' ? '>' : '<'} ${pattern.value}%\nTHEN: The average performance over the next ${pattern.analysisWindow} days was ${formatPercent(avgPerf)}.\n(Found ${summary.total} historical instances with a ${successRate.toFixed(1)}% success rate)\n-- Analyzed by JaxSpot AI --`;
    navigator.clipboard.writeText(text.trim()).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-200 animate-fade-in-up shadow-sm">
      <div className="flex justify-between items-start"><h3 className="text-lg font-bold text-teal-700">Backtest Results</h3><button onClick={handleShare} className="flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors">{copySuccess ? <><CheckCircleIcon className="w-4 h-4 text-green-600"/> Copied!</> : <><ShareIcon className="w-4 h-4"/> Share</>}</button></div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><p className="text-xs text-gray-500">Instances</p><p className="text-xl font-bold font-mono text-gray-900">{summary.total}</p></div>
        <div><p className="text-xs text-gray-500">Success Rate</p><p className={`text-xl font-bold font-mono ${successRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>{successRate.toFixed(1)}%</p></div>
        <div><p className="text-xs text-gray-500">Avg. Perf.</p><p className={`text-xl font-bold font-mono ${avgPerf >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(avgPerf)}</p></div>
      </div>
      <div>
          <h4 className="text-sm font-semibold text-gray-500 mb-2">Matching Occurrences:</h4>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
            {matches.map(match => (
              <div key={match.date} className="flex justify-between items-center text-xs p-1 bg-gray-50 rounded"><span className="font-mono text-gray-700">{match.date}</span><span className={`font-mono font-semibold ${match.performance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(match.performance)}</span></div>
            ))}
          </div>
      </div>
    </div>
  );
};

const SimulationResults: React.FC<{ results: SimulationResult[]; }> = ({ results }) => (
    <div className="animate-fade-in-up">
        <h3 className="text-lg font-bold text-teal-700 mb-4">AI Simulation Results</h3>
        {results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((res, index) => {
                    const confidence = res.confidenceScore;
                    const confidenceColor = confidence > 75 ? 'bg-green-500' : confidence > 50 ? 'bg-yellow-500' : 'bg-red-500';
                    return (
                        <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col justify-between shadow-sm">
                            <div>
                                <h4 className="font-bold text-md text-purple-700">{res.patternName}</h4>
                                <p className="text-xl font-bold text-gray-900 my-2">{res.outcomeDescription}</p>
                            </div>
                            <div className="space-y-2 mt-3">
                                <div><p className="text-xs text-gray-500">Historical Occurrences</p><p className="font-mono text-lg font-bold text-gray-900">{res.historicalOccurrences}</p></div>
                                <div><p className="text-xs text-gray-500 mb-1">AI Confidence ({confidence.toFixed(0)}%)</p><div className="w-full bg-gray-200 rounded-full h-2"><div className={`${confidenceColor} h-2 rounded-full`} style={{ width: `${confidence}%` }}></div></div></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        ) : (
            <div className="text-center text-gray-500 bg-white p-6 rounded-lg border border-gray-200">
                <p className="font-semibold">No significant historical patterns found for this scenario.</p>
            </div>
        )}
    </div>
);