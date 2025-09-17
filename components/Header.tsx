import React from 'react';
import { MenuIcon } from './Icons';

export const Header: React.FC<{ onToggleNav: () => void }> = ({ onToggleNav }) => {
  return (
    <header className="w-full bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 p-4 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Jax<span className="font-bold text-lime-400">Spot</span>
          </h1>
          <p className="text-xs text-gray-400">Crypto Goatz AI Market Agent</p>
        </div>
        <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2">
                <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
                <span className="text-sm text-green-400">Pipeline Active</span>
            </div>
            <button onClick={onToggleNav} className="text-gray-300 hover:text-white md:hidden" aria-label="Open navigation menu">
              <MenuIcon />
            </button>
        </div>
      </div>
    </header>
  );
};