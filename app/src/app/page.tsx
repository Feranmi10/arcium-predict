"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Program, AnchorProvider, BN, web3 } from "@coral-xyz/anchor";
import {
  encryptVote,
  encodeQuestion,
  decodeQuestion,
  getMarketPDA,
  getTallyPDA,
  getEscrowPDA,
  getVoterRecordPDA,
  getArciumAccounts,
  getSubmitVoteCompDef,
  getWinnerLabel,
  isMarketOpen,
  formatTimeRemaining,
  lamportsToSol,
  randomComputationOffset,
  PROGRAM_ID,
} from "../utils/arcium";
import { awaitComputationFinalization } from "@arcium-hq/client";
import "@solana/wallet-adapter-react-ui/styles.css";

// ================================================================
//  Types
// ================================================================

interface Market {
  marketId: BN;
  question: string;
  closesAt: number;
  minStakeLamports: BN;
  creator: string;
  resolved: boolean;
  winner: number;
  yesVotes: BN;
  noVotes: BN;
  yesStake: BN;
  noStake: BN;
  numVoters: BN;
}

type View = "list" | "create" | "market";

// ================================================================
//  Main App
// ================================================================

export default function Home() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const [view, setView] = useState<View>("list");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // Create market form
  const [newQuestion, setNewQuestion] = useState("");
  const [hoursOpen, setHoursOpen] = useState("24");
  const [minStakeSol, setMinStakeSol] = useState("0.01");

  // Vote UI
  const [hasVoted, setHasVoted] = useState(false);
  const [ticker, setTicker] = useState(0);

  // Ticker for time remaining countdowns
  useEffect(() => {
    const id = setInterval(() => setTicker((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const getProgram = useCallback(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    const wallet = { publicKey, signTransaction, signAllTransactions };
    const provider = new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
    // In production, import the IDL from target/types/arcium_predict
    // For demo, we use a minimal inline program reference
    return { provider, programId: PROGRAM_ID };
  }, [publicKey, signTransaction, signAllTransactions, connection]);

  // ── Load all markets (demo data for UI) ────────────────────────
  useEffect(() => {
    // In production: fetch all Market accounts via program.account.market.all()
    // Demo: seed with example markets
    const now = Date.now() / 1000;
    setMarkets([
      {
        marketId: new BN(1001),
        question: "Will SOL reach $200 before June 30, 2026?",
        closesAt: now + 86400 * 2,
        minStakeLamports: new BN(10_000_000),
        creator: "Demo",
        resolved: false,
        winner: 255,
        yesVotes: new BN(0),
        noVotes: new BN(0),
        yesStake: new BN(0),
        noStake: new BN(0),
        numVoters: new BN(37),
      },
      {
        marketId: new BN(1002),
        question: "Will Arcium mainnet launch before Q3 2026?",
        closesAt: now + 86400 * 5,
        minStakeLamports: new BN(5_000_000),
        creator: "Demo",
        resolved: false,
        winner: 255,
        yesVotes: new BN(0),
        noVotes: new BN(0),
        yesStake: new BN(0),
        noStake: new BN(0),
        numVoters: new BN(12),
      },
      {
        marketId: new BN(1003),
        question: "Will ETH flip BTC by market cap in 2026?",
        closesAt: now - 100, // already closed
        minStakeLamports: new BN(1_000_000),
        creator: "Demo",
        resolved: true,
        winner: 0, // NO won
        yesVotes: new BN(14),
        noVotes: new BN(23),
        yesStake: new BN(140_000_000),
        noStake: new BN(230_000_000),
        numVoters: new BN(37),
      },
    ]);
  }, []);

  // ── Check if current user voted ────────────────────────────────
  useEffect(() => {
    if (!publicKey || !selectedMarket) return;
    // In production: fetch VoterRecord PDA and check has_voted
    setHasVoted(false);
  }, [publicKey, selectedMarket]);

  // ── Create market ──────────────────────────────────────────────
  async function handleCreateMarket() {
    if (!getProgram() || !newQuestion.trim()) return;
    setLoading(true);
    setStatus("Creating market on-chain...");
    try {
      const marketId = new BN(Date.now());
      const closesAt = new BN(
        Math.floor(Date.now() / 1000) + parseInt(hoursOpen) * 3600
      );
      const minStake = new BN(Math.floor(parseFloat(minStakeSol) * 1e9));
      const question = encodeQuestion(newQuestion);

      // In production: call program.methods.createMarket(...)
      // Simulate success for UI demo
      await new Promise((r) => setTimeout(r, 1500));

      const newMarket: Market = {
        marketId,
        question: newQuestion,
        closesAt: closesAt.toNumber(),
        minStakeLamports: minStake,
        creator: publicKey?.toBase58() || "you",
        resolved: false,
        winner: 255,
        yesVotes: new BN(0),
        noVotes: new BN(0),
        yesStake: new BN(0),
        noStake: new BN(0),
        numVoters: new BN(0),
      };

      setMarkets((prev) => [newMarket, ...prev]);
      setStatus("✅ Market created!");
      setNewQuestion("");
      setView("list");
    } catch (e: any) {
      setStatus("❌ " + e.message);
    }
    setLoading(false);
  }

  // ── Submit encrypted vote ──────────────────────────────────────
  async function handleVote(market: Market, voteYes: boolean) {
    const p = getProgram();
    if (!p || !publicKey) return;
    setLoading(true);
    setStatus("🔐 Encrypting your vote with Arcium MPC...");

    try {
      const stakeLamports = BigInt(market.minStakeLamports.toString());

      // Encrypt vote — happens client-side before hitting chain
      setStatus("🔑 Performing x25519 key exchange with MXE...");
      const encrypted = await encryptVote(p.provider, voteYes, stakeLamports);

      setStatus("📡 Submitting encrypted vote to Solana...");
      const computationOffset = randomComputationOffset();

      const [marketPDA] = getMarketPDA(market.marketId);
      const [tallyPDA] = getTallyPDA(market.marketId);
      const [escrowPDA] = getEscrowPDA(market.marketId);
      const [voterRecordPDA] = getVoterRecordPDA(market.marketId, publicKey);
      const arciumAccs = getArciumAccounts(computationOffset);

      // In production: call program.methods.submitVote(...)
      await new Promise((r) => setTimeout(r, 2000));

      setStatus("⏳ Waiting for MPC computation to complete...");
      // await awaitComputationFinalization(p.provider, computationOffset, PROGRAM_ID, "confirmed");
      await new Promise((r) => setTimeout(r, 1500));

      setHasVoted(true);
      setSelectedMarket((prev) =>
        prev
          ? { ...prev, numVoters: new BN(prev.numVoters.toNumber() + 1) }
          : prev
      );

      setStatus(
        `✅ Vote submitted! You voted ${voteYes ? "YES ✓" : "NO ✗"}.\n🔒 Your vote is now encrypted inside Arcium MPC — not even the nodes know how you voted.`
      );
    } catch (e: any) {
      setStatus("❌ " + e.message);
    }
    setLoading(false);
  }

  // ================================================================
  //  RENDER
  // ================================================================

  return (
    <div className="min-h-screen bg-gray-950 text-white font-mono">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setView("list")}
        >
          <div className="text-2xl">🔮</div>
          <div>
            <div className="text-lg font-bold text-purple-400 tracking-tight">
              arcium-predict
            </div>
            <div className="text-xs text-gray-500">
              Private prediction markets · Powered by Arcium MPC
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {view !== "create" && (
            <button
              onClick={() => setView("create")}
              disabled={!publicKey}
              className="px-4 py-2 text-sm bg-purple-700 hover:bg-purple-600 disabled:opacity-40 rounded-lg transition"
            >
              + New Market
            </button>
          )}
          <WalletMultiButton className="!bg-gray-800 !hover:bg-gray-700 !rounded-lg !text-sm" />
        </div>
      </header>

      {/* ── Privacy banner ──────────────────────────────────────── */}
      <div className="bg-purple-950/40 border-b border-purple-900/50 px-6 py-2 text-xs text-purple-300 flex items-center gap-2">
        <span>🔒</span>
        <span>
          Votes are encrypted via Arcium MPC. The YES/NO split is{" "}
          <strong>invisible to everyone</strong> — including the market creator
          — until after close.
        </span>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* ── Status message ───────────────────────────────────── */}
        {status && (
          <div className="mb-6 p-4 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-300 whitespace-pre-line">
            {status}
          </div>
        )}

        {/* ── CREATE MARKET VIEW ───────────────────────────────── */}
        {view === "create" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView("list")}
                className="text-gray-400 hover:text-white text-sm"
              >
                ← Back
              </button>
              <h2 className="text-xl font-bold">Create Market</h2>
            </div>

            <div className="bg-gray-900 rounded-2xl p-6 space-y-5 border border-gray-800">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">
                  Market Question
                </label>
                <textarea
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Will SOL reach $300 by end of 2026?"
                  maxLength={127}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-purple-500"
                />
                <div className="text-xs text-gray-600 mt-1 text-right">
                  {newQuestion.length}/127
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">
                    Duration (hours)
                  </label>
                  <input
                    type="number"
                    value={hoursOpen}
                    onChange={(e) => setHoursOpen(e.target.value)}
                    min="1"
                    max="8760"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">
                    Min Stake (SOL)
                  </label>
                  <input
                    type="number"
                    value={minStakeSol}
                    onChange={(e) => setMinStakeSol(e.target.value)}
                    min="0.001"
                    step="0.001"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="bg-purple-950/40 rounded-xl p-4 text-xs text-purple-300 space-y-1 border border-purple-900/40">
                <div className="font-bold text-purple-200 mb-2">
                  🔒 How privacy works
                </div>
                <div>
                  • Each voter encrypts their vote with a key shared only with
                  the Arcium MXE cluster
                </div>
                <div>
                  • No Arx node can see individual votes or the running tally
                </div>
                <div>
                  • The YES/NO split is revealed only when the market closes via
                  MPC reveal
                </div>
                <div>
                  • This prevents whale manipulation, vote herding, and last-minute sniping
                </div>
              </div>

              <button
                onClick={handleCreateMarket}
                disabled={loading || !newQuestion.trim() || !publicKey}
                className="w-full py-3 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 rounded-xl font-bold transition"
              >
                {loading ? "Creating..." : "Create Market →"}
              </button>
            </div>
          </div>
        )}

        {/* ── MARKET DETAIL VIEW ───────────────────────────────── */}
        {view === "market" && selectedMarket && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setView("list"); setStatus(""); }}
                className="text-gray-400 hover:text-white text-sm"
              >
                ← Back
              </button>
            </div>

            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              {/* Question header */}
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-bold leading-snug">
                    {selectedMarket.question}
                  </h2>
                  <span
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold ${
                      selectedMarket.resolved
                        ? "bg-gray-700 text-gray-300"
                        : isMarketOpen(selectedMarket.closesAt)
                        ? "bg-green-900 text-green-300"
                        : "bg-yellow-900 text-yellow-300"
                    }`}
                  >
                    {selectedMarket.resolved
                      ? "Resolved"
                      : isMarketOpen(selectedMarket.closesAt)
                      ? "Open"
                      : "Pending reveal"}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-400">
                  <span>
                    👥{" "}
                    <strong className="text-white">
                      {selectedMarket.numVoters.toString()}
                    </strong>{" "}
                    voters
                  </span>
                  <span>
                    ⏱{" "}
                    <strong className="text-white">
                      {formatTimeRemaining(selectedMarket.closesAt)}
                    </strong>
                  </span>
                  <span>
                    💰 Min stake:{" "}
                    <strong className="text-white">
                      {lamportsToSol(selectedMarket.minStakeLamports.toString())} SOL
                    </strong>
                  </span>
                </div>
              </div>

              {/* Resolved result */}
              {selectedMarket.resolved ? (
                <div className="p-6 space-y-4">
                  <div
                    className={`text-center p-6 rounded-xl border ${
                      getWinnerLabel(selectedMarket.winner) === "YES"
                        ? "bg-green-950/40 border-green-800 text-green-300"
                        : getWinnerLabel(selectedMarket.winner) === "NO"
                        ? "bg-red-950/40 border-red-800 text-red-300"
                        : "bg-gray-800 border-gray-700 text-gray-300"
                    }`}
                  >
                    <div className="text-3xl font-black mb-1">
                      {getWinnerLabel(selectedMarket.winner)} won
                    </div>
                    <div className="text-sm opacity-70">
                      Revealed by Arcium MPC after market close
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-400 mb-1">YES</div>
                      <div className="text-2xl font-bold text-green-400">
                        {selectedMarket.yesVotes.toString()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {lamportsToSol(selectedMarket.yesStake.toString())} SOL staked
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-400 mb-1">NO</div>
                      <div className="text-2xl font-bold text-red-400">
                        {selectedMarket.noVotes.toString()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {lamportsToSol(selectedMarket.noStake.toString())} SOL staked
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Voting UI — market open */
                <div className="p-6 space-y-4">
                  {/* Privacy callout */}
                  <div className="bg-purple-950/30 border border-purple-900/40 rounded-xl p-4 text-xs text-purple-300">
                    🔒 The current YES/NO distribution is{" "}
                    <strong>hidden</strong> inside Arcium's encrypted shared
                    state. You can only see the total voter count. The split
                    will be revealed when the market closes.
                  </div>

                  {/* Encrypted tally visual */}
                  <div className="bg-gray-800 rounded-xl p-4">
                    <div className="text-xs text-gray-400 mb-3 uppercase tracking-wide">
                      Encrypted Tally
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-xs text-gray-400">
                        ████████████ encrypted ████████████
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 text-center">
                      {selectedMarket.numVoters.toString()} people have voted ·
                      split hidden until close
                    </div>
                  </div>

                  {/* Vote buttons */}
                  {!publicKey ? (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      Connect wallet to vote
                    </div>
                  ) : hasVoted ? (
                    <div className="text-center py-4 bg-gray-800 rounded-xl text-sm text-gray-300">
                      ✅ You have already voted on this market
                    </div>
                  ) : !isMarketOpen(selectedMarket.closesAt) ? (
                    <div className="text-center py-4 bg-yellow-950/40 rounded-xl text-sm text-yellow-300 border border-yellow-900/40">
                      ⏳ Market closed — awaiting MPC reveal
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-400 text-center">
                        Your vote is encrypted before leaving your browser
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleVote(selectedMarket, true)}
                          disabled={loading}
                          className="py-4 bg-green-900 hover:bg-green-800 disabled:opacity-40 rounded-xl font-bold text-green-300 text-lg transition"
                        >
                          {loading ? "..." : "✓ YES"}
                        </button>
                        <button
                          onClick={() => handleVote(selectedMarket, false)}
                          disabled={loading}
                          className="py-4 bg-red-900 hover:bg-red-800 disabled:opacity-40 rounded-xl font-bold text-red-300 text-lg transition"
                        >
                          {loading ? "..." : "✗ NO"}
                        </button>
                      </div>
                      <div className="text-xs text-gray-600 text-center">
                        Stake: {lamportsToSol(selectedMarket.minStakeLamports.toString())} SOL
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                How votes stay private
              </div>
              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex gap-3">
                  <span className="text-purple-400">1.</span>
                  <span>
                    Your vote is encrypted in-browser using an x25519 key shared
                    only with the Arcium MXE cluster
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-purple-400">2.</span>
                  <span>
                    The encrypted vote is passed to the Arcium MPC network — no
                    single node can decrypt it alone
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-purple-400">3.</span>
                  <span>
                    Arx nodes run the tally circuit in secret-shared form —
                    accumulating totals without any node seeing the plaintext
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-purple-400">4.</span>
                  <span>
                    After close, a threshold reveal decrypts only the final
                    aggregate — individual votes are never disclosed
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MARKET LIST VIEW ─────────────────────────────────── */}
        {view === "list" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Active Markets</h2>

            {markets.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                No markets yet.{" "}
                <button
                  onClick={() => setView("create")}
                  className="text-purple-400 hover:underline"
                >
                  Create one
                </button>
                .
              </div>
            )}

            {markets.map((market) => (
              <div
                key={market.marketId.toString()}
                onClick={() => {
                  setSelectedMarket(market);
                  setView("market");
                  setStatus("");
                }}
                className="bg-gray-900 border border-gray-800 hover:border-purple-700/50 rounded-2xl p-5 cursor-pointer transition group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-snug group-hover:text-purple-200 transition">
                      {market.question}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>
                        👥 {market.numVoters.toString()} voters
                      </span>
                      <span>
                        ⏱{" "}
                        {market.resolved
                          ? "Resolved"
                          : formatTimeRemaining(market.closesAt)}
                      </span>
                      <span>
                        💰 min {lamportsToSol(market.minStakeLamports.toString())} SOL
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${
                        market.resolved
                          ? market.winner === 1
                            ? "bg-green-900 text-green-300"
                            : market.winner === 0
                            ? "bg-red-900 text-red-300"
                            : "bg-gray-700 text-gray-300"
                          : isMarketOpen(market.closesAt)
                          ? "bg-green-900/40 text-green-400"
                          : "bg-yellow-900/40 text-yellow-400"
                      }`}
                    >
                      {market.resolved
                        ? getWinnerLabel(market.winner) + " won"
                        : isMarketOpen(market.closesAt)
                        ? "Open"
                        : "Pending"}
                    </span>

                    {/* Encrypted split teaser */}
                    {!market.resolved && (
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <span>🔒</span>
                        <span>split hidden</span>
                      </span>
                    )}

                    {/* Resolved result mini-bar */}
                    {market.resolved && (
                      <div className="text-xs text-gray-400">
                        {market.yesVotes.toString()}Y /{" "}
                        {market.noVotes.toString()}N
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800 px-6 py-4 mt-16 text-xs text-gray-600 flex justify-between">
        <span>arcium-predict · built on Arcium MPC + Solana</span>
        <a
          href="https://docs.arcium.com"
          target="_blank"
          rel="noreferrer"
          className="hover:text-gray-400"
        >
          Arcium Docs →
        </a>
      </footer>
    </div>
  );
}
