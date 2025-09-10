
import React from 'react';
import type { Idea } from '../types';
import { ClockIcon } from './Icons';

export const IdeaCard: React.FC<{ idea: Idea }> = ({ idea }) => {
    const confidenceColor = idea.confidence > 65 ? 'bg-green-500' : idea.confidence > 40 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="p-4">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm text-purple-400 font-bold">{idea.strategy}</p>
                    <h3 className="text-xl font-bold text-white">{idea.symbol}</h3>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                    <ClockIcon />
                    <span>~{idea.hold_minutes} min hold</span>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-gray-800/50 p-3 rounded-lg">
                    <p className="text-xs text-gray-400">Entry Zone</p>
                    <p className="font-mono text-white">${idea.entry_low.toLocaleString()} - ${idea.entry_high.toLocaleString()}</p>
                </div>
                <div className="bg-red-500/20 p-3 rounded-lg">
                    <p className="text-xs text-red-300">Stop Loss</p>
                    <p className="font-mono font-bold text-white">${idea.stop.toLocaleString()}</p>
                </div>
                <div className="bg-green-500/20 p-3 rounded-lg">
                    <p className="text-xs text-green-300">Target 1</p>
                    <p className="font-mono font-bold text-white">${idea.target1.toLocaleString()}</p>
                </div>
                <div className="bg-green-500/20 p-3 rounded-lg">
                    <p className="text-xs text-green-300">Target 2</p>
                    <p className="font-mono font-bold text-white">${idea.target2.toLocaleString()}</p>
                </div>
            </div>

            <div className="mt-4">
                <p className="text-xs text-gray-400 mb-1">Confidence ({idea.confidence}%)</p>
                <div className="w-full bg-gray-800/50 rounded-full h-2.5">
                    <div className={`${confidenceColor} h-2.5 rounded-full`} style={{ width: `${idea.confidence}%` }}></div>
                </div>
            </div>

            <div className="mt-4">
                <h4 className="font-bold text-gray-300">Rationale</h4>
                <ul className="list-disc list-inside mt-2 text-sm text-gray-300 space-y-1">
                    {idea.rationale.map((reason, index) => (
                        <li key={index}>{reason}</li>
                    ))}
                </ul>
            </div>
             <p className="mt-4 text-xs text-gray-500 italic">
                Disclaimer: This is for educational purposes only and not financial advice. Crypto markets are volatile.
             </p>
        </div>
    );
};