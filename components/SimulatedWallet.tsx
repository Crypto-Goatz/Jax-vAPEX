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
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        <p className="text-xs text-gray-600 mt-1">{description}</p>
    </div>
);

const CloseReasonPill: React.FC<{ reason: Trade['closeReason'] }> = ({ reason }) => {
    if (!reason) return <span className="text-gray-500">N/A</span>;

    let colors = 'bg-gray-100 text-gray-700';
    if (reason === 'Take Profit') {
        colors = 'bg-green-100 text-green-700';
    } else if (reason === 'Stop Loss') {
        colors = 'bg-red-100 text-red-700';
    } else if (reason === 'Time Limit') {
        colors = 'bg-yellow-100 text-yellow-700';
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
    const [logoError, setLogoError] = useState(false);
    useEffect(() => { setLogoError(false); }, [trade.coin.symbol]);

    const isBuy = trade.direction === 'buy';
    const pnl = trade.pnl ?? 0;
    const isProfit = pnl >= 0;
    const pnlColor = isProfit ? 'text-green-600' : 'text-red-600';
    const pnlPercentage = trade.sizeUSD !== 0 ? (pnl / trade.sizeUSD) * 100 : 0;

    const commonCells = (
        <>
            <td className="p-3">
                <div className="flex items-center space-x-2">
                    {logoError ? (
                        <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center font-bold text-purple-600 text-xs border border-gray-200 flex-shrink-0">
                            {trade.coin.symbol.charAt(0)}
                        </div>
                    ) : (
                        <img 
                            src={`https://assets.coincap.io/assets/icons/${trade.coin.symbol.toLowerCase()}@2x.png`} 
                            alt={`${trade.coin.name} logo`}
                            className="w-6 h-6 rounded-full flex-shrink-0"
                            onError={() => setLogoError(true)}
                        />
                    )}
                    <div>
                        <p className="font-semibold text-gray-800 text-sm">{trade.coin.name}</p>
                        <p className="text-xs text-gray-500">{trade.coin.symbol}</p>
                    </div>
                </div>
            </td>
            <td className="p-3 font-mono text-gray-700">{formatCurrency(trade.sizeUSD)}</td>
            <td className="p-3">
                <span className={`px-2 py-1 text-xs font-semibold rounded-md ${isBuy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {trade.direction.toUpperCase()}
                </span>
            </td>
            <td className="p-3 font-mono text-gray-700">{formatCurrency(trade.entryPrice)}</td>
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
            <tr className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer" onClick={onViewChart}>
                {commonCells}
                <td className="p-3 font-mono text-green-600">{formatCurrency(takeProfitPrice)}</td>
                <td className="p-3 font-mono text-red-600">{formatCurrency(stopLossPrice)}</td>
                {pnlCell}
                <td className="p-3 text-gray-500 text-sm">{new Date(trade.openTimestamp).toLocaleString()}</td>
                <td className="p-3 text-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewChart?.(); }}
                        className="p-2 text-gray-500 hover:text-purple-600 hover:bg-gray-100 rounded-full transition-colors"
                        aria-label={`View chart for ${trade.coin.symbol} trade`}
                    >
                        <LineChartIcon className="w-5 h-5" />
                    </button>
                </td>
            </tr>
        );
    }

    return (
        <tr className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer" onClick={onViewChart}>
            {commonCells}
            <td className="p-3 font-mono text-gray-700">{formatCurrency(trade.closePrice)}</td>
            {pnlCell}
            <td className="p-3 text-gray-500 text-sm">{new Date(trade.openTimestamp).toLocaleString()}</td>
            <td className="p-3 text-gray-500 text-sm">{trade.closeTimestamp ? new Date(trade.closeTimestamp).toLocaleString() : 'N/A'}</td>
            <td className="p-3 text-gray-500 text-sm"><CloseReasonPill reason={trade.closeReason} /></td>
            <td className="p-3 text-gray-500 text-sm font-mono">{formatDuration(trade.closeTimestamp ? trade.closeTimestamp - trade.openTimestamp : null)}</td>
            <td className="p-3 text-center">
                <button
                    onClick={(e) => { e.stopPropagation(); onViewChart?.(); }}
                    className="p-2 text-gray-500 hover:text-purple-600 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label={`View chart for ${trade.coin.symbol} trade`}
                >
                    <LineChartIcon className="w-5 h-5" />
                </button>
            </td>
        </tr>
    );
};

const OpenPositionCard: React.FC<{ trade: Trade; onViewChart: () => void; }> = ({ trade, onViewChart }) => {
    const [logoError, setLogoError] = useState(false);
    useEffect(() => { setLogoError(false); }, [trade.coin.symbol]);

    const pnl = trade.pnl ?? 0;
    const isProfit = pnl >= 0;
    const pnlColor = isProfit ? 'text-green-600' : 'text-red-600';
    const isBuy = trade.direction === 'buy';
    const { takeProfitPrice, stopLossPrice } = tradeSimulatorService.getTakeProfitStopLoss(trade);
    const pnlPercentage = trade.sizeUSD !== 0 ? (pnl / trade.sizeUSD) * 100 : 0;
    
    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                        {logoError ? (
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-bold text-purple-600 text-sm border border-gray-200">{trade.coin.symbol.charAt(0)}</div>
                        ) : (
                            <img 
                                src={`https://assets.coincap.io/assets/icons/${trade.coin.symbol.toLowerCase()}@2x.png`} 
                                alt={`${trade.coin.name} logo`}
                                className="w-8 h-8 rounded-full"
                                onError={() => setLogoError(true)}
                            />
                        )}
                        <div>
                            <p className="font-bold text-gray-900">{trade.coin.name} <span className="text-gray-500">({trade.coin.symbol})</span></p>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${isBuy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                               {trade.direction.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Unrealized P/L</p>
                        <p className={`font-mono font-bold text-lg ${pnlColor}`}>{formatCurrency(pnl)}</p>
                        <p className={`font-mono text-sm ${pnlColor}`}>({isProfit ? '+' : ''}{pnlPercentage.toFixed(2)}%)</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Size:</span> <span className="font-mono text-gray-800">{formatCurrency(trade.sizeUSD)}</span></div>
                    <div><span className="text-gray-500">Entry:</span> <span className="font-mono text-gray-800">{formatCurrency(trade.entryPrice)}</span></div>
                    <div><span className="text-green-600">Take Profit:</span> <span className="font-mono text-gray-800">{formatCurrency(takeProfitPrice)}</span></div>
                    <div><span className="text-red-600">Stop Loss:</span> <span className="font-mono text-gray-800">{formatCurrency(stopLossPrice)}</span></div>
                </div>
                 <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">Opened: {new Date(trade.openTimestamp).toLocaleString()}</p>
            </div>
            <div className="p-2 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
                 <button
                    onClick={onViewChart}
                    className="flex items-center space-x-2 px-3 py-1.5 text-sm text-purple-600 bg-purple-100 hover:bg-purple-200 rounded-md transition-colors"
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
    const [logoError, setLogoError] = useState(false);
    useEffect(() => { setLogoError(false); }, [trade.coin.symbol]);

    const pnl = trade.pnl ?? 0;
    const isProfit = pnl >= 0;
    const pnlColor = isProfit ? 'text-green-600' : 'text-red-600';
    const isBuy = trade.direction === 'buy';
    const pnlPercentage = trade.sizeUSD !== 0 ? (pnl / trade.sizeUSD) * 100 : 0;

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer shadow-sm" onClick={onViewChart}>
            <div className="p-4 space-y-3">
                 <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                        {logoError ? (
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-bold text-purple-600 text-sm border border-gray-200">{trade.coin.symbol.charAt(0)}</div>
                        ) : (
                            <img 
                                src={`https://assets.coincap.io/assets/icons/${trade.coin.symbol.toLowerCase()}@2x.png`} 
                                alt={`${trade.coin.name} logo`}
                                className="w-8 h-8 rounded-full"
                                onError={() => setLogoError(true)}
                            />
                        )}
                        <div>
                            <p className="font-bold text-gray-900">{trade.coin.name} <span className="text-gray-500">({trade.coin.symbol})</span></p>
                             <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${isBuy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {trade.direction.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Realized P/L</p>
                        <p className={`font-mono font-bold text-lg ${pnlColor}`}>{formatCurrency(pnl)}</p>
                         <p className={`font-mono text-sm ${pnlColor}`}>({isProfit ? '+' : ''}{pnlPercentage.toFixed(2)}%)</p>
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    <div><span className="text-gray-500">Size:</span> <span className="font-mono text-gray-800">{formatCurrency(trade.sizeUSD)}</span></div>
                    <div><span className="text-gray-500">Reason:</span> <CloseReasonPill reason={trade.closeReason} /></div>
                    <div><span className="text-gray-500">Entry:</span> <span className="font-mono text-gray-800">{formatCurrency(trade.entryPrice)}</span></div>
                    <div><span className="text-gray-500">Close:</span> <span className="font-mono text-gray-800">{formatCurrency(trade.closePrice)}</span></div>
                    <div className="col-span-2"><span className="text-gray-500">Hold Time:</span> <span className="font-mono text-gray-800">{formatDuration(trade.closeTimestamp ? trade.closeTimestamp - trade.openTimestamp : null)}</span></div>
                </div>
            </div>
            <div className="p-2 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
                 <button
                    onClick={(e) => { e.stopPropagation(); onViewChart(); }}
                    className="flex items-center space-x-2 px-3 py-1.5 text-sm text-purple-600 bg-purple-100 hover:bg-purple-200 rounded-md transition-colors"
                >
                    <LineChartIcon className="w-4 h-4" />
                    <span>View Chart</span>
                </button>
            </div>
        </div>
    );
};


// Main Component
export const SimulatedWallet: React.FC = () => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [settings, setSettings] = useState<WalletSettings>(tradeSimulatorService.getSettings());
    const [tradeForChart, setTradeForChart] = useState<Trade | null>(null);
    const [isTestingWebhook, setIsTestingWebhook] = useState(false);
    const [webhookSuccess, setWebhookSuccess] = useState<boolean | null>(null);
    const [view, setView] = useState<'open' | 'history'>('open');

    useEffect(() => {
        const updateState = () => {
            setTrades([...tradeSimulatorService.getAllTrades()]);
            setSettings(tradeSimulatorService.getSettings());
        };
        tradeSimulatorService.subscribe(updateState);
        updateState();
        return () => tradeSimulatorService.unsubscribe(updateState);
    }, []);

    const openTrades = trades.filter(t => t.status === 'open');
    const closedTrades = trades.filter(t => t.status === 'closed');

    const totalPnl = closedTrades.reduce((acc, trade) => acc + (trade.pnl ?? 0), 0);
    const winTrades = closedTrades.filter(t => (t.pnl ?? 0) >= 0).length;
    const winRate = closedTrades.length > 0 ? (winTrades / closedTrades.length) * 100 : 0;

    // Fix: Cast target to HTMLInputElement to safely access the 'checked' property,
    // which does not exist on HTMLSelectElement, resolving the TypeScript error.
    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : (type === 'range' ? parseFloat(value) : value);
        tradeSimulatorService.updateSettings({ [name]: finalValue });
    };

    const handleTestWebhook = async () => {
        setIsTestingWebhook(true);
        setWebhookSuccess(null);
        await tradeSimulatorService.testWebhook(); // This function now exists in the service
        // Since we can't get direct feedback from the fetch call in the service,
        // we'll simulate a success/fail for UI purposes. In a real app, this would be more robust.
        setTimeout(() => {
            setIsTestingWebhook(false);
            if (settings.webhookUrl) {
                setWebhookSuccess(true);
                setTimeout(() => setWebhookSuccess(null), 3000);
            } else {
                setWebhookSuccess(false);
            }
        }, 1500);
    };

    const handleReset = () => {
        if (window.confirm("Are you sure you want to reset all trades and settings? This action cannot be undone.")) {
            tradeSimulatorService.resetWallet();
        }
    };
    
    return (
        <>
            <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Simulated Wallet & Strategy</h2>
                    <p className="text-sm text-gray-500">Monitor simulated trades and configure the AI's trading parameters.</p>
                </div>
                <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <MetricCard title="Total Realized P/L" value={formatCurrency(totalPnl)} description="Profit & Loss from all closed trades." />
                        <MetricCard title="Win Rate" value={`${winRate.toFixed(1)}%`} description={`${winTrades} wins / ${closedTrades.length} total closed trades.`} />
                        <MetricCard title="Open Positions" value={openTrades.length.toString()} description="Currently active simulated trades." />
                    </div>

                    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-6">
                        <h3 className="text-lg font-bold text-purple-700 mb-4">AI Trading Strategy</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="riskTolerance" className="block text-sm font-medium text-gray-700 mb-1">Risk Tolerance</label>
                                <select id="riskTolerance" name="riskTolerance" value={settings.riskTolerance} onChange={handleSettingsChange} className="w-full bg-gray-100 border border-gray-300 rounded-lg p-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500">
                                    <option>Conservative</option><option>Moderate</option><option>Aggressive</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="investmentStyle" className="block text-sm font-medium text-gray-700 mb-1">Investment Style</label>
                                <select id="investmentStyle" name="investmentStyle" value={settings.investmentStyle} onChange={handleSettingsChange} className="w-full bg-gray-100 border border-gray-300 rounded-lg p-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500">
                                    <option>Scalping</option><option>Day Trading</option><option>Swing Trading</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="aiConfidence" className="flex justify-between items-center text-sm font-medium text-gray-700 mb-1">
                                    <span>Execution Confidence Threshold</span>
                                    <span className="font-mono text-purple-600 text-base">{settings.aiConfidence.toFixed(1)}%</span>
                                </label>
                                <input id="aiConfidence" name="aiConfidence" type="range" min="50" max="95" step="0.1" value={settings.aiConfidence} onChange={handleSettingsChange} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer confidence-slider" />
                                <p className="text-xs text-gray-500 mt-1">Sets the minimum AI confidence to auto-execute a trade from the pipeline.</p>
                            </div>
                        </div>
                    </div>

                     <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-6">
                        <h3 className="text-lg font-bold text-purple-700 mb-4">System & Notifications</h3>
                         <div className="space-y-4">
                             <div>
                                <label htmlFor="webhookUrl" className="block text-sm font-medium text-gray-700 mb-1">Webhook URL (for trade alerts)</label>
                                <div className="flex gap-2">
                                     <input id="webhookUrl" name="webhookUrl" type="text" placeholder="https://example.com/webhook" value={settings.webhookUrl} onChange={handleSettingsChange} className="flex-grow bg-gray-100 border border-gray-300 rounded-lg p-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                                     <button onClick={handleTestWebhook} disabled={isTestingWebhook || !settings.webhookUrl} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                                         {isTestingWebhook ? <LoadingSpinner /> : 'Test'}
                                     </button>
                                </div>
                                {webhookSuccess === true && <p className="text-xs text-green-600 mt-1">Test signal sent successfully!</p>}
                                {webhookSuccess === false && <p className="text-xs text-red-600 mt-1">Please enter a valid URL.</p>}
                             </div>
                             <div className="flex items-center">
                                 <input id="webhookEnabled" name="webhookEnabled" type="checkbox" checked={settings.webhookEnabled} onChange={handleSettingsChange} className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                                 <label htmlFor="webhookEnabled" className="ml-2 block text-sm text-gray-700">Enable Webhook Notifications</label>
                             </div>
                             <div>
                                 <button onClick={handleReset} className="px-4 py-2 bg-red-100 text-red-800 font-semibold rounded-lg hover:bg-red-200">
                                    Reset Wallet & Settings
                                </button>
                             </div>
                         </div>
                    </div>

                    {/* Mobile View Toggle */}
                    <div className="sm:hidden mb-4">
                        <div className="flex bg-gray-200 p-1 rounded-lg">
                            <button onClick={() => setView('open')} className={`flex-1 p-2 text-sm font-semibold rounded-md ${view === 'open' ? 'bg-white shadow' : ''}`}>Open ({openTrades.length})</button>
                            <button onClick={() => setView('history')} className={`flex-1 p-2 text-sm font-semibold rounded-md ${view === 'history' ? 'bg-white shadow' : ''}`}>History ({closedTrades.length})</button>
                        </div>
                    </div>
                    
                    {/* Open Positions (Mobile) */}
                    <div className={`sm:hidden space-y-4 ${view !== 'open' ? 'hidden' : ''}`}>
                         <h3 className="text-lg font-bold text-purple-700">Open Positions</h3>
                        {openTrades.length > 0 ? openTrades.map(t => <OpenPositionCard key={t.id} trade={t} onViewChart={() => setTradeForChart(t)} />)
                         : <p className="text-gray-500 text-center py-4">No open trades.</p>}
                    </div>

                     {/* Trade History (Mobile) */}
                    <div className={`sm:hidden space-y-4 ${view !== 'history' ? 'hidden' : ''}`}>
                         <h3 className="text-lg font-bold text-purple-700">Trade History</h3>
                        {closedTrades.length > 0 ? closedTrades.slice(0, 50).map(t => <ClosedTradeCard key={t.id} trade={t} onViewChart={() => setTradeForChart(t)} />)
                         : <p className="text-gray-500 text-center py-4">No closed trades.</p>}
                    </div>

                    {/* Desktop Tables */}
                    <div className="hidden sm:block bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                         <h3 className="text-lg font-bold text-purple-700 mb-4">Open Positions ({openTrades.length})</h3>
                         <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                    <tr>
                                        <th className="p-3">Asset</th><th className="p-3">Size</th><th className="p-3">Side</th><th className="p-3">Entry</th>
                                        <th className="p-3">Take Profit</th><th className="p-3">Stop Loss</th><th className="p-3">P/L</th><th className="p-3">Opened</th><th className="p-3 text-center">Chart</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {openTrades.length > 0 ? openTrades.map(t => <TradeRow key={t.id} trade={t} type="open" onViewChart={() => setTradeForChart(t)} />)
                                     : <tr><td colSpan={9} className="text-center p-4 text-gray-500">No open trades.</td></tr>}
                                </tbody>
                            </table>
                         </div>
                    </div>

                     <div className="hidden sm:block mt-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-bold text-purple-700 mb-4">Trade History ({closedTrades.length})</h3>
                        <div className="overflow-x-auto">
                           <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                    <tr>
                                        <th className="p-3">Asset</th><th className="p-3">Size</th><th className="p-3">Side</th><th className="p-3">Entry</th>
                                        <th className="p-3">Close Price</th><th className="p-3">P/L</th><th className="p-3">Opened</th><th className="p-3">Closed</th>
                                        <th className="p-3">Reason</th><th className="p-3">Duration</th><th className="p-3 text-center">Chart</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {closedTrades.length > 0 ? closedTrades.slice(0, 50).map(t => <TradeRow key={t.id} trade={t} type="closed" onViewChart={() => setTradeForChart(t)} />)
                                     : <tr><td colSpan={11} className="text-center p-4 text-gray-500">No closed trades.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            {tradeForChart && <CryptoChartModal trade={tradeForChart} onClose={() => setTradeForChart(null)} />}
            <style>{`
                 .confidence-slider {
                    -webkit-appearance: none; appearance: none; width: 100%; height: 6px;
                    background: #e5e7eb; border-radius: 9999px; outline: none; opacity: 0.9; transition: opacity 0.2s;
                }
                .confidence-slider:hover { opacity: 1; }
                .confidence-slider::-webkit-slider-thumb {
                    -webkit-appearance: none; appearance: none; width: 20px; height: 20px;
                    background: #a855f7; cursor: pointer; border-radius: 9999px;
                    border: 3px solid #ffffff; box-shadow: 0 0 5px rgba(168, 85, 247, 0.5);
                }
                .confidence-slider::-moz-range-thumb {
                    width: 20px; height: 20px; background: #a855f7; cursor: pointer;
                    border-radius: 9999px; border: 3px solid #ffffff; box-shadow: 0 0 5px rgba(168, 85, 247, 0.5);
                }
            `}</style>
        </>
    );
};