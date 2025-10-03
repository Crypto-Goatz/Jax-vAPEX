

import React, { useState, useEffect } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { SideNav } from './components/SideNav';
import { SpecDetails } from './components/SpecDetails';
import { SpotLive } from './components/SpotLive';
import { DataSources } from './components/DataSources';
import { PredictionPipeline, PipelineStageDefinition } from './components/PredictionPipeline';
import { MarketTrends } from './components/MarketTrends';
import { SimulatedWallet } from './components/SimulatedWallet';
import { ActiveLearning } from './components/ActiveLearning';
import { Experiments } from './components/Experiments';
import { JaxSignals } from './components/JaxSignals';
import { SignalLab } from './components/SignalLab';
import { MarketRewind } from './components/MarketRewind';
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
import { googleSheetService } from './services/googleSheetService';
import { CoreSettings } from './components/CoreSettings'; // New Admin Panel

export type ActiveView = 'chat' | 'specs' | 'pricing' | 'data' | 'pipeline' | 'trends' | 'wallet' | 'learning' | 'experiments' | 'signals' | 'signalLab' | 'dashboard' | 'macro' | 'coreSettings' | 'rewind';

export interface PipelineCryptoPrice extends CryptoPrice {
  confidence?: number;
  pnl?: number;
  entryPrice?: number;
}
type PipelineState = { [key: string]: PipelineCryptoPrice[] };
type ExitedState = { [key: string]: { coin: PipelineCryptoPrice; reason: string } | null };


const PIPELINE_STAGES: PipelineStageDefinition[] = [
  { 
    id: 'stage1', 
    title: 'Hold Signals', 
    description: 'Assets AI recommends holding based on current conditions.',
    passCondition: () => true,
    getConditionText: (coin: PipelineCryptoPrice) => `AI Confidence: ${coin.confidence?.toFixed(0)}%`
  },
  { 
    id: 'stage2', 
    title: 'Neutral', 
    description: 'Assets with no strong signal.',
    passCondition: () => true,
    getConditionText: (coin: PipelineCryptoPrice) => `AI Confidence: ${coin.confidence?.toFixed(0)}%`
  },
  { 
    id: 'stage3', 
    title: 'Sell Signals', 
    description: 'Assets AI recommends selling or shorting.',
    passCondition: () => true,
    getConditionText: (coin: PipelineCryptoPrice) => `AI Confidence: ${coin.confidence?.toFixed(0)}%`
  },
];

const EXECUTION_STAGE_DEFINITION: PipelineStageDefinition = {
  id: 'stage4',
  title: 'Buy Signals',
  description: 'Assets AI recommends buying based on strong bullish signals.',
  passCondition: () => true,
  getConditionText: (coin: PipelineCryptoPrice) => `AI Confidence: ${coin.confidence?.toFixed(0)}%`
};

const ACTIVE_TRADES_STAGE_DEFINITION: PipelineStageDefinition = {
  id: 'stage5',
  title: 'Active Trades',
  description: 'Simulated open positions being monitored for TP/SL.',
  passCondition: () => true,
  getConditionText: (coin: PipelineCryptoPrice) => `Entry: $${coin.entryPrice?.toFixed(2)}`
};

const HOLDING_STAGE_DEFINITION: PipelineStageDefinition = {
    id: 'stage6',
    title: 'Recommended Holds',
    description: 'Recently closed, profitable trades suggested for long-term watch.',
    passCondition: () => true,
    getConditionText: (coin: PipelineCryptoPrice) => `Realized P/L: $${coin.pnl != null ? coin.pnl.toFixed(2) : '—'}`
};

const ALL_STAGE_DEFINITIONS = [...PIPELINE_STAGES, EXECUTION_STAGE_DEFINITION, ACTIVE_TRADES_STAGE_DEFINITION, HOLDING_STAGE_DEFINITION];
const RENDER_PIPELINE_STAGES = [...PIPELINE_STAGES, EXECUTION_STAGE_DEFINITION, ACTIVE_TRADES_STAGE_DEFINITION];

const App: React.FC = () => {
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [isFooterExpanded, setIsFooterExpanded] = useState(false);
  
  const [pipeline, setPipeline] = useState<PipelineState>({ stage1: [], stage2: [], stage3: [], stage4: [], stage5: [], stage6: [] });
  const [exitedCoins, setExitedCoins] = useState<ExitedState>({ stage1: null, stage2: null, stage3: null, stage4: null, stage5: null, stage6: null });
  const [allCoins, setAllCoins] = useState<CryptoPrice[]>([]);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [isPipelineLoading, setIsPipelineLoading] = useState(true);

  const [globalLiquidity, setGlobalLiquidity] = useState<GlobalLiquidity | null>(null);
  const [newsSentiment, setNewsSentiment] = useState<NewsSentiment | null>(null);

  const [macroData, setMacroData] = useState<MacroData | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(watchlistService.getWatchlistSymbols());
  
  const [detailCoin, setDetailCoin] = useState<CryptoPrice | null>(null);

  const [historicalMacroData, setHistoricalMacroData] = useState<HistoricalMacroDataPoint[]>([]);
  const [allBtcHistory, setAllBtcHistory] = useState<BtcHistoryEntry[]>([]);

  useEffect(() => {
    if (activeView !== 'pipeline' && activeView !== 'chat' && isFooterExpanded) {
        setIsFooterExpanded(false);
    }
  }, [activeView, isFooterExpanded]);

  useEffect(() => {
    const updateWatchlist = () => setWatchlist(watchlistService.getWatchlistSymbols());
    watchlistService.subscribe(updateWatchlist);
    return () => watchlistService.unsubscribe(updateWatchlist);
  }, []);

  useEffect(() => {
    const updateTrades = () => {
      setOpenTrades(tradeSimulatorService.getAllTrades().filter(t => t.status === 'open'));
    };
    tradeSimulatorService.subscribe(updateTrades);
    updateTrades();
    return () => tradeSimulatorService.unsubscribe(updateTrades);
  }, []);

  useEffect(() => {
    const runInitialLoad = async () => {
        try {
            await btcHistoryService.init();
            
            // Fetch all data concurrently
            const [prices, globalLiq, newsSent, macro, histMacro] = await Promise.all([
                fetchLivePricing(),
                getGlobalLiquidity(),
                getNewsSentiment(),
                macroService.getMacroData(),
                macroService.getHistoricalMacroData()
            ]);
            
            setAllCoins(prices);
            setGlobalLiquidity(globalLiq);
            setNewsSentiment(newsSent);
            setMacroData(macro);
            setHistoricalMacroData(histMacro);
            setAllBtcHistory(btcHistoryService.getBtcHistory());

            if (prices.length > 0) {
                tradeSimulatorService.updateOpenTrades(prices);
                signalsService.checkForSignalTriggers(prices, newsSent);
            }
            
            if (isPipelineLoading && prices.length > 0) setIsPipelineLoading(false);
            
            // --- NEW PIPELINE LOGIC ---
            const pipelineSignals = await googleSheetService.fetchData<any>('pipeline');
            const newPipeline: PipelineState = { stage1: [], stage2: [], stage3: [], stage4: [], stage5: [], stage6: [] };
            const priceMap = new Map(prices.map(p => [p.symbol.toUpperCase(), p]));

            pipelineSignals.forEach(signal => {
                const coinData = priceMap.get(signal.Asset?.toUpperCase());
                if (coinData) {
                    const pipelineCoin: PipelineCryptoPrice = {
                        ...coinData,
                        confidence: signal.Score * 100, // Assuming score is 0-1
                    };

                    switch (signal.Decision?.toUpperCase()) {
                        case 'BUY': newPipeline.stage4.push(pipelineCoin); break;
                        case 'SELL': newPipeline.stage3.push(pipelineCoin); break;
                        case 'HOLD': newPipeline.stage1.push(pipelineCoin); break;
                        default: break; // Or push to a 'neutral' stage if desired
                    }
                }
            });

            // Update active trades for stage 5
            const currentOpenTrades = tradeSimulatorService.getAllTrades().filter(t => t.status === 'open');
            newPipeline.stage5 = currentOpenTrades.map(trade => {
                const liveCoinData = prices.find(p => p.id === trade.coin.id) || trade.coin;
                return { ...liveCoinData, pnl: trade.pnl, entryPrice: trade.entryPrice, id: trade.id };
            });

            // Holding stage logic remains the same
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const recentProfitableClosed = tradeSimulatorService.getAllTrades().filter(t => t.status === 'closed' && (t.pnl ?? 0) > 0 && t.closeTimestamp && t.closeTimestamp > sevenDaysAgo);
            const holdingMap = new Map<string, Trade>();
            recentProfitableClosed.forEach(trade => {
                if (!holdingMap.has(trade.coin.id) || trade.closeTimestamp! > holdingMap.get(trade.coin.id)!.closeTimestamp!) {
                    holdingMap.set(trade.coin.id, trade);
                }
            });
            newPipeline.stage6 = Array.from(holdingMap.values()).map(trade => ({...trade.coin, pnl: trade.pnl, entryPrice: trade.entryPrice, id: trade.id }));

            // Auto-execute trades based on new signals
            const executionThreshold = tradeSimulatorService.getSettings().aiConfidence;
            for (const coin of newPipeline.stage4) {
                 if ((coin.confidence ?? 0) > executionThreshold) {
                    tradeSimulatorService.executeTrade(coin, 'buy');
                 }
            }

            setPipeline(newPipeline);
            // Note: Exited coins logic is complex and may not map well to the new signal-based pipeline.
            // For now, we'll simplify and not display exited coins to avoid incorrect information.
            setExitedCoins({ stage1: null, stage2: null, stage3: null, stage4: null, stage5: null, stage6: null });


        } catch (error) {
            console.error("Error during initial data load:", error);
            setIsPipelineLoading(false);
        }
    };

    runInitialLoad();

  }, []);


  const toggleNav = () => {
    setIsNavOpen(!isNavOpen);
  };

  const footerHeightClass = isFooterExpanded ? 'pb-[33vh]' : 'pb-8';

  return (
    <div className="h-screen bg-gray-100 text-gray-800 font-sans flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <main className={`flex-1 flex flex-col p-2 md:p-4 overflow-y-auto relative transition-all duration-300 ease-in-out ${footerHeightClass} ${isNavOpen ? 'md:mr-64' : ''}`}>
          <button
            onClick={toggleNav}
            className={`fixed top-4 right-4 text-gray-600 hover:text-gray-900 z-40 p-2 bg-white/50 backdrop-blur-sm rounded-md shadow-md transition-transform duration-300 ease-in-out ${isNavOpen ? 'md:translate-x-[-16rem]' : 'md:translate-x-0'}`}
            aria-label={isNavOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {isNavOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          {activeView === 'dashboard' && <Dashboard />}
          {activeView === 'chat' && <ChatInterface allCoins={allCoins} />}
          {activeView === 'specs' && <SpecDetails />}
          {activeView === 'pricing' && <SpotLive />}
          {activeView === 'data' && <DataSources />}
          {activeView === 'pipeline' && <PredictionPipeline pipeline={pipeline} exitedCoins={exitedCoins} allCoins={allCoins} isLoading={isPipelineLoading} stages={RENDER_PIPELINE_STAGES} onShowCoinDetail={(coin) => setDetailCoin(coin)} />}
          {activeView === 'trends' && <MarketTrends allCoins={allCoins} newsSentiment={newsSentiment} />}
          {activeView === 'wallet' && <SimulatedWallet />}
          {activeView === 'learning' && <ActiveLearning allCoins={allCoins} />}
          {activeView === 'experiments' && <Experiments allCoins={allCoins} />}
          {activeView === 'signals' && <JaxSignals allCoins={allCoins} />}
          {activeView === 'signalLab' && <SignalLab btcHistory={allBtcHistory} allCoins={allCoins} />}
          {activeView === 'rewind' && <MarketRewind btcHistory={allBtcHistory} />}
          {activeView === 'macro' && <MacroView btcHistory={allBtcHistory} macroHistory={historicalMacroData} />}
          {activeView === 'coreSettings' && <CoreSettings />}
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