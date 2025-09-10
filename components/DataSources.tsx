import React, { useState, useEffect } from 'react';
import { googleDriveService, UserProfile } from '../services/googleDriveService';
import { GoogleDriveIcon, TradingViewIcon, LunarCrushIcon, FlipsideIcon, DefiLlamaIcon, DexToolsIcon, CoinglassIcon, DexScreenerIcon } from './Icons';
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
      statusClasses = "bg-gray-500";
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
  const [profile, setProfile] = useState<UserProfile | null>(googleDriveService.getProfile());
  const [isAuthenticated, setIsAuthenticated] = useState(googleDriveService.isAuthenticated());
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // State for TradingView connection
  const [tvApiKey, setTvApiKey] = useState('');
  const [tvApiSecret, setTvApiSecret] = useState('');
  const [tvConnectionStatus, setTvConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [tvConnectionTimestamp, setTvConnectionTimestamp] = useState<Date | null>(null);
  const [tvError, setTvError] = useState('');

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(googleDriveService.isAuthenticated());
      setProfile(googleDriveService.getProfile());
      setIsGoogleLoading(false);
    };

    googleDriveService.subscribe(handleAuthChange);
    return () => googleDriveService.unsubscribe(handleAuthChange);
  }, []);

  const getTvStatus = (): Status => {
    switch(tvConnectionStatus) {
        case 'connected': return 'connected';
        case 'connecting': return 'connecting';
        case 'error': return 'error';
        case 'idle': return 'disconnected';
        default: return 'disconnected';
    }
  };

  const handleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await googleDriveService.signIn();
    } catch (error) {
      console.error("Sign-in failed:", error);
      setIsGoogleLoading(false);
    }
  };

  const handleSignOut = () => {
    googleDriveService.signOut();
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

  return (
    <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">Data Sources</h2>
        <p className="text-sm text-gray-400">Connect your accounts to use as context for the AI.</p>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-6">
        {/* Google Drive Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <GoogleDriveIcon />
              <div>
                <div className="flex items-center space-x-2.5">
                    <h3 className="text-lg font-bold text-white">Google Drive</h3>
                    <StatusIndicator status={isAuthenticated ? 'connected' : 'disconnected'} />
                </div>
                <p className="text-sm text-gray-400">Access documents to provide context to the AI.</p>
              </div>
            </div>
            {isAuthenticated ? (
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleSignIn}
                disabled={isGoogleLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center min-w-[120px]"
              >
                {isGoogleLoading ? <LoadingSpinner /> : 'Connect'}
              </button>
            )}
          </div>
          {isAuthenticated && profile && (
            <div className="mt-6 pt-4 border-t border-gray-700 flex items-center space-x-4">
              <img src={profile.picture} alt="User profile" className="w-12 h-12 rounded-full" />
              <div>
                <p className="font-semibold text-white">{profile.name}</p>
                <p className="text-sm text-gray-400">{profile.email}</p>
              </div>
            </div>
          )}
        </div>

        {/* TradingView Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <TradingViewIcon />
              <div>
                 <div className="flex items-center space-x-2.5">
                    <h3 className="text-lg font-bold text-white">TradingView</h3>
                    <StatusIndicator status={getTvStatus()} />
                 </div>
                <p className="text-sm text-gray-400">Connect your account for broker integration.</p>
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center min-w-[120px]"
              >
                {tvConnectionStatus === 'connecting' ? <LoadingSpinner /> : 'Connect'}
              </button>
            )}
          </div>
          {tvConnectionStatus !== 'connected' ? (
              <div className="mt-6 pt-4 border-t border-gray-700 space-y-4">
                  <div>
                      <label htmlFor="tv-api-key" className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
                      <input 
                        type="password" 
                        id="tv-api-key"
                        value={tvApiKey}
                        onChange={(e) => setTvApiKey(e.target.value)}
                        placeholder="********************"
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                  </div>
                   <div>
                      <label htmlFor="tv-secret-key" className="block text-sm font-medium text-gray-300 mb-1">Secret Key</label>
                      <input 
                        type="password" 
                        id="tv-secret-key"
                        value={tvApiSecret}
                        onChange={(e) => setTvApiSecret(e.target.value)}
                        placeholder="********************"
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                  </div>
                  {tvConnectionStatus === 'error' && <p className="text-sm text-red-400">{tvError}</p>}
              </div>
          ) : (
             <div className="mt-6 pt-4 border-t border-gray-700 space-y-2">
                 <p className="text-green-400 font-semibold">Successfully connected to TradingView.</p>
                 {tvConnectionTimestamp && (
                    <p className="text-sm text-gray-400">
                        Connected on: {tvConnectionTimestamp.toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                        })}
                    </p>
                 )}
             </div>
          )}
        </div>
        
        {/* --- Pre-configured Data Layers --- */}
        <h3 className="text-lg font-semibold text-gray-300 border-b border-gray-700 pb-2">Pre-Configured Data Layers</h3>

        {/* LunarCrush Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <LunarCrushIcon />
                    <div>
                        <div className="flex items-center space-x-2.5">
                            <h3 className="text-lg font-bold text-white">LunarCrush</h3>
                            <StatusIndicator status="pre-configured" />
                        </div>
                        <p className="text-sm text-gray-400">Social listening and market intelligence.</p>
                    </div>
                </div>
                <span className="text-gray-400 font-semibold">Pre-configured</span>
            </div>
        </div>
        
        {/* Flipside Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <FlipsideIcon />
                    <div>
                        <div className="flex items-center space-x-2.5">
                            <h3 className="text-lg font-bold text-white">Flipside Crypto</h3>
                             <StatusIndicator status="pre-configured" />
                        </div>
                        <p className="text-sm text-gray-400">On-chain analytics and business intelligence.</p>
                    </div>
                </div>
                <span className="text-gray-400 font-semibold">Pre-configured</span>
            </div>
        </div>

        {/* DefiLlama Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <DefiLlamaIcon />
                    <div>
                        <div className="flex items-center space-x-2.5">
                           <h3 className="text-lg font-bold text-white">DefiLlama</h3>
                           <StatusIndicator status="pre-configured" />
                        </div>
                        <p className="text-sm text-gray-400">TVL & on-chain liquidity metrics.</p>
                    </div>
                </div>
                <span className="text-gray-400 font-semibold">Pre-configured</span>
            </div>
        </div>

        {/* DexTools Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <DexToolsIcon />
                    <div>
                        <div className="flex items-center space-x-2.5">
                            <h3 className="text-lg font-bold text-white">DexTools</h3>
                            <StatusIndicator status="pre-configured" />
                        </div>
                        <p className="text-sm text-gray-400">DEX liquidity and trading volume.</p>
                    </div>
                </div>
                <span className="text-gray-400 font-semibold">Pre-configured</span>
            </div>
        </div>

        {/* DexScreener Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <DexScreenerIcon />
                    <div>
                        <div className="flex items-center space-x-2.5">
                            <h3 className="text-lg font-bold text-white">DexScreener</h3>
                            <StatusIndicator status="pre-configured" />
                        </div>
                        <p className="text-sm text-gray-400">Real-time DEX price charts and data.</p>
                    </div>
                </div>
                <span className="text-gray-400 font-semibold">Pre-configured</span>
            </div>
        </div>

        {/* Coinglass Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <CoinglassIcon />
                    <div>
                        <div className="flex items-center space-x-2.5">
                            <h3 className="text-lg font-bold text-white">Coinglass</h3>
                            <StatusIndicator status="pre-configured" />
                        </div>
                        <p className="text-sm text-gray-400">Derivatives: OI, funding, longs/shorts.</p>
                    </div>
                </div>
                <span className="text-gray-400 font-semibold">Pre-configured</span>
            </div>
        </div>

      </div>
    </div>
  );
};