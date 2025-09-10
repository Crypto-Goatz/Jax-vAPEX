import React, { useState, useEffect } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { SideNav } from './components/SideNav';
import { SpecDetails } from './components/SpecDetails';
import { SpotLive } from './components/SpotLive';
import { DataSources } from './components/DataSources';
import { PredictionPipeline } from './components/PredictionPipeline';
import { MarketTrends } from './components/MarketTrends';
import { SimulatedWallet } from './components/SimulatedWallet';
import { MarketRewind } from './components/MarketRewind';
import { MenuIcon, CloseIcon } from './components/Icons';
import { tradeSimulatorService } from './services/tradeSimulatorService';
import { fetchLivePricing } from './services/cryptoService';


export type ActiveView = 'chat' | 'specs' | 'pricing' | 'data' | 'pipeline' | 'trends' | 'wallet' | 'rewind';

const App: React.FC = () => {
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('pipeline');

  useEffect(() => {
    // This interval will periodically update the P/L of open trades in the background
    const updateInterval = setInterval(async () => {
      try {
        const livePrices = await fetchLivePricing();
        if (livePrices.length > 0) {
          tradeSimulatorService.updateOpenTrades(livePrices);
        }
      } catch (error) {
        console.error("Background price refresh for wallet failed:", error);
      }
    }, 10000); // Update every 10 seconds

    return () => clearInterval(updateInterval);
  }, []);

  const toggleNav = () => {
    setIsNavOpen(!isNavOpen);
  };

  return (
    <div className="h-screen bg-gray-900 text-gray-100 font-sans flex overflow-hidden">
      <main className={`flex-1 flex flex-col p-2 md:p-4 overflow-y-auto relative transition-all duration-300 ease-in-out ${isNavOpen ? 'md:mr-64' : ''}`}>
        {/* Main Nav Toggle */}
        <button
          onClick={toggleNav}
          className={`fixed top-4 text-gray-300 hover:text-white z-40 p-2 bg-gray-800/50 rounded-md transition-all duration-300 ease-in-out ${isNavOpen ? 'right-68' : 'right-4'}`}
          aria-label={isNavOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {isNavOpen ? <CloseIcon /> : <MenuIcon />}
        </button>

        {activeView === 'chat' && <ChatInterface />}
        {activeView === 'specs' && <SpecDetails />}
        {activeView === 'pricing' && <SpotLive />}
        {activeView === 'data' && <DataSources />}
        {activeView === 'pipeline' && <PredictionPipeline />}
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
  );
};

export default App;