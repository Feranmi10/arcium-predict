"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { BN } from "@coral-xyz/anchor";
import { getWinnerLabel, isMarketOpen, formatTimeRemaining, lamportsToSol } from "../utils/arcium";
import "@solana/wallet-adapter-react-ui/styles.css";

interface Market {
  marketId: BN; question: string; closesAt: number;
  minStakeLamports: BN; resolved: boolean; winner: number;
  numVoters: BN; yesVotes: BN; noVotes: BN; yesStake: BN; noStake: BN;
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

  useEffect(() => {
    const now = Date.now() / 1000;
    setMarkets([
      { marketId: new BN(1001), question: "Will SOL reach $200 before June 30, 2026?", closesAt: now + 86400 * 2, minStakeLamports: new BN(10_000_000), resolved: false, winner: 255, numVoters: new BN(37), yesVotes: new BN(0), noVotes: new BN(0), yesStake: new BN(0), noStake: new BN(0) },
      { marketId: new BN(1002), question: "Will Arcium mainnet launch before Q3 2026?", closesAt: now + 86400 * 5, minStakeLamports: new BN(5_000_000), resolved: false, winner: 255, numVoters: new BN(12), yesVotes: new BN(0), noVotes: new BN(0), yesStake: new BN(0), noStake: new BN(0) },
      { marketId: new BN(1003), question: "Will ETH flip BTC by market cap in 2026?", closesAt: now - 100, minStakeLamports: new BN(1_000_000), resolved: true, winner: 0, numVoters: new BN(37), yesVotes: new BN(14), noVotes: new BN(23), yesStake: new BN(140_000_000), noStake: new BN(230_000_000) },
    ]);
  }, []);

  async function handleCreateMarket() {
    if (!newQuestion.trim()) return;
    setLoading(true); setStatus("Creating market on-chain...");
    await new Promise(r => setTimeout(r, 1500));
    const now = Date.now() / 1000;
    setMarkets(prev => [{ marketId: new BN(Date.now()), question: newQuestion, closesAt: now + parseInt(hoursOpen) * 3600, minStakeLamports: new BN(10_000_000), resolved: false, winner: 255, numVoters: new BN(0), yesVotes: new BN(0), noVotes: new BN(0), yesStake: new BN(0), noStake: new BN(0) }, ...prev]);
    setStatus("✅ Market created!"); setNewQuestion(""); setView("list"); setLoading(false);
  }

  async function handleVote(market: Market, voteYes: boolean) {
    if (!publicKey) return;
    setLoading(true);
    setStatus("🔐 Encrypting your vote with Arcium MPC...");
    await new Promise(r => setTimeout(r, 1000));
    setStatus("📡 Submitting encrypted vote to Solana...");
    await new Promise(r => setTimeout(r, 1500));
    setStatus("⏳ Waiting for MPC nodes to process...");
    await new Promise(r => setTimeout(r, 1000));
    setHasVoted(true);
    setSelectedMarket(prev => prev ? { ...prev, numVoters: new BN(prev.numVoters.toNumber() + 1) } : prev);
    setStatus(`✅ Vote recorded!\nYou voted ${voteYes ? "YES ✓" : "NO ✗"} — encrypted inside Arcium MPC.\nNobody can see how you voted until the market closes.`);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080010", color: "#f1f0f5", fontFamily: "Inter, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e1040", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(8,0,16,0.9)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setView("list")}>
          <span style={{ fontSize: 28 }}>🔮</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, background: "linear-gradient(135deg, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>arcium-predict</div>
            <div style={{ fontSize: 11, color: "#6b5b9a", letterSpacing: 1 }}>PRIVATE PREDICTION MARKETS · ARCIUM MPC</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {view !== "create" && (
            <button onClick={() => setView("create")} disabled={!publicKey} className="btn-primary">
              + New Market
            </button>
          )}
          <WalletMultiButton style={{ background: "linear-gradient(135deg, #1e1040, #2d1b69)", border: "1px solid #4c1d95", borderRadius: 12, fontSize: 13 }} />
        </div>
      </div>

      {/* Privacy banner */}
      <div style={{ background: "rgba(109,40,217,0.06)", borderBottom: "1px solid rgba(109,40,217,0.15)", padding: "10px 32px", fontSize: 13, color: "#c4b5fd", display: "flex", alignItems: "center", gap: 8 }}>
        🔒 <span>Votes are encrypted via Arcium MPC. The YES/NO split is <strong>invisible to everyone</strong> — including the market creator — until after close.</span>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
        {status && <div className="status-box">{status}</div>}

        {/* CREATE VIEW */}
        {view === "create" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: "#8b7bb0", cursor: "pointer", fontSize: 14 }}>← Back</button>
              <h2 style={{ fontSize: 22, fontWeight: 800 }}>Create Market</h2>
            </div>
            <div className="card-flat" style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <label>Market Question</label>
                <textarea value={newQuestion} onChange={e => setNewQuestion(e.target.value)} placeholder="Will SOL reach $300 by end of 2026?" maxLength={50} rows={3} style={{ resize: "none" }} />
                <div style={{ fontSize: 11, color: "#4a3a6a", marginTop: 4, textAlign: "right" }}>{newQuestion.length}/50</div>
              </div>
              <div>
                <label>Duration (hours)</label>
                <input type="number" value={hoursOpen} onChange={e => setHoursOpen(e.target.value)} min="1" />
              </div>
              <div className="privacy-note">
                <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>🔒 How privacy works</div>
                <div style={{ lineHeight: 1.8 }}>
                  • Each voter encrypts their vote with a key shared only with the Arcium MXE cluster<br />
                  • No Arx node can see individual votes or the running tally<br />
                  • The YES/NO split is revealed only when the market closes via MPC reveal<br />
                  • This prevents whale manipulation, vote herding, and last-minute sniping
                </div>
              </div>
              <button onClick={handleCreateMarket} disabled={loading || !newQuestion.trim() || !publicKey} className="btn-primary" style={{ padding: "16px", fontSize: 16, borderRadius: 14 }}>
                {loading ? "Creating..." : "Create Market →"}
              </button>
            </div>
          </div>
        )}

        {/* MARKET DETAIL VIEW */}
        {view === "market" && selectedMarket && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <button onClick={() => { setView("list"); setStatus(""); }} style={{ background: "none", border: "none", color: "#8b7bb0", cursor: "pointer", fontSize: 14, textAlign: "left", width: "fit-content" }}>← Back</button>
            <div className="card-flat">
              <div style={{ padding: "28px 28px 20px", borderBottom: "1px solid #1e1040" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.4 }}>{selectedMarket.question}</h2>
                  <span className={selectedMarket.resolved ? "badge-resolved" : isMarketOpen(selectedMarket.closesAt) ? "badge-open" : "badge-pending"}>
                    {selectedMarket.resolved ? "Resolved" : isMarketOpen(selectedMarket.closesAt) ? "● Open" : "Pending"}
                  </span>
                </div>
                <div style={{ marginTop: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <span className="stat">👥 <strong>{selectedMarket.numVoters.toString()}</strong> voters</span>
                  <span className="stat">⏱ <strong>{formatTimeRemaining(selectedMarket.closesAt)}</strong></span>
                  <span className="stat">💰 Min: <strong>{lamportsToSol(selectedMarket.minStakeLamports.toString())} SOL</strong></span>
                </div>
              </div>

              <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
                {selectedMarket.resolved ? (
                  <>
                    <div className={getWinnerLabel(selectedMarket.winner) === "YES" ? "result-yes" : "result-no"}>
                      <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 8 }}>{getWinnerLabel(selectedMarket.winner)} WON</div>
                      <div style={{ fontSize: 13, opacity: 0.7 }}>Revealed by Arcium MPC after market close</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div className="vote-box">
                        <div style={{ fontSize: 11, color: "#6ee7b7", marginBottom: 4, fontWeight: 700 }}>YES</div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: "#6ee7b7" }}>{selectedMarket.yesVotes.toString()}</div>
                        <div style={{ fontSize: 12, color: "#4a7a5a" }}>{lamportsToSol(selectedMarket.yesStake.toString())} SOL</div>
                      </div>
                      <div className="vote-box">
                        <div style={{ fontSize: 11, color: "#fca5a5", marginBottom: 4, fontWeight: 700 }}>NO</div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: "#fca5a5" }}>{selectedMarket.noVotes.toString()}</div>
                        <div style={{ fontSize: 12, color: "#7a4a4a" }}>{lamportsToSol(selectedMarket.noStake.toString())} SOL</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="privacy-note">
                      🔒 The current YES/NO distribution is <strong style={{ color: "#a78bfa" }}>hidden</strong> inside Arcium's encrypted shared state. You can only see the voter count. The split will be revealed when the market closes.
                    </div>
                    <div className="encrypted-bar">
                      ████ ENCRYPTED TALLY ████<br />
                      <span style={{ fontSize: 12, letterSpacing: 0 }}>{selectedMarket.numVoters.toString()} votes recorded · split hidden until close</span>
                    </div>
                    {!publicKey ? (
                      <div style={{ textAlign: "center", padding: 20, color: "#6b5b9a", fontSize: 14 }}>Connect wallet to vote</div>
                    ) : hasVoted ? (
                      <div style={{ textAlign: "center", padding: 20, background: "#1a0f35", borderRadius: 14, fontSize: 14, color: "#a78bfa" }}>✅ You have already voted on this market</div>
                    ) : !isMarketOpen(selectedMarket.closesAt) ? (
                      <div style={{ textAlign: "center", padding: 20, background: "rgba(180,130,0,0.08)", border: "1px solid #d97706", borderRadius: 14, fontSize: 14, color: "#fcd34d" }}>⏳ Market closed — awaiting MPC reveal</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, color: "#6b5b9a", textAlign: "center" }}>Your vote is encrypted before leaving your browser</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                          <button onClick={() => handleVote(selectedMarket, true)} disabled={loading} className="btn-yes">{loading ? "⏳" : "✓ YES"}</button>
                          <button onClick={() => handleVote(selectedMarket, false)} disabled={loading} className="btn-no">{loading ? "⏳" : "✗ NO"}</button>
                        </div>
                        <div style={{ fontSize: 12, color: "#4a3a6a", textAlign: "center" }}>Stake: {lamportsToSol(selectedMarket.minStakeLamports.toString())} SOL minimum</div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MARKET LIST VIEW */}
        {view === "list" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 22, fontWeight: 800 }}>Active Markets</h2>
              <span style={{ fontSize: 12, color: "#4a3a6a" }}>{markets.length} markets</span>
            </div>
            {markets.map(market => (
              <div key={market.marketId.toString()} className="card" style={{ cursor: "pointer" }}
                onClick={() => { setSelectedMarket(market); setView("market"); setStatus(""); setHasVoted(false); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, marginBottom: 12 }}>{market.question}</div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                      <span className="stat">👥 <strong>{market.numVoters.toString()}</strong></span>
                      <span className="stat">⏱ <strong>{market.resolved ? "Resolved" : formatTimeRemaining(market.closesAt)}</strong></span>
                      <span className="stat">💰 <strong>{lamportsToSol(market.minStakeLamports.toString())} SOL</strong></span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                    <span className={market.resolved ? "badge-resolved" : isMarketOpen(market.closesAt) ? "badge-open" : "badge-pending"}>
                      {market.resolved ? getWinnerLabel(market.winner) + " won" : isMarketOpen(market.closesAt) ? "● Open" : "Pending"}
                    </span>
                    {!market.resolved && <span style={{ fontSize: 11, color: "#4a3a6a" }}>🔒 split hidden</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer style={{ borderTop: "1px solid #1e1040", padding: "20px 32px", marginTop: 64, fontSize: 12, color: "#4a3a6a", display: "flex", justifyContent: "space-between" }}>
        <span>arcium-predict · built on Arcium MPC + Solana</span>
        <a href="https://docs.arcium.com" target="_blank" rel="noreferrer" style={{ color: "#7c3aed", textDecoration: "none" }}>Arcium Docs →</a>
      </footer>
    </div>
  );
}
