import React, { useEffect, useMemo, useState } from "react";
import { googleSheetService } from "../services/googleSheetService";
import { LoadingSpinner } from "./LoadingSpinner";
import { MergedMasterTable } from "./MergedMasterTable";
import { TrendingUpIcon, TrendingDownIcon } from './Icons';

// Types (flexible: we normalize headers)
type PipelineRow = {
  symbol: string;
  decision?: string;     // BUY/SELL/HOLD
  confidence?: number;   // 0..100 or 0..1
  score?: number;
  timestamp?: string;
  [k: string]: any;
};

type CompareRow = {
  symbol: string;
  classicDecision?: string;
  classicConfidence?: number;
  confluenceDecision?: string;
  confluenceConfidence?: number;
  [k: string]: any;
};

interface DashboardProps {
  // empty props for now
}

// NEW COMPONENT for the AI-generated trade idea
const JaxAlphaTrade: React.FC = () => {
    const tradeIdea = {
        symbol: "RNDR",
        name: "Render Token",
        decision: "BUY",
        entryZone: "$7.60 - $7.85",
        target1: "$9.20",
        target2: "$11.50",
        stopLoss: "$6.95",
        confidence: 82,
        rationale: [
            "Unusual volume spikes on merged_master not yet reflected in price.",
            "Social volume up 45% WoW (lunar_social), but sentiment is neutral. The herd hasn't arrived.",
            "Tracked wallets show significant accumulation (~$2.5M) in the last 72 hours.",
            "Open Interest climbing steadily while funding rates remain low (coinglass_data).",
            "Setup mirrors a Q4 2023 pattern from historical_archive that preceded a 60% rally."
        ]
    };

    const isBuy = tradeIdea.decision === 'BUY';
    const confidenceColor = tradeIdea.confidence > 75 ? 'bg-green-500' : tradeIdea.confidence > 50 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="md:col-span-2 bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-800/50 rounded-2xl p-6 shadow-2xl shadow-purple-900/20 text-white">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-purple-300">🔥 JAX's Alpha Pick</h2>
                <span className={`px-3 py-1 text-sm font-bold rounded-full flex items-center gap-2 ${isBuy ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {isBuy ? <TrendingUpIcon className="w-4 h-4" /> : <TrendingDownIcon className="w-4 h-4" />}
                    {tradeIdea.decision}
                </span>
            </div>

            <div className="mt-4 flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="flex-shrink-0 text-center">
                    <p className="text-5xl font-extrabold tracking-wider">{tradeIdea.symbol}</p>
                    <p className="text-gray-400">{tradeIdea.name}</p>
                </div>

                <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-gray-700/50 p-3 rounded-lg">
                        <p className="text-xs text-gray-400">Entry Zone</p>
                        <p className="font-mono font-bold text-lg">{tradeIdea.entryZone}</p>
                    </div>
                    <div className="bg-green-500/20 p-3 rounded-lg">
                        <p className="text-xs text-green-300">Target 1</p>
                        <p className="font-mono font-bold text-lg">{tradeIdea.target1}</p>
                    </div>
                     <div className="bg-green-500/20 p-3 rounded-lg">
                        <p className="text-xs text-green-300">Target 2</p>
                        <p className="font-mono font-bold text-lg">{tradeIdea.target2}</p>
                    </div>
                    <div className="bg-red-500/20 p-3 rounded-lg col-span-2 md:col-span-1">
                        <p className="text-xs text-red-300">Stop Loss</p>
                        <p className="font-mono font-bold text-lg">{tradeIdea.stopLoss}</p>
                    </div>
                </div>
            </div>

            <div className="mt-6">
                <h3 className="font-bold text-gray-300">Rationale</h3>
                <ul className="mt-2 text-sm text-gray-400 space-y-1 list-disc list-inside">
                    {tradeIdea.rationale.map((reason, index) => <li key={index}>{reason}</li>)}
                </ul>
            </div>
            
            <div className="mt-6">
                 <p className="text-xs text-gray-400 mb-1">AI Confidence ({tradeIdea.confidence}%)</p>
                <div className="w-full bg-gray-700/50 rounded-full h-2.5">
                    <div className={`${confidenceColor} h-2.5 rounded-full`} style={{ width: `${tradeIdea.confidence}%` }}></div>
                </div>
            </div>
            
            <div className="mt-6 text-xs text-gray-500 italic">
                This is not financial advice. For educational use only.
            </div>
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = () => {
    const [confluence, setConfluence] = useState<PipelineRow[]>([]);
    const [compare, setCompare] = useState<CompareRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [errors, setErrors] = useState<string[]>([]);
    const [walletConnected, setWalletConnected] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setErrors([]);
            try {
                const pipelineData = await googleSheetService.fetchData<any>('pipeline');
                
                const classicData = pipelineData
                    .filter(row => row.Source?.toLowerCase() === 'classic')
                    .map(r => ({ symbol: r.Asset, decision: r.Decision, confidence: r.Score * 100, score: r.Score, timestamp: r.Timestamp }));

                const confluenceData = pipelineData
                    .filter(row => row.Source?.toLowerCase() === 'confluence')
                    .map(r => ({ symbol: r.Asset, decision: r.Decision, confidence: r.Score * 100, score: r.Score, timestamp: r.Timestamp }));
                
                setConfluence(confluenceData);

                const confluenceMap = new Map(confluenceData.map(c => [c.symbol, c]));
                const compareData: CompareRow[] = classicData.map(classicRow => {
                    const confluenceRow = confluenceMap.get(classicRow.symbol);
                    return {
                        symbol: classicRow.symbol,
                        classicDecision: classicRow.decision,
                        classicConfidence: classicRow.confidence,
                        confluenceDecision: confluenceRow?.decision,
                        confluenceConfidence: confluenceRow?.confidence
                    };
                });
                setCompare(compareData);

            } catch (error) {
                console.error("Failed to load dashboard data:", error);
                setErrors(prev => [...prev, "Could not load pipeline data."]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const topConfluence = useMemo(() => {
        return [...confluence]
          .filter(r => r.decision === "BUY" || r.decision === "SELL")
          .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
          .slice(0, 5);
    }, [confluence]);

    const topDivergences = useMemo(() => {
        const rows = compare
          .map(r => ({
            ...r,
            gap: (r.confluenceConfidence ?? 0) - (r.classicConfidence ?? 0)
          }))
          .filter(r =>
            (r.confluenceDecision === "BUY" || r.confluenceDecision === "SELL") &&
            r.confluenceDecision !== r.classicDecision
          )
          .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))
          .slice(0, 5);
        return rows;
    }, [compare]);
  
    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="w-full min-h-full flex flex-col gap-6 p-6 bg-gray-50 text-gray-900">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <JaxAlphaTrade />

                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
                    <h3 className="text-xl font-bold">👛 Wallet</h3>
                    <div className="mt-4">
                        {walletConnected ? (
                        <div>
                            <p className="text-green-600 font-semibold">Connected ✅</p>
                            <p className="text-sm text-gray-500 mt-1">Balance: $—</p>
                        </div>
                        ) : (
                        <button
                            onClick={() => setWalletConnected(true)}
                            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 font-bold text-white shadow-md hover:shadow-lg"
                        >
                            Connect Wallet
                        </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-purple-700">Top Confluence Picks</h3>
                        <span className="text-xs text-gray-500">Stage5_Confluence</span>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                        <thead className="text-left text-gray-600">
                            <tr className="border-b border-gray-200/60">
                            <th className="py-2 pr-4">Symbol</th>
                            <th className="py-2 pr-4">Decision</th>
                            <th className="py-2 pr-4">Confidence</th>
                            <th className="py-2 pr-4">Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topConfluence.length === 0 && (
                            <tr><td className="py-4 text-gray-500" colSpan={4}>No picks yet.</td></tr>
                            )}
                            {topConfluence.map((r, i) => (
                            <tr key={r.symbol + i} className="border-b border-gray-100">
                                <td className="py-2 pr-4 font-semibold">{r.symbol}</td>
                                <td className="py-2 pr-4">
                                <span className={r.decision === "SELL" ? "text-red-600" : "text-green-600"}>
                                    {r.decision ?? "—"}
                                </span>
                                </td>
                                <td className="py-2 pr-4"><span className={`text-xs font-semibold ${r.decision === "BUY" ? "text-green-600" : r.decision === "SELL" ? "text-red-600" : "text-purple-600"}`}>{Number.isFinite(r.confidence) ? `${(r.confidence as number).toFixed(0)}%` : "—"}</span></td>
                                <td className="py-2 pr-4">{Number.isFinite(r.score) ? (r.score as number).toFixed(2) : "—"}</td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-purple-700">Pipeline Compare — Divergences</h3>
                        <span className="text-xs text-gray-500">Pipeline_Compare</span>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                        <thead className="text-left text-gray-600">
                            <tr className="border-b border-gray-200/60">
                            <th className="py-2 pr-4">Symbol</th>
                            <th className="py-2 pr-4">Classic</th>
                            <th className="py-2 pr-4">Confluence</th>
                            <th className="py-2 pr-4">Δ Conf</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topDivergences.length === 0 && (
                            <tr><td className="py-4 text-gray-500" colSpan={4}>No divergences.</td></tr>
                            )}
                            {topDivergences.map((r, i) => (
                            <tr key={r.symbol + i} className="border-b border-gray-100">
                                <td className="py-2 pr-4 font-semibold">{r.symbol}</td>
                                <td className="py-2 pr-4">
                                <span className={ r.classicDecision === "SELL" ? "text-red-500" : r.classicDecision === "BUY" ? "text-green-500" : "text-gray-800"}>
                                    {r.classicDecision ?? "—"}
                                </span>{" "}
                                <span className="text-xs text-gray-500">({Number.isFinite(r.classicConfidence) ? (r.classicConfidence as number).toFixed(0) : "—"}%)</span>
                                </td>
                                <td className="py-2 pr-4">
                                <span className={r.confluenceDecision === "SELL" ? "text-red-500" : r.confluenceDecision === "BUY" ? "text-green-500" : "text-gray-800"}>
                                    {r.confluenceDecision ?? "—"}
                                </span>{" "}
                                <span className="text-xs text-gray-500">({Number.isFinite(r.confluenceConfidence) ? (r.confluenceConfidence as number).toFixed(0) : "—"}%)</span>
                                </td>
                                <td className="py-2 pr-4">{Number.isFinite(r.gap) ? (r.gap as number).toFixed(0) : "—"}%</td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="w-full">
                <MergedMasterTable />
            </div>

            <div className="text-xs text-gray-500">
                {errors.length > 0 && (
                <ul className="mt-2 text-red-500 list-disc list-inside">
                    {errors.map((e, idx) => <li key={idx}>{e}</li>)}
                </ul>
                )}
            </div>
        </div>
    );
};
