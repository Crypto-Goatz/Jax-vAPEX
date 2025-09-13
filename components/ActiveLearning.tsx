import React, { useState, useEffect, useCallback } from 'react';
import { getLearningPatterns } from '../services/geminiService';
import { learningService, LearningPattern } from '../services/learningService';
import { LoadingSpinner } from './LoadingSpinner';
import { CheckCircleIcon, XCircleIcon, RefreshIcon, LightbulbIcon } from './Icons';
import { CryptoPrice } from '../services/cryptoService';

const PATTERN_CATEGORIES: { [key: string]: { icon: string, color: string } } = {
  'Price Correlation': { icon: '🔗', color: 'text-blue-400' },
  'Sentiment Indicator': { icon: '😊', color: 'text-green-400' },
  'On-Chain Anomaly': { icon: '⛓️', color: 'text-yellow-400' },
  'Derivatives Signal': { icon: '📈', color: 'text-pink-400' },
  'Inter-Asset Lag': { icon: '⏳', color: 'text-indigo-400' },
};

// --- SUB-COMPONENTS ---
const PatternCard: React.FC<{
  pattern: LearningPattern;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}> = ({ pattern, onApprove, onReject, isProcessing }) => {
  const categoryInfo = PATTERN_CATEGORIES[pattern.category] || { icon: '💡', color: 'text-purple-400' };
  const confidence = pattern.confidence;
  const confidenceColor = confidence > 75 ? 'bg-green-500' : confidence > 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col animate-fade-in-up">
      <div className="p-4 flex-grow">
        <div className="flex justify-between items-start gap-2">
            <h3 className="text-lg font-bold text-white">{pattern.title}</h3>
            <div className={`flex items-center space-x-2 text-sm font-semibold ${categoryInfo.color}`}>
                <span>{categoryInfo.icon}</span>
                <span>{pattern.category}</span>
            </div>
        </div>
        <p className="text-sm text-gray-300 mt-2 italic">"{pattern.description}"</p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-900/50 p-2 rounded-md">
                <p className="text-xs text-gray-400">Times Observed</p>
                <p className="font-mono text-lg font-bold text-white">{pattern.observation_count}</p>
            </div>
            <div className="bg-gray-900/50 p-2 rounded-md">
                <p className="text-xs text-gray-400">AI Confidence</p>
                <div className="flex items-center gap-2">
                    <div className="w-full bg-gray-700 rounded-full h-2 flex-grow">
                        <div className={`${confidenceColor} h-2 rounded-full`} style={{ width: `${confidence}%` }}></div>
                    </div>
                    <p className="font-mono font-bold text-white text-lg">{confidence.toFixed(0)}%</p>
                </div>
            </div>
        </div>
      </div>
      <div className="bg-gray-900/50 p-3 flex justify-end items-center space-x-3 border-t border-gray-700">
        <button
          onClick={onReject}
          disabled={isProcessing}
          className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-full transition-colors disabled:opacity-50"
          aria-label="Reject pattern"
        >
          <XCircleIcon className="w-6 h-6" />
        </button>
        <button
          onClick={onApprove}
          disabled={isProcessing}
          className="p-3 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-full transition-colors disabled:opacity-50"
          aria-label="Approve pattern for experiment"
        >
          <CheckCircleIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};


// --- MAIN COMPONENT ---
interface ActiveLearningProps {
  allCoins: CryptoPrice[];
}

export const ActiveLearning: React.FC<ActiveLearningProps> = ({ allCoins }) => {
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPatterns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getLearningPatterns();
      // Filter out patterns that are already experiments
      const newPatterns = response.patterns.filter(
        (p: LearningPattern) => !learningService.isPatternInExperiments(p.id)
      );
      setPatterns(newPatterns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setPatterns([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);
  
  const handleApprove = (pattern: LearningPattern) => {
    setProcessingId(pattern.id);
    learningService.approvePattern(pattern, allCoins);
    // Remove the pattern from the view immediately for a snappy UI
    setPatterns(prev => prev.filter(p => p.id !== pattern.id));
    setProcessingId(null);
  };

  const handleReject = (patternId: string) => {
    setProcessingId(patternId);
    // Simply remove from view. We could persist rejections to avoid seeing them again,
    // but for this version, a refresh will bring new ones anyway.
    setPatterns(prev => prev.filter(p => p.id !== patternId));
    setProcessingId(null);
  };


  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <LoadingSpinner />
          <p className="mt-3 font-semibold text-purple-300">AI is searching for new patterns...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="font-semibold text-red-400">Failed to Load Patterns</p>
                <p className="text-sm text-gray-300 mt-1">{error}</p>
            </div>
        </div>
      );
    }
    if (patterns.length === 0) {
      return (
         <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <LightbulbIcon className="w-12 h-12 mb-3 text-gray-600"/>
            <p className="font-semibold">No new learning patterns at this time.</p>
            <p className="text-sm">The AI is continuously analyzing the market. Check back soon!</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {patterns.map(pattern => (
          <PatternCard
            key={pattern.id}
            pattern={pattern}
            onApprove={() => handleApprove(pattern)}
            onReject={() => handleReject(pattern.id)}
            isProcessing={processingId === pattern.id}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-semibold text-white">Active Learning</h2>
                <p className="text-sm text-gray-400">AI-discovered patterns awaiting your review.</p>
            </div>
            <button
                onClick={fetchPatterns}
                disabled={isLoading}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Find new patterns"
            >
                {isLoading ? <LoadingSpinner /> : <RefreshIcon />}
            </button>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
            {renderContent()}
        </div>
         <style>{`
            @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in-up {
            animation: fade-in-up 0.5s ease-out forwards;
            }
        `}</style>
    </div>
  );
};
