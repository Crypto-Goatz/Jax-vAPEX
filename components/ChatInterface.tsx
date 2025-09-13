import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage as ChatMessageType, Idea, Signal, Health, ChatContext } from '../types';
import { runChat } from '../services/geminiService';
import { googleDriveService, DriveFile } from '../services/googleDriveService';
import { ChatMessage } from './ChatMessage';
import { ContextHub } from './ContextHub';
import { LoadingSpinner } from './LoadingSpinner';
import { SendIcon, PaperclipIcon, CloseIcon, BookmarkIcon, TrashIcon } from './Icons';
import type { CryptoPrice } from '../services/cryptoService';
import { CryptoChartModal } from './CryptoChartModal';
import { Trade } from '../services/tradeSimulatorService';

type Timeframe = '24h' | '7d' | '30d' | '1y';

const TRAINING_PROMPTS = [
  {
    title: "Historical Analysis",
    prompts: [
      "Correlate whale outflows > $2M with ADA momentum drops in last month's archives.",
      "What were key pre-halving signals from LunarCrush/DeFiLlama for BTC?",
      "Find 3 failed 'BUY NOW' signals from Q2 2023 archives & explain commonalities.",
    ],
  },
  {
    title: "Comparative & 'What If' Scenarios",
    prompts: [
      "Compare pipeline metrics for SOL vs. AVAX over the last 7 days. Who has a stronger case?",
      "What if a Stage 2 token's TVL suddenly dropped 30%? How would that affect its progress?",
      "If ETH Lunar sentiment was 35 instead of 65 yesterday, how would its SpotScore change?",
    ],
  },
  {
    title: "Strategy & Performance Review",
    prompts: [
      "Analyze the last 20 closed trades: what was the avg. hold time for winners vs. losers?",
      "Is the 0.4 weight for CoinbaseMomentum in the SpotScore optimal for this market?",
      "Review the last 5 Stop Loss trades. Was there a common failing indicator?",
      "Propose a new rule for Stage 2 to filter 'pump and dump' schemes earlier.",
    ],
  },
  {
    title: "Deep Dive Explanations",
    prompts: [
      "Explain the exact SpotScore calculation for LINK, with current values.",
      "Walk me through how a $5M inflow for MATIC would propagate from Stage 2 to Stage 3.",
      "A coin is 'stuck' in Stage 2. Explain all possible conditions it's failing to meet.",
    ],
  },
];


const SAVED_PROMPTS_KEY = 'jaxspot_saved_prompts';

interface ChatInterfaceProps {
  allCoins: CryptoPrice[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ allCoins }) => {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    { id: 'initial', role: 'model', content: "I am JaxSpot, your AI market agent. How can I help you analyze the crypto markets today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<DriveFile | null>(null);
  const [isDriveAuthenticated, setIsDriveAuthenticated] = useState(googleDriveService.isAuthenticated());
  const [savedPrompts, setSavedPrompts] = useState<string[]>([]);
  const [contextData, setContextData] = useState<ChatContext | null>(null);
  const [tradeForChart, setTradeForChart] = useState<Trade | null>(null);
  const [initialChartTimeframe, setInitialChartTimeframe] = useState<Timeframe>('30d');
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);
  
  // Load saved prompts from localStorage on initial render
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


  useEffect(() => {
    const handleAuthChange = () => {
      setIsDriveAuthenticated(googleDriveService.isAuthenticated());
    };
    googleDriveService.subscribe(handleAuthChange);
    return () => googleDriveService.unsubscribe(handleAuthChange);
  }, []);

  const handleViewChartForIdea = (idea: Idea) => {
    if (!idea.symbol) {
        console.error("Idea is missing a symbol, cannot generate chart.");
        return;
    }
    // FIX: More robust symbol parsing to handle "BTC/USDT", "BTC-USD", "BTC", etc.
    const coinSymbol = idea.symbol.replace(/[\/-].*$/, '').toUpperCase();
    const coin = allCoins.find(c => c.symbol.toUpperCase() === coinSymbol);

    if (!coin) {
        console.error(`Could not find coin data for symbol: ${coinSymbol}`);
        alert(`Sorry, live data for ${coinSymbol} isn't available to create a chart.`);
        return;
    }

    // REFACTOR: Clearer entry price calculation with a fallback.
    let entryPrice: number;
    const { entry_low, entry_high } = idea;
    if (entry_low != null && entry_high != null) {
        entryPrice = (entry_low + entry_high) / 2;
    } else {
        entryPrice = entry_low ?? entry_high ?? 0;
    }

    // If both entry points were null, entryPrice is 0. Use current price as a better fallback for charting.
    if (entryPrice === 0) {
        console.warn("Calculated entry price is 0, using current price as fallback for chart.");
        entryPrice = coin.price;
    }
    
    // Enhancement: Determine a relevant timeframe based on hold duration.
    let determinedTimeframe: Timeframe = '30d';
    if (idea.hold_minutes) {
        if (idea.hold_minutes <= 60) { // Scalp (<= 1hr)
            determinedTimeframe = '24h';
        } else if (idea.hold_minutes <= 60 * 24) { // Intraday (<= 24hr)
            determinedTimeframe = '7d';
        } else if (idea.hold_minutes <= 60 * 24 * 7) { // Short Swing (<= 1wk)
            determinedTimeframe = '30d';
        } else { // Long Swing (> 1wk)
            determinedTimeframe = '1y';
        }
    }

    const tradeShim: Trade = {
        id: `idea-${Date.now()}`,
        coin: coin,
        direction: 'buy', // Ideas are implicitly long for now
        entryPrice: entryPrice,
        takeProfitPrice: idea.target1 ?? undefined,
        stopLossPrice: idea.stop ?? undefined,
        status: 'open',
        sizeUSD: 0,
        openTimestamp: Date.now(),
        closeTimestamp: null,
        closePrice: null,
        pnl: null,
    };
    
    setInitialChartTimeframe(determinedTimeframe);
    setTradeForChart(tradeShim);
};

  const handleSend = async (prompt?: string) => {
    const userMessageContent = prompt || input;
    if (!userMessageContent.trim() || isLoading) return;
  
    setIsLoading(true);
    setInput('');
  
    let fullPrompt = userMessageContent;
    let fileContent = '';
  
    if (attachedFile) {
      try {
        fileContent = await googleDriveService.getFileContent(attachedFile.id);
        fullPrompt = `CONTEXT FROM FILE: ${attachedFile.name}\n\n---\n${fileContent}\n---\n\nUSER PROMPT: ${userMessageContent}`;
      } catch (error) {
        console.error("Error fetching file content:", error);
        const errorMessage: ChatMessageType = {
          id: Date.now().toString(),
          role: 'model',
          content: `Sorry, I couldn't read the file "${attachedFile.name}". Please check permissions and try again.`,
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        setAttachedFile(null);
        return;
      }
    }
  
    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
    };
  
    setMessages(prev => [...prev, userMessage]);
    setAttachedFile(null); 
  
    try {
        const modelResponseString = await runChat(fullPrompt);
        let newModelMessage: ChatMessageType;

        try {
            const parsedResponse = JSON.parse(modelResponseString);
            
            // Set context data if available, otherwise clear it
            setContextData(parsedResponse.context || null);

            // More robust validation of the AI response structure
            const isValidStructure = 
                parsedResponse && 
                typeof parsedResponse === 'object' && 
                typeof parsedResponse.type === 'string' &&
                parsedResponse.payload &&
                typeof parsedResponse.payload === 'object';

            if (!isValidStructure) {
                throw new Error("Response is valid JSON but does not match the expected {type, payload} structure.");
            }

            const { type, payload } = parsedResponse;
            const validTypes = ['idea', 'signal', 'health', 'text'];
            
            if (!validTypes.includes(type)) {
                throw new Error(`Received an unexpected response type: '${type}'.`);
            }

            let content: string | Idea | Signal | Health;
            if (type === 'text') {
                content = payload.text || "Sorry, I received an empty response.";
            } else {
                content = { ...payload, type: type };
            }
            
            newModelMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: content,
            };

        } catch (parsingError) {
            console.error("Error parsing or validating AI response:", {
                error: (parsingError as Error).message,
                response: modelResponseString
            });
            // Clear context on error
            setContextData(null);
            const userFriendlyError = "Sorry, I received a response that I couldn't understand. The format might be incorrect. Could you try rephrasing your request?";
            newModelMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: userFriendlyError,
            };
        }
        setMessages(prev => [...prev, newModelMessage]);

    } catch (error) {
      setContextData(null); // Clear context on error
      const errorMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "Sorry, I encountered an error connecting to the AI. Please try again.",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttachFile = async () => {
    try {
      const file = await googleDriveService.showPicker();
      if (file) {
        setAttachedFile(file);
      }
    } catch (error) {
      console.error("Error showing picker:", error);
    }
  };

  const handleExamplePrompt = (prompt: string) => {
    setInput(prompt);
  };
  
  const handleSavePrompt = () => {
    const newPrompt = input.trim();
    if (newPrompt && !savedPrompts.includes(newPrompt)) {
        const updatedPrompts = [newPrompt, ...savedPrompts];
        setSavedPrompts(updatedPrompts);
        localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(updatedPrompts));
    }
  };

  const handleDeletePrompt = (promptToDelete: string) => {
    const updatedPrompts = savedPrompts.filter(p => p !== promptToDelete);
    setSavedPrompts(updatedPrompts);
    localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(updatedPrompts));
  };


  return (
    <>
    <div className="w-full h-full flex flex-col md:flex-row gap-4 bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
        {/* Left Panel: Chat */}
        <div className="flex-1 flex flex-col min-w-0">
            <div ref={messagesContainerRef} className="flex-grow p-4 overflow-y-auto space-y-6">
                {messages.map((msg) => (
                <ChatMessage 
                    key={msg.id} 
                    message={msg}
                    onViewChartForIdea={handleViewChartForIdea}
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
                {attachedFile && (
                <div className="mb-2 flex items-center justify-between bg-gray-700 p-2 rounded-md text-sm">
                    <span className="text-gray-300 truncate">
                    Attached: <span className="font-medium text-white">{attachedFile.name}</span>
                    </span>
                    <button onClick={() => setAttachedFile(null)} className="text-gray-400 hover:text-white">
                    <CloseIcon />
                    </button>
                </div>
                )}

                <div className="mb-4 space-y-3">
                    {savedPrompts.length > 0 && (
                        <div>
                            <h4 className="text-xs text-purple-400 font-semibold mb-1.5">My Prompts</h4>
                            <div className="flex flex-wrap gap-2">
                                {savedPrompts.map(prompt => (
                                    <div key={prompt} className="group flex items-center bg-gray-700 rounded-full">
                                        <button
                                            onClick={() => handleExamplePrompt(prompt)}
                                            disabled={isLoading}
                                            className="px-3 py-1 text-xs text-gray-300 transition-colors group-hover:text-white"
                                        >
                                            {prompt}
                                        </button>
                                        <button
                                            onClick={() => handleDeletePrompt(prompt)}
                                            className="pr-2 pl-1 text-gray-500 hover:text-red-400"
                                            aria-label={`Delete prompt: ${prompt}`}
                                        >
                                            <TrashIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <h4 className="text-xs text-gray-500 font-semibold mb-1.5">AI Training Prompts</h4>
                         <div className="space-y-3">
                            {TRAINING_PROMPTS.map(category => (
                                <div key={category.title}>
                                    <h5 className="text-xs text-purple-400 font-semibold mb-1.5">{category.title}</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {category.prompts.map(prompt => (
                                            <button
                                                key={prompt}
                                                onClick={() => handleExamplePrompt(prompt)}
                                                disabled={isLoading}
                                                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs text-gray-300 rounded-full transition-colors text-left"
                                            >
                                                {prompt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    {isDriveAuthenticated && (
                        <button
                        onClick={handleAttachFile}
                        disabled={isLoading}
                        className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50 transition-colors"
                        aria-label="Attach file from Google Drive"
                        >
                        <PaperclipIcon />
                        </button>
                    )}
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex-grow flex items-center space-x-2">
                        <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask JaxSpot for an idea..."
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-500 border border-transparent rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-800 transition-shadow placeholder:text-gray-200"
                        aria-label="Chat input"
                        />
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
                    </form>
                </div>
            </div>
        </div>
        {/* Right Panel: Context Hub */}
        <div className="w-full md:w-2/5 lg:w-1/3 border-t-2 md:border-t-0 md:border-l-2 border-gray-700/50 flex flex-col">
            <ContextHub context={contextData} allCoins={allCoins} />
        </div>
    </div>
    {tradeForChart && (
        <CryptoChartModal 
            trade={tradeForChart}
            onClose={() => setTradeForChart(null)}
            initialTimeframe={initialChartTimeframe}
        />
    )}
    </>
  );
};