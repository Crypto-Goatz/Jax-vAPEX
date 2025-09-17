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
import { ActiveLearning } from './components/ActiveLearning';
import { Experiments } from './components/Experiments';
import { JaxSignals } from './components/JaxSignals';
import { SignalStudio } from './components/SignalStudio';
import { MacroView } from './components/MacroView';
import { MenuIcon, CloseIcon } from './components/Icons';
import { tradeSimulatorService, Trade } from './services/tradeSimulatorService';
import { signalsService } from './services/signalsService';
import { fetchLivePricing, CryptoPrice, GlobalLiquidity, NewsSentiment, getGlobalLiquidity, getNewsSentiment } from './services/cryptoService';
import { PipelineFooter } from './components/PipelineFooter';
import { Dashboard } from './components/Dashboard';
import { macroService, MacroData, HistoricalMacroDataPoint } from './services/macroService';
import { btcHistoryService, BtcHistoryEntry } from './services/btcHistoryService';
import { watchlistService } from './services/watchlistService';
import { CoinDetailModal } from './components/CoinDetailModal';

export type ActiveView = 'chat' | 'specs' | 'pricing' | 'data' | 'pipeline' | 'trends' | 'wallet' | 'rewind' | 'learning' | 'experiments' | 'signals' | 'signalStudio' | 'dashboard' | 'macro';

export interface PipelineCryptoPrice extends CryptoPrice {
  confidence?: number;
  pnl?: number;
  entryPrice?: number;
}
type PipelineState = { [key: string]: PipelineCryptoPrice[] };
type ExitedState = { [key: string]: { coin: PipelineCryptoPrice; reason: string } | null };


// --- NEW, REFINED STAGE DEFINITIONS FOR EXCLUSIVE FUNNEL ---
const PIPELINE_STAGES: PipelineStageDefinition[] = [
  { 
    id: 'stage1', 
    title: 'Momentum Watch', 
    description: 'Assets showing initial positive 24h price action.',
    passCondition: (coin: CryptoPrice) => coin.change24h > 2,
    getConditionText: (coin: CryptoPrice) => `24h Change > 2% (Current: ${coin.change24h.toFixed(2)}%)`
  },
  { 
    id: 'stage2', 
    title: 'Liquidity Screen', 
    description: 'Momentum assets that also have an established market cap.',
    passCondition: (coin: CryptoPrice) => (coin.marketCap ?? 0) > 100000000,
    getConditionText: (coin: CryptoPrice) => `MCap > $100M (Current: ${coin.marketCap ? `$${(coin.marketCap / 1_000_000).toFixed(0)}M` : 'N/A'})`
  },
  { 
    id: 'stage3', 
    title: 'Risk Screen', 
    description: 'Liquid assets filtered for extreme volatility.',
    passCondition: (coin: CryptoPrice) => coin.change24h < 25,
    getConditionText: (coin: CryptoPrice) => `24h Change < 25% (Current: ${coin.change24h.toFixed(2)}%)`
  },
];

const EXECUTION_STAGE_DEFINITION: PipelineStageDefinition = {
  id: 'stage4',
  title: 'Execution Candidates',
  description: 'Assets passing all filters, scored for confidence before trade execution.',
  passCondition: () => true, // Membership is determined by passing all previous stages
  getConditionText: (coin: CryptoPrice) => `Awaiting final AI confidence check.`
};

const ACTIVE_TRADES_STAGE_DEFINITION: PipelineStageDefinition = {
  id: 'stage5',
  title: 'Active Trades',
  description: 'Simulated open positions being monitored for TP/SL.',
  passCondition: () => true, // All open trades are in this stage
  getConditionText: (coin: PipelineCryptoPrice) => `Entry: $${coin.entryPrice?.toFixed(2)}`
};

const HOLDING_STAGE_DEFINITION: PipelineStageDefinition = {
    id: 'stage6',
    title: 'Recommended Holds',
    description: 'Recently closed, profitable trades suggested for long-term watch.',
    passCondition: () => true,
    getConditionText: (coin: PipelineCryptoPrice) => `Realized P/L: ${formatCurrency(coin.pnl)}`
};

const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};


const ALL_STAGE_DEFINITIONS = [...PIPELINE_STAGES, EXECUTION_STAGE_DEFINITION, ACTIVE_TRADES_STAGE_DEFINITION, HOLDING_STAGE_DEFINITION];
const RENDER_PIPELINE_STAGES = [...PIPELINE_STAGES, EXECUTION_STAGE_DEFINITION, ACTIVE_TRADES_STAGE_DEFINITION];


const App: React.FC = () => {
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [isFooterExpanded, setIsFooterExpanded] = useState(false);
  
  // --- Centralized Pipeline State ---
  const [pipeline, setPipeline] = useState<PipelineState>({ stage1: [], stage2: [], stage3: [], stage4: [], stage5: [], stage6: [] });
  const [exitedCoins, setExitedCoins] = useState<ExitedState>({ stage1: null, stage2: null, stage3: null, stage4: null, stage5: null, stage6: null });
  const [allCoins, setAllCoins] = useState<CryptoPrice[]>([]);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [isPipelineLoading, setIsPipelineLoading] = useState(true);

  // --- NEW: State for global data ---
  const [globalLiquidity, setGlobalLiquidity] = useState<GlobalLiquidity | null>(null);
  const [newsSentiment, setNewsSentiment] = useState<NewsSentiment | null>(null);

  // --- NEW: State for dashboard data ---
  const [macroData, setMacroData] = useState<MacroData | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(watchlistService.getWatchlistSymbols());
  
  // --- NEW: State for coin detail modal ---
  const [detailCoin, setDetailCoin] = useState<CryptoPrice | null>(null);

  // --- NEW: State for Macro view ---
  const [historicalMacroData, setHistoricalMacroData] = useState<HistoricalMacroDataPoint[]>([]);
  const [allBtcHistory, setAllBtcHistory] = useState<BtcHistoryEntry[]>([]);


  // Automatically collapse footer on non-pipeline/chat views
  useEffect(() => {
    if (activeView !== 'pipeline' && activeView !== 'chat' && isFooterExpanded) {
        setIsFooterExpanded(false);
    }
  }, [activeView, isFooterExpanded]);

  // Watchlist subscription
  useEffect(() => {
    const updateWatchlist = () => setWatchlist(watchlistService.getWatchlistSymbols());
    watchlistService.subscribe(updateWatchlist);
    return () => watchlistService.unsubscribe(updateWatchlist);
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

  // --- Initial Data Fetch and Simulation (runs once) ---
  useEffect(() => {
    const runInitialLoad = async () => {
        try {
            // Initialize services that fetch data
            btcHistoryService.init();

            const prices = await fetchLivePricing();

            // This is important for other parts of the app that rely on updated trades.
            if (prices.length > 0) {
              tradeSimulatorService.updateOpenTrades(prices);
            }

            setGlobalLiquidity(await getGlobalLiquidity());
            setNewsSentiment(await getNewsSentiment());
            setMacroData(await macroService.getMacroData());
            setHistoricalMacroData(await macroService.getHistoricalMacroData());
            setAllBtcHistory(btcHistoryService.getBtcHistory());
            
            if (isPipelineLoading && prices.length > 0) setIsPipelineLoading(false);
            
            setAllCoins(prices);

            signalsService.checkForSignalTriggers(prices);

            // --- Single run of pipeline logic ---
            const newPipeline: PipelineState = { stage1: [], stage2: [], stage3: [], stage4: [], stage5: [], stage6: [] };

            const currentOpenTrades = tradeSimulatorService.getAllTrades().filter(t => t.status === 'open');
            newPipeline.stage5 = currentOpenTrades.map(trade => {
                const liveCoinData = prices.find(p => p.id === trade.coin.id) || trade.coin;
                return { ...liveCoinData, pnl: trade.pnl, entryPrice: trade.entryPrice, id: trade.id };
            });
            const openOrRecentlyClosedTradeIds = new Set(tradeSimulatorService.getAllTrades().map(t => t.coin.id));

            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const recentProfitableClosed = tradeSimulatorService.getAllTrades().filter(
                t => t.status === 'closed' && (t.pnl ?? 0) > 0 && t.closeTimestamp && t.closeTimestamp > sevenDaysAgo
            );
            const holdingMap = new Map<string, Trade>();
            recentProfitableClosed.forEach(trade => {
                if (!holdingMap.has(trade.coin.id) || trade.closeTimestamp! > holdingMap.get(trade.coin.id)!.closeTimestamp!) {
                    holdingMap.set(trade.coin.id, trade);
                }
            });
            newPipeline.stage6 = Array.from(holdingMap.values()).map(trade => ({...trade.coin, pnl: trade.pnl, entryPrice: trade.entryPrice, id: trade.id }));
            const holdingIds = new Set(newPipeline.stage6.map(c => c.id));

            const candidates = prices.filter(c => !openOrRecentlyClosedTradeIds.has(c.id) && !holdingIds.has(c.id));

            candidates.forEach(coin => {
                const passesS1 = PIPELINE_STAGES[0].passCondition(coin);
                if (!passesS1) {
                     newPipeline.stage1.push(coin);
                     return;
                }
                const passesS2 = PIPELINE_STAGES[1].passCondition(coin);
                const passesS3 = PIPELINE_STAGES[2].passCondition(coin);
                if (passesS2 && passesS3) {
                    const momentumScore = Math.min(1, Math.max(0, (coin.change24h - 2) / (25 - 2)));
                    const mcap = coin.marketCap ?? 100_000_000;
                    const mcapScore = Math.min(1, Math.max(0, (Math.log10(mcap) - 8) / (12.7 - 8)));
                    const confidence = (momentumScore * 0.7 + mcapScore * 0.3) * 100;
                    newPipeline.stage4.push({ ...coin, confidence });
                } else if (passesS2) {
                    newPipeline.stage3.push(coin);
                } else {
                    newPipeline.stage2.push(coin);
                }
            });

            const executionThreshold = tradeSimulatorService.getSettings().aiConfidence;
            for (const coin of newPipeline.stage4) {
                 if ((coin.confidence ?? 0) > executionThreshold) {
                    tradeSimulatorService.executeTrade(coin, 'buy');
                 }
            }
            
            setPipeline(currentPipeline => {
                const newExitedState: ExitedState = { stage1: null, stage2: null, stage3: null, stage4: null, stage5: null, stage6: null };
                ALL_STAGE_DEFINITIONS.slice(0, 4).forEach(stage => {
                    const previousStageCoins = currentPipeline[stage.id] ?? [];
                    const previousIds = new Set(previousStageCoins.map(c => c.id));
                    const currentIds = new Set(newPipeline[stage.id]?.map(c => c.id) ?? []);
                    let lastExitedCoin = null;
                    for (const id of previousIds) {
                        if (!currentIds.has(id)) {
                            const exitedCoinData = previousStageCoins.find(c => c.id === id);
                            if (exitedCoinData) {
                                const latestPriceData = prices.find(p => p.id === id);
                                lastExitedCoin = { 
                                    coin: latestPriceData || exitedCoinData, 
                                    reason: "Advanced or exited." 
                                };
                            }
                        }
                    }
                    newExitedState[stage.id] = lastExitedCoin;
                });
                setExitedCoins(newExitedState);
                return newPipeline;
            });

        } catch (error) {
            console.error("Error during initial data load:", error);
            setIsPipelineLoading(false); // Stop loading indicator on error
        }
    };

    runInitialLoad();

  }, []);


  const toggleNav = () => {
    setIsNavOpen(!isNavOpen);
  };

  const footerHeightClass = isFooterExpanded ? 'pb-[33vh]' : 'pb-8';

  return (
    <div className="h-screen bg-gray-900 text-gray-100 font-sans flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <main className={`flex-1 flex flex-col p-2 md:p-4 overflow-y-auto relative transition-all duration-300 ease-in-out ${footerHeightClass} ${isNavOpen ? 'md:mr-64' : ''}`}>
          <button
            onClick={toggleNav}
            className={`fixed top-4 right-4 text-gray-300 hover:text-white z-40 p-2 bg-gray-800/50 rounded-md transition-transform duration-300 ease-in-out ${isNavOpen ? 'md:translate-x-[-16rem]' : 'md:translate-x-0'}`}
            aria-label={isNavOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {isNavOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          {activeView === 'dashboard' && <Dashboard allCoins={allCoins} newsSentiment={newsSentiment} macroData={macroData} watchlist={watchlist} onShowCoinDetail={(coin) => setDetailCoin(coin)} />}
          {activeView === 'chat' && <ChatInterface allCoins={allCoins} />}
          {activeView === 'specs' && <SpecDetails />}
          {activeView === 'pricing' && <SpotLive />}
          {activeView === 'data' && <DataSources />}
          {activeView === 'pipeline' && <PredictionPipeline pipeline={pipeline} exitedCoins={exitedCoins} allCoins={allCoins} isLoading={isPipelineLoading} stages={RENDER_PIPELINE_STAGES} onShowCoinDetail={(coin) => setDetailCoin(coin)} />}
          {activeView === 'trends' && <MarketTrends allCoins={allCoins} newsSentiment={newsSentiment} />}
          {activeView === 'wallet' && <SimulatedWallet />}
          {activeView === 'rewind' && <MarketRewind />}
          {activeView === 'learning' && <ActiveLearning allCoins={allCoins} />}
          {activeView === 'experiments' && <Experiments allCoins={allCoins} />}
          {activeView === 'signals' && <JaxSignals allCoins={allCoins} />}
          {activeView === 'signalStudio' && <SignalStudio allCoins={allCoins} />}
          {activeView === 'macro' && <MacroView btcHistory={allBtcHistory} macroHistory={historicalMacroData} />}
        </main>

        <SideNav
          isOpen={isNavOpen}
          onClose={() => setIsNavOpen(false)}
          activeView={activeView}
          setActiveView={setActiveView}
          globalLiquidity={globalLiquidity}
        />
      </div>
       {(activeView === 'pipeline' || activeView === 'chat') && (
        <PipelineFooter
            pipeline={pipeline}
            isNavOpen={isNavOpen}
            isExpanded={isFooterExpanded}
            onToggle={() => setIsFooterExpanded(!isFooterExpanded)}
        />
       )}
       {detailCoin && <CoinDetailModal coin={detailCoin} onClose={() => setDetailCoin(null)} />}
    </div>
  );
};

export default App;