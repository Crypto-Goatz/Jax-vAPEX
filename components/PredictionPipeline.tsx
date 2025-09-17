
import React, { useState, useMemo } from 'react';
import { CryptoPrice } from '../services/cryptoService';
import { LoadingSpinner } from './LoadingSpinner';
import { XCircleIcon, ChevronRightIcon, VaultIcon, CloseIcon, ChevronsRightIcon, ChevronsLeftIcon, LineChartIcon } from './Icons';
import type { PipelineCryptoPrice } from '../App';
import { tradeSimulatorService, Trade } from '../services/tradeSimulatorService';
import { CryptoChartModal } from './CryptoChartModal';


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

const getProgressColor = (progress: number): string => {
    if (progress <= 0.2) return '#0055ff'; // Level 1: Blue
    if (progress <= 0.4) return '#00aaff'; // Level 2: Cyan
    if (progress <= 0.6) return '#00d4ff'; // Level 3: Aqua
    if (progress <= 0.8) return '#00ffaa'; // Level 4: Mint
    return '#aaff00'; // Level 5: Lime
};

const ColorLegend = () => (
    <div className="mt-2 flex items-center space-x-2">
        <span className="text-xs text-gray-400 font-semibold">Cold</span>
        <div className="flex-grow flex items-center space-x-1">
            <div title="0-20% Hotness" className="h-2 flex-1 rounded-full" style={{ backgroundColor: '#0055ff' }}></div>
            <div title="21-40% Hotness" className="h-2 flex-1 rounded-full" style={{ backgroundColor: '#00aaff' }}></div>
            <div title="41-60% Hotness" className="h-2 flex-1 rounded-full" style={{ backgroundColor: '#00d4ff' }}></div>
            <div title="61-80% Hotness" className="h-2 flex-1 rounded-full" style={{ backgroundColor: '#00ffaa' }}></div>
            <div title="81-100% Hotness" className="h-2 flex-1 rounded-full" style={{ backgroundColor: '#aaff00' }}></div>
        </div>
        <span className="text-xs text-gray-400 font-semibold">Hot</span>
    </div>
);


// --- MODAL & CARDS for HOLDING STAGE ---

const HoldingCard: React.FC<{ coin: PipelineCryptoPrice }> = ({ coin }) => {
    const [logoError, setLogoError] = useState(false);
    const logoUrl = `https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`;

    return (
        <div className="bg-gray-800 p-3 rounded-lg border border-teal-500/40 shadow-lg shadow-teal-500/10 w-full text-left animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    {logoError ? (
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center font-bold text-teal-400 text-sm flex-shrink-0">{coin.symbol.charAt(0)}</div>
                    ) : (
                        <img src={logoUrl} alt={`${coin.name} logo`} className="w-8 h-8 rounded-full flex-shrink-0" onError={() => setLogoError(true)} />
                    )}
                    <div>
                        <p className="font-semibold text-white text-sm">{coin.name}</p>
                        <p className="text-xs text-gray-400">{coin.symbol}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-400">Realized P/L</p>
                    <p className="font-mono text-sm font-bold text-green-400">{formatCurrency(coin.pnl)}</p>
                </div>
            </div>
        </div>
    );
};

const HoldingModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    coins: PipelineCryptoPrice[];
}> = ({ isOpen, onClose, coins }) => {
    if (!isOpen) return null;

    return (
         <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" 
            role="dialog" 
            aria-modal="true"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-4xl max-h-[80vh] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 flex justify-between items-center border-b border-gray-700 flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <VaultIcon className="w-6 h-6 text-teal-400"/>
                        <h2 id="chart-title" className="text-xl font-semibold text-white">Recommended Holds</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close modal">
                        <CloseIcon />
                    </button>
                </div>
                <div className="flex-grow p-4 overflow-y-auto">
                    {coins.length > 0 ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {coins.map(coin => <HoldingCard key={coin.id} coin={coin} />)}
                         </div>
                    ) : (
                         <div className="flex items-center justify-center h-full text-gray-500">
                            No recommended holds yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- PIPELINE STAGE SUB-COMPONENTS ---

const CryptoPipelineCard: React.FC<{ 
  coin: PipelineCryptoPrice;
  stage: PipelineStageDefinition;
  onCoinClick: (coin: PipelineCryptoPrice) => void;
}> = ({ coin, stage, onCoinClick }) => {
  const [logoError, setLogoError] = useState(false);
  const logoUrl = `https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`;

  const progress = useMemo(() => {
    let score = 0;
    const mcap = coin.marketCap ?? 0;
    switch (stage.id) {
        case 'stage1':
        case 'stage2': score = Math.min(1, Math.max(0, (coin.change24h - 2) / (25 - 2))); break;
        case 'stage3': if (mcap > 0) score = Math.min(1, Math.max(0, (Math.log10(mcap) - 8) / (12.7 - 8))); break;
        case 'stage4': score = (coin.confidence ?? 0) / 100; break;
        default: score = 0.5;
    }
    return score;
  }, [coin, stage.id]);
  
  const gradientColor = getProgressColor(progress);
  const cardStyle = {
    background: `linear-gradient(90deg, ${gradientColor} -20%, rgba(31, 41, 55, 0) 60%)`,
    transition: 'background 0.5s ease-in-out',
  };

  return (
    <button onClick={() => onCoinClick(coin)} style={cardStyle} className="p-3 rounded-lg border border-gray-700 mb-3 transition-all hover:shadow-lg hover:-translate-y-1 w-full text-left animate-fade-in-up">
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
              onError={() => setLogoError(true)}
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
        <p className="text-xs text-gray-400 font-mono">{stage.getConditionText(coin)}</p>
      </div>
    </button>
  );
};

const ActiveTradeCard: React.FC<{ coin: PipelineCryptoPrice, onViewChart: () => void }> = ({ coin, onViewChart }) => {
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
            <div className="mt-2 pt-2 border-t border-gray-700/50 flex justify-between items-center">
                <div className="grid grid-cols-2 gap-2 text-left flex-grow">
                    <div>
                        <p className="text-xs text-gray-400">Entry Price</p>
                        <p className="font-mono text-sm text-white">{formatCurrency(coin.entryPrice)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Unrealized P/L</p>
                        <p className={`font-mono text-sm font-bold ${pnlColor}`}>{formatCurrency(pnl)}</p>
                    </div>
                </div>
                 <button onClick={onViewChart} className="p-2 text-gray-400 hover:text-purple-400 hover:bg-gray-700 rounded-full transition-colors ml-2 flex-shrink-0" aria-label={`View chart for ${coin.symbol}`}>
                    <LineChartIcon className="w-5 h-5" />
                </button>
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

const CollapsiblePipelineStage: React.FC<{ 
    stageNumber: number; 
    exitedCoinInfo: { coin: PipelineCryptoPrice; reason: string } | null;
    stage: PipelineStageDefinition;
    coins: PipelineCryptoPrice[];
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onCoinClick: (coin: PipelineCryptoPrice) => void;
    onViewTradeChart: (tradeId: string) => void;
}> = ({ stageNumber, exitedCoinInfo, stage, coins, isCollapsed, onToggleCollapse, onCoinClick, onViewTradeChart }) => {
  
  const stageColor = stage.id === 'stage5' ? 'text-green-400' : 'text-purple-400';
  const ringColor = stage.id === 'stage5' ? 'ring-green-500' : 'ring-purple-500';
  const bgColor = stage.id === 'stage5' ? 'bg-green-500' : 'bg-purple-600';

  if (isCollapsed) {
    return (
      <div 
        onClick={onToggleCollapse}
        className="group relative flex-shrink-0 w-20 bg-gray-900 rounded-lg p-2 h-full flex flex-col items-center justify-around cursor-pointer
                   border border-gray-700 hover:border-purple-600 
                   transform hover:scale-[1.03] hover:shadow-xl hover:shadow-purple-500/20
                   transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden"
      >
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/30 via-purple-900/10 to-transparent transition-opacity duration-500 opacity-50 group-hover:opacity-100"></div>

        <div className="relative z-10 text-gray-400 group-hover:text-white transition-colors duration-300">
            <ChevronsRightIcon />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-2 text-center">
            <div className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center font-bold text-white text-md 
                           group-hover:scale-110 transition-transform duration-300 border-2 border-gray-900/50`}>
                {stageNumber}
            </div>
            <h3 
                className="font-bold text-gray-500 group-hover:text-purple-300 text-xs transition-colors duration-300" 
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
                {stage.title}
            </h3>
        </div>
        <div 
            className="relative z-10 font-mono text-lg font-bold text-white bg-gray-800 rounded-full w-10 h-10 flex items-center justify-center
                       border-2 border-gray-700 group-hover:border-purple-500 transition-all duration-300"
        >
            {coins.length}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-80 bg-gray-900/50 rounded-lg p-4 h-full flex flex-col transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">
      <div className="flex items-start mb-4">
        <div className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center font-bold text-white text-md z-10 ring-4 ${ringColor}/20 mr-3 flex-shrink-0 mt-1`}>
          {stageNumber}
        </div>
        <div className="flex-grow">
            <h3 className={`font-bold ${stageColor}`}>{stage.title}</h3>
            <p className="text-xs text-gray-500">{stage.description}</p>
        </div>
        {stageNumber <= 3 && <button onClick={onToggleCollapse} className="text-gray-400 hover:text-white"><ChevronsLeftIcon /></button>}
      </div>
      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3">
        {coins.length > 0 ? (
          coins.map(coin => {
            if (stage.id === 'stage5') {
                return <ActiveTradeCard key={coin.id} coin={coin} onViewChart={() => onViewTradeChart(coin.id)} />;
            }
            return <CryptoPipelineCard key={coin.id} coin={coin} stage={stage} onCoinClick={onCoinClick} />;
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
    onShowCoinDetail: (coin: CryptoPrice) => void;
}

export const PredictionPipeline: React.FC<PredictionPipelineProps> = ({ pipeline, exitedCoins, isLoading, stages, onShowCoinDetail }) => {
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [isHoldingModalOpen, setIsHoldingModalOpen] = useState(false);
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(
      new Set(['stage1', 'stage2', 'stage3'])
  );
  const [tradeForChart, setTradeForChart] = useState<Trade | null>(null);

  const handleViewTradeChart = (tradeId: string) => {
    const trade = tradeSimulatorService.getAllTrades().find(t => t.id === tradeId);
    if (trade) {
        setTradeForChart(trade);
    }
  };

  const toggleStageCollapse = (stageId: string) => {
    setCollapsedStages(prev => {
        const newSet = new Set(prev);
        if (newSet.has(stageId)) {
            newSet.delete(stageId);
        } else {
            newSet.add(stageId);
        }
        return newSet;
    });
  };
  
  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700">
        <LoadingSpinner />
        <p className="mt-4 text-purple-300">Initializing Prediction Pipeline...</p>
      </div>
    );
  }
  
  const holdingCoins = pipeline.stage6 || [];

  return (
    <>
    <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-xl font-semibold text-white">JaxSpot Pump Pipeline</h2>
                <p className="text-sm text-gray-400">Live, logic-driven analysis of potential low-risk gems.</p>
            </div>
            <button 
                onClick={() => setIsHoldingModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 rounded-lg transition-colors"
            >
                <VaultIcon />
                <span>Recommended Holds</span>
                <span className="bg-teal-500/50 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {holdingCoins.length}
                </span>
            </button>
        </div>
        <ColorLegend />
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
        
        {/* Desktop View (Collapsible) */}
        <div className="hidden lg:flex items-stretch space-x-4 flex-1 overflow-x-hidden pb-4">
             {stages.map((stage, index) => (
                <React.Fragment key={stage.id}>
                    <CollapsiblePipelineStage
                        stageNumber={index + 1}
                        stage={stage}
                        coins={pipeline[stage.id] || []}
                        exitedCoinInfo={exitedCoins[stage.id] || null}
                        isCollapsed={collapsedStages.has(stage.id)}
                        onToggleCollapse={() => toggleStageCollapse(stage.id)}
                        onCoinClick={onShowCoinDetail}
                        onViewTradeChart={handleViewTradeChart}
                    />
                    {index < stages.length - 1 && (
                         <div className="flex items-center justify-center flex-shrink-0">
                            <ChevronRightIcon className="w-8 h-8 text-gray-600 animate-pulse" />
                        </div>
                    )}
                </React.Fragment>
            ))}
        </div>

        {/* Mobile View (Single Stage) */}
        <div className="lg:hidden flex-1 min-h-0">
            {stages[activeStageIndex] && (
                 <CollapsiblePipelineStage
                    key={stages[activeStageIndex].id}
                    stageNumber={activeStageIndex + 1}
                    stage={stages[activeStageIndex]}
                    coins={pipeline[stages[activeStageIndex].id] || []}
                    exitedCoinInfo={exitedCoins[stages[activeStageIndex].id] || null}
                    isCollapsed={false}
                    onToggleCollapse={() => {}}
                    onCoinClick={onShowCoinDetail}
                    onViewTradeChart={handleViewTradeChart}
                />
            )}
        </div>

      </div>
       <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }
        @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
        @keyframes pulse { 50% { opacity: .5; } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

        .overflow-y-auto::-webkit-scrollbar { width: 8px; }
        .overflow-y-auto::-webkit-scrollbar-track { background: #1f2937; border-radius: 10px; }
        .overflow-y-auto::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #6b7280; }
        .custom-scrollbar-horizontal::-webkit-scrollbar { height: 4px; }
        .custom-scrollbar-horizontal::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-horizontal::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
      `}</style>
    </div>
    <HoldingModal isOpen={isHoldingModalOpen} onClose={() => setIsHoldingModalOpen(false)} coins={holdingCoins} />
    {tradeForChart && <CryptoChartModal trade={tradeForChart} onClose={() => setTradeForChart(null)} />}
    </>
  );
};
