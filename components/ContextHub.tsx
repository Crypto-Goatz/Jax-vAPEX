
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatContext, SocialPost } from '../types';
import type { CryptoPrice } from '../services/cryptoService';
import { fetchHistoricalData, HistoricalData } from '../services/cryptoService';
import { LoadingSpinner } from './LoadingSpinner';
import { XIcon, JaxIcon, PaperclipIcon, CloseIcon } from './Icons';

// --- SUB-COMPONENTS ---

const SocialPostCard: React.FC<{ post: SocialPost }> = ({ post }) => (
    <a 
        href={post.url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="block bg-gray-800 p-3 rounded-lg border border-gray-700 hover:bg-gray-700/50 transition-colors"
    >
        <div className="flex items-start space-x-3">
            {post.avatarUrl ? (
                 <img src={post.avatarUrl} alt={`${post.user} avatar`} className="w-10 h-10 rounded-full flex-shrink-0" />
            ) : (
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <XIcon className="w-5 h-5 text-gray-400"/>
                </div>
            )}
            <div className="flex-1">
                <div className="flex items-center space-x-1">
                    <span className="font-bold text-white text-sm">{post.user}</span>
                    <span className="text-gray-400 text-sm">@{post.handle}</span>
                </div>
                <p className="text-gray-300 text-sm mt-1">{post.content}</p>
            </div>
        </div>
    </a>
);

const ContextChart: React.FC<{ coinSymbol: string }> = ({ coinSymbol }) => {
    const [chartData, setChartData] = useState<HistoricalData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const chartCanvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);

    useEffect(() => {
        const getData = async () => {
            setIsLoading(true);
            try {
                const data = await fetchHistoricalData(coinSymbol, '30d');
                setChartData(data);
            } catch (error) {
                console.error(`Failed to fetch chart data for ${coinSymbol}:`, error);
                setChartData(null);
            } finally {
                setIsLoading(false);
            }
        };
        getData();
    }, [coinSymbol]);

    useEffect(() => {
        if (chartInstanceRef.current) chartInstanceRef.current.destroy();
        if (chartCanvasRef.current && chartData) {
            const ctx = chartCanvasRef.current.getContext('2d');
            if (ctx) {
                chartInstanceRef.current = new window.Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: chartData.labels,
                        datasets: [{
                            data: chartData.prices,
                            borderColor: 'rgba(168, 85, 247, 0.8)',
                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                            borderWidth: 1.5,
                            pointRadius: 0,
                            tension: 0.4,
                            fill: true,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { 
                            x: { display: false }, 
                            y: { display: false } 
                        },
                        plugins: { 
                            legend: { display: false },
                            tooltip: { enabled: false }
                        },
                    }
                });
            }
        }
        return () => {
            if (chartInstanceRef.current) chartInstanceRef.current.destroy();
        };
    }, [chartData]);

    if (isLoading) {
        return <div className="h-24 flex items-center justify-center"><LoadingSpinner /></div>;
    }
    if (!chartData) {
        return <div className="h-24 flex items-center justify-center text-xs text-red-400">Chart data unavailable.</div>;
    }
    return <div className="h-24 w-full"><canvas ref={chartCanvasRef}></canvas></div>;
};

const LivePriceTicker: React.FC<{ liveCoin: CryptoPrice }> = ({ liveCoin }) => {
    const isUp = liveCoin.change24h >= 0;
    return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center font-bold text-purple-400 text-sm">
                        {liveCoin.symbol.charAt(0)}
                    </div>
                    <div>
                        <p className="font-bold text-white">{liveCoin.name}</p>
                        <p className="text-sm text-gray-400">{liveCoin.symbol}</p>
                    </div>
                </div>
                 <div className="text-right">
                    <p className="font-mono font-bold text-lg text-white">
                        ${liveCoin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </p>
                    <p className={`font-mono font-semibold text-sm ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                        {isUp ? '+' : ''}{liveCoin.change24h.toFixed(2)}%
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- IMAGE UPLOAD COMPONENT ---
const ImageUploader: React.FC<{
    onImageUpload: (base64: string | null, mimeType: string | null) => void;
    attachedImage: { data: string; mimeType: string } | null;
}> = ({ onImageUpload, attachedImage }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const processFile = (file: File) => {
        if (!file || !file.type.startsWith('image/')) {
            alert('Please upload a valid image file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = (e.target?.result as string).split(',')[1];
            onImageUpload(base64, file.type);
        };
        reader.readAsDataURL(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    }, [onImageUpload]);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);
    
    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleRemoveImage = () => {
        onImageUpload(null, null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className="mb-4">
            <h4 className="text-sm font-bold text-gray-300 mb-2">Chart Analysis</h4>
            {attachedImage ? (
                <div className="relative group">
                    <img src={`data:${attachedImage.mimeType};base64,${attachedImage.data}`} alt="Uploaded chart" className="rounded-lg w-full h-auto object-contain max-h-48" />
                    <button 
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-opacity opacity-0 group-hover:opacity-100"
                        aria-label="Remove image"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div 
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                        ${isDragging ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'}`
                    }
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        className="hidden"
                    />
                    <PaperclipIcon className="w-8 h-8 text-gray-500 mb-2" />
                    <p className="text-sm text-center text-gray-400">
                        <span className="font-semibold text-purple-400">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-center text-gray-500">PNG, JPG, GIF up to 10MB</p>
                </div>
            )}
        </div>
    );
};


// --- MAIN COMPONENT ---

interface ContextHubProps {
    context: ChatContext | null;
    allCoins: CryptoPrice[];
    onImageUpload: (base64: string | null, mimeType: string | null) => void;
    attachedImage: { data: string; mimeType: string } | null;
}

export const ContextHub: React.FC<ContextHubProps> = ({ context, allCoins, onImageUpload, attachedImage }) => {
    
    const findCoinBySymbol = (symbol: string) => {
        const upperSymbol = symbol.toUpperCase();
        return allCoins.find(c => c.symbol.toUpperCase() === upperSymbol || c.name.toUpperCase() === upperSymbol || c.id.toUpperCase() === upperSymbol);
    };

    const liveCoinData = context?.symbol ? findCoinBySymbol(context.symbol) : null;
    
    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-gray-700/50">
                <h3 className="text-lg font-bold text-purple-400">Context Hub</h3>
                <p className="text-sm text-gray-400">Supporting data for your conversation.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <ImageUploader onImageUpload={onImageUpload} attachedImage={attachedImage} />
                {!context && !attachedImage ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 pt-8">
                        <JaxIcon className="w-12 h-12 mb-3 text-gray-600"/>
                        <p className="font-semibold">Contextual data will appear here.</p>
                        <p className="text-sm">Ask about a specific crypto or upload a chart.</p>
                    </div>
                ) : (
                    <>
                        {liveCoinData ? (
                            <>
                                <LivePriceTicker liveCoin={liveCoinData} />
                                <ContextChart coinSymbol={liveCoinData.symbol} />
                            </>
                        ) : (
                            context?.symbol && <div className="text-center text-sm text-yellow-400 p-2 bg-yellow-500/10 rounded-md">Live price data not found for {context.symbol}.</div>
                        )}
                        
                        {context?.narrative && (
                            <div>
                                <h4 className="text-sm font-bold text-gray-300 mb-2">AI Narrative</h4>
                                <p className="text-sm text-gray-400 p-3 bg-gray-800 rounded-lg border border-gray-700 italic">
                                    "{context.narrative}"
                                </p>
                            </div>
                        )}

                        {context?.posts && context.posts.length > 0 && (
                            <div>
                                <h4 className="text-sm font-bold text-gray-300 mb-2">Social Feed</h4>
                                <div className="space-y-3">
                                    {context.posts.map((post, index) => <SocialPostCard key={index} post={post} />)}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
