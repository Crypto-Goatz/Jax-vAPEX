import React from 'react';
import type { CryptoPrice } from '../services/cryptoService';
import { ChevronDownIcon, ChevronUpIcon } from './Icons';

type PipelineState = { [key: string]: CryptoPrice[] };

interface PipelineFooterProps {
    pipeline: PipelineState;
    isNavOpen: boolean;
    isExpanded: boolean;
    onToggle: () => void;
}

const FOOTER_STAGES = [
    { id: 'stage1', name: 'Momentum Watch' },
    { id: 'stage2', name: 'Liquidity Screen' },
    { id: 'stage3', name: 'Risk Screen' },
    { id: 'stage4', name: 'Execution' },
    { id: 'stage5', name: 'Active Trades' },
    { id: 'stage6', name: 'Holding' }
];

const CoinRow: React.FC<{ coin: CryptoPrice }> = ({ coin }) => (
    <li className="flex justify-between items-center text-xs font-mono px-1 py-0.5 rounded hover:bg-purple-500/10">
        <div className="flex items-center space-x-1.5 truncate">
             <img 
              src={`https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`} 
              alt=""
              className="w-3.5 h-3.5 rounded-full"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="truncate">{coin.symbol}</span>
        </div>
        <span>${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
    </li>
);

const QuickViewColumn: React.FC<{ title: string; coins: CryptoPrice[] }> = ({ title, coins }) => (
    <div className="flex-1 flex flex-col min-w-0">
        <h4 className="font-bold text-purple-400 text-sm text-center border-b border-gray-700 pb-2 mb-2 truncate">{title}</h4>
        <ul className="text-gray-300 space-y-1 overflow-y-auto pr-2 -mr-2 custom-scrollbar">
            {coins.length > 0 ? (
                coins.slice(0, 5).map(coin => <CoinRow key={coin.id} coin={coin} />)
            ) : (
                <li className="text-center text-gray-600 italic text-xs py-2">Empty</li>
            )}
        </ul>
    </div>
);


export const PipelineFooter: React.FC<PipelineFooterProps> = ({ pipeline, isNavOpen, isExpanded, onToggle }) => {
    
    return (
        <>
            <footer className={`fixed bottom-0 left-0 bg-gray-900/90 backdrop-blur-lg border-t border-gray-700/50 z-20 transition-all duration-300 ease-in-out ${isNavOpen ? 'right-0 md:right-64' : 'right-0'} ${isExpanded ? 'h-[33vh]' : 'h-8'}`}>
                 <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center space-x-1">
                    <button
                        onClick={onToggle}
                        className="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 hover:text-white rounded-full p-1 z-30 transition-all"
                        aria-label={isExpanded ? "Collapse footer" : "Expand footer"}
                        aria-expanded={isExpanded}
                    >
                        {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
                    </button>
                 </div>
                
                {/* Expanded Quick View Panel */}
                <div className={`w-full h-full p-4 flex gap-4 transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 invisible'}`}>
                    {FOOTER_STAGES.map(stage => (
                        <QuickViewColumn 
                            key={stage.id} 
                            title={stage.name} 
                            coins={pipeline[stage.id] || []} 
                        />
                    ))}
                </div>

                {/* Collapsed View Bar */}
                 <div className={`flex items-center justify-center h-full transition-opacity duration-300 ${!isExpanded ? 'opacity-100' : 'opacity-0 invisible'}`}>
                    <div className="flex items-center space-x-2">
                            <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </div>
                        <span className="text-xs text-gray-400">Pipeline Active</span>
                    </div>
                </div>
            </footer>
            {/* CSS for custom scrollbar */}
            <style>{`
                 /* Custom scrollbar for pop-up */
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6b7280; }
            `}</style>
        </>
    );
};