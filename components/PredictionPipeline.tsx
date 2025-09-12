import React, { useState } from 'react';
import { CryptoPrice } from '../services/cryptoService';
import { LoadingSpinner } from './LoadingSpinner';
import { XCircleIcon } from './Icons';
import type { PipelineCryptoPrice } from '../App';

export interface PipelineStageDefinition {
  id: string;
  title: string;
  description: string;
  passCondition: (coin: CryptoPrice | PipelineCryptoPrice) => boolean;
  getConditionText: (coin: CryptoPrice | PipelineCryptoPrice) => string;
}

// --- HELPER FUNCTIONS ---
const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};


// --- SUB-COMPONENTS ---

const CryptoPipelineCard: React.FC<{ 
  coin: CryptoPrice;
  conditionText: string;
}> = ({ coin, conditionText }) => {
  const [logoError, setLogoError] = useState(false);
  const logoUrl = `https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`;
  
  const handleLogoError = () => setLogoError(true);

  return (
    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 mb-3 transition-all hover:bg-gray-700/50 hover:shadow-lg hover:-translate-y-1 w-full text-left animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {logoError ? (
             <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center font-bold text-purple-400 text-sm flex-shrink-0">
                {coin.symbol.charAt(0)}
             </div>
          ) : (
            <img 
              src={logoUrl} 
              alt={`${coin.name} logo`} 
              className="w-8 h-8 rounded-full flex-shrink-0"
              onError={handleLogoError}
            />
          )}
          <div>
            <p className="font-semibold text-white text-sm">{coin.name}</p>
            <p className="text-xs text-gray-400">{coin.symbol}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm text-white">${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-700/50">
        <p className="text-xs text-purple-300">Condition:</p>
        <p className="text-xs text-gray-400 font-mono">{conditionText}</p>
      </div>
    </div>
  );
};

const ExecutionCandidateCard: React.FC<{ coin: PipelineCryptoPrice }> = ({ coin }) => {
    const [logoError, setLogoError] = useState(false);
    const logoUrl = `https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`;
    const confidence = coin.confidence ?? 0;
    const confidenceColor = confidence > 75 ? 'bg-green-500' : confidence > 50 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 mb-3 transition-all hover:bg-gray-700/50 hover:shadow-lg hover:-translate-y-1 w-full text-left animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    {logoError ? (
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center font-bold text-purple-400 text-sm flex-shrink-0">
                            {coin.symbol.charAt(0)}
                        </div>
                    ) : (
                        <img src={logoUrl} alt={`${coin.name} logo`} className="w-8 h-8 rounded-full flex-shrink-0" onError={() => setLogoError(true)} />
                    )}
                    <div>
                        <p className="font-semibold text-white text-sm">{coin.name}</p>
                        <p className="text-xs text-gray-400">{coin.symbol}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-mono text-sm text-white">${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-700/50">
                <div className="flex justify-between items-center mb-1">
                    <p className="text-xs text-purple-300 font-semibold">AI Confidence Score:</p>
                    <p className="text-sm font-mono font-bold text-white">{confidence.toFixed(1)}%</p>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className={`${confidenceColor} h-2 rounded-full transition-all duration-500`} style={{ width: `${confidence}%` }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-1 italic">Based on momentum & market cap strength.</p>
            </div>
        </div>
    );
};

const ActiveTradeCard: React.FC<{ coin: PipelineCryptoPrice }> = ({ coin }) => {
    const [logoError, setLogoError] = useState(false);
    const logoUrl = `https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`;
    const pnl = coin.pnl ?? 0;
    const isProfit = pnl >= 0;
    const pnlColor = isProfit ? 'text-green-400' : 'text-red-400';

    return (
        <div className="bg-gray-800 p-3 rounded-lg border-2 border-purple-500/60 mb-3 shadow-lg shadow-purple-500/10 w-full text-left animate-fade-in-up">
            <div className="flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                    {logoError ? (
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center font-bold text-purple-400 text-sm flex-shrink-0">
                            {coin.symbol.charAt(0)}
                        </div>
                    ) : (
                        <img src={logoUrl} alt={`${coin.name} logo`} className="w-8 h-8 rounded-full flex-shrink-0" onError={() => setLogoError(true)} />
                    )}
                    <div>
                        <p className="font-semibold text-white text-sm">{coin.name}</p>
                        <p className="text-xs text-gray-400">{coin.symbol}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-mono text-sm text-white">${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-700/50 grid grid-cols-2 gap-2 text-center">
                <div>
                    <p className="text-xs text-gray-400">Entry Price</p>
                    <p className="font-mono text-sm text-white">{formatCurrency(coin.entryPrice)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-400">Unrealized P/L</p>
                    <p className={`font-mono text-sm font-bold ${pnlColor}`}>{formatCurrency(pnl)}</p>
                </div>
            </div>
        </div>
    );
};

const ExitedCoinCard: React.FC<{ coin: CryptoPrice; reason: string }> = ({ coin, reason }) => {
    return (
        <div className="bg-red-900/20 p-2 rounded-md border border-red-500/30 flex items-center space-x-2 animate-fade-in">
             <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
                 <p className="text-xs font-bold text-red-300">{coin.symbol} Exited</p>
                 <p className="text-xs text-gray-400">{reason}</p>
            </div>
        </div>
    )
}

const PipelineStage: React.FC<{ 
    stageNumber: number; 
    exitedCoinInfo: { coin: PipelineCryptoPrice; reason: string } | null;
    stage: PipelineStageDefinition;
    coins: PipelineCryptoPrice[];
}> = ({ stageNumber, exitedCoinInfo, stage, coins }) => {
  return (
    <div className="flex-shrink-0 w-full lg:w-80 bg-gray-900/50 rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-start mb-4">
        <div className={`w-8 h-8 rounded-full ${stage.id === 'stage5' ? 'bg-green-500' : 'bg-purple-600'} flex items-center justify-center font-bold text-white text-md z-10 ring-4 ring-gray-800/50 mr-3 flex-shrink-0 mt-1`}>
          {stageNumber}
        </div>
        <div>
            <h3 className={`font-bold ${stage.id === 'stage5' ? 'text-green-400' : 'text-purple-400'}`}>{stage.title}</h3>
            <p className="text-xs text-gray-500">{stage.description}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3">
        {coins.length > 0 ? (
          coins.map(coin => {
             if (stage.id === 'stage4') {
                return <ExecutionCandidateCard key={coin.id} coin={coin} />;
            }
            if (stage.id === 'stage5') {
                return <ActiveTradeCard key={coin.id} coin={coin} />;
            }
            return <CryptoPipelineCard key={coin.id} coin={coin} conditionText={stage.getConditionText(coin)} />;
          })
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No assets in this stage.
          </div>
        )}
      </div>
       <div className="mt-3 pt-3 border-t border-gray-700/50">
           <h4 className="text-xs font-semibold text-gray-400 mb-2">Recently Exited</h4>
           {exitedCoinInfo ? (
               <ExitedCoinCard coin={exitedCoinInfo.coin} reason={exitedCoinInfo.reason} />
           ) : (
                <p className="text-xs text-gray-600 italic">No recent exits.</p>
           )}
       </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
type PipelineState = { [key: string]: PipelineCryptoPrice[] };
type ExitedState = { [key: string]: { coin: PipelineCryptoPrice; reason: string } | null };

interface PredictionPipelineProps {
    pipeline: PipelineState;
    exitedCoins: ExitedState;
    allCoins: CryptoPrice[];
    isLoading: boolean;
    stages: PipelineStageDefinition[];
}

export const PredictionPipeline: React.FC<PredictionPipelineProps> = ({ pipeline, exitedCoins, isLoading, stages }) => {
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  
  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700">
        <LoadingSpinner />
        <p className="mt-4 text-purple-300">Initializing Prediction Pipeline...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">JaxSpot Pump Pipeline</h2>
        <p className="text-sm text-gray-400">Live, logic-driven analysis of potential low-risk gems.</p>
      </div>
      <div className="flex-1 p-4 flex flex-col overflow-hidden">
        {/* Mobile Tabs */}
        <div className="lg:hidden mb-4">
            <div className="flex space-x-2 overflow-x-auto pb-2 custom-scrollbar-horizontal">
                {stages.map((stage, index) => (
                    <button
                        key={stage.id}
                        onClick={() => setActiveStageIndex(index)}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex-shrink-0 ${
                            activeStageIndex === index ? (stage.id === 'stage5' ? 'bg-green-600 text-white' : 'bg-purple-600 text-white') : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                    >
                        {index + 1}. {stage.title}
                    </button>
                ))}
            </div>
        </div>
        
        {/* Desktop View (Horizontal Scroll) */}
        <div className="hidden lg:flex space-x-4 flex-1 overflow-x-auto pb-4">
             {stages.map((stage, index) => (
                <PipelineStage
                    key={stage.id}
                    stageNumber={index + 1}
                    stage={stage}
                    coins={pipeline[stage.id] || []}
                    exitedCoinInfo={exitedCoins[stage.id] || null}
                />
            ))}
        </div>

        {/* Mobile View (Single Stage) */}
        <div className="lg:hidden flex-1 min-h-0">
            {stages[activeStageIndex] && (
                 <PipelineStage
                    key={stages[activeStageIndex].id}
                    stageNumber={activeStageIndex + 1}
                    stage={stages[activeStageIndex]}
                    coins={pipeline[stages[activeStageIndex].id] || []}
                    exitedCoinInfo={exitedCoins[stages[activeStageIndex].id] || null}
                />
            )}
        </div>

      </div>
       <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }

        @keyframes fade-in {
            from { opacity: 0; } to { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }

        /* Custom scrollbar for pipeline columns */
        .overflow-y-auto::-webkit-scrollbar { width: 8px; }
        .overflow-y-auto::-webkit-scrollbar-track { background: #1f2937; border-radius: 10px; }
        .overflow-y-auto::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #6b7280; }
        
        /* Custom horizontal scrollbar for mobile tabs */
        .custom-scrollbar-horizontal::-webkit-scrollbar { height: 4px; }
        .custom-scrollbar-horizontal::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-horizontal::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
        
        /* Custom scrollbar for desktop pipeline container */
        .overflow-x-auto::-webkit-scrollbar { height: 8px; }
        .overflow-x-auto::-webkit-scrollbar-track { background: #111827; }
        .overflow-x-auto::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        .overflow-x-auto::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      `}</style>
    </div>
  );
};
