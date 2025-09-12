
import React from 'react';
import type { Signal } from '../types';
import { TrendingUpIcon, TrendingDownIcon } from './Icons';

export const SignalCard: React.FC<{ signal: Signal }> = ({ signal }) => {
    const isLong = signal.side === 'long';
    const cardColor = isLong ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500';
    const textColor = isLong ? 'text-green-400' : 'text-red-400';
    const Icon = isLong ? TrendingUpIcon : TrendingDownIcon;

    return (
        <div className={`p-4 ${cardColor}`}>
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-sm text-purple-400 font-bold">{signal.strategy || 'N/A'}</p>
                    <div className={`flex items-center space-x-2 text-xl font-bold ${textColor}`}>
                        <Icon />
                        <span className="capitalize">{signal.side || 'N/A'} Signal</span>
                    </div>
                </div>
                <div className="text-right">
                     <p className="text-xs text-gray-400">Score</p>
                     <p className="font-mono text-lg font-bold text-white">{(signal.score ?? 0).toFixed(2)}</p>
                </div>
            </div>

            <div className="mt-4">
                <h4 className="font-bold text-gray-300 text-sm">Features Used</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                    {signal.features_used && signal.features_used.length > 0 ? (
                        signal.features_used.map((feature, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-800 text-xs text-gray-300 rounded-md font-mono">{feature}</span>
                        ))
                    ) : (
                        <span className="text-xs text-gray-500 italic">None specified.</span>
                    )}
                </div>
            </div>

            <div className="mt-4">
                <h4 className="font-bold text-gray-300 text-sm">Rationale</h4>
                <ul className="list-disc list-inside mt-2 text-sm text-gray-300 space-y-1">
                     {signal.rationale && signal.rationale.length > 0 ? (
                        signal.rationale.map((reason, index) => (
                            <li key={index}>{reason}</li>
                        ))
                     ) : (
                         <li>No rationale provided.</li>
                     )}
                </ul>
            </div>
             <p className="mt-4 text-xs text-gray-500 italic">
                Timestamp: {signal.ts ? new Date(signal.ts).toLocaleString() : 'N/A'}
             </p>
        </div>
    );
};