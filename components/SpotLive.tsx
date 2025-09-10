import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { NewsIcon, CalendarIcon, SocialIcon, SearchIcon } from './Icons';
import { getSpotLiveData } from '../services/geminiService';

// --- Type Definitions ---
interface NewsItem {
    source: string;
    title: string;
    sentiment: string;
    tag: string;
}

interface EventItem {
    date: string;
    title: string;
    impact: string;
    coin: string;
}

interface SocialTrendItem {
    topic: string;
    volume: number;
    sentiment: string;
}

// --- Helper Functions for Styling ---
const getSentimentClasses = (sentiment: string) => {
    switch (sentiment) {
        case 'Bullish':
        case 'Positive':
            return 'bg-green-500/20 text-green-300';
        case 'Bearish':
        case 'Negative':
            return 'bg-red-500/20 text-red-300';
        default:
            return 'bg-gray-600/50 text-gray-300';
    }
};

const getImpactClasses = (impact: string) => {
    switch (impact) {
        case 'High':
            return 'bg-red-500';
        case 'Medium':
            return 'bg-yellow-500';
        default:
            return 'bg-blue-500';
    }
};

// --- Main Component ---
export const SpotLive: React.FC = () => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [events, setEvents] = useState<EventItem[]>([]);
    const [socialTrends, setSocialTrends] = useState<SocialTrendItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getSpotLiveData();
                setNews(data.news || []);
                setEvents(data.events || []);
                setSocialTrends(data.socialTrends || []);
            } catch (err) {
                console.error("Failed to fetch SpotLive data:", err);
                if (err instanceof Error) {
                     setError(err.message);
                } else {
                     setError("An unknown error occurred while fetching data.");
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // --- Filtering Logic ---
    const lowercasedQuery = searchQuery.toLowerCase();

    const filteredNews = news.filter(item =>
        item.title.toLowerCase().includes(lowercasedQuery) ||
        item.source.toLowerCase().includes(lowercasedQuery) ||
        item.tag.toLowerCase().includes(lowercasedQuery)
    );

    const filteredEvents = events.filter(event =>
        event.title.toLowerCase().includes(lowercasedQuery) ||
        event.coin.toLowerCase().includes(lowercasedQuery)
    );

    const filteredSocialTrends = socialTrends.filter(trend =>
        trend.topic.toLowerCase().includes(lowercasedQuery)
    );

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center space-y-3 text-center">
                        <LoadingSpinner />
                        <p className="text-purple-300 font-semibold">JaxSpot AI is analyzing the market...</p>
                        <p className="text-sm text-gray-400">Curating the latest news, events, and trends for you.</p>
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                 <div className="flex-1 flex items-center justify-center">
                    <div className="text-center p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="font-semibold text-red-400">Failed to Load Data</p>
                        <p className="text-sm text-gray-300 mt-1">{error}</p>
                    </div>
                </div>
            );
        }

        return (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* News Column */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-purple-400 flex items-center space-x-2">
                        <NewsIcon />
                        <span>Top News & Narratives</span>
                    </h3>
                    {filteredNews.length > 0 ? filteredNews.map((item, index) => (
                        <div key={index} className="bg-gray-800 p-4 rounded-lg border border-gray-700/50">
                            <p className="text-xs text-gray-400">{item.source}</p>
                            <p className="font-semibold text-white my-1">{item.title}</p>
                            <div className="flex items-center space-x-2 mt-2">
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getSentimentClasses(item.sentiment)}`}>
                                    {item.sentiment}
                                </span>
                                <span className="px-2 py-0.5 text-xs font-mono bg-gray-700 text-gray-300 rounded-full">{item.tag}</span>
                            </div>
                        </div>
                    )) : <p className="text-gray-500 text-sm">{searchQuery ? 'No news matching your filter.' : 'No news available.'}</p>}
                </div>

                {/* Events Column */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-purple-400 flex items-center space-x-2">
                        <CalendarIcon />
                        <span>Key Upcoming Events</span>
                    </h3>
                    {filteredEvents.length > 0 ? filteredEvents.map((event, index) => (
                        <div key={index} className="bg-gray-800 p-4 rounded-lg border border-gray-700/50 flex items-center space-x-4">
                            <div className="flex-shrink-0 text-center">
                                <p className="text-xs text-gray-400">{event.date.split(',')[0]}</p>
                                <p className="text-xl font-bold text-white">{event.date.split(' ')[1]?.replace(',', '') || 'N/A'}</p>
                            </div>
                            <div className="w-px bg-gray-600 self-stretch"></div>
                            <div>
                                <p className="font-semibold text-white">{event.title}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full text-white/90 ${getImpactClasses(event.impact)}`}>
                                        {event.impact} Impact
                                    </span>
                                    <span className="px-2 py-0.5 text-xs font-mono bg-gray-700 text-gray-300 rounded-full">{event.coin}</span>
                                </div>
                            </div>
                        </div>
                    )) : <p className="text-gray-500 text-sm">{searchQuery ? 'No events matching your filter.' : 'No events available.'}</p>}
                </div>

                {/* Social Trends Column */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-purple-400 flex items-center space-x-2">
                        <SocialIcon />
                        <span>Social Media Trends</span>
                    </h3>
                    {filteredSocialTrends.length > 0 ? filteredSocialTrends.map((trend, index) => (
                        <div key={index} className="bg-gray-800 p-4 rounded-lg border border-gray-700/50">
                            <div className="flex items-center justify-between">
                                <p className="font-bold text-white font-mono">{trend.topic}</p>
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getSentimentClasses(trend.sentiment)}`}>
                                    {trend.sentiment}
                                </span>
                            </div>
                            <div className="mt-2">
                                <p className="text-xs text-gray-400 mb-1">Chatter Volume</p>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: `${trend.volume}%` }}></div>
                                </div>
                            </div>
                        </div>
                    )) : <p className="text-gray-500 text-sm">{searchQuery ? 'No social trends matching your filter.' : 'No social trends available.'}</p>}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">SpotLive AI Dashboard</h2>
                <p className="text-sm text-gray-400">Curated real-time news, events, and social trends.</p>
            </div>
            {/* --- Search Bar --- */}
            <div className="p-4 border-b border-gray-700">
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <SearchIcon />
                    </span>
                    <input
                        type="text"
                        placeholder="Filter by keyword, e.g., BTC, SEC..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        aria-label="Filter news, events, and trends"
                    />
                </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
                {renderContent()}
            </div>
        </div>
    );
};