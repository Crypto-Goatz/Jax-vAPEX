import React, { useState, useEffect } from 'react';
import { tradeSimulatorService, Trade } from '../services/tradeSimulatorService';
import { WalletIcon, ChevronUpIcon, ChevronDownIcon, LineChartIcon } from './Icons';
import { CryptoChartModal } from './CryptoChartModal';

const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || !isFinite(value)) return '$0.00';
    const fractionDigits = (Math.abs(value) > 0 && Math.abs(value) < 1) ? 6 : 2;
    return value.toLocaleString('en-US', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: 2, maximumFractionDigits: Math.max(2, fractionDigits)
    });
};

const MetricDisplay: React.FC<{ title: string; value: string; valueColor?: string; isCompact?: boolean }> = ({ title, value, valueColor = 'text-white', isCompact }) => (
    <div className={`text-center ${isCompact ? 'px-2' : 'px-4'}`}>
        <p className={`font-bold ${valueColor} ${isCompact ? 'text-lg' : 'text-xl'}`}>{value}</p>
        <p className="text-xs text-gray-400 truncate">{title}</p>
    </div>
);

const TradeRow: React.FC<{ trade: Trade; type: 'open' | 'closed'; onViewChart?: () => void; }> = ({ trade, type, onViewChart }) => {
    const isBuy = trade.direction === 'buy';
    const pnl = trade.pnl ?? 0;
    const isProfit = pnl >= 0;
    const pnlColor = isProfit ? 'text-green-400' : 'text-red-400';
    const pnlPercentage = trade.sizeUSD !== 0 ? (pnl / trade.sizeUSD) * 100 : 0;

    return (
        <tr className="border-b border-gray-700/50 hover:bg-gray-800/50">
            <td className="p-2 text-sm font-semibold text-white">{trade.coin.symbol}</td>
            <td className="p-2"><span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${isBuy ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{trade.direction.toUpperCase()}</span></td>
            <td className="p-2 font-mono text-xs text-gray-300">{formatCurrency(trade.entryPrice)}</td>
            {type === 'closed' && <td className="p-2 font-mono text-xs text-gray-300">{formatCurrency(trade.closePrice)}</td>}
            <td className="p-2 font-mono text-xs"><div className={`flex flex-col ${pnlColor}`}><span className="font-bold">{formatCurrency(pnl)}</span><span>({isProfit ? '+' : ''}{pnlPercentage.toFixed(2)}%)</span></div></td>
            <td className="p-2 text-center">
                 <button onClick={onViewChart} className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-gray-700 rounded-full transition-colors" aria-label={`View chart for ${trade.coin.symbol} trade`}>
                    <LineChartIcon className="w-4 h-4" />
                </button>
            </td>
        </tr>
    );
};

export const GlobalWalletWidget: React.FC = () => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [settings, setSettings] = useState(tradeSimulatorService.getSettings());
    const [tradeForChart, setTradeForChart] = useState<Trade | null>(null);

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
    
    const startingBalance = 100000;
    const totalPnl = closedTrades.reduce((acc, trade) => acc + (trade.pnl ?? 0), 0);
    const openPnl = openTrades.reduce((acc, trade) => acc + (trade.pnl ?? 0), 0);
    const portfolioBalance = startingBalance + totalPnl + openPnl;
    const wins = closedTrades.filter(t => (t.pnl ?? 0) >= 0).length;
    const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
    const pnlColor = totalPnl >= 0 ? 'text-green-400' : 'text-red-400';
    const winRateColor = winRate >= 90 ? 'text-green-400' : winRate >= 70 ? 'text-yellow-400' : 'text-red-400';

    return (
        <>
            <div className={`w-full bg-gray-900/80 backdrop-blur-md border-t-2 border-purple-500/30 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? 'h-1/2' : 'h-20'} flex flex-col`}>
                <div className="flex-shrink-0 flex items-center justify-between p-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="flex items-center space-x-3">
                        <WalletIcon className="w-8 h-8 text-purple-400" />
                        <h3 className="text-lg font-bold text-white">Global AI Wallet</h3>
                    </div>
                    <div className="flex items-center divide-x divide-gray-700">
                        <MetricDisplay title="Portfolio Balance" value={formatCurrency(portfolioBalance)} isCompact />
                        <MetricDisplay title="Realized P/L" value={formatCurrency(totalPnl)} valueColor={pnlColor} isCompact />
                        <MetricDisplay title="Win Rate" value={`${winRate.toFixed(1)}%`} valueColor={winRateColor} isCompact />
                        <MetricDisplay title="AI Risk" value={settings.riskTolerance} isCompact />
                    </div>
                    <button className="p-2" aria-label={isExpanded ? "Collapse Wallet" : "Expand Wallet"}>
                        {isExpanded ? <ChevronDownIcon /> : <ChevronUpIcon />}
                    </button>
                </div>

                <div className={`flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-hidden transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                    {/* Open Positions */}
                    <div className="flex flex-col bg-gray-800/50 rounded-lg border border-gray-700">
                        <h4 className="p-2 text-sm font-semibold text-purple-300 border-b border-gray-700">Open Positions ({openTrades.length})</h4>
                        <div className="flex-1 overflow-y-auto">
                           <table className="w-full text-left">
                                <thead className="text-xs text-gray-400 bg-gray-900/50 sticky top-0">
                                    <tr>
                                        <th className="p-2">Asset</th><th className="p-2">Side</th><th className="p-2">Entry</th><th className="p-2">P/L</th><th className="p-2 text-center">Chart</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {openTrades.length > 0 ? openTrades.map(t => <TradeRow key={t.id} trade={t} type="open" onViewChart={() => setTradeForChart(t)} />)
                                     : <tr><td colSpan={5} className="text-center p-4 text-xs text-gray-500">No open trades.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {/* Trade History */}
                     <div className="flex flex-col bg-gray-800/50 rounded-lg border border-gray-700">
                        <h4 className="p-2 text-sm font-semibold text-purple-300 border-b border-gray-700">Recent History ({closedTrades.length})</h4>
                        <div className="flex-1 overflow-y-auto">
                           <table className="w-full text-left">
                                <thead className="text-xs text-gray-400 bg-gray-900/50 sticky top-0">
                                    <tr>
                                        <th className="p-2">Asset</th><th className="p-2">Side</th><th className="p-2">Entry</th><th className="p-2">Close</th><th className="p-2">P/L</th><th className="p-2 text-center">Chart</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {closedTrades.length > 0 ? closedTrades.slice(0, 50).map(t => <TradeRow key={t.id} trade={t} type="closed" onViewChart={() => setTradeForChart(t)} />)
                                     : <tr><td colSpan={6} className="text-center p-4 text-xs text-gray-500">No closed trades.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            {tradeForChart && <CryptoChartModal trade={tradeForChart} onClose={() => setTradeForChart(null)} />}
             <style>{`
                .overflow-y-auto::-webkit-scrollbar { width: 6px; }
                .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
                .overflow-y-auto::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
            `}</style>
        </>
    );
};