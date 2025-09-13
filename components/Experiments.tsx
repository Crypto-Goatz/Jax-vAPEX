
import React, { useState, useEffect, useMemo } from 'react';
import { learningService, Experiment, LogEntry } from '../services/learningService';
import { signalsService } from '../services/signalsService';
import { CryptoPrice } from '../services/cryptoService';
import { LoadingSpinner } from './LoadingSpinner';
import { ClockIcon, CheckCircleIcon, BeakerIcon, BellIcon, RecycleIcon, RefreshIcon, ActivityLogIcon } from './Icons';

// --- HELPER FUNCTIONS ---
const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || !isFinite(value)) {
        return '$0.00';
    }
    const fractionDigits = (Math.abs(value) > 0 && Math.abs(value) < 1) ? 6 : 2;
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: Math.max(2, fractionDigits)
    });
};

// --- SUB-COMPONENTS ---

const StatusPill: React.FC<{ status: Experiment['status'] }> = ({ status }) => {
    const baseClasses = "px-2.5 py-1 text-xs font-semibold rounded-full inline-flex items-center gap-1.5";
    switch (status) {
        case 'pending':
            return <div className={`${baseClasses} bg-gray-700 text-gray-300`}><ClockIcon className="w-3 h-3" /> Pending</div>;
        case 'running':
            return <div className={`${baseClasses} bg-blue-500/20 text-blue-300`}><LoadingSpinner /> Running</div>;
        case 'completed':
            return <div className={`${baseClasses} bg-purple-500/20 text-purple-300`}><CheckCircleIcon className="w-4 h-4" /> Completed</div>;
        default:
            return null;
    }
};

const DetailedDescription: React.FC<{ text: string; allCoins: CryptoPrice[] }> = ({ text, allCoins }) => {
    const coinMap = useMemo(() => new Map(allCoins.map(c => [c.symbol.toUpperCase(), c])), [allCoins]);

    const parts = useMemo(() => {
        const allSymbols = Array.from(coinMap.keys()).join('|');
        if (!allSymbols) return [text];

        // Regex to match asset symbols OR numbers with signs/symbols
        const regex = new RegExp(`\\b(${allSymbols})\\b|([+-]?\\s*\\$?\\d[\\d,.]*\\d%?)`, 'gi');
        
        return text.split(regex).filter(part => part);
    }, [text, coinMap]);

    return (
        <p className="text-sm text-gray-300 mt-2 leading-relaxed">
            {parts.map((part, index) => {
                if (!part) return null;
                const upperPart = part.toUpperCase();
                if (coinMap.has(upperPart)) {
                    const coin = coinMap.get(upperPart);
                    // FIX: Add a null check for 'coin' to prevent crash if map lookup fails unexpectedly.
                    if (coin) {
                        const logoUrl = `https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`;
                        return (
                            <span key={index} className="inline-flex items-center bg-gray-900/50 rounded-md px-1.5 py-0.5 mx-1 font-bold text-white align-middle">
                                <img src={logoUrl} alt={coin.symbol} className="w-4 h-4 mr-1.5 rounded-full" />
                                {coin.symbol}
                            </span>
                        );
                    }
                }
                // Check if it's a number part
                if (/[+-]?\s*\$?\d/.test(part)) {
                    const isPositive = /^[+]\s*|^\s*\d/.test(part) && !part.startsWith('-');
                    const isNegative = part.startsWith('-');
                    const color = isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-white';
                    return <span key={index} className={`font-mono font-bold ${color}`}>{part}</span>;
                }
                return <span key={index}>{part}</span>;
            })}
        </p>
    );
};

const ExperimentCard: React.FC<{
    experiment: Experiment;
    isSignalActivated: boolean;
    allCoins: CryptoPrice[];
}> = ({ experiment, isSignalActivated, allCoins }) => {
    const handleActivate = () => signalsService.activateSignalFromExperiment(experiment);
    const handleRecycle = () => learningService.recycleExperiment(experiment.id);
    const handleResume = () => learningService.resumeExperiment(experiment.id, allCoins);

    const isProfitable = (experiment.result?.pnl ?? 0) >= 0;

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col animate-fade-in-up">
            <div className="p-4">
                <div className="flex justify-between items-start gap-2">
                    <h3 className="text-lg font-bold text-white">{experiment.title}</h3>
                    <StatusPill status={experiment.status} />
                </div>
                <DetailedDescription text={experiment.description} allCoins={allCoins} />
                <p className="text-xs text-gray-500 mt-3">Approved: {new Date(experiment.approvedTimestamp).toLocaleString()}</p>
            </div>
            <div className="mt-auto bg-gray-900/50 p-3 border-t border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex-grow text-center sm:text-left">
                    {experiment.status === 'completed' ? (
                        <>
                            <p className="text-xs text-gray-400">Result (P/L)</p>
                            <p className={`text-2xl font-bold font-mono ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                                {formatCurrency(experiment.result?.pnl)}
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-gray-500 italic">Awaiting completion...</p>
                    )}
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                    {experiment.status === 'completed' && (
                        <>
                            {isProfitable ? (
                                isSignalActivated ? (
                                    <span className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-green-300 bg-green-500/10 rounded-full">
                                        <CheckCircleIcon className="w-4 h-4" /> Signal Active
                                    </span>
                                ) : (
                                    <button onClick={handleActivate} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-full transition-colors">
                                        <BellIcon className="w-4 h-4" /> Activate
                                    </button>
                                )
                            ) : (
                                <button onClick={handleRecycle} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-full transition-colors">
                                    <RecycleIcon className="w-4 h-4" /> Recycle
                                </button>
                            )}
                             <button onClick={handleResume} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-full transition-colors">
                                <RefreshIcon className="w-4 h-4" /> Resume
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const ActivityLog: React.FC<{ logs: LogEntry[] }> = ({ logs }) => (
    <div className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col h-full">
        <h3 className="text-lg font-bold text-purple-400 p-4 flex items-center gap-2 border-b border-gray-700">
            <ActivityLogIcon /> Activity Log
        </h3>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {logs.length > 0 ? logs.map(log => {
                const typeColor = log.type === 'success' ? 'bg-green-500' : log.type === 'failure' ? 'bg-red-500' : 'bg-gray-500';
                return (
                    <div key={log.id} className="flex items-start space-x-3 text-sm animate-fade-in-down">
                        <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${typeColor}`}></div>
                        <div>
                            <p className="text-gray-300">{log.message}</p>
                            <p className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                    </div>
                );
            }) : (
                <div className="text-center text-gray-500 pt-8">No activity yet.</div>
            )}
        </div>
    </div>
);


// --- MAIN COMPONENT ---
interface ExperimentsProps {
    allCoins: CryptoPrice[];
}

export const Experiments: React.FC<ExperimentsProps> = ({ allCoins }) => {
    const [experiments, setExperiments] = useState<Experiment[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [activatedSignalIds, setActivatedSignalIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const handleUpdate = () => {
            setExperiments(learningService.getExperiments());
            setActivatedSignalIds(new Set(signalsService.getActivatedSignals().map(s => s.id)));
            setLogs(learningService.getLogs());
        };

        learningService.subscribe(handleUpdate);
        signalsService.subscribe(handleUpdate);
        
        handleUpdate();

        return () => {
            learningService.unsubscribe(handleUpdate);
            signalsService.unsubscribe(handleUpdate);
        };
    }, []);

    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">AI Experiments & R&D</h2>
                <p className="text-sm text-gray-400">Tracking performance, iterating on patterns, and managing the activity log.</p>
            </div>

            <div className="flex-1 p-4 grid grid-cols-1 xl:grid-cols-3 gap-6 overflow-hidden">
                <div className="xl:col-span-2 overflow-y-auto pr-2 -mr-2">
                    <h3 className="text-lg font-bold text-purple-400 mb-4">Active & Pending Experiments</h3>
                    {experiments.length > 0 ? (
                        <div className="space-y-4">
                            {experiments.map(exp => (
                                <ExperimentCard 
                                    key={exp.id} 
                                    experiment={exp}
                                    isSignalActivated={activatedSignalIds.has(exp.id)}
                                    allCoins={allCoins}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                            <BeakerIcon className="w-12 h-12 mb-3 text-gray-600"/>
                            <p className="font-semibold">No experiments are running.</p>
                            <p className="text-sm">Approve a pattern from 'Active Learning' to start.</p>
                        </div>
                    )}
                </div>

                <div className="overflow-hidden h-full">
                    <ActivityLog logs={logs} />
                </div>
            </div>

            <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
                @keyframes fade-in-down {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-down { animation: fade-in-down 0.4s ease-out forwards; }
            `}</style>
        </div>
    );
};
