import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { btcHistoryService, BtcHistoryEntry, Pattern, BacktestResult } from '../services/btcHistoryService';
import { patternHistoryService } from '../services/patternHistoryService';
import { analyzeBtcPatterns } from '../services/geminiService';
import { LoadingSpinner } from './LoadingSpinner';
import { RewindIcon, PlayIcon, BookmarkIcon, TrashIcon, ShareIcon, CheckCircleIcon, BrainIcon, CloseIcon } from './Icons';

declare global {
  interface Window { Chart: any; }
}

// --- HELPER FUNCTIONS ---
const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const formatCurrency = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const formatAiResponse = (content: string) => {
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-teal-300">$1</strong>')
        .replace(/(\r\n|\n|\r)/g, '<br />');
};

// --- TYPE DEFINITIONS ---
interface InspectorData {
    eventsOnDate: BtcHistoryEntry[];
    metrics: BtcHistoryEntry | null;
    surroundingEvents: { before: BtcHistoryEntry[], after: BtcHistoryEntry[] };
}

// --- UI SUB-COMPONENTS ---

const MainChart: React.FC<{
  history: BtcHistoryEntry[];
  highlightDates: string[];
  selectedDate: string | null;
}> = ({ history, highlightDates, selectedDate }) => {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    if (chartCanvasRef.current && history.length > 0) {
      const ctx = chartCanvasRef.current.getContext('2d');
      if (ctx) {
        const annotations: any = {};
        
        highlightDates.forEach(date => {
            annotations[`line-match-${date}`] = { type: 'line', xMin: date, xMax: date, borderColor: 'rgba(45, 212, 191, 0.5)', borderWidth: 1, borderDash: [3, 3] };
        });

        if (selectedDate) {
             annotations[`line-selected-${selectedDate}`] = { type: 'line', xMin: selectedDate, xMax: selectedDate, borderColor: 'rgba(250, 204, 21, 1)', borderWidth: 2 };
        }

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
  }, [history, highlightDates, selectedDate]);

  return <div className="w-full h-full"><canvas ref={chartCanvasRef}></canvas></div>;
};

const InspectorPanel: React.FC<{
    date: string;
    data: InspectorData;
    onClose: () => void;
}> = ({ date, data, onClose }) => {
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAnalyze = async () => {
        const mainEvent = data.eventsOnDate[0];
        if (!mainEvent) return;
        
        setIsAnalyzing(true);
        setAiAnalysis(null);
        try {
            const dataSlice = btcHistoryService.getDataSlice(date, 7, 'before');
            const analysis = await analyzeBtcPatterns(dataSlice, date, mainEvent.eventType);
            setAiAnalysis(analysis);
        } catch (error) {
            setAiAnalysis("Sorry, the AI analysis failed. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const mainEvent = data.eventsOnDate[0];

    return (
        <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700 animate-fade-in-up h-full flex flex-col">
            <div className="flex justify-between items-center flex-shrink-0">
                <h3 className="text-lg font-bold text-yellow-300">Inspector: {new Date(date + 'T12:00:00Z').toDateString()}</h3>
                <button onClick={onClose} className="p-1 text-gray-400 hover:text-white"><CloseIcon/></button>
            </div>
            
            <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                 {/* Event Details */}
                <div>
                    <h4 className="font-semibold text-gray-300">Event Details</h4>
                    {data.eventsOnDate.length > 0 ? (
                        data.eventsOnDate.map((event, i) => (
                             <p key={i} className="text-sm text-white bg-gray-800 p-2 rounded-md mt-1">{event.eventType}</p>
                        ))
                    ): <p className="text-sm text-gray-500 italic">No significant event recorded on this day.</p>}
                </div>

                {/* Market Snapshot */}
                {data.metrics && (
                     <div>
                        <h4 className="font-semibold text-gray-300">Market Snapshot</h4>
                        <div className="grid grid-cols-3 gap-2 text-center mt-1 text-sm">
                            <div className="bg-gray-800 p-2 rounded-md"><p className="text-xs text-gray-400">Price</p><p className="font-mono font-semibold text-white">{formatCurrency(data.metrics.price)}</p></div>
                            <div className="bg-gray-800 p-2 rounded-md"><p className="text-xs text-gray-400">24h Change</p><p className="font-mono font-semibold text-white">{formatPercent(data.metrics.dailyChange)}</p></div>
                            <div className="bg-gray-800 p-2 rounded-md"><p className="text-xs text-gray-400">Volatility</p><p className="font-mono font-semibold text-white">{formatPercent(data.metrics.volatility)}</p></div>
                        </div>
                    </div>
                )}
               
                {/* AI Analysis */}
                {mainEvent && (
                    <div>
                        <h4 className="font-semibold text-gray-300">AI Precursor Analysis</h4>
                        <div className="mt-1 p-3 bg-gray-800 rounded-md">
                            {aiAnalysis ? (
                                <div className="text-sm text-gray-300 space-y-2" dangerouslySetInnerHTML={{ __html: formatAiResponse(aiAnalysis) }}></div>
                            ) : (
                                <button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-600">
                                    {isAnalyzing ? <LoadingSpinner /> : <BrainIcon />} {isAnalyzing ? 'Analyzing...' : `Analyze Precursors to "${mainEvent.eventType}"`}
                                </button>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Contextual Events */}
                <div>
                    <h4 className="font-semibold text-gray-300">Contextual Events</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                        <div>
                            <p className="text-center text-gray-400 mb-1">Before</p>
                            {data.surroundingEvents.before.map(e => <p key={e.date} className="p-1 bg-gray-800 rounded-md mb-1 truncate" title={e.eventType}>{e.date}: {e.eventType}</p>)}
                        </div>
                        <div>
                            <p className="text-center text-gray-400 mb-1">After</p>
                             {data.surroundingEvents.after.map(e => <p key={e.date} className="p-1 bg-gray-800 rounded-md mb-1 truncate" title={e.eventType}>{e.date}: {e.eventType}</p>)}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};


// --- MAIN COMPONENT ---
export const MarketRewind: React.FC<{ btcHistory: BtcHistoryEntry[] }> = ({ btcHistory }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    
    const [pattern, setPattern] = useState<Pattern>({ id: '', name: 'Custom Pattern', metric: 'dailyChange', operator: 'gt', value: 5, analysisWindow: 7 });
    const [savedPatterns, setSavedPatterns] = useState<Pattern[]>([]);
    const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
    const [timeframe, setTimeframe] = useState<'30D' | '90D' | '1Y' | 'ALL'>('1Y');
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [inspectorData, setInspectorData] = useState<InspectorData | null>(null);
    const dateRange = useMemo(() => btcHistoryService.getDateRange(), [btcHistory]);

    useEffect(() => {
        const updatePatterns = () => setSavedPatterns(patternHistoryService.getSavedPatterns());
        patternHistoryService.subscribe(updatePatterns);
        updatePatterns();
        return () => patternHistoryService.unsubscribe(updatePatterns);
    }, []);

    const handleRunBacktest = useCallback(() => {
        setIsTesting(true);
        setBacktestResult(null);
        setSelectedDate(null);
        setInspectorData(null);
        setTimeout(() => {
            const results = btcHistoryService.backtestPattern(pattern);
            setBacktestResult(results);
            setIsTesting(false);
        }, 500);
    }, [pattern]);

    const handleSavePattern = () => {
        const name = prompt("Enter a name for this pattern:", pattern.name || 'New Pattern');
        if (name) {
            const newPattern = { ...pattern, name, id: pattern.id || Date.now().toString() };
            patternHistoryService.savePattern(newPattern);
        }
    };
    
    const handleLoadPattern = (p: Pattern) => {
        setPattern(p);
        setBacktestResult(null);
        setSelectedDate(null);
        setInspectorData(null);
    };

    const handleDeletePattern = (id: string) => {
        if (window.confirm("Are you sure you want to delete this pattern?")) {
            patternHistoryService.deletePattern(id);
        }
    };

    const handleDateSelect = (date: string) => {
        if (!date) {
            setSelectedDate(null);
            setInspectorData(null);
            return;
        }
        setSelectedDate(date);
        setBacktestResult(null); // Clear backtest results when inspecting a date
        setInspectorData({
            eventsOnDate: btcHistoryService.getDataForDate(date).filter(e => e.eventType),
            metrics: btcHistoryService.getDataForDate(date)[0] || null,
            surroundingEvents: btcHistoryService.getSurroundingEvents(date, 3)
        });
    };
    
    const highlightDates = useMemo(() => backtestResult?.matches.map(m => m.date) || [], [backtestResult]);
    const filteredHistory = useMemo(() => {
        const history = btcHistory;
        if (timeframe === 'ALL' || !history.length) return history;
        const endDate = new Date(history[history.length - 1].date);
        const startDate = new Date(endDate);
        let days = 0;
        if (timeframe === '30D') days = 30;
        else if (timeframe === '90D') days = 90;
        else if (timeframe === '1Y') days = 365;
        startDate.setDate(endDate.getDate() - days);
        return history.filter(d => new Date(d.date) >= startDate);
    }, [btcHistory, timeframe]);

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
                <div className="lg:col-span-1 xl:col-span-1 flex flex-col gap-4 overflow-y-auto pr-2">
                    <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <h3 className="text-lg font-bold text-purple-300">Jax Pattern Lab</h3>
                        <div>
                            <label className="text-sm font-semibold text-gray-400">WHEN BTC...</label>
                            <div className="flex gap-2 mt-1">
                                <select value={pattern.metric} onChange={e => setPattern(p => ({...p, metric: e.target.value as any}))} className="flex-grow bg-gray-700 p-2 rounded-md text-white"><option value="dailyChange">Price Change</option><option value="volatility">Volatility</option></select>
                                <select value={pattern.operator} onChange={e => setPattern(p => ({...p, operator: e.target.value as any}))} className="bg-gray-700 p-2 rounded-md text-white"><option value="gt">&gt;</option><option value="lt">&lt;</option></select>
                                <div className="relative"><input type="number" value={pattern.value} onChange={e => setPattern(p => ({...p, value: parseInt(e.target.value) || 0}))} className="w-20 bg-gray-700 p-2 rounded-md text-white text-center" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">%</span></div>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="analysisWindow" className="text-sm font-semibold text-gray-400">THEN, ANALYZE PERFORMANCE OVER...</label>
                            <div className="flex items-center gap-2 mt-1"><input id="analysisWindow" type="number" value={pattern.analysisWindow} onChange={e => setPattern(p => ({...p, analysisWindow: parseInt(e.target.value) || 0}))} className="w-20 bg-gray-700 p-2 rounded-md text-white text-center" /><span className="text-gray-300">days</span></div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleRunBacktest} disabled={isTesting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-600">{isTesting ? <LoadingSpinner /> : <PlayIcon className="w-5 h-5"/>} Run Backtest</button>
                            <button onClick={handleSavePattern} title="Save Pattern" className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"><BookmarkIcon /></button>
                        </div>
                    </div>
                    <div className="flex-grow space-y-2">
                        <h3 className="text-lg font-bold text-purple-300">Saved Patterns</h3>
                        {savedPatterns.length > 0 ? savedPatterns.map(p => (
                            <div key={p.id} className="group flex items-center justify-between p-2 bg-gray-800 rounded-md hover:bg-gray-700/50">
                                <button onClick={() => handleLoadPattern(p)} className="text-left flex-grow"><p className="font-semibold text-white text-sm">{p.name}</p><p className="text-xs text-gray-400 font-mono">BTC {p.metric} {p.operator === 'gt' ? '>' : '<'} {p.value}% → {p.analysisWindow}d</p></button>
                                <button onClick={() => handleDeletePattern(p.id)} className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4"/></button>
                            </div>)) : <p className="text-sm text-gray-500 italic text-center p-4">No patterns saved yet.</p>}
                    </div>
                </div>

                <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-4 overflow-hidden">
                    <div className="flex-grow-[2] bg-gray-900/50 rounded-lg p-4 border border-gray-700 min-h-[300px] flex flex-col">
                        <div className="flex justify-between items-center mb-2 flex-shrink-0 flex-wrap gap-2">
                            <h3 className="text-lg font-bold text-purple-300">Historical BTC Price</h3>
                            <div className="flex items-center space-x-2">
                                <input type="date" value={selectedDate || ''} onChange={(e) => handleDateSelect(e.target.value)} min={dateRange.min} max={dateRange.max} className="bg-gray-700 text-white p-1 rounded-md border border-gray-600 text-xs"/>
                                {(['30D', '90D', '1Y', 'ALL'] as const).map(tf => (<button key={tf} onClick={() => setTimeframe(tf)} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeframe === tf ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>{tf}</button>))}
                            </div>
                        </div>
                        <div className="flex-grow w-full h-full">
                           <MainChart history={filteredHistory} highlightDates={highlightDates} selectedDate={selectedDate} />
                        </div>
                    </div>
                    <div className="flex-grow-[1] overflow-hidden">
                        {isTesting ? <div className="flex items-center justify-center h-full"><LoadingSpinner/></div> :
                         inspectorData && selectedDate ? <InspectorPanel date={selectedDate} data={inspectorData} onClose={() => { setSelectedDate(null); setInspectorData(null); }} /> :
                         backtestResult ? <BacktestResults results={backtestResult} pattern={pattern} /> :
                         <div className="flex items-center justify-center h-full text-gray-500">Run a backtest or select a date to inspect.</div>
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

const BacktestResults: React.FC<{ results: BacktestResult | null; pattern: Pattern; }> = ({ results, pattern }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  
  if (!results) return null;

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
    <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700 animate-fade-in-up">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-bold text-teal-300">Backtest Results</h3>
        <button onClick={handleShare} className="flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors">
          {copySuccess ? <><CheckCircleIcon className="w-4 h-4 text-green-400"/> Copied!</> : <><ShareIcon className="w-4 h-4"/> Share</>}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><p className="text-xs text-gray-400">Instances</p><p className="text-xl font-bold font-mono text-white">{summary.total}</p></div>
        <div><p className="text-xs text-gray-400">Success Rate</p><p className={`text-xl font-bold font-mono ${successRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{successRate.toFixed(1)}%</p></div>
        <div><p className="text-xs text-gray-400">Avg. Perf.</p><p className={`text-xl font-bold font-mono ${avgPerf >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(avgPerf)}</p></div>
      </div>
      <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Matching Occurrences:</h4>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
            {matches.map(match => (<div key={match.date} className="flex justify-between items-center text-xs p-1 bg-gray-800 rounded"><span className="font-mono text-gray-300">{match.date}</span><span className={`font-mono font-semibold ${match.performance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPercent(match.performance)}</span></div>))}
          </div>
      </div>
    </div>
  );
};
