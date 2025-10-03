import React, { useEffect, useMemo, useState } from "react";
import { CryptoPrice } from "../services/cryptoService";
import { googleSheetService } from "../services/googleSheetService";
import { LoadingSpinner } from "./LoadingSpinner";
import { MergedMasterTable } from "./MergedMasterTable";

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
  allCoins?: CryptoPrice[];
  data?: any[];
}


function pickRecommendedTrade(
  confluence: PipelineRow[],
  classic: PipelineRow[],
  compare: CompareRow[]
) {
  const byConfDesc = (a: PipelineRow, b: PipelineRow) =>
    (b.confidence ?? 0) - (a.confidence ?? 0);

  const confCandidates = confluence
    .filter(r => r.decision === "BUY" || r.decision === "SELL")
    .sort(byConfDesc);

  if (confCandidates[0]) {
    return {
      source: "Confluence",
      ...confCandidates[0]
    };
  }

  const divergences = compare.filter(r => {
    const cc = r.confluenceConfidence ?? 0;
    const kc = r.classicConfidence ?? 0;
    const divergeDecision =
      (r.confluenceDecision === "BUY" || r.confluenceDecision === "SELL") &&
      r.confluenceDecision !== r.classicDecision;
    return divergeDecision && cc > kc;
  });

  if (divergences[0]) {
    return {
      source: "Compare",
      symbol: divergences[0].symbol,
      decision: divergences[0].confluenceDecision,
      confidence: divergences[0].confluenceConfidence
    };
  }

  const classicCandidates = classic
    .filter(r => r.decision === "BUY" || r.decision === "SELL")
    .sort(byConfDesc);

  if (classicCandidates[0]) {
    return {
      source: "Classic",
      ...classicCandidates[0]
    };
  }

  return null;
}

const ConfidenceBadge: React.FC<{ value?: number; decision?: string }> = ({ value, decision }) => {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const color =
    decision === "BUY" ? "text-green-600" :
    decision === "SELL" ? "text-red-600" :
    "text-purple-600";
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {Number.isFinite(pct) ? `${pct.toFixed(0)}%` : "—"}
    </span>
  );
};

const MiniRing: React.FC<{ value?: number; decision?: string }> = ({ value, decision }) => {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const stroke = decision === "SELL" ? "#ef4444" : "#22c55e";
  return (
    <svg className="w-16 h-16 -rotate-90">
      <circle cx="32" cy="32" r={r} stroke="#e5e7eb" strokeWidth="6" fill="none" />
      <circle
        cx="32" cy="32" r={r}
        stroke={stroke}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
};

export const Dashboard: React.FC<DashboardProps> = () => {
  const [classic, setClassic] = useState<PipelineRow[]>([]);
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
        
        setClassic(classicData);
        setConfluence(confluenceData);

        // Generate Compare Data
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

  const recommended = useMemo(
    () => pickRecommendedTrade(confluence, classic, compare),
    [confluence, classic, compare]
  );

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
        <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">🔥 Recommended Trade</h2>
            <span className="text-xs text-gray-500">
              Source:&nbsp;
              <span className="font-semibold text-purple-600">
                {recommended?.source ?? "—"}
              </span>
            </span>
          </div>
          {recommended ? (
            <div className="mt-4 flex items-center gap-6">
              <div className="relative">
                <MiniRing value={recommended.confidence} decision={recommended.decision} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-gray-800">
                    {Math.round(recommended.confidence ?? 0)}%
                  </span>
                </div>
              </div>
              <div>
                <div className="text-2xl font-extrabold tracking-wide">
                  <span className={recommended.decision === "SELL" ? "text-red-500" : "text-green-500"}>
                    {recommended.decision ?? "—"}
                  </span>{" "}
                  {recommended.symbol ?? "—"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Confidence&nbsp;
                  <ConfidenceBadge value={recommended.confidence} decision={recommended.decision} />
                </div>
              </div>
              <div className="ml-auto">
                <button className="px-5 py-2 rounded-lg font-bold bg-purple-600 hover:bg-purple-700 text-white transition shadow-md hover:shadow-lg">
                  Execute Trade
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-gray-500">Waiting for pipeline Stage5 results…</div>
          )}
        </div>
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
                    <td className="py-2 pr-4"><ConfidenceBadge value={r.confidence} decision={r.decision} /></td>
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
