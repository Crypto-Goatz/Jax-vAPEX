
import React, { useState } from 'react';
import {
    CloseIcon, ChartBarIcon, DatabaseIcon, PipelineIcon, LineChartIcon, WalletIcon, RewindIcon,
    LightbulbIcon, BeakerIcon, BellIcon, FlowChartIcon, GlobeIcon, BitcoinIcon, DollarIcon, LockIcon,
    ChevronDownIcon, ChevronUpIcon, SettingsIcon
} from './Icons';
import type { ActiveView } from '../App';
import { Logo } from './Logo';
import type { GlobalLiquidity } from '../services/cryptoService';

type SideNavProps = {
  isOpen: boolean;
  onClose: () => void;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  globalLiquidity: GlobalLiquidity | null;
};

const formatCompact = (value: number) => {
    if (!value || !isFinite(value)) return '$0';
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 2,
    }).format(value);
}

const GlobalMarketStats: React.FC<{ liquidity: GlobalLiquidity }> = ({ liquidity }) => (
    <div className="space-y-3 px-3 mb-4">
        <h3 className="pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase">Global Market</h3>
        <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600"><GlobeIcon className="w-4 h-4 text-gray-500"/> Market Cap</span>
                <span className="font-mono font-semibold text-gray-800">{formatCompact(liquidity.total_market_cap)}</span>
            </div>
             <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600"><BitcoinIcon className="w-4 h-4 text-gray-500"/> BTC Dominance</span>
                <span className="font-mono font-semibold text-gray-800">{liquidity.btc_dominance.toFixed(1)}%</span>
            </div>
             <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600"><DollarIcon className="w-4 h-4 text-gray-500"/> Stablecoin Supply</span>
                <span className="font-mono font-semibold text-gray-800">{formatCompact(liquidity.stablecoin_supply)}</span>
            </div>
             <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600"><LockIcon className="w-4 h-4 text-gray-500"/> DeFi TVL</span>
                <span className="font-mono font-semibold text-gray-800">{formatCompact(liquidity.defi_tvl)}</span>
            </div>
        </div>
    </div>
);


const navItems = [
    {
        category: 'Analysis',
        items: [
            { view: 'pipeline', label: 'Pump Pipeline', icon: <PipelineIcon /> },
            { view: 'pricing', label: 'SpotLive', icon: <ChartBarIcon /> },
            { view: 'trends', label: 'Market Trends', icon: <LineChartIcon /> },
            { view: 'macro', label: 'Macro Analysis', icon: <GlobeIcon /> },
        ],
    },
    {
        category: 'AI Core',
        items: [
            { view: 'learning', label: 'Active Learning', icon: <LightbulbIcon /> },
            { view: 'experiments', label: 'Experiments', icon: <BeakerIcon /> },
            { view: 'signalLab', label: 'Signal Lab', icon: <FlowChartIcon /> },
            { view: 'signals', label: 'Jax Signals', icon: <BellIcon /> },
            { view: 'wallet', label: 'Simulated Wallet', icon: <WalletIcon /> },
        ],
    },
    {
        category: 'System',
        items: [
            { view: 'coreSettings', label: 'Core Settings', icon: <SettingsIcon /> },
            { view: 'data', label: 'Data Sources', icon: <DatabaseIcon /> },
            { view: 'specs', label: 'System Specs', icon: <RewindIcon /> },
        ],
    },
] as const;

type NavCategory = typeof navItems[number]['category'];

export const SideNav: React.FC<SideNavProps> = ({ isOpen, onClose, activeView, setActiveView, globalLiquidity }) => {
  const [expandedCategory, setExpandedCategory] = useState<NavCategory | null>('Analysis');
  
  const handleCategoryClick = (category: NavCategory) => {
    setExpandedCategory(prev => (prev === category ? null : category));
  };

  const navButtonClasses = "w-full text-left p-3 rounded-lg transition-colors text-gray-600 hover:bg-gray-200 hover:text-gray-900 flex items-center space-x-3";
  const activeButtonClasses = "bg-purple-600 text-white hover:bg-purple-600 hover:text-white";

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className={`fixed inset-0 bg-black/40 z-20 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* SideNav Panel */}
      <aside className={`fixed top-0 right-0 h-full bg-white/80 backdrop-blur-md border-l border-gray-200 w-64 z-30 transform transition-transform duration-300 ease-in-out
                       ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="navigation"
        aria-label="Main Navigation">
        {/* Header section */}
        <div className="p-4 flex justify-between items-center border-b border-gray-200 h-[73px]">
           <div className="flex items-center space-x-3">
            <Logo className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Jax<span className="font-bold text-lime-500">Spot</span>
              </h1>
              <p className="text-xs text-gray-500">AI Market Agent</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 md:hidden" aria-label="Close navigation menu">
            <CloseIcon />
          </button>
        </div>

        {/* Status and Navigation */}
        <div className="p-4 space-y-4 overflow-y-auto h-[calc(100vh-73px)]">
          <div className="flex items-stretch gap-2">
            <button
              onClick={() => setActiveView('chat')}
              className={`flex-1 p-3 rounded-lg transition-all duration-300 flex items-center justify-center text-lg font-bold shadow-md hover:shadow-purple-500/20 ${
                activeView === 'chat'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white'
                  : 'bg-white hover:bg-gray-100 text-gray-800 border border-gray-200'
              }`}
            >
              <span className="tracking-widest">JAX</span>
            </button>
            <button
              onClick={() => setActiveView('dashboard')}
              className={`flex-1 p-3 rounded-lg transition-all duration-300 flex items-center justify-center text-lg font-bold shadow-md hover:shadow-purple-500/20 ${
                activeView === 'dashboard'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white'
                  : 'bg-white hover:bg-gray-100 text-gray-800 border border-gray-200'
              }`}
            >
              DASH
            </button>
            <button
                onClick={() => setActiveView('pipeline')}
                className={`flex-1 p-3 rounded-lg transition-all duration-300 flex items-center justify-center text-lg font-bold shadow-md hover:shadow-purple-500/20 ${
                    activeView === 'pipeline'
                        ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white'
                        : 'bg-white hover:bg-gray-100 text-gray-800 border border-gray-200'
                }`}
            >
                SPOT
            </button>
          </div>

          <nav className="space-y-1 border-t border-gray-200/60 pt-4">
              {globalLiquidity && <GlobalMarketStats liquidity={globalLiquidity} />}
              {navItems.map(({ category, items }) => {
                  const isExpanded = expandedCategory === category;
                  return (
                      <div key={category}>
                          <button
                              onClick={() => handleCategoryClick(category)}
                              className="w-full flex justify-between items-center p-3 text-left text-sm font-bold text-purple-600 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none"
                              aria-expanded={isExpanded}
                          >
                              <span>{category}</span>
                              {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                          </button>
                          <div className={`pl-2 space-y-1 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 py-1' : 'max-h-0'}`}>
                              {items.map(({ view, label, icon }) => (
                                  <button
                                      key={view}
                                      onClick={() => setActiveView(view as ActiveView)}
                                      className={`${navButtonClasses} ${activeView === view ? activeButtonClasses : ''}`}
                                  >
                                      {React.cloneElement(icon, { className: 'h-5 w-5' })}
                                      <span>{label}</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                  )
              })}
          </nav>
        </div>
      </aside>
    </>
  );
};
