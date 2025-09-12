
import React from 'react';
import type { Health } from '../types';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from './Icons';

const StatusItem: React.FC<{ label: string; isOk: boolean | null | undefined }> = ({ label, isOk }) => (
    <div className="flex items-center space-x-2">
        {isOk ? <CheckCircleIcon className="text-green-400" /> : <XCircleIcon className="text-red-400" />}
        <span className="text-gray-300">{label}</span>
    </div>
);

export const HealthCard: React.FC<{ health: Health }> = ({ health }) => {
    const isOk = health.ingest_ok && (health.sources_ok?.length ?? 0) > 0;

    return (
        <div className="p-4">
            <h3 className="text-xl font-bold text-white mb-4">System Health Status</h3>
            
            <div className="space-y-3">
                <StatusItem label="Ingestion Pipeline" isOk={health.ingest_ok} />
                
                <div className="flex items-center space-x-2">
                    <ClockIcon className="text-gray-400" />
                    <span className="text-gray-300">Last Tick Received: <span className="font-mono text-white">{health.last_tick_ts ? new Date(health.last_tick_ts).toLocaleTimeString() : 'N/A'}</span></span>
                </div>

                <div>
                    <p className="text-gray-300 mb-1">Data Sources:</p>
                    <div className="pl-6 space-y-2">
                        {health.sources_ok && health.sources_ok.length > 0 ? (
                            health.sources_ok.map(source => (
                                <div key={source} className="flex items-center space-x-2">
                                    <CheckCircleIcon className="text-green-400 h-4 w-4" />
                                    <span className="text-gray-300 capitalize">{source}</span>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center space-x-2">
                                <XCircleIcon className="text-red-400 h-4 w-4" />
                                <span className="text-gray-300">No sources reporting.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <p className={`mt-4 text-sm font-semibold ${isOk ? 'text-green-400' : 'text-yellow-400'}`}>
                {isOk ? 'All systems nominal.' : 'One or more systems may be degraded.'}
            </p>
        </div>
    );
};