import React, { useState, useEffect } from 'react';
import { tradeSimulatorService, Trade, WalletSettings } from '../services/tradeSimulatorService';
import { SettingsIcon, CloseIcon } from './Icons';


const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '$0.00';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
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

const TradeRow: React.FC<{ trade: Trade }> = ({ trade }) => {
    const isBuy = trade.direction === 'buy';
    const pnl = trade.pnl ?? 0;
    const isProfit = pnl >= 0;

    const pnlColor = isProfit ? 'text-green-400' : 'text-red-400';
    
    return (
        <tr className="border-b border-gray-700 hover:bg-gray-800/50">
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
            {trade.status === 'closed' && (
                <td className="p-3 font-mono text-gray-300">{formatCurrency(trade.closePrice)}</td>
            )}
            <td className={`p-3 font-mono font-bold ${pnlColor}`}>{formatCurrency(pnl)}</td>
            <td className="p-3 text-gray-400 text-sm">{new Date(trade.openTimestamp).toLocaleString()}</td>
            {trade.status === 'closed' && (
                 <td className="p-3 text-gray-400 text-sm">{trade.closeTimestamp ? new Date(trade.closeTimestamp).toLocaleString() : 'N/A'}</td>
            )}
            {trade.status === 'closed' && (
                 <td className="p-3 text-gray-400 text-sm font-mono">{formatDuration(trade.closeTimestamp ? trade.closeTimestamp - trade.openTimestamp : null)}</td>
            )}
        </tr>
    );
};

export const SimulatedWallet: React.FC = () => {
    const [allTrades, setAllTrades] = useState<Trade[]>(tradeSimulatorService.getAllTrades());
    const [settings, setSettings] = useState<WalletSettings>(tradeSimulatorService.getSettings());
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        const updateState = () => {
            setAllTrades([...tradeSimulatorService.getAllTrades()]);
            setSettings(tradeSimulatorService.getSettings());
        };
        tradeSimulatorService.subscribe(updateState);
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

    const baseTradeSize = 1000;
    const confidenceMultiplier = aiConfidence / 100;
    const sizeAdjustment = baseTradeSize * (confidenceMultiplier - 0.75);
    const nextTradeSize = baseTradeSize + sizeAdjustment;


    const handleSettingsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        tradeSimulatorService.updateSettings({ [name]: value });
    };

    const handleReset = () => {
        if (window.confirm("Are you sure you want to reset the wallet? All trade history and P/L will be permanently deleted.")) {
            tradeSimulatorService.resetWallet();
            setIsSettingsOpen(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
             <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-white">AI Simulated Wallet</h2>
                    <p className="text-sm text-gray-400">Live performance tracking of the JaxSpot prediction pipeline.</p>
                </div>
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    aria-label={isSettingsOpen ? "Close settings" : "Open settings"}
                >
                    {isSettingsOpen ? <CloseIcon /> : <SettingsIcon />}
                </button>
            </div>

            {isSettingsOpen && (
                <div className="p-4 border-b border-gray-700 bg-gray-900/50 space-y-4 animate-fade-in-down">
                    <h3 className="text-lg font-bold text-purple-400">AI Trading Strategy</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="riskTolerance" className="block text-sm font-medium text-gray-300 mb-1">Risk Tolerance</label>
                            <select
                                id="riskTolerance"
                                name="riskTolerance"
                                value={settings.riskTolerance}
                                onChange={handleSettingsChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option>Conservative</option>
                                <option>Moderate</option>
                                <option>Aggressive</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="investmentStyle" className="block text-sm font-medium text-gray-300 mb-1">Investment Style</label>
                            <select
                                id="investmentStyle"
                                name="investmentStyle"
                                value={settings.investmentStyle}
                                onChange={handleSettingsChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option>Scalping</option>
                                <option>Day Trading</option>
                                <option>Swing Trading</option>
                            </select>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-gray-700/50">
                        <h3 className="text-lg font-bold text-purple-400 mb-2">Wallet Management</h3>
                        <button
                            onClick={handleReset}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors w-full md:w-auto"
                        >
                            Reset Wallet & History
                        </button>
                        <p className="text-xs text-gray-500 mt-2">Warning: This action is permanent and cannot be undone.</p>
                    </div>
                </div>
            )}


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
                    title="AI Confidence" 
                    value={`${aiConfidence.toFixed(1)}%`}
                    description="Adapts based on performance"
                />
                 <MetricCard 
                    title="Total Trades" 
                    value={closedTrades.length.toString()}
                    description={`Next Trade Size: ${formatCurrency(nextTradeSize)}`}
                />
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-purple-400 mb-2">Open Positions ({openTrades.length})</h3>
                    <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
                       <table className="w-full text-sm text-left">
                            <thead className="bg-gray-700/50 text-xs text-gray-400 uppercase">
                                <tr>
                                    <th className="p-3">Asset</th>
                                    <th className="p-3">Size (USD)</th>
                                    <th className="p-3">Direction</th>
                                    <th className="p-3">Entry Price</th>
                                    <th className="p-3">Unrealized P/L</th>
                                    <th className="p-3">Opened At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {openTrades.length > 0 ? (
                                    openTrades.map(trade => <TradeRow key={trade.id} trade={trade} />)
                                ) : (
                                    <tr><td colSpan={6} className="text-center p-4 text-gray-500">No open positions.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-purple-400 mb-2">Trade History ({closedTrades.length})</h3>
                    <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
                        <table className="w-full text-sm text-left">
                             <thead className="bg-gray-700/50 text-xs text-gray-400 uppercase">
                                <tr>
                                    <th className="p-3">Asset</th>
                                    <th className="p-3">Size (USD)</th>
                                    <th className="p-3">Direction</th>
                                    <th className="p-3">Entry Price</th>
                                    <th className="p-3">Close Price</th>
                                    <th className="p-3">Realized P/L</th>
                                    <th className="p-3">Opened At</th>
                                    <th className="p-3">Closed At</th>
                                    <th className="p-3">Hold Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                 {closedTrades.length > 0 ? (
                                    closedTrades.map(trade => <TradeRow key={trade.id} trade={trade} />)
                                ) : (
                                    <tr><td colSpan={9} className="text-center p-4 text-gray-500">No trade history yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes fade-in-down {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-down {
                animation: fade-in-down 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};