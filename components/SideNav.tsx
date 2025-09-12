import React from 'react';
import { CloseIcon, ChartBarIcon, DatabaseIcon, PipelineIcon, LineChartIcon, ChatBubbleIcon, WalletIcon, RewindIcon } from './Icons';
import type { ActiveView } from '../App';
import { Logo } from './Logo';

type SideNavProps = {
  isOpen: boolean;
  onClose: () => void;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
};

export const SideNav: React.FC<SideNavProps> = ({ isOpen, onClose, activeView, setActiveView }) => {
  const navButtonClasses = "w-full text-left p-3 rounded-lg transition-colors text-gray-300 hover:bg-gray-700 flex items-center space-x-3";
  const activeButtonClasses = "bg-purple-600 text-white hover:bg-purple-600";

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className={`fixed inset-0 bg-black/60 z-20 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* SideNav Panel */}
      <aside className={`fixed top-0 right-0 h-full bg-gray-900/80 backdrop-blur-md border-l border-gray-700 w-64 z-30 transform transition-transform duration-300 ease-in-out
                       ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="navigation"
        aria-label="Main Navigation">
        {/* Header section */}
        <div className="p-4 flex justify-between items-center border-b border-gray-700 h-[73px]">
           <div className="flex items-center space-x-3">
            <Logo className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold text-white">
                Jax<span className="text-purple-400">Spot</span>
              </h1>
              <p className="text-xs text-gray-400">AI Market Agent</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white md:hidden" aria-label="Close navigation menu">
            <CloseIcon />
          </button>
        </div>

        {/* Status and Navigation */}
        <div className="p-4 space-y-4">
          <div className="flex items-center space-x-2 p-3 bg-gray-800/50 rounded-lg">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </div>
            <span className="text-sm text-green-400">Pipeline Active</span>
          </div>

          <button
            onClick={() => setActiveView('chat')}
            className={`w-full text-left p-4 rounded-lg transition-all duration-300 flex items-center space-x-3 text-lg font-semibold shadow-lg hover:shadow-purple-500/40 ${
              activeView === 'chat'
                ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
            }`}
          >
            <ChatBubbleIcon />
            <span>Jax AI</span>
          </button>

          <nav className="space-y-2 border-t border-gray-700/60 pt-4">
            <button
              onClick={() => setActiveView('pipeline')}
              className={`${navButtonClasses} ${activeView === 'pipeline' ? activeButtonClasses : ''}`}
            >
              <PipelineIcon />
              <span>Pump Pipeline</span>
            </button>
            <button
              onClick={() => setActiveView('wallet')}
              className={`${navButtonClasses} ${activeView === 'wallet' ? activeButtonClasses : ''}`}
            >
              <WalletIcon />
              <span>Simulated Wallet</span>
            </button>
            <button
              onClick={() => setActiveView('trends')}
              className={`${navButtonClasses} ${activeView === 'trends' ? activeButtonClasses : ''}`}
            >
              <LineChartIcon />
              <span>Market Trends</span>
            </button>
             <button
              onClick={() => setActiveView('pricing')}
              className={`${navButtonClasses} ${activeView === 'pricing' ? activeButtonClasses : ''}`}
            >
              <ChartBarIcon />
              <span>SpotLive</span>
            </button>
            <button
              onClick={() => setActiveView('rewind')}
              className={`${navButtonClasses} ${activeView === 'rewind' ? activeButtonClasses : ''}`}
            >
              <RewindIcon />
              <span>Market Rewind</span>
            </button>
            <button
              onClick={() => setActiveView('data')}
              className={`${navButtonClasses} ${activeView === 'data' ? activeButtonClasses : ''}`}
            >
              <DatabaseIcon />
              <span>Data Sources</span>
            </button>
            <button
              onClick={() => setActiveView('specs')}
              className={`${navButtonClasses} ${activeView === 'specs' ? activeButtonClasses : ''}`}
            >
              <span>⚙️</span>
              <span>Spec Details</span>
            </button>
          </nav>
        </div>
      </aside>
    </>
  );
};