import React, { useState, useEffect, useCallback } from 'react';
import { fetchLivePricing, CryptoPrice } from '../services/cryptoService';
import { tradeSimulatorService } from '../services/tradeSimulatorService';
import { LoadingSpinner } from './LoadingSpinner';
import { XCircleIcon } from './Icons';

// --- STAGE DEFINITIONS WITH LOGIC ---
const STAGES = [
  { 
    id: 'stage1', 
    title: 'Momentum Analysis', 
    description: 'Filters for assets with strong positive 24h price action.',
    passCondition: (coin: CryptoPrice) => coin.change24h > 5,
    getConditionText: (coin: CryptoPrice) => `24h Change > 5% (Current: ${coin.change24h.toFixed(2)}%)`
  },
  { 
    id: 'stage2', 
    title: 'Volatility Check', 
    description: 'Filters out assets with excessively high volatility to manage risk.',
    passCondition: (coin: CryptoPrice) => coin.change24h < 20,
    getConditionText: (coin: CryptoPrice) => `24h Change < 20% (Current: ${coin.change24h.toFixed(2)}%)`
  },
  { 
    id: 'stage3', 
    title: 'Market Cap Filter', 
    description: 'Identifies assets within the "gem" market cap range ($50M - $5B).',
    passCondition: (coin: CryptoPrice) => (coin.marketCap ?? 0) > 50000000 && (coin.marketCap ?? 0) < 5000000000,
    getConditionText: (coin: CryptoPrice) => `$50M < MCap < $5B (Current: ${coin.marketCap ? `$${(coin.marketCap / 1_000_000).toFixed(0)}M` : 'N/A'})`
  },
  { 
    id: 'stage4', 
    title: 'Composite Signal', 
    description: 'Final check. Assets passing all stages trigger a simulated trade.',
    passCondition: () => true, // Final stage, always passes to execution
    getConditionText: () => `Ready for execution.`
  },
];

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
        <p className="text-xs text-purple-300">Waiting for:</p>
        <p className="text-xs text-gray-400 font-mono">{conditionText}</p>
      </div>
    </div>
  );
};

const ExitedCoinCard: React.FC<{ coin: CryptoPrice; reason: string }> = ({ coin, reason }) => {
    return (
        <div className="bg-red-900/20 p-2 rounded-md border border-red-500/30 flex items-center space-x-2 animate-fade-in">
             <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
                 <p className="text-xs font-bold text-red-300">{coin.symbol} Rejected</p>
                 <p className="text-xs text-gray-400">{reason}</p>
            </div>
        </div>
    )
}

const PipelineStage: React.FC<{ 
    title: string; 
    description: string;
    stageNumber: number; 
    coins: CryptoPrice[];
    exitedCoinInfo: { coin: CryptoPrice; reason: string } | null;
    getConditionText: (coin: CryptoPrice) => string;
}> = ({ title, description, stageNumber, coins, exitedCoinInfo, getConditionText }) => {
  return (
    <div className="flex-shrink-0 w-full lg:w-80 bg-gray-900/50 rounded-lg p-4 h-[70vh] lg:h-full flex flex-col">
      <div className="flex items-start mb-4">
        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center font-bold text-white text-md z-10 ring-4 ring-gray-800/50 mr-3 flex-shrink-0 mt-1">
          {stageNumber}
        </div>
        <div>
            <h3 className="font-bold text-purple-400">{title}</h3>
            <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3">
        {coins.length > 0 ? (
          coins.map(coin => <CryptoPipelineCard key={coin.id} coin={coin} conditionText={getConditionText(coin)} />)
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
type PipelineState = { [key: string]: CryptoPrice[] };
type ExitedState = { [key: string]: { coin: CryptoPrice; reason: string } | null };

export const PredictionPipeline: React.FC = () => {
  const [pipeline, setPipeline] = useState<PipelineState>({ stage1: [], stage2: [], stage3: [], stage4: [] });
  const [exitedCoins, setExitedCoins] = useState<ExitedState>({ stage1: null, stage2: null, stage3: null, stage4: null });
  const [allCoins, setAllCoins] = useState<CryptoPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const distributeCoins = useCallback((coins: CryptoPrice[]) => {
    // Start all coins that meet initial criteria in the first stage
    const initialCandidates = coins.filter(c => c.change24h > 0 && c.marketCap && c.marketCap > 10000000);
    const newPipeline: PipelineState = { stage1: initialCandidates.slice(0, 15), stage2: [], stage3: [], stage4: [] };
    setPipeline(newPipeline);
  }, []);

  useEffect(() => {
    const getInitialData = async () => {
      setIsLoading(true);
      try {
        const prices = await fetchLivePricing();
        if (prices.length > 0) {
          setAllCoins(prices);
          distributeCoins(prices);
        }
      } catch (error) { console.error("Failed to fetch initial pipeline data:", error); } 
      finally { setIsLoading(false); }
    };
    getInitialData();
  }, [distributeCoins]);

  useEffect(() => {
    if (isLoading || allCoins.length === 0) return;

    const simulationInterval = setInterval(() => {
      setPipeline(currentPipeline => {
        const newPipeline: PipelineState = JSON.parse(JSON.stringify(currentPipeline));
        const newExited: ExitedState = { ...exitedCoins };
        let moved = false;

        for (let i = STAGES.length - 1; i >= 0; i--) {
          const currentStage = STAGES[i];
          const nextStage = i < STAGES.length - 1 ? STAGES[i + 1] : null;

          const coinsToProcess = [...newPipeline[currentStage.id]];

          for (const coin of coinsToProcess) {
            // Find the latest price data for the coin
            const liveCoinData = allCoins.find(c => c.id === coin.id);
            if (!liveCoinData) continue;

            const passes = currentStage.passCondition(liveCoinData);
            
            if (passes) {
              if (nextStage) { // Move to next stage
                newPipeline[currentStage.id] = newPipeline[currentStage.id].filter(c => c.id !== coin.id);
                newPipeline[nextStage.id].push(liveCoinData);
                moved = true;
              } else { // Passed the final stage
                console.log(`PIPELINE: ${coin.symbol} passed final stage. Executing trade.`);
                const direction = coin.change24h >= 0 ? 'buy' : 'sell';
                tradeSimulatorService.executeTrade(coin, direction);
                newPipeline[currentStage.id] = newPipeline[currentStage.id].filter(c => c.id !== coin.id);
                moved = true;
              }
            } else { // Fails the stage
              if (i > 0) { // Don't remove from the first stage on failure
                newPipeline[currentStage.id] = newPipeline[currentStage.id].filter(c => c.id !== coin.id);
                newExited[currentStage.id] = { coin: liveCoinData, reason: `Failed condition: ${currentStage.getConditionText(liveCoinData)}`};
                moved = true;
              }
            }
          }
        }
        setExitedCoins(newExited);

        // Periodically add a new coin to the start if there's space
        if (!moved && allCoins.length > 0 && newPipeline.stage1.length < 15) {
             const existingIds = new Set(Object.values(newPipeline).flat().map(c => c.id));
             const availableCoins = allCoins.filter(c => !existingIds.has(c.id) && c.change24h > 0 && c.marketCap && c.marketCap > 10000000);
             if(availableCoins.length > 0) {
                 const newCoin = availableCoins[Math.floor(Math.random() * availableCoins.length)];
                 newPipeline.stage1.unshift(newCoin);
             }
        }
        
        return newPipeline;
      });
    }, 5000); // Run simulation every 5 seconds

    return () => clearInterval(simulationInterval);
  }, [allCoins, isLoading]);

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
      <div className="flex-1 p-4 overflow-x-auto overflow-y-hidden">
        <div className="flex space-x-4 h-full">
          {STAGES.map((stage, index) => (
            <PipelineStage
              key={stage.id}
              title={stage.title}
              description={stage.description}
              stageNumber={index + 1}
              coins={pipeline[stage.id] || []}
              exitedCoinInfo={exitedCoins[stage.id] || null}
              getConditionText={stage.getConditionText}
            />
          ))}
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
      `}</style>
    </div>
  );
};
