import React, { useState, useEffect } from 'react';
import { TradingViewIcon, LunarCrushIcon, FlipsideIcon, DefiLlamaIcon, DexToolsIcon, CoinglassIcon, DexScreenerIcon, CoinbaseIcon } from './Icons';
import { LoadingSpinner } from './LoadingSpinner';

// --- Status Indicator Component ---
type Status = 'connected' | 'disconnected' | 'connecting' | 'error' | 'pre-configured';

const StatusIndicator: React.FC<{ status: Status }> = ({ status }) => {
  const baseClasses = "w-2.5 h-2.5 rounded-full";
  let statusClasses = "";
  let title = "";

  switch (status) {
    case 'connected':
    case 'pre-configured':
      statusClasses = "bg-green-500";
      title = "Connected";
      break;
    case 'connecting':
      statusClasses = "bg-yellow-500";
      title = "Connecting...";
      break;
    case 'error':
      statusClasses = "bg-red-500";
      title = "Error";
      break;
    case 'disconnected':
    default:
      statusClasses = "bg-gray-400";
      title = "Disconnected";
      break;
  }

  if (status === 'connecting') {
    return (
      <div className="relative flex items-center justify-center w-2.5 h-2.5" title={title}>
        <span className="absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75 animate-ping"></span>
        <span className={`relative inline-flex rounded-full ${baseClasses} ${statusClasses}`}></span>
      </div>
    );
  }

  return <div className={`${baseClasses} ${statusClasses}`} title={title}></div>;
};


// --- Main DataSources Component ---
export const DataSources: React.FC = () => {
  // State for TradingView connection
  const [tvApiKey, setTvApiKey] = useState('');
  const [tvApiSecret, setTvApiSecret] = useState('');
  const [tvConnectionStatus, setTvConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [tvConnectionTimestamp, setTvConnectionTimestamp] = useState<Date | null>(null);
  const [tvError, setTvError] = useState('');

  // State for Coinbase connection
  const [cbApiKey, setCbApiKey] = useState('');
  const [cbApiSecret, setCbApiSecret] = useState('');
  const [cbConnectionStatus, setCbConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [cbConnectionTimestamp, setCbConnectionTimestamp] = useState<Date | null>(null);
  const [cbError, setCbError] = useState('');

  const getTvStatus = (): Status => {
    switch(tvConnectionStatus) {
        case 'connected': return 'connected';
        case 'connecting': return 'connecting';
        case 'error': return 'error';
        case 'idle': return 'disconnected';
        default: return 'disconnected';
    }
  };

  const getCbStatus = (): Status => {
    switch(cbConnectionStatus) {
        case 'connected': return 'connected';
        case 'connecting': return 'connecting';
        case 'error': return 'error';
        case 'idle': return 'disconnected';
        default: return 'disconnected';
    }
  };
  
  const handleTradingViewConnect = () => {
      setTvError('');
      if (!tvApiKey || !tvApiSecret) {
          setTvError('API Key and Secret Key are required.');
          setTvConnectionStatus('error');
          return;
      }
      setTvConnectionStatus('connecting');
      // Simulate API call
      setTimeout(() => {
          setTvConnectionStatus('connected');
          setTvConnectionTimestamp(new Date());
      }, 1500);
  };

  const handleTradingViewDisconnect = () => {
      setTvApiKey('');
      setTvApiSecret('');
      setTvConnectionStatus('idle');
      setTvConnectionTimestamp(null);
  };

  const handleCoinbaseConnect = () => {
      setCbError('');
      if (!cbApiKey || !cbApiSecret) {
          setCbError('API Key and Secret Key are required.');
          setCbConnectionStatus('error');
          return;
      }
      setCbConnectionStatus('connecting');
      // Simulate API call
      setTimeout(() => {
          setCbConnectionStatus('connected');
          setCbConnectionTimestamp(new Date());
      }, 1500);
  };

  const handleCoinbaseDisconnect = () => {
      setCbApiKey('');
      setCbApiSecret('');
      setCbConnectionStatus('idle');
      setCbConnectionTimestamp(null);
  };


  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Data Sources</h2>
        <p className="text-sm text-gray-500">Connect your accounts to use as context for the AI.</p>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-6 bg-gray-50">
        {/* TradingView Card */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <TradingViewIcon />
              <div>
                 <div className="flex items-center space-x-2.5">
                    <h3 className="text-lg font-bold text-gray-900">TradingView</h3>
                    <StatusIndicator status={getTvStatus()} />
                 </div>
                <p className="text-sm text-gray-500">Connect your account for broker integration.</p>
              </div>
            </div>
             {tvConnectionStatus === 'connected' ? (
              <button
                onClick={handleTradingViewDisconnect}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleTradingViewConnect}
                disabled={tvConnectionStatus === 'connecting'}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center min-w-[120px]"
              >
                {tvConnectionStatus === 'connecting' ? <LoadingSpinner /> : 'Connect'}
              </button>
            )}
          </div>
          {tvConnectionStatus !== 'connected' ? (
              <div className="mt-6 pt-4 border-t border-gray-200 space-y-4">
                  <div>
                      <label htmlFor="tv-api-key" className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                      <input 
                        type="password" 
                        id="tv-api-key"
                        value={tvApiKey}
                        onChange={(e) => setTvApiKey(e.target.value)}
                        placeholder="********************"
                        className="w-full bg-gray-100 border border-gray-300 rounded-lg p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow placeholder:text-gray-500"
                      />
                  </div>
                   <div>
                      <label htmlFor="tv-secret-key" className="block text-sm font-medium text-gray-700 mb-1">Secret Key</label>
                      <input 
                        type="password" 
                        id="tv-secret-key"
                        value={tvApiSecret}
                        onChange={(e) => setTvApiSecret(e.target.value)}
                        placeholder="********************"
                        className="w-full bg-gray-100 border border-gray-300 rounded-lg p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow placeholder:text-gray-500"
                      />
                  </div>
                  {tvConnectionStatus === 'error' && <p className="text-sm text-red-500">{tvError}</p>}
              </div>
          ) : (
             <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
                 <p className="text-green-600 font-semibold">Successfully connected to TradingView.</p>
                 {tvConnectionTimestamp && (
                    <p className="text-sm text-gray-500">
                        Connected on: {tvConnectionTimestamp.toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                        })}
                    </p>
                 )}
             </div>
          )}
        </div>

        {/* Coinbase Card */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <CoinbaseIcon className="text-blue-600" />
              <div>
                 <div className="flex items-center space-x-2.5">
                    <h3 className="text-lg font-bold text-gray-900">Coinbase</h3>
                    <StatusIndicator status={getCbStatus()} />
                 </div>
                <p className="text-sm text-gray-500">Connect your account for live trading data.</p>
              </div>
            </div>
             {cbConnectionStatus === 'connected' ? (
              <button
                onClick={handleCoinbaseDisconnect}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleCoinbaseConnect}
                disabled={cbConnectionStatus === 'connecting'}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center min-w-[120px]"
              >
                {cbConnectionStatus === 'connecting' ? <LoadingSpinner /> : 'Connect'}
              </button>
            )}
          </div>
          {cbConnectionStatus !== 'connected' ? (
              <div className="mt-6 pt-4 border-t border-gray-200 space-y-4">
                  <div>
                      <label htmlFor="cb-api-key" className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                      <input 
                        type="password" 
                        id="cb-api-key"
                        value={cbApiKey}
                        onChange={(e) => setCbApiKey(e.target.value)}
                        placeholder="********************"
                        className="w-full bg-gray-100 border border-gray-300 rounded-lg p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow placeholder:text-gray-500"
                      />
                  </div>
                   <div>
                      <label htmlFor="cb-secret-key" className="block text-sm font-medium text-gray-700 mb-1">Secret Key</label>
                      <input 
                        type="password" 
                        id="cb-secret-key"
                        value={cbApiSecret}
                        onChange={(e) => setCbApiSecret(e.target.value)}
                        placeholder="********************"
                        className="w-full bg-gray-100 border border-gray-300 rounded-lg p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow placeholder:text-gray-500"
                      />
                  </div>
                  {cbConnectionStatus === 'error' && <p className="text-sm text-red-500">{cbError}</p>}
              </div>
          ) : (
             <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
                 <p className="text-green-600 font-semibold">Successfully connected to Coinbase.</p>
                 {cbConnectionTimestamp && (
                    <p className="text-sm text-gray-500">
                        Connected on: {cbConnectionTimestamp.toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                        })}
                    </p>
                 )}
             </div>
          )}
        </div>
        
        {/* --- Pre-configured Data Layers --- */}
        <h3 className="text-lg font-semibold text-gray-700 border-b border-gray-200 pb-2">Pre-Configured Data Layers</h3>

        {/* LunarCrush Card */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <LunarCrushIcon />
                    <div>
                        <div className="flex items-center space-x-2.5">
                            <h3 className="text-lg font-bold text-gray-900">LunarCrush</h3>
                            <StatusIndicator status="pre-configured" />
                        </div>
                        <p className="text-sm text-gray-500">Social listening and market intelligence.</p>
                    </div>
                </div>
                <span className="text-gray-500 font-semibold">Pre-configured</span>
            </div>
        </div>
        
        {/* Flipside Card */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <FlipsideIcon />
                    <div>
                        <div className="flex items-center space-x-2.5">
                            <h3 className="text-lg font-bold text-gray-900">Flipside Crypto</h3>
                             <StatusIndicator status="pre-configured" />
                        </div>
                        <p className="text-sm text-gray-500">On-chain analytics and business intelligence.</p>
                    </div>
                </div>
                <span className="text-gray-500 font-semibold">Pre-configured</span>
            </div>
        </div>

        {/* DefiLlama Card */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <DefiLlamaIcon />
                    <div>
                        <div className="flex items-center space-x-2.5">
                           <h3 className="text-lg font-bold text-gray-900">DefiLlama</h3>
                           <StatusIndicator status="pre-configured" />
                        </div>
                        <p className="text-sm text-gray-500">TVL & on-chain liquidity metrics.</p>
                    </div>
                </div>
                <span className="text-gray-500 font-semibold">Pre-configured</span>
            </div>
        </div>

        {/* DexTools Card */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <DexToolsIcon />
                    <div>
                        <div className="flex items-center space-x-2.5">
                            <h3 className="text-lg font-bold text-gray-900">DexTools</h3>
                            <StatusIndicator status="pre-configured" />
                        </div>
                        <p className="text-sm text-gray-500">DEX liquidity and trading volume.</p>
                    </div>
                </div>
                <span className="text-gray-500 font-semibold">Pre-configured</span>
            </div>
        </div>

        {/* DexScreener Card */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <DexScreenerIcon />
                    <div>
                        <div className="flex items-center space-x-2.5">
                            <h3 className="text-lg font-bold text-gray-900">DexScreener</h3>
                            <StatusIndicator status="pre-configured" />
                        </div>
                        <p className="text-sm text-gray-500">Real-time DEX price charts and data.</p>
                    </div>
                </div>
                <span className="text-gray-500 font-semibold">Pre-configured</span>
            </div>
        </div>

        {/* Coinglass Card */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <CoinglassIcon />
                    <div>
                        <div className="flex items-center space-x-2.5">
                            <h3 className="text-lg font-bold text-gray-900">Coinglass</h3>
                            <StatusIndicator status="pre-configured" />
                        </div>
                        <p className="text-sm text-gray-500">Derivatives: OI, funding, longs/shorts.</p>
                    </div>
                </div>
                <span className="text-gray-500 font-semibold">Pre-configured</span>
            </div>
        </div>

      </div>
    </div>
  );
};