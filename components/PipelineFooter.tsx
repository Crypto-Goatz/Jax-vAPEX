import React from 'react';
import type { CryptoPrice } from '../services/cryptoService';
import type { Trade } from '../services/tradeSimulatorService';

type PipelineState = { [key: string]: CryptoPrice[] };

interface PipelineFooterProps {
    pipeline: PipelineState;
    openTrades: Trade[];
    isNavOpen: boolean;
}

const FOOTER_STAGES = [
    { id: 'stage1', name: 'Momentum' },
    { id: 'stage2', name: 'Liquidity' },
    { id: 'stage3', name: 'Risk-Managed' },
    { id: 'stage4', name: 'Execution' },
    { id: 'stage5', name: 'Active Trades' }
];

const CoinRow: React.FC<{ coin: CryptoPrice }> = ({ coin }) => (
    <li className="flex justify-between font-mono px-1 py-0.5 rounded hover:bg-purple-500/10">
        <span>{coin.symbol}</span>
        <span>${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
    </li>
);

export const PipelineFooter: React.FC<PipelineFooterProps> = ({ pipeline, openTrades, isNavOpen }) => {
    
    const stageData = [
        { ...FOOTER_STAGES[0], coins: pipeline.stage1 || [] },
        { ...FOOTER_STAGES[1], coins: pipeline.stage2 || [] },
        { ...FOOTER_STAGES[2], coins: pipeline.stage3 || [] },
        { ...FOOTER_STAGES[3], coins: pipeline.stage4 || [] }, // Execution Candidates
        { ...FOOTER_STAGES[4], coins: openTrades.map(t => t.coin) } // Active Trades
    ];

    return (
        <>
            <footer className={`fixed bottom-0 left-0 h-24 bg-gray-900/80 backdrop-blur-md border-t border-gray-700/50 z-20 transition-all duration-300 ease-in-out ${isNavOpen ? 'right-0 md:right-64' : 'right-0'}`}>
                <div className="max-w-4xl mx-auto h-full flex justify-around items-end">
                    {stageData.map((stage, index) => (
                        <div key={stage.name} className="pipeline-stage-item flex flex-col items-center cursor-pointer group relative">
                            
                            {/* --- Pop-up Panel --- */}
                            <div className="absolute bottom-full mb-3 w-52 bg-gray-900 border border-purple-500/50 rounded-lg p-2 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none transform group-hover:-translate-y-2">
                                <h4 className="font-bold text-purple-400 text-sm text-center border-b border-gray-700 pb-1 mb-1">
                                    Stage {index + 1}: {stage.name}
                                </h4>
                                <ul className="text-xs text-gray-300 max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                    {stage.coins.length > 0 ? (
                                        stage.coins.map(coin => <CoinRow key={coin.id} coin={coin} />)
                                    ) : (
                                        <li className="text-center text-gray-500 italic py-2">Empty</li>
                                    )}
                                </ul>
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-gray-900 border-b border-r border-purple-500/50 transform rotate-45"></div>
                            </div>

                            {/* --- Circle --- */}
                            <div className="w-16 h-16 bg-gray-800 border-2 border-purple-500/50 rounded-full flex items-center justify-center shadow-lg transform">
                                <span className="text-purple-400 text-3xl font-bold group-hover:text-white transition-colors duration-300">
                                    {index + 1}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </footer>
            {/* CSS for custom animations and scrollbar */}
            <style>{`
                .pipeline-stage-item > div:last-child {
                    /* Define the 'down' state transition (slow start, fast end) */
                    transition: transform 0.6s cubic-bezier(0.4, 0.0, 1, 1);
                }
                .pipeline-stage-item:hover > div:last-child {
                    /* Define the 'up' state transition (overshoot/bounce effect) */
                    transform: translateY(-20px);
                    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                 /* Custom scrollbar for pop-up */
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #1f2937; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6b7280; }
            `}</style>
        </>
    );
};