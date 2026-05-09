import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { randomBytes } from "crypto";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ||
    "PRE7KHu3aVuCn1cRE4xXkLxjuvixbtLfMx559WPFmuR"
);

export function getMarketPDA(marketId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("poll"), marketId.toArrayLike(Buffer, "le", 4)],
    PROGRAM_ID
  );
}

export function encodeQuestion(text: string): string {
  return text.slice(0, 50);
}

export function getWinnerLabel(winner: number): string {
  if (winner === 1) return "YES";
  if (winner === 0) return "NO";
  if (winner === 2) return "TIE";
  return "UNRESOLVED";
}

export function isMarketOpen(closesAt: number): boolean {
  return Date.now() / 1000 < closesAt;
}

export function formatTimeRemaining(closesAt: number): string {
  const secs = Math.max(0, closesAt - Date.now() / 1000);
  if (secs === 0) return "Closed";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function lamportsToSol(lamports: number | bigint): string {
  return (Number(lamports) / 1e9).toFixed(4);
}

export function randomComputationOffset(): BN {
  return new BN(randomBytes(8), "hex");
}
