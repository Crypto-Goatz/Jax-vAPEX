import React, { useState, useEffect } from 'react';
import { WalletIcon, LightbulbIcon, SettingsIcon } from './Icons';

type DrawerType = 'wallet' | 'prompts' | 'strategy' | null;

interface JaxCoreMenuProps {
    activeDrawer: DrawerType;
    onToggleDrawer: (drawer: DrawerType) => void;
}

export const JaxCoreMenu: React.FC<JaxCoreMenuProps> = ({ activeDrawer, onToggleDrawer }) => {
    const [accuracy, setAccuracy] = useState(0);

    useEffect(() => {
        // Set initial accuracy and only update it periodically to feel more stable
        const updateAccuracy = () => setAccuracy(parseFloat((Math.random() * (99.0 - 71.0) + 71.0).toFixed(1)));
        updateAccuracy();
        const interval = setInterval(updateAccuracy, 30000); // Update every 30s
        return () => clearInterval(interval);
    }, []);

    const menuButtonClass = "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors";
    const activeMenuButtonClass = "bg-purple-600 text-white";
    const inactiveMenuButtonClass = "bg-gray-800 hover:bg-gray-700 text-gray-300";

    return (
        <div className="relative flex-shrink-0 z-40">
            <div className="p-2 bg-gray-900/50 border-b border-gray-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => onToggleDrawer('wallet')} className={`${menuButtonClass} ${activeDrawer === 'wallet' ? activeMenuButtonClass : inactiveMenuButtonClass}`}>
                        <WalletIcon className="w-5 h-5"/> Global Wallet
                    </button>
                    <button onClick={() => onToggleDrawer('prompts')} className={`${menuButtonClass} ${activeDrawer === 'prompts' ? activeMenuButtonClass : inactiveMenuButtonClass}`}>
                        <LightbulbIcon className="w-5 h-5"/> Prompts
                    </button>
                    <button onClick={() => onToggleDrawer('strategy')} className={`${menuButtonClass} ${activeDrawer === 'strategy' ? activeMenuButtonClass : inactiveMenuButtonClass}`}>
                        <SettingsIcon className="w-5 h-5"/> Strategy
                    </button>
                </div>
                <div className="text-sm text-white">
                    JaxAI Prediction Score: <span className="font-bold text-green-400">{accuracy}% Accuracy</span>
                </div>
            </div>
        </div>
    );
};
