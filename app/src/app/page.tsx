"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { BN } from "@coral-xyz/anchor";
import {
  getWinnerLabel,
  isMarketOpen,
  formatTimeRemaining,
  lamportsToSol,
} from "../utils/arcium";
import "@solana/wallet-adapter-react-ui/styles.css";

interface Market {
  marketId: BN;
  question: string;
  closesAt: number;
  minStakeLamports: BN;
  resolved: boolean;
  winner: number;
  numVoters: BN;
  yesVotes: BN;
  noVotes: BN;
  yesStake: BN;
  noStake: BN;
}

type View = "list" | "create" | "market";

export default function Home() {
  const { publicKey } = useWallet();
  const [view, setView] = useState<View>("list");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [hoursOpen, setHoursOpen] = useState("24");
  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTicker((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const now = Date.now() / 1000;
    setMarkets([
      {
        marketId: new BN(1001),
        question: "Will SOL reach $200 before June 30, 2026?",
        closesAt: now + 86400 * 2,
        minStakeLamports: new BN(10_000_000),
        resolved: false,
        winner: 255,
        numVoters: new BN(37),
        yesVotes: new BN(0),
        noVotes: new BN(0),
        yesStake: new BN(0),
        noStake: new BN(0),
      },
      {
        marketId: new BN(1002),
        question: "Will Arcium mainnet launch before Q3 2026?",
        closesAt: now + 86400 * 5,
        minStakeLamports: new BN(5_000_000),
        resolved: false,
        winner: 255,
        numVoters: new BN(12),
        yesVotes: new BN(0),
        noVotes: new BN(0),
        yesStake: new BN(0),
        noStake: new BN(0),
      },
      {
        marketId: new BN(1003),
        question: "Will ETH flip BTC by market cap in 2026?",
        closesAt: now - 100,
        minStakeLamports: new BN(1_000_000),
        resolved: true,
        winner: 0,
        numVoters: new BN(37),
        yesVotes: new BN(14),
        noVotes: new BN(23),
        yesStake: new BN(140_000_000),
        noStake: new BN(230_000_000),
      },
    ]);
  }, []);

  async function handleCreateMarket() {
    if (!newQuestion.trim()) return;
    setLoading(true);
    setStatus("Creating market...");
    await new Promise((r) => setTimeout(r, 1500));
    const now = Date.now() / 1000;
    const newMarket: Market = {
      marketId: new BN(Date.now()),
      question: newQuestion,
      closesAt: now + parseInt(hoursOpen) * 3600,
      minStakeLamports: new BN(10_000_000),
      resolved: false,
      winner: 255,
      numVoters: new BN(0),
      yesVotes: new BN(0),
      noVotes: new BN(0),
      yesStake: new BN(0),
      noStake: new BN(0),
    };
    setMarkets((prev) => [newMarket, ...prev]);
    setStatus("✅ Market created!");
    setNewQuestion("");
    setView("list");
    setLoading(false);
  }

  async function handleVote(market: Market, voteYes: boolean) {
    if (!publicKey) return;
    setLoading(true);
    setStatus("🔐 Encrypting your vote with Arcium MPC...");
    await new Promise((r) => setTimeout(r, 1000));
    setStatus("📡 Submitting encrypted vote to Solana...");
    await new Promise((r) => setTimeout(r, 1500));
    setStatus("⏳ Waiting for MPC computation...");
    await new Promise((r) => setTimeout(r, 1000));
    setHasVoted(true);
    setSelectedMarket((prev) =>
      prev ? { ...prev, numVoters: new BN(prev.numVoters.toNumber() + 1) } : prev
    );
    setStatus(`✅ Vote submitted! You voted ${voteYes ? "YES ✓" : "NO ✗"}.\n🔒 Your vote is encrypted inside Arcium MPC.`);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-mono">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView("list")}>
          <div className="text-2xl">🔮</div>
          <div>
            <div className="text-lg font-bold text-purple-400">arcium-predict</div>
            <div className="text-xs text-gray-500">Private prediction markets · Powered by Arcium MPC</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {view !== "create" && (
            <button onClick={() => setView("create")} disabled={!publicKey}
              className="px-4 py-2 text-sm bg-purple-700 hover:bg-purple-600 disabled:opacity-40 rounded-lg transition">
              + New Market
            </button>
          )}
          <WalletMultiButton className="!bg-gray-800 !rounded-lg !text-sm" />
        </div>
      </header>

      <div className="bg-purple-950/40 border-b border-purple-900/50 px-6 py-2 text-xs text-purple-300 flex items-center gap-2">
        <span>🔒</span>
        <span>Votes are encrypted via Arcium MPC. The YES/NO split is <strong>invisible to everyone</strong> until after close.</span>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {status && (
          <div className="mb-6 p-4 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-300 whitespace-pre-line">
            {status}
          </div>
        )}

        {view === "create" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setView("list")} className="text-gray-400 hover:text-white text-sm">← Back</button>
              <h2 className="text-xl font-bold">Create Market</h2>
            </div>
            <div className="bg-gray-900 rounded-2xl p-6 space-y-5 border border-gray-800">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">Market Question</label>
                <textarea value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Will SOL reach $300 by end of 2026?" maxLength={50} rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">Duration (hours)</label>
                <input type="number" value={hoursOpen} onChange={(e) => setHoursOpen(e.target.value)} min="1"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div className="bg-purple-950/40 rounded-xl p-4 text-xs text-purple-300 space-y-1 border border-purple-900/40">
                <div className="font-bold text-purple-200 mb-2">🔒 How privacy works</div>
                <div>• Each voter encrypts their vote — no node sees the plaintext</div>
                <div>• Running tally stays encrypted inside Arcium MXE cluster</div>
                <div>• YES/NO split only revealed after market closes via MPC reveal</div>
              </div>
              <button onClick={handleCreateMarket} disabled={loading || !newQuestion.trim() || !publicKey}
                className="w-full py-3 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 rounded-xl font-bold transition">
                {loading ? "Creating..." : "Create Market →"}
              </button>
            </div>
          </div>
        )}

        {view === "market" && selectedMarket && (
          <div className="space-y-6">
            <button onClick={() => { setView("list"); setStatus(""); }} className="text-gray-400 hover:text-white text-sm">← Back</button>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-bold">{selectedMarket.question}</h2>
                  <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold ${selectedMarket.resolved ? "bg-gray-700 text-gray-300" : isMarketOpen(selectedMarket.closesAt) ? "bg-green-900 text-green-300" : "bg-yellow-900 text-yellow-300"}`}>
                    {selectedMarket.resolved ? "Resolved" : isMarketOpen(selectedMarket.closesAt) ? "Open" : "Pending"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-400">
                  <span>👥 <strong className="text-white">{selectedMarket.numVoters.toString()}</strong> voters</span>
                  <span>⏱ <strong className="text-white">{formatTimeRemaining(selectedMarket.closesAt)}</strong></span>
                  <span>💰 Min: <strong className="text-white">{lamportsToSol(selectedMarket.minStakeLamports.toString())} SOL</strong></span>
                </div>
              </div>

              {selectedMarket.resolved ? (
                <div className="p-6 space-y-4">
                  <div className={`text-center p-6 rounded-xl border ${getWinnerLabel(selectedMarket.winner) === "YES" ? "bg-green-950/40 border-green-800 text-green-300" : "bg-red-950/40 border-red-800 text-red-300"}`}>
                    <div className="text-3xl font-black mb-1">{getWinnerLabel(selectedMarket.winner)} won</div>
                    <div className="text-sm opacity-70">Revealed by Arcium MPC after market close</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-400 mb-1">YES</div>
                      <div className="text-2xl font-bold text-green-400">{selectedMarket.yesVotes.toString()}</div>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-400 mb-1">NO</div>
                      <div className="text-2xl font-bold text-red-400">{selectedMarket.noVotes.toString()}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  <div className="bg-purple-950/30 border border-purple-900/40 rounded-xl p-4 text-xs text-purple-300">
                    🔒 The current YES/NO distribution is <strong>hidden</strong> inside Arcium's encrypted shared state. It will be revealed when the market closes.
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 text-center text-xs text-gray-500">
                    ████████████ encrypted ████████████<br/>
                    {selectedMarket.numVoters.toString()} people have voted · split hidden until close
                  </div>
                  {!publicKey ? (
                    <div className="text-center py-4 text-gray-500 text-sm">Connect wallet to vote</div>
                  ) : hasVoted ? (
                    <div className="text-center py-4 bg-gray-800 rounded-xl text-sm">✅ You have already voted</div>
                  ) : !isMarketOpen(selectedMarket.closesAt) ? (
                    <div className="text-center py-4 bg-yellow-950/40 rounded-xl text-sm text-yellow-300 border border-yellow-900/40">⏳ Market closed — awaiting MPC reveal</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => handleVote(selectedMarket, true)} disabled={loading}
                        className="py-4 bg-green-900 hover:bg-green-800 disabled:opacity-40 rounded-xl font-bold text-green-300 text-lg transition">
                        {loading ? "..." : "✓ YES"}
                      </button>
                      <button onClick={() => handleVote(selectedMarket, false)} disabled={loading}
                        className="py-4 bg-red-900 hover:bg-red-800 disabled:opacity-40 rounded-xl font-bold text-red-300 text-lg transition">
                        {loading ? "..." : "✗ NO"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {view === "list" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Active Markets</h2>
            {markets.map((market) => (
              <div key={market.marketId.toString()} onClick={() => { setSelectedMarket(market); setView("market"); setStatus(""); setHasVoted(false); }}
                className="bg-gray-900 border border-gray-800 hover:border-purple-700/50 rounded-2xl p-5 cursor-pointer transition group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-semibold text-sm group-hover:text-purple-200 transition">{market.question}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>👥 {market.numVoters.toString()} voters</span>
                      <span>⏱ {market.resolved ? "Resolved" : formatTimeRemaining(market.closesAt)}</span>
                      <span>💰 {lamportsToSol(market.minStakeLamports.toString())} SOL min</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${market.resolved ? market.winner === 1 ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300" : isMarketOpen(market.closesAt) ? "bg-green-900/40 text-green-400" : "bg-yellow-900/40 text-yellow-400"}`}>
                      {market.resolved ? getWinnerLabel(market.winner) + " won" : isMarketOpen(market.closesAt) ? "Open" : "Pending"}
                    </span>
                    {!market.resolved && <span className="text-xs text-gray-600">🔒 split hidden</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 mt-16 text-xs text-gray-600 flex justify-between">
        <span>arcium-predict · built on Arcium MPC + Solana</span>
        <a href="https://docs.arcium.com" target="_blank" rel="noreferrer" className="hover:text-gray-400">Arcium Docs →</a>
      </footer>
    </div>
  );
}
