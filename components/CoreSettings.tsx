
import React, { useState, useEffect } from 'react';
import { googleSheetService, DATA_SOURCES, DataSourceStatus, DataSourceKey } from '../services/googleSheetService';
import { SettingsIcon, RefreshIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from './Icons';
import { LoadingSpinner } from './LoadingSpinner';

const StatusIndicator: React.FC<{ status: DataSourceStatus['status'] }> = ({ status }) => {
    switch (status) {
        case 'synced':
            return <div className="flex items-center gap-1.5 text-green-600"><CheckCircleIcon className="w-4 h-4" /> Synced</div>;
        case 'syncing':
            return <div className="flex items-center gap-1.5 text-blue-600"><LoadingSpinner /> Syncing...</div>;
        case 'error':
            return <div className="flex items-center gap-1.5 text-red-600"><XCircleIcon className="w-4 h-4" /> Error</div>;
        case 'idle':
        default:
            return <div className="flex items-center gap-1.5 text-gray-500"><ClockIcon className="w-4 h-4" /> Idle</div>;
    }
};

const DataTablePreview: React.FC<{ data: any[] }> = ({ data }) => {
    if (!data || data.length === 0) {
        return <p className="text-xs text-gray-400 italic">No data to preview.</p>;
    }

    const headers = Object.keys(data[0]);
    const previewData = data.slice(0, 3);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
                <thead className="bg-gray-100">
                    <tr>
                        {headers.map(h => <th key={h} className="p-1.5 font-semibold text-gray-600 truncate">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {previewData.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-gray-100">
                            {headers.map(h => <td key={`${rowIndex}-${h}`} className="p-1.5 text-gray-700 truncate">{String(row[h])}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export const CoreSettings: React.FC = () => {
    const [statuses, setStatuses] = useState(googleSheetService.getStatuses());
    const [isSyncingAll, setIsSyncingAll] = useState(false);

    useEffect(() => {
        const subscription = googleSheetService.getStatusUpdates().subscribe(setStatuses);
        return () => subscription.unsubscribe();
    }, []);

    const handleSync = (key: DataSourceKey) => {
        googleSheetService.fetchData(key, true);
    };
    
    const handleSyncAll = async () => {
        setIsSyncingAll(true);
        await googleSheetService.syncAll();
        setIsSyncingAll(false);
    };

    return (
        <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><SettingsIcon /> Core Settings</h2>
                    <p className="text-sm text-gray-500">Admin panel for monitoring and managing live data sources.</p>
                </div>
                <button
                    onClick={handleSyncAll}
                    disabled={isSyncingAll}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-400"
                >
                    {isSyncingAll ? <LoadingSpinner /> : <RefreshIcon />}
                    Sync All
                </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
                {Object.values(DATA_SOURCES).map(source => {
                    const status = statuses[source.key];
                    return (
                        <div key={source.key} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">{source.name}</h3>
                                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate">{source.url}</a>
                                </div>
                                <div className="flex items-center gap-4">
                                    <StatusIndicator status={status.status} />
                                    <button 
                                        onClick={() => handleSync(source.key)} 
                                        disabled={status.status === 'syncing'}
                                        className="text-sm font-semibold text-purple-600 hover:text-purple-800 disabled:opacity-50"
                                    >
                                        Sync Now
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500 space-y-1">
                                <p>Last Synced: <span className="font-semibold text-gray-700">{status.lastSync ? status.lastSync.toLocaleString() : 'Never'}</span></p>
                                <p>Cached Rows: <span className="font-semibold text-gray-700">{status.rowCount}</span></p>
                                {status.error && <p className="text-red-600">Error: {status.error}</p>}
                            </div>
                             <div className="mt-3 pt-3 border-t border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-600 mb-2">Data Preview</h4>
                                <DataTablePreview data={status.data} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
