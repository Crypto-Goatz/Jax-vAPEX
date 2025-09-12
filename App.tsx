import React, { useState, useEffect } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { SideNav } from './components/SideNav';
import { SpecDetails } from './components/SpecDetails';
import { SpotLive } from './components/SpotLive';
import { DataSources } from './components/DataSources';
import { PredictionPipeline, PipelineStageDefinition } from './components/PredictionPipeline';
import { MarketTrends } from './components/MarketTrends';
import { SimulatedWallet } from './components/SimulatedWallet';
import { MarketRewind } from './components/MarketRewind';
import { MenuIcon, CloseIcon } from './components/Icons';
import { tradeSimulatorService, Trade } from './services/tradeSimulatorService';
import { fetchLivePricing, CryptoPrice } from './services/cryptoService';
import { PipelineFooter } from './components/PipelineFooter';

export type ActiveView = 'chat' | 'specs' | 'pricing' | 'data' | 'pipeline' | 'trends' | 'wallet' | 'rewind';

export interface PipelineCryptoPrice extends CryptoPrice {
  confidence?: number;
  pnl?: number;
  entryPrice?: number;
}
type PipelineState = { [key: string]: PipelineCryptoPrice[] };
type ExitedState = { [key: string]: { coin: PipelineCryptoPrice; reason: string } | null };


// --- STAGE DEFINITIONS WITH LOGIC (Centralized in App.tsx) ---
const PIPELINE_STAGES: PipelineStageDefinition[] = [
  { 
    id: 'stage1', 
    title: 'Strong Momentum', 
    description: 'Assets with positive 24h price action.',
    passCondition: (coin: CryptoPrice) => coin.change24h > 2,
    getConditionText: (coin: CryptoPrice) => `24h Change > 2% (Current: ${coin.change24h.toFixed(2)}%)`
  },
  { 
    id: 'stage2', 
    title: 'High Liquidity', 
    description: 'Filters for established assets with significant market cap.',
    passCondition: (coin: CryptoPrice) => (coin.marketCap ?? 0) > 100000000,
    getConditionText: (coin: CryptoPrice) => `MCap > $100M (Current: ${coin.marketCap ? `$${(coin.marketCap / 1_000_000).toFixed(0)}M` : 'N/A'})`
  },
  { 
    id: 'stage3', 
    title: 'Risk-Managed', 
    description: 'Filters out assets with extreme pumps to manage volatility risk.',
    passCondition: (coin: CryptoPrice) => coin.change24h < 25,
    getConditionText: (coin: CryptoPrice) => `24h Change < 25% (Current: ${coin.change24h.toFixed(2)}%)`
  },
];

const EXECUTION_STAGE_DEFINITION: PipelineStageDefinition = {
  id: 'stage4',
  title: 'Execution Candidates',
  description: 'Assets passing filters, scored for confidence before trade execution.',
  passCondition: (coin: CryptoPrice) => {
    return PIPELINE_STAGES[0].passCondition(coin) &&
           PIPELINE_STAGES[1].passCondition(coin) &&
           PIPELINE_STAGES[2].passCondition(coin);
  },
  getConditionText: (coin: CryptoPrice) => `Awaiting final AI confidence check.`
};

const ACTIVE_TRADES_STAGE_DEFINITION: PipelineStageDefinition = {
  id: 'stage5',
  title: 'Active Trades',
  description: 'Simulated open positions being monitored for TP/SL.',
  passCondition: () => true, // All open trades are in this stage
  getConditionText: (coin: PipelineCryptoPrice) => `Entry: $${coin.entryPrice?.toFixed(2)}`
};

const ALL_PIPELINE_STAGES = [...PIPELINE_STAGES, EXECUTION_STAGE_DEFINITION, ACTIVE_TRADES_STAGE_DEFINITION];

const App: React.FC = () => {
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('pipeline');
  
  // --- Centralized Pipeline State ---
  const [pipeline, setPipeline] = useState<PipelineState>({ stage1: [], stage2: [], stage3: [], stage4: [], stage5: [] });
  const [exitedCoins, setExitedCoins] = useState<ExitedState>({ stage1: null, stage2: null, stage3: null, stage4: null, stage5: null });
  const [allCoins, setAllCoins] = useState<CryptoPrice[]>([]);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [isPipelineLoading, setIsPipelineLoading] = useState(true);

  // Background wallet updater
  useEffect(() => {
    const updateInterval = setInterval(async () => {
      try {
        const livePrices = await fetchLivePricing();
        if (livePrices.length > 0) {
          tradeSimulatorService.updateOpenTrades(livePrices);
        }
      } catch (error) {
        console.error("Background price refresh for wallet failed:", error);
      }
    }, 10000);
    return () => clearInterval(updateInterval);
  }, []);
  
  // Trade subscription for pipeline footer and stage 5
  useEffect(() => {
    const updateTrades = () => {
      setOpenTrades(tradeSimulatorService.getAllTrades().filter(t => t.status === 'open'));
    };
    tradeSimulatorService.subscribe(updateTrades);
    updateTrades(); // Initial fetch
    return () => tradeSimulatorService.unsubscribe(updateTrades);
  }, []);

  // --- Pipeline Data Fetching and Simulation Logic ---
  useEffect(() => {
    let isMounted = true;
    let timeoutId: number;

    const runSimulation = async () => {
        if (!isMounted) return;

        try {
            const prices = await fetchLivePricing();
            if (!isMounted) return;
            if (isPipelineLoading && prices.length > 0) setIsPipelineLoading(false);
            
            setAllCoins(prices);

            const currentOpenTradeSymbols = new Set(
                tradeSimulatorService.getAllTrades()
                    .filter(t => t.status === 'open')
                    .map(t => t.coin.symbol)
            );

            const newPipeline: PipelineState = { stage1: [], stage2: [], stage3: [], stage4: [], stage5: [] };
            const candidates = prices.filter(c => !currentOpenTradeSymbols.has(c.symbol));

            candidates.forEach(coin => {
                if (PIPELINE_STAGES[0].passCondition(coin)) newPipeline.stage1.push(coin);
                if (PIPELINE_STAGES[1].passCondition(coin)) newPipeline.stage2.push(coin);
                if (PIPELINE_STAGES[2].passCondition(coin)) newPipeline.stage3.push(coin);
            });
            
            const stage1Ids = new Set(newPipeline.stage1.map(c => c.id));
            const stage2Ids = new Set(newPipeline.stage2.map(c => c.id));
            
            newPipeline.stage4 = newPipeline.stage3
                .filter(c => stage1Ids.has(c.id) && stage2Ids.has(c.id))
                .map(coin => {
                    const momentumScore = Math.min(1, Math.max(0, (coin.change24h - 2) / (25 - 2)));
                    const mcap = coin.marketCap ?? 100_000_000;
                    const mcapScore = Math.min(1, Math.max(0, (Math.log10(mcap) - 8) / (12.7 - 8)));
                    const confidence = (momentumScore * 0.7 + mcapScore * 0.3) * 100;
                    return { ...coin, confidence };
                });

            for (const coin of newPipeline.stage4) {
                 if ((coin.confidence ?? 0) > 65) { // Only trade on high confidence
                    tradeSimulatorService.executeTrade(coin, 'buy');
                 }
            }
            
            const currentOpenTrades = tradeSimulatorService.getAllTrades().filter(t => t.status === 'open');
            newPipeline.stage5 = currentOpenTrades.map(trade => {
                const liveCoinData = prices.find(p => p.id === trade.coin.id) || trade.coin;
                return { ...liveCoinData, pnl: trade.pnl, entryPrice: trade.entryPrice, id: trade.id };
            });


            setPipeline(currentPipeline => {
                const newExitedState: ExitedState = { stage1: null, stage2: null, stage3: null, stage4: null, stage5: null };
                
                ALL_PIPELINE_STAGES.slice(0, 4).forEach(stage => {
                    const previousIds = new Set(currentPipeline[stage.id]?.map(c => c.id) ?? []);
                    const currentIds = new Set(newPipeline[stage.id]?.map(c => c.id) ?? []);
                    let lastExitedCoin = null;

                    for(const id of previousIds) {
                        if (!currentIds.has(id)) {
                            const exitedCoin = prices.find(c => c.id === id);
                            if (exitedCoin) {
                                let reason = "Condition no longer met.";
                                if (stage.id === 'stage4') {
                                     if (!PIPELINE_STAGES[0].passCondition(exitedCoin)) reason = `Failed: ${PIPELINE_STAGES[0].getConditionText(exitedCoin)}`;
                                     else if (!PIPELINE_STAGES[1].passCondition(exitedCoin)) reason = `Failed: ${PIPELINE_STAGES[1].getConditionText(exitedCoin)}`;
                                     else if (!PIPELINE_STAGES[2].passCondition(exitedCoin)) reason = `Failed: ${PIPELINE_STAGES[2].getConditionText(exitedCoin)}`;
                                } else {
                                    reason = `Failed: ${stage.getConditionText(exitedCoin)}`;
                                }
                                lastExitedCoin = { coin: exitedCoin, reason };
                            }
                        }
                    }
                    newExitedState[stage.id] = lastExitedCoin;
                });

                // Find the most recently closed trade to display in the "exited" slot for stage 5
                const previousOpenTradeIds = new Set(currentPipeline.stage5?.map(t => t.id) ?? []);
                const currentOpenTradeIds = new Set(newPipeline.stage5?.map(t => t.id) ?? []);
                let lastClosedTrade = null;

                for (const tradeId of previousOpenTradeIds) {
                    if (!currentOpenTradeIds.has(tradeId)) {
                        // This trade was in the last pipeline tick's stage5 but is not in the current one, meaning it just closed.
                        const closedTrade = tradeSimulatorService.getAllTrades().find(t => t.id === tradeId && t.status === 'closed');
                        if (closedTrade) {
                             lastClosedTrade = {
                                coin: { ...closedTrade.coin, pnl: closedTrade.pnl, entryPrice: closedTrade.entryPrice, id: closedTrade.id },
                                reason: `Closed: ${closedTrade.closeReason || 'Manual'}`
                            };
                        }
                    }
                }
                newExitedState.stage5 = lastClosedTrade;


                setExitedCoins(newExitedState);
                return newPipeline;
            });

        } catch (error) {
            console.error("Error during simulation tick:", error);
        } finally {
            if (isMounted) {
                timeoutId = window.setTimeout(runSimulation, 5000);
            }
        }
    };

    runSimulation();

    return () => {
        isMounted = false;
        clearTimeout(timeoutId);
    };
  }, []);


  const toggleNav = () => {
    setIsNavOpen(!isNavOpen);
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-100 font-sans flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <main className={`flex-1 flex flex-col p-2 md:p-4 overflow-y-auto relative transition-all duration-300 ease-in-out pb-32 ${isNavOpen ? 'md:mr-64' : ''}`}>
          <button
            onClick={toggleNav}
            className={`fixed top-4 text-gray-300 hover:text-white z-40 p-2 bg-gray-800/50 rounded-md transition-all duration-300 ease-in-out ${isNavOpen ? 'right-68' : 'right-4'}`}
            aria-label={isNavOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {isNavOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          {activeView === 'chat' && <ChatInterface allCoins={allCoins} />}
          {activeView === 'specs' && <SpecDetails />}
          {activeView === 'pricing' && <SpotLive />}
          {activeView === 'data' && <DataSources />}
          {activeView === 'pipeline' && <PredictionPipeline pipeline={pipeline} exitedCoins={exitedCoins} allCoins={allCoins} isLoading={isPipelineLoading} stages={ALL_PIPELINE_STAGES} />}
          {activeView === 'trends' && <MarketTrends />}
          {activeView === 'wallet' && <SimulatedWallet />}
          {activeView === 'rewind' && <MarketRewind />}
        </main>

        <SideNav
          isOpen={isNavOpen}
          onClose={() => setIsNavOpen(false)}
          activeView={activeView}
          setActiveView={setActiveView}
        />
      </div>
      <PipelineFooter pipeline={pipeline} openTrades={openTrades} isNavOpen={isNavOpen} />
    </div>
  );
};

export default App;
