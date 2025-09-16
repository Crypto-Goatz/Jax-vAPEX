import React, { useState, useEffect } from 'react';
import { tradeSimulatorService, Trade, WalletSettings } from '../services/tradeSimulatorService';
import { CloseIcon, LineChartIcon } from './Icons';
import { CryptoChartModal } from './CryptoChartModal';
import { LoadingSpinner } from './LoadingSpinner';


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

const formatDuration = (milliseconds: number | null | undefined): string => {
    if (milliseconds === null || milliseconds === undefined || milliseconds < 0) return 'N/A';

    let seconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(seconds / (3600 * 24));
    seconds -= days * 3600 * 24;
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;

    if (days > 0) {
        return `${days}d ${hours}h`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
};


const MetricCard: React.FC<{ title: string; value: string; description: string }> = ({ title, value, description }) => (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
);

const CloseReasonPill: React.FC<{ reason: Trade['closeReason'] }> = ({ reason }) => {
    if (!reason) return <span className="text-gray-400">N/A</span>;

    let colors = 'bg-gray-700 text-gray-300';
    if (reason === 'Take Profit') {
        colors = 'bg-green-500/20 text-green-300';
    } else if (reason === 'Stop Loss') {
        colors = 'bg-red-500/20 text-red-300';
    } else if (reason === 'Time Limit') {
        colors = 'bg-yellow-500/20 text-yellow-300';
    }

    return (
        <span className={`px-2 py-1 text-xs font-semibold rounded-md ${colors}`}>
            {reason}
        </span>
    );
};

const TradeRow: React.FC<{ 
    trade: Trade; 
    type: 'open' | 'closed'; 
    onViewChart?: () => void;
}> = ({ trade, type, onViewChart }) => {
    const isBuy = trade.direction === 'buy';
    const pnl = trade.pnl ?? 0;
    const isProfit = pnl >= 0;
    const pnlColor = isProfit ? 'text-green-400' : 'text-red-400';
    const pnlPercentage = trade.sizeUSD !== 0 ? (pnl / trade.sizeUSD) * 100 : 0;

    const commonCells = (
        <>
            <td className="p-3">
                <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center font-bold text-purple-400 text-xs">
                        {trade.coin.symbol.charAt(0)}
                    </div>
                    <div>
                        <p className="font-semibold text-white text-sm">{trade.coin.name}</p>
                        <p className="text-xs text-gray-400">{trade.coin.symbol}</p>
                    </div>
                </div>
            </td>
            <td className="p-3 font-mono text-gray-300">{formatCurrency(trade.sizeUSD)}</td>
            <td className="p-3">
                <span className={`px-2 py-1 text-xs font-semibold rounded-md ${isBuy ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {trade.direction.toUpperCase()}
                </span>
            </td>
            <td className="p-3 font-mono text-gray-300">{formatCurrency(trade.entryPrice)}</td>
        </>
    );

    const pnlCell = (
        <td className="p-3 font-mono">
            <div className="flex flex-col">
                <span className={`font-bold ${pnlColor}`}>{formatCurrency(pnl)}</span>
                <span className={`text-xs ${pnlColor}`}>
                    ({isProfit ? '+' : ''}{pnlPercentage.toFixed(2)}%)
                </span>
            </div>
        </td>
    );

    if (type === 'open') {
        const { takeProfitPrice, stopLossPrice } = tradeSimulatorService.getTakeProfitStopLoss(trade);
        return (
            <tr className="border-b border-gray-700 hover:bg-gray-800/50 cursor-pointer" onClick={onViewChart}>
                {commonCells}
                <td className="p-3 font-mono text-green-400">{formatCurrency(takeProfitPrice)}</td>
                <td className="p-3 font-mono text-red-400">{formatCurrency(stopLossPrice)}</td>
                {pnlCell}
                <td className="p-3 text-gray-400 text-sm">{new Date(trade.openTimestamp).toLocaleString()}</td>
                <td className="p-3 text-center">
                    <button
                        onClick={(e) => {
                            e.stopPropagation(); // prevent row click from firing twice
                            onViewChart?.();
                        }}
                        className="p-2 text-gray-400 hover:text-purple-400 hover:bg-gray-700 rounded-full transition-colors"
                        aria-label={`View chart for ${trade.coin.symbol} trade`}
                    >
                        <LineChartIcon className="w-5 h-5" />
                    </button>
                </td>
            </tr>
        );
    }

    // type === 'closed'
    return (
        <tr 
            className="border-b border-gray-700 hover:bg-gray-800/50 cursor-pointer"
            onClick={onViewChart}
        >
            {commonCells}
            <td className="p-3 font-mono text-gray-300">{formatCurrency(trade.closePrice)}</td>
            {pnlCell}
            <td className="p-3 text-gray-400 text-sm">{new Date(trade.openTimestamp).toLocaleString()}</td>
            <td className="p-3 text-gray-400 text-sm">{trade.closeTimestamp ? new Date(trade.closeTimestamp).toLocaleString() : 'N/A'}</td>
            <td className="p-3 text-gray-400 text-sm"><CloseReasonPill reason={trade.closeReason} /></td>
            <td className="p-3 text-gray-400 text-sm font-mono">{formatDuration(trade.closeTimestamp ? trade.closeTimestamp - trade.openTimestamp : null)}</td>
            <td className="p-3 text-center">
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // prevent row click (expand) from firing
                        onViewChart?.();
                    }}
                    className="p-2 text-gray-400 hover:text-purple-400 hover:bg-gray-700 rounded-full transition-colors"
                    aria-label={`View chart for ${trade.coin.symbol} trade`}
                >
                    <LineChartIcon className="w-5 h-5" />
                </button>
            </td>
        </tr>
    );
};

// --- MOBILE CARD COMPONENTS ---
const OpenPositionCard: React.FC<{ trade: Trade; onViewChart: () => void; }> = ({ trade, onViewChart }) => {
    const pnl = trade.pnl ?? 0;
    const isProfit = pnl >= 0;
    const pnlColor = isProfit ? 'text-green-400' : 'text-red-400';
    const isBuy = trade.direction === 'buy';
    const { takeProfitPrice, stopLossPrice } = tradeSimulatorService.getTakeProfitStopLoss(trade);
    const pnlPercentage = trade.sizeUSD !== 0 ? (pnl / trade.sizeUSD) * 100 : 0;
    
    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center font-bold text-purple-400 text-sm">{trade.coin.symbol.charAt(0)}</div>
                        <div>
                            <p className="font-bold text-white">{trade.coin.name} <span className="text-gray-400">({trade.coin.symbol})</span></p>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${isBuy ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                               {trade.direction.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Unrealized P/L</p>
                        <p className={`font-mono font-bold text-lg ${pnlColor}`}>{formatCurrency(pnl)}</p>
                        <p className={`font-mono text-sm ${pnlColor}`}>({isProfit ? '+' : ''}{pnlPercentage.toFixed(2)}%)</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-400">Size:</span> <span className="font-mono text-white">{formatCurrency(trade.sizeUSD)}</span></div>
                    <div><span className="text-gray-400">Entry:</span> <span className="font-mono text-white">{formatCurrency(trade.entryPrice)}</span></div>
                    <div><span className="text-green-400">Take Profit:</span> <span className="font-mono text-white">{formatCurrency(takeProfitPrice)}</span></div>
                    <div><span className="text-red-400">Stop Loss:</span> <span className="font-mono text-white">{formatCurrency(stopLossPrice)}</span></div>
                </div>
                 <p className="text-xs text-gray-500 pt-2 border-t border-gray-700/50">Opened: {new Date(trade.openTimestamp).toLocaleString()}</p>
            </div>
            <div className="p-2 bg-gray-800/50 border-t border-gray-700/50 flex items-center justify-end">
                 <button
                    onClick={onViewChart}
                    className="flex items-center space-x-2 px-3 py-1.5 text-sm text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-md transition-colors"
                >
                    <LineChartIcon className="w-4 h-4" />
                    <span>View Chart</span>
                </button>
            </div>
        </div>
    );
};

const ClosedTradeCard: React.FC<{ 
    trade: Trade; 
    onViewChart: () => void;
}> = ({ trade, onViewChart }) => {
    const pnl = trade.pnl ?? 0;
    const isProfit = pnl >= 0;
    const pnlColor = isProfit ? 'text-green-400' : 'text-red-400';
    const isBuy = trade.direction === 'buy';
    const pnlPercentage = trade.sizeUSD !== 0 ? (pnl / trade.sizeUSD) * 100 : 0;

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden cursor-pointer" onClick={onViewChart}>
            <div className="p-4 space-y-3">
                 <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center font-bold text-purple-400 text-sm">{trade.coin.symbol.charAt(0)}</div>
                        <div>
                            <p className="font-bold text-white">{trade.coin.name} <span className="text-gray-400">({trade.coin.symbol})</span></p>
                             <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${isBuy ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                {trade.direction.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Realized P/L</p>
                        <p className={`font-mono font-bold text-lg ${pnlColor}`}>{formatCurrency(pnl)}</p>
                         <p className={`font-mono text-sm ${pnlColor}`}>({isProfit ? '+' : ''}{pnlPercentage.toFixed(2)}%)</p>
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    <div><span className="text-gray-400">Size:</span> <span className="font-mono text-white">{formatCurrency(trade.sizeUSD)}</span></div>
                    <div><span className="text-gray-400">Reason:</span> <CloseReasonPill reason={trade.closeReason} /></div>
                    <div><span className="text-gray-400">Entry:</span> <span className="font-mono text-white">{formatCurrency(trade.entryPrice)}</span></div>
                    <div><span className="text-gray-400">Close:</span> <span className="font-mono text-white">{formatCurrency(trade.closePrice)}</span></div>
                    <div className="col-span-2"><span className="text-gray-400">Hold Time:</span> <span className="font-mono text-white">{formatDuration(trade.closeTimestamp ? trade.closeTimestamp - trade.openTimestamp : null)}</span></div>
                </div>
            </div>
            <div className="p-2 bg-gray-800/50 border-t border-gray-700/50 flex items-center justify-end">
                 <button
                    onClick={(e) => { e.stopPropagation(); onViewChart(); }}
                    className="flex items-center space-x-2 px-3 py-1.5 text-sm text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-md transition-colors"
                >
                    <LineChartIcon className="w-4 h-4" />
                    <span>View Chart</span>
                </button>
            </div>
        </div>
    );
};


export const SimulatedWallet: React.FC = () => {
    const [allTrades, setAllTrades] = useState<Trade[]>(tradeSimulatorService.getAllTrades());
    const [settings, setSettings] = useState<WalletSettings>(tradeSimulatorService.getSettings());
    const [tradeForChart, setTradeForChart] = useState<Trade | null>(null);
    const [webhookTestStatus, setWebhookTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');


    useEffect(() => {
        const updateState = () => {
            setAllTrades([...tradeSimulatorService.getAllTrades()]);
            setSettings(tradeSimulatorService.getSettings());
        };
        tradeSimulatorService.subscribe(updateState);
        updateState(); // Initial load
        return () => tradeSimulatorService.unsubscribe(updateState);
    }, []);
    
    const openTrades = allTrades.filter(t => t.status === 'open');
    const closedTrades = allTrades.filter(t => t.status === 'closed');
    
    const startingBalance = 100000;
    const totalPnl = closedTrades.reduce((acc, trade) => acc + (trade.pnl ?? 0), 0);
    const openPnl = openTrades.reduce((acc, trade) => acc + (trade.pnl ?? 0), 0);
    const portfolioBalance = startingBalance + totalPnl + openPnl;
    const wins = closedTrades.filter(t => (t.pnl ?? 0) >= 0).length;
    const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
    const aiConfidence = settings.aiConfidence;

    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        let finalValue: string | number | boolean;
        if (type === 'range' || (type === 'number' && name === 'aiConfidence')) {
            finalValue = parseFloat(value);
        } else if (type === 'checkbox') {
            finalValue = (e.target as HTMLInputElement).checked;
        } else {
            finalValue = value;
        }

        tradeSimulatorService.updateSettings({ [name]: finalValue });
    };

    const handleTestWebhook = async () => {
        setWebhookTestStatus('testing');
        try {
            await tradeSimulatorService.testWebhook();
            setWebhookTestStatus('success');
        } catch (error) {
            setWebhookTestStatus('error');
        } finally {
            setTimeout(() => setWebhookTestStatus('idle'), 3000);
        }
    };
    
    const handleResetWallet = () => {
        if(window.confirm("Are you sure you want to reset all trades and settings? This action cannot be undone.")) {
            tradeSimulatorService.resetWallet();
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
             <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-white">AI Simulated Wallet</h2>
                    <p className="text-sm text-gray-400">Live performance tracking of the JaxSpot prediction pipeline.</p>
                </div>
            </div>

            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 border-b border-gray-700">
                <MetricCard 
                    title="Portfolio Balance" 
                    value={formatCurrency(portfolioBalance)} 
                    description={`${openTrades.length} open | Unrealized: ${formatCurrency(openPnl)}`}
                />
                <MetricCard 
                    title="Realized P/L" 
                    value={formatCurrency(totalPnl)}
                    description="From all closed trades"
                />
                <MetricCard 
                    title="Win Rate" 
                    value={`${winRate.toFixed(1)}%`}
                    description={`${wins} Wins / ${closedTrades.length - wins} Losses`}
                />
                <MetricCard 
                    title="Execution Confidence" 
                    value={`${aiConfidence.toFixed(1)}%`}
                    description="AI trade execution threshold"
                />
                 <MetricCard 
                    title="Closed Trades" 
                    value={closedTrades.length.toString()}
                    description={`${openTrades.length} positions currently open`}
                />
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-6">
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <h3 className="text-lg font-bold text-purple-400 mb-4">AI Trading Strategy & Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="riskTolerance" className="block text-sm font-medium text-gray-300 mb-1">Risk Tolerance</label>
                                <select id="riskTolerance" name="riskTolerance" value={settings.riskTolerance} onChange={handleSettingsChange} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                    <option>Conservative</option><option>Moderate</option><option>Aggressive</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="investmentStyle" className="block text-sm font-medium text-gray-300 mb-1">Investment Style</label>
                                <select id="investmentStyle" name="investmentStyle" value={settings.investmentStyle} onChange={handleSettingsChange} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                                    <option>Scalping</option><option>Day Trading</option><option>Swing Trading</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="aiConfidence" className="flex justify-between items-center text-sm font-medium text-gray-300 mb-1">
                                    <span>Execution Confidence</span>
                                    <span className="font-mono text-purple-300 text-base">{settings.aiConfidence.toFixed(1)}%</span>
                                </label>
                                <input id="aiConfidence" name="aiConfidence" type="range" min="50" max="95" step="0.1" value={settings.aiConfidence} onChange={handleSettingsChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer confidence-slider" />
                                <p className="text-xs text-gray-500 mt-1">Minimum AI confidence to auto-execute a trade from the pipeline.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                             <div>
                                <label htmlFor="webhookUrl" className="block text-sm font-medium text-gray-300 mb-1">Webhook URL (Optional)</label>
                                <input type="text" id="webhookUrl" name="webhookUrl" value={settings.webhookUrl} onChange={handleSettingsChange} placeholder="https://..." className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                             </div>
                             <div className="flex items-center justify-between">
                                <label htmlFor="webhookEnabled" className="flex items-center cursor-pointer">
                                    <input type="checkbox" id="webhookEnabled" name="webhookEnabled" checked={settings.webhookEnabled} onChange={handleSettingsChange} className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-purple-600 focus:ring-purple-500" />
                                    <span className="ml-2 text-sm text-gray-300">Enable Webhooks</span>
                                </label>
                                 <button onClick={handleTestWebhook} disabled={!settings.webhookUrl || !settings.webhookEnabled || webhookTestStatus !== 'idle'} className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-500/20 text-blue-300 hover:bg-blue-500/30">
                                    {webhookTestStatus === 'testing' ? <LoadingSpinner /> : webhookTestStatus === 'success' ? 'Success!' : webhookTestStatus === 'error' ? 'Failed!' : 'Test'}
                                </button>
                            </div>
                             <p className="text-xs text-gray-500 -mt-2">Sends a POST request with trade data when a trade is opened or closed.</p>
                        </div>
                    </div>
                     <div className="mt-6 pt-4 border-t border-gray-700/50 flex justify-end">
                        <button onClick={handleResetWallet} className="bg-red-600/20 hover:bg-red-600/30 text-red-300 font-bold py-2 px-4 rounded-lg transition-colors text-sm">
                            Reset Wallet & Settings
                        </button>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-purple-400 mb-2">Open Positions ({openTrades.length})</h3>
                    <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700 hidden md:block">
                       <table className="w-full text-sm text-left">
                            <thead className="bg-gray-700/50 text-xs text-gray-400 uppercase">
                                <tr>
                                    <th className="p-3">Asset</th>
                                    <th className="p-3">Size (USD)</th>
                                    <th className="p-3">Direction</th>
                                    <th className="p-3">Entry Price</th>
                                    <th className="p-3 text-green-400">Take Profit</th>
                                    <th className="p-3 text-red-400">Stop Loss</th>
                                    <th className="p-3">Unrealized P/L (%)</th>
                                    <th className="p-3">Opened At</th>
                                    <th className="p-3 text-center">Chart</th>
                                </tr>
                            </thead>
                            <tbody>
                                {openTrades.length > 0 ? (
                                    openTrades.map(trade => <TradeRow key={trade.id} trade={trade} type="open" onViewChart={() => setTradeForChart(trade)} />)
                                ) : (
                                    <tr><td colSpan={9} className="text-center p-4 text-gray-500">No open positions.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="md:hidden space-y-3">
                        {openTrades.length > 0 ? (
                            openTrades.map(trade => <OpenPositionCard key={trade.id} trade={trade} onViewChart={() => setTradeForChart(trade)} />)
                        ) : (
                            <div className="text-center p-4 text-gray-500 bg-gray-800 rounded-lg border border-gray-700">No open positions.</div>
                        )}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-purple-400 mb-2">Trade History ({closedTrades.length})</h3>
                    <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700 hidden md:block">
                        <table className="w-full text-sm text-left">
                             <thead className="bg-gray-700/50 text-xs text-gray-400 uppercase">
                                <tr>
                                    <th className="p-3">Asset</th>
                                    <th className="p-3">Size (USD)</th>
                                    <th className="p-3">Direction</th>
                                    <th className="p-3">Entry Price</th>
                                    <th className="p-3">Close Price</th>
                                    <th className="p-3">Realized P/L (%)</th>
                                    <th className="p-3">Opened At</th>
                                    <th className="p-3">Closed At</th>
                                    <th className="p-3">Close Reason</th>
                                    <th className="p-3">Hold Time</th>
                                    <th className="p-3 text-center">Chart</th>
                                </tr>
                            </thead>
                            <tbody>
                                 {closedTrades.length > 0 ? (
                                    closedTrades.map(trade => (
                                        <TradeRow 
                                            key={trade.id}
                                            trade={trade} 
                                            type="closed" 
                                            onViewChart={() => setTradeForChart(trade)}
                                        />
                                    ))
                                ) : (
                                    <tr><td colSpan={11} className="text-center p-4 text-gray-500">No trade history yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="md:hidden space-y-3">
                         {closedTrades.length > 0 ? (
                            closedTrades.map(trade => (
                                <ClosedTradeCard
                                    key={trade.id}
                                    trade={trade}
                                    onViewChart={() => setTradeForChart(trade)}
                                />
                            ))
                        ) : (
                            <div className="text-center p-4 text-gray-500 bg-gray-800 rounded-lg border border-gray-700">No trade history yet.</div>
                        )}
                    </div>
                </div>
            </div>
            {tradeForChart && (
                <CryptoChartModal 
                    trade={tradeForChart}
                    onClose={() => setTradeForChart(null)}
                />
            )}
            <style>{`
                .confidence-slider {
                    -webkit-appearance: none; appearance: none; width: 100%; height: 6px;
                    background: #374151; border-radius: 9999px; outline: none; opacity: 0.9; transition: opacity 0.2s;
                }
                .confidence-slider:hover { opacity: 1; }
                .confidence-slider::-webkit-slider-thumb {
                    -webkit-appearance: none; appearance: none; width: 20px; height: 20px;
                    background: #a855f7; cursor: pointer; border-radius: 9999px;
                    border: 3px solid #f9fafb; box-shadow: 0 0 5px rgba(168, 85, 247, 0.5);
                }
                .confidence-slider::-moz-range-thumb {
                    width: 20px; height: 20px; background: #a855f7; cursor: pointer;
                    border-radius: 9999px; border: 3px solid #f9fafb; box-shadow: 0 0 5px rgba(168, 85, 247, 0.5);
                }
            `}</style>
        </div>
    );
};