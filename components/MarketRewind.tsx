import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { btcHistoryService, BtcHistoryEntry, Pattern, BacktestResult } from '../services/btcHistoryService';
import { patternHistoryService } from '../services/patternHistoryService';
import { LoadingSpinner } from './LoadingSpinner';
import { RewindIcon, PlayIcon, BookmarkIcon, TrashIcon, ShareIcon, CheckCircleIcon } from './Icons';

declare global {
  interface Window { Chart: any; }
}

// --- HELPER FUNCTIONS ---
const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

// --- UI SUB-COMPONENTS ---

const MainChart: React.FC<{
  history: BtcHistoryEntry[];
  highlightDates: string[];
}> = ({ history, highlightDates }) => {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    if (chartCanvasRef.current && history.length > 0) {
      const ctx = chartCanvasRef.current.getContext('2d');
      if (ctx) {
        const annotations = highlightDates.reduce((acc, date) => {
          acc[`line-${date}`] = { type: 'line', xMin: date, xMax: date, borderColor: 'rgba(45, 212, 191, 0.7)', borderWidth: 1 };
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
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.1,
              fill: true,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
              x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
              y: { position: 'right', grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', callback: (v: any) => `$${Number(v/1000).toFixed(0)}k` }}
            },
            plugins: {
              legend: { display: false },
              tooltip: { mode: 'index', intersect: false },
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

const PatternLab: React.FC<{
  pattern: Pattern;
  setPattern: React.Dispatch<React.SetStateAction<Pattern>>;
  onRun: () => void;
  onSave: () => void;
  isLoading: boolean;
}> = ({ pattern, setPattern, onRun, onSave, isLoading }) => {

  const handleNumericChange = (field: 'value' | 'analysisWindow', value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      setPattern(p => ({ ...p, [field]: num }));
    }
  };

  return (
    <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
      <h3 className="text-lg font-bold text-purple-300">Jax Pattern Lab</h3>
      
      {/* WHEN */}
      <div>
        <label className="text-sm font-semibold text-gray-400">WHEN BTC...</label>
        <div className="flex gap-2 mt-1">
          <select value={pattern.metric} onChange={e => setPattern(p => ({...p, metric: e.target.value as any}))} className="flex-grow bg-gray-700 p-2 rounded-md text-white">
            <option value="dailyChange">Price Change</option>
            <option value="volatility">Volatility</option>
          </select>
           <select value={pattern.operator} onChange={e => setPattern(p => ({...p, operator: e.target.value as any}))} className="bg-gray-700 p-2 rounded-md text-white">
            <option value="gt">&gt;</option>
            <option value="lt">&lt;</option>
          </select>
          <div className="relative">
            <input type="number" value={pattern.value} onChange={e => handleNumericChange('value', e.target.value)} className="w-20 bg-gray-700 p-2 rounded-md text-white text-center" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">%</span>
          </div>
        </div>
      </div>

      {/* THEN */}
      <div>
        <label htmlFor="analysisWindow" className="text-sm font-semibold text-gray-400">THEN, ANALYZE PERFORMANCE OVER...</label>
        <div className="flex items-center gap-2 mt-1">
          <input id="analysisWindow" type="number" value={pattern.analysisWindow} onChange={e => handleNumericChange('analysisWindow', e.target.value)} className="w-20 bg-gray-700 p-2 rounded-md text-white text-center" />
          <span className="text-gray-300">days</span>
        </div>
      </div>
      
      {/* ACTIONS */}
      <div className="flex gap-2 pt-2">
        <button onClick={onRun} disabled={isLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-600">
          {isLoading ? <LoadingSpinner /> : <PlayIcon className="w-5 h-5"/>} Run Backtest
        </button>
        <button onClick={onSave} title="Save Pattern" className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
          <BookmarkIcon />
        </button>
      </div>
    </div>
  );
};


const BacktestResults: React.FC<{ 
  results: BacktestResult | null; 
  pattern: Pattern;
}> = ({ results, pattern }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  
  if (!results) return null;

  const { matches, summary } = results;
  const successRate = summary.total > 0 ? (summary.successes / summary.total) * 100 : 0;
  const avgPerf = summary.total > 0 ? summary.totalReturn / summary.total : 0;

  const handleShare = () => {
    const text = `
📈 JAX AI Pattern Backtest Result:
WHEN: BTC ${pattern.metric} ${pattern.operator === 'gt' ? '>' : '<'} ${pattern.value}%
THEN: The average performance over the next ${pattern.analysisWindow} days was ${formatPercent(avgPerf)}.
(Found ${summary.total} historical instances with a ${successRate.toFixed(1)}% success rate)
-- Analyzed by JaxSpot AI --
    `.trim();
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700 animate-fade-in-up">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-bold text-teal-300">Backtest Results</h3>
        <button onClick={handleShare} className="flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors">
          {copySuccess ? <><CheckCircleIcon className="w-4 h-4 text-green-400"/> Copied!</> : <><ShareIcon className="w-4 h-4"/> Share</>}
        </button>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
            <p className="text-xs text-gray-400">Instances</p>
            <p className="text-xl font-bold font-mono text-white">{summary.total}</p>
        </div>
        <div>
            <p className="text-xs text-gray-400">Success Rate</p>
            <p className={`text-xl font-bold font-mono ${successRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{successRate.toFixed(1)}%</p>
        </div>
        <div>
            <p className="text-xs text-gray-400">Avg. Perf.</p>
            <p className={`text-xl font-bold font-mono ${avgPerf >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(avgPerf)}</p>
        </div>
      </div>
      
      {/* Individual Matches */}
      <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Matching Occurrences:</h4>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
            {matches.map(match => (
              <div key={match.date} className="flex justify-between items-center text-xs p-1 bg-gray-800 rounded">
                <span className="font-mono text-gray-300">{match.date}</span>
                <span className={`font-mono font-semibold ${match.performance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(match.performance)}</span>
              </div>
            ))}
          </div>
      </div>
    </div>
  );
};


// --- MAIN COMPONENT ---
export const MarketRewind: React.FC = () => {
    const [history, setHistory] = useState<BtcHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState(false);
    
    const [pattern, setPattern] = useState<Pattern>({ id: '', name: 'Custom Pattern', metric: 'dailyChange', operator: 'gt', value: 5, analysisWindow: 7 });
    const [savedPatterns, setSavedPatterns] = useState<Pattern[]>([]);
    const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);

    // Load initial data and saved patterns
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                await btcHistoryService.init();
                setHistory(btcHistoryService.getBtcHistory());
                setSavedPatterns(patternHistoryService.getSavedPatterns());
            } catch (e) { console.error("Failed to load historical data:", e); }
            finally { setIsLoading(false); }
        };
        loadData();
    }, []);

    const handleRunBacktest = useCallback(() => {
        setIsTesting(true);
        setBacktestResult(null);
        setTimeout(() => { // Simulate computation time for better UX
            const results = btcHistoryService.backtestPattern(pattern);
            setBacktestResult(results);
            setIsTesting(false);
        }, 500);
    }, [pattern]);

    const handleSavePattern = () => {
        const name = prompt("Enter a name for this pattern:", pattern.name);
        if (name) {
            const newPattern = { ...pattern, id: Date.now().toString(), name };
            patternHistoryService.savePattern(newPattern);
            setSavedPatterns(patternHistoryService.getSavedPatterns());
        }
    };
    
    const handleLoadPattern = (p: Pattern) => {
        setPattern(p);
        setBacktestResult(null);
    };

    const handleDeletePattern = (id: string) => {
        if (window.confirm("Are you sure you want to delete this pattern?")) {
            patternHistoryService.deletePattern(id);
            setSavedPatterns(patternHistoryService.getSavedPatterns());
        }
    };
    
    const highlightDates = useMemo(() => backtestResult?.matches.map(m => m.date) || [], [backtestResult]);

    if (isLoading) {
        return <div className="w-full h-full flex items-center justify-center"><LoadingSpinner /></div>;
    }

    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2"><RewindIcon /> Jax AI Time Machine</h2>
                <p className="text-sm text-gray-400">Backtest historical market patterns to uncover insights.</p>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 overflow-hidden">
                {/* Left Control Panel */}
                <div className="lg:col-span-1 xl:col-span-1 flex flex-col gap-4 overflow-y-auto pr-2">
                    <PatternLab pattern={pattern} setPattern={setPattern} onRun={handleRunBacktest} onSave={handleSavePattern} isLoading={isTesting} />
                    
                    {/* Saved Patterns */}
                    <div className="flex-grow space-y-2">
                        <h3 className="text-lg font-bold text-purple-300">Saved Patterns</h3>
                        {savedPatterns.length > 0 ? savedPatterns.map(p => (
                            <div key={p.id} className="group flex items-center justify-between p-2 bg-gray-800 rounded-md hover:bg-gray-700/50">
                                <button onClick={() => handleLoadPattern(p)} className="text-left flex-grow">
                                    <p className="font-semibold text-white text-sm">{p.name}</p>
                                    <p className="text-xs text-gray-400 font-mono">
                                        BTC {p.metric} {p.operator === 'gt' ? '>' : '<'} {p.value}% → {p.analysisWindow}d
                                    </p>
                                </button>
                                <button onClick={() => handleDeletePattern(p.id)} className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <TrashIcon className="w-4 h-4"/>
                                </button>
                            </div>
                        )) : <p className="text-sm text-gray-500 italic text-center p-4">No patterns saved yet.</p>}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-4 overflow-hidden">
                    <div className="flex-grow-[2] bg-gray-900/50 rounded-lg p-4 border border-gray-700 min-h-[300px]">
                        <h3 className="text-lg font-bold text-purple-300 mb-2">Historical BTC Price</h3>
                        <MainChart history={history} highlightDates={highlightDates} />
                    </div>
                    <div className="flex-grow-[1] overflow-y-auto pr-2">
                        {isTesting 
                            ? <div className="flex items-center justify-center h-full"><LoadingSpinner/></div>
                            : <BacktestResults results={backtestResult} pattern={pattern} />
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};
