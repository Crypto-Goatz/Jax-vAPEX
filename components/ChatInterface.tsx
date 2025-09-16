import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage as ChatMessageType, Idea, Signal, Health, ChatContext } from '../types';
import { runChat } from '../services/geminiService';
import { ChatMessage } from './ChatMessage';
import { ContextHub } from './ContextHub';
import { LoadingSpinner } from './LoadingSpinner';
import { SendIcon, BookmarkIcon } from './Icons';
import type { CryptoPrice } from '../services/cryptoService';
import { CryptoChartModal } from './CryptoChartModal';
import { tradeSimulatorService, Trade, WalletSettings } from '../services/tradeSimulatorService';
import { JaxCoreMenu } from './JaxCoreMenu';
import { LineChartIcon } from './Icons';

// --- DRAWER & CONTENT COMPONENTS (Moved from JaxCoreMenu for proper scoping) ---

type DrawerType = 'wallet' | 'prompts' | 'strategy' | null;

const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || !isFinite(value)) return '$0.00';
    const fractionDigits = (Math.abs(value) > 0 && Math.abs(value) < 1) ? 6 : 2;
    return value.toLocaleString('en-US', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: 2, maximumFractionDigits: Math.max(2, fractionDigits)
    });
};

const Drawer: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}> = ({ isOpen, onClose, children }) => {
    return (
        <div className={`absolute inset-0 z-30 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className={`absolute top-0 left-0 w-full bg-gray-900/80 border-t border-gray-700 shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] h-[50vh] md:h-[40vh] ${isOpen ? 'translate-y-0' : '-translate-y-full'}`}>
                {children}
            </div>
        </div>
    );
};

const TradeRow: React.FC<{ trade: Trade; type: 'open' | 'closed'; onViewChart?: () => void; }> = ({ trade, type, onViewChart }) => {
    const isBuy = trade.direction === 'buy';
    const pnl = trade.pnl ?? 0;
    const isProfit = pnl >= 0;
    const pnlColor = isProfit ? 'text-green-400' : 'text-red-400';
    const pnlPercentage = trade.sizeUSD !== 0 ? (pnl / trade.sizeUSD) * 100 : 0;

    return (
        <tr className="border-b border-gray-700/50 hover:bg-gray-800/50">
            <td className="p-2 text-sm font-semibold text-white">{trade.coin.symbol}</td>
            <td className="p-2"><span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${isBuy ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{trade.direction.toUpperCase()}</span></td>
            <td className="p-2 font-mono text-xs text-gray-300">{formatCurrency(trade.entryPrice)}</td>
            {type === 'closed' && <td className="p-2 font-mono text-xs text-gray-300">{formatCurrency(trade.closePrice)}</td>}
            <td className="p-2 font-mono text-xs"><div className={`flex flex-col ${pnlColor}`}><span className="font-bold">{formatCurrency(pnl)}</span><span>({isProfit ? '+' : ''}{pnlPercentage.toFixed(2)}%)</span></div></td>
            <td className="p-2 text-center">
                 <button onClick={onViewChart} className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-gray-700 rounded-full transition-colors" aria-label={`View chart for ${trade.coin.symbol} trade`}>
                    <LineChartIcon className="w-4 h-4" />
                </button>
            </td>
        </tr>
    );
};

const WalletDrawerContent: React.FC = () => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [tradeForChart, setTradeForChart] = useState<Trade | null>(null);

    useEffect(() => {
        const updateTrades = () => setTrades([...tradeSimulatorService.getAllTrades()]);
        tradeSimulatorService.subscribe(updateTrades);
        updateTrades();
        return () => tradeSimulatorService.unsubscribe(updateTrades);
    }, []);

    const openTrades = trades.filter(t => t.status === 'open');
    const closedTrades = trades.filter(t => t.status === 'closed');

    return (
        <>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 h-full overflow-y-auto">
                <div className="flex flex-col bg-gray-800/50 rounded-lg border border-gray-700">
                    <h4 className="p-2 text-sm font-semibold text-purple-300 border-b border-gray-700">Open Positions ({openTrades.length})</h4>
                    <div className="flex-1 overflow-y-auto">
                       <table className="w-full text-left">
                            <thead className="text-xs text-gray-400 bg-gray-900/50 sticky top-0">
                                <tr><th className="p-2">Asset</th><th className="p-2">Side</th><th className="p-2">Entry</th><th className="p-2">P/L</th><th className="p-2 text-center">Chart</th></tr>
                            </thead>
                            <tbody>
                                {openTrades.length > 0 ? openTrades.map(t => <TradeRow key={t.id} trade={t} type="open" onViewChart={() => setTradeForChart(t)} />)
                                 : <tr><td colSpan={5} className="text-center p-4 text-xs text-gray-500">No open trades.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
                 <div className="flex flex-col bg-gray-800/50 rounded-lg border border-gray-700">
                    <h4 className="p-2 text-sm font-semibold text-purple-300 border-b border-gray-700">Recent History ({closedTrades.length})</h4>
                    <div className="flex-1 overflow-y-auto">
                       <table className="w-full text-left">
                            <thead className="text-xs text-gray-400 bg-gray-900/50 sticky top-0">
                                <tr><th className="p-2">Asset</th><th className="p-2">Side</th><th className="p-2">Entry</th><th className="p-2">Close</th><th className="p-2">P/L</th><th className="p-2 text-center">Chart</th></tr>
                            </thead>
                            <tbody>
                                {closedTrades.length > 0 ? closedTrades.slice(0, 50).map(t => <TradeRow key={t.id} trade={t} type="closed" onViewChart={() => setTradeForChart(t)} />)
                                 : <tr><td colSpan={6} className="text-center p-4 text-xs text-gray-500">No closed trades.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {tradeForChart && <CryptoChartModal trade={tradeForChart} onClose={() => setTradeForChart(null)} />}
        </>
    );
};

const PromptsDrawerContent: React.FC<{ onSelect: (prompt: string) => void }> = ({ onSelect }) => {
    const PROMPT_CATEGORIES = [
        { title: "Market Analysis", prompts: ["What's a good buy right now on Coinbase?", "Find a low-cap coin with high social volume.", "What are the top 3 trending narratives in crypto right now?"] },
        { title: "Coin Specific", prompts: ["Why is XRP's price so low?", "Analyze the current sentiment for Solana.", "Give me a technical analysis summary for Bitcoin.", "What are the biggest risks for Ethereum in the next month?"] },
        { title: "Strategy", prompts: ["Suggest a conservative trade for today.", "What indicators should I watch for a potential BTC breakout?", "How can I hedge my portfolio against a market drop?"] }
    ];

    return (
        <div className="p-4 overflow-y-auto h-full space-y-6">
            {PROMPT_CATEGORIES.map(category => (
                <div key={category.title}>
                    <h3 className="text-sm font-semibold text-purple-400 mb-2">{category.title}</h3>
                    <div className="flex flex-wrap gap-2">
                        {category.prompts.map(prompt => (
                            <button key={prompt} onClick={() => onSelect(prompt)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-xs text-left text-gray-300 rounded-lg transition-colors">
                                {prompt}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

const StrategyDrawerContent: React.FC = () => {
    const [settings, setSettings] = useState<WalletSettings>(tradeSimulatorService.getSettings());

    useEffect(() => {
        const updateSettings = () => setSettings(tradeSimulatorService.getSettings());
        tradeSimulatorService.subscribe(updateSettings);
        return () => tradeSimulatorService.unsubscribe(updateSettings);
    }, []);

    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const finalValue = type === 'range' ? parseFloat(value) : value;
        tradeSimulatorService.updateSettings({ [name]: finalValue });
    };

    return (
        <div className="p-4 h-full overflow-y-auto space-y-6">
            <h3 className="text-lg font-bold text-purple-400">AI Trading Strategy</h3>
            <p className="text-sm text-gray-400 -mt-4">These settings influence the trades JAX simulates. This does not affect the global Pump Pipeline.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="riskTolerance" className="block text-sm font-medium text-gray-300 mb-1">Risk Tolerance</label>
                    <select id="riskTolerance" name="riskTolerance" value={settings.riskTolerance} onChange={handleSettingsChange} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <option>Conservative</option><option>Moderate</option><option>Aggressive</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="investmentStyle" className="block text-sm font-medium text-gray-300 mb-1">Investment Style</label>
                    <select id="investmentStyle" name="investmentStyle" value={settings.investmentStyle} onChange={handleSettingsChange} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <option>Scalping</option><option>Day Trading</option><option>Swing Trading</option>
                    </select>
                </div>
            </div>
            <div>
                <label htmlFor="aiConfidence" className="flex justify-between items-center text-sm font-medium text-gray-300 mb-1">
                    <span>Execution Confidence Threshold</span>
                    <span className="font-mono text-purple-300 text-base">{settings.aiConfidence.toFixed(1)}%</span>
                </label>
                <input id="aiConfidence" name="aiConfidence" type="range" min="50" max="95" step="0.1" value={settings.aiConfidence} onChange={handleSettingsChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer confidence-slider" />
                <p className="text-xs text-gray-500 mt-1">Sets the minimum AI confidence score required to automatically open a trade from the pipeline.</p>
            </div>
        </div>
    );
};


// --- MAIN CHAT INTERFACE COMPONENT ---
type Timeframe = '24h' | '7d' | '30d' | '1y';

const SAVED_PROMPTS_KEY = 'jaxspot_saved_prompts';

interface ChatInterfaceProps {
  allCoins: CryptoPrice[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ allCoins }) => {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    { id: 'initial', role: 'model', content: "I am JAX, your AI market agent. How can I help you analyze the crypto markets today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStrategyMode, setIsStrategyMode] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [savedPrompts, setSavedPrompts] = useState<string[]>([]);
  const [contextData, setContextData] = useState<ChatContext | null>(null);
  const [tradeForChart, setTradeForChart] = useState<Trade | null>(null);
  const [initialChartTimeframe, setInitialChartTimeframe] = useState<Timeframe>('30d');
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);
  
  useEffect(() => {
    try {
        const storedPrompts = localStorage.getItem(SAVED_PROMPTS_KEY);
        if (storedPrompts) {
            setSavedPrompts(JSON.parse(storedPrompts));
        }
    } catch (error) {
        console.error("Failed to load saved prompts from localStorage:", error);
    }
  }, []);

  const handleImageUpload = (data: string | null, mimeType: string | null) => {
    setAttachedImage(data && mimeType ? { data, mimeType } : null);
  };

  const handleSend = async (prompt?: string) => {
    const userMessageContent = prompt || input;
    if (!userMessageContent.trim() || isLoading) return;
  
    setIsLoading(true);
    setInput('');
    setContextData(null); // Clear context on new message
  
    let fullPrompt = userMessageContent;
    if (isStrategyMode) {
      fullPrompt = `STRATEGY MODE ENABLED:\n${userMessageContent}`;
    }
  
    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: attachedImage ? `${userMessageContent} (image attached)` : userMessageContent,
    };
  
    setMessages(prev => [...prev, userMessage]);
    const imageToSend = attachedImage;
    setAttachedImage(null);
  
    try {
        const modelResponseString = await runChat(fullPrompt, imageToSend);
        
        const newModelMessage: ChatMessageType = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: modelResponseString || "Sorry, I received an empty response.",
        };
        setMessages(prev => [...prev, newModelMessage]);

    } catch (error) {
      const errorMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(), role: 'model',
        content: "Sorry, I encountered an error connecting to the AI. Please try again.",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSavePrompt = () => {
    const newPrompt = input.trim();
    if (newPrompt && !savedPrompts.includes(newPrompt)) {
        const updatedPrompts = [newPrompt, ...savedPrompts];
        setSavedPrompts(updatedPrompts);
        localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(updatedPrompts));
    }
  };

  const toggleDrawer = (drawer: DrawerType) => {
    setActiveDrawer(prev => (prev === drawer ? null : drawer));
  };
  
  const handlePromptSelect = (prompt: string) => {
    setInput(prompt);
    setActiveDrawer(null);
  };

  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden relative">
      <JaxCoreMenu 
        activeDrawer={activeDrawer}
        onToggleDrawer={toggleDrawer}
      />

      <Drawer isOpen={activeDrawer === 'wallet'} onClose={() => setActiveDrawer(null)}>
        <WalletDrawerContent />
      </Drawer>
      <Drawer isOpen={activeDrawer === 'prompts'} onClose={() => setActiveDrawer(null)}>
        <PromptsDrawerContent onSelect={handlePromptSelect} />
      </Drawer>
      <Drawer isOpen={activeDrawer === 'strategy'} onClose={() => setActiveDrawer(null)}>
        <StrategyDrawerContent />
      </Drawer>

      <div className="flex-1 w-full flex flex-col md:flex-row gap-4 min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
              <div ref={messagesContainerRef} className="flex-grow p-4 overflow-y-auto space-y-6">
                  {messages.map((msg) => (
                  <ChatMessage 
                      key={msg.id} 
                      message={msg}
                  />
                  ))}
                  {isLoading && (
                      <div className="flex justify-start items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 font-bold">J</div>
                          <div className="bg-gray-700 p-3 rounded-lg"><LoadingSpinner /></div>
                      </div>
                  )}
              </div>
              <div className="p-4 border-t border-gray-700">
                  <form 
                      onSubmit={(e) => { e.preventDefault(); handleSend(); }} 
                      className="flex items-start sm:items-center gap-2 flex-wrap sm:flex-nowrap"
                  >
                      <input
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Ask JAX for an idea..."
                          disabled={isLoading}
                          className="w-full flex-grow bg-gradient-to-r from-purple-600 to-blue-500 border border-transparent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-800 transition-shadow placeholder:text-gray-200"
                          aria-label="Chat input"
                      />
                      <div className="flex items-center gap-2 flex-shrink-0">
                           <button
                              type="button"
                              onClick={handleSavePrompt}
                              disabled={isLoading || !input.trim() || savedPrompts.includes(input.trim())}
                              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold p-3 rounded-lg transition-colors"
                              aria-label="Save current prompt"
                              title="Save Prompt"
                          >
                              <BookmarkIcon />
                          </button>
                          <button
                              type="submit"
                              disabled={isLoading || !input.trim()}
                              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold p-3 rounded-lg transition-colors"
                              aria-label="Send message"
                          >
                              {isLoading ? <LoadingSpinner /> : <SendIcon />}
                          </button>
                      </div>
                  </form>

                  <div className="mt-3 flex flex-col sm:flex-row items-center justify-end gap-2">
                      <label htmlFor="strategy-mode-toggle" className="flex items-center cursor-pointer">
                          <span className="mr-3 text-sm font-medium text-gray-300">Strategy Mode</span>
                          <div className="relative">
                              <input 
                                  type="checkbox" 
                                  id="strategy-mode-toggle" 
                                  className="sr-only" 
                                  checked={isStrategyMode}
                                  onChange={() => setIsStrategyMode(!isStrategyMode)}
                              />
                              <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
                              <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isStrategyMode ? 'translate-x-6 bg-purple-400' : ''}`}></div>
                          </div>
                      </label>
                  </div>
              </div>
          </div>
          <div className="w-full md:w-2/5 lg:w-1/3 border-t-2 md:border-t-0 md:border-l-2 border-gray-700/50 flex flex-col">
              <ContextHub
                  context={contextData}
                  allCoins={allCoins}
                  onImageUpload={handleImageUpload}
                  attachedImage={attachedImage}
              />
          </div>
      </div>
      {tradeForChart && (
          <CryptoChartModal 
              trade={tradeForChart}
              onClose={() => setTradeForChart(null)}
              initialTimeframe={initialChartTimeframe}
          />
      )}
      <style>{`
          .dot {
              transition: transform 0.3s ease-in-out, background-color 0.3s ease-in-out;
          }
          /* --- Custom Range Slider Styles for Strategy Drawer --- */
          .confidence-slider {
              -webkit-appearance: none; appearance: none; width: 100%; height: 6px;
              background: #374151; border-radius: 9999px; outline: none; opacity: 0.9; transition: opacity 0.2s;
          }
          .confidence-slider:hover { opacity: 1; }
          .confidence-slider::-webkit-slider-thumb {
              -webkit-appearance: none; appearance: none; width: 20px; height: 20px;
              background: #a855f7; cursor: pointer; border-radius: 9999px;
              border: 3px solid #f9fafb; box-shadow: 0 0 5px rgba(168, 85, 247, 0.5);
          }
          .confidence-slider::-moz-range-thumb {
              width: 20px; height: 20px; background: #a855f7; cursor: pointer;
              border-radius: 9999px; border: 3px solid #f9fafb; box-shadow: 0 0 5px rgba(168, 85, 247, 0.5);
          }
      `}</style>
    </div>
  );
};