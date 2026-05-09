import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  getMXEPublicKeyWithRetry,
  RescueCipher,
  deserializeLE,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getComputationAccAddress,
  getClusterAccAddress,
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
} from "@arcium-hq/client";
import { x25519 } from "@noble/curves/ed25519";
import { randomBytes } from "crypto";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ||
    "PREDICT11111111111111111111111111111111111111"
);

export const CLUSTER_OFFSET = parseInt(
  process.env.NEXT_PUBLIC_CLUSTER_OFFSET || "0"
);

// ── PDA derivations ────────────────────────────────────────────

export function getMarketPDA(marketId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), marketId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
}

export function getTallyPDA(marketId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("tally"), marketId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
}

export function getEscrowPDA(marketId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), marketId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
}

export function getVoterRecordPDA(
  marketId: BN,
  voterKey: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("voter"),
      marketId.toArrayLike(Buffer, "le", 8),
      voterKey.toBuffer(),
    ],
    PROGRAM_ID
  );
}

// ── Arcium account helpers ─────────────────────────────────────

export function getArciumAccounts(computationOffset: BN) {
  return {
    mxeAccount: getMXEAccAddress(PROGRAM_ID),
    clusterAccount: getClusterAccAddress(CLUSTER_OFFSET),
    mempoolAccount: getMempoolAccAddress(CLUSTER_OFFSET),
    executingPool: getExecutingPoolAccAddress(CLUSTER_OFFSET),
    computationAccount: getComputationAccAddress(CLUSTER_OFFSET, computationOffset),
  };
}

export function getSubmitVoteCompDef() {
  return getCompDefAccAddress(
    PROGRAM_ID,
    Buffer.from(getCompDefAccOffset("submit_vote")).readUInt32LE()
  );
}

export function getTallyVotesCompDef() {
  return getCompDefAccAddress(
    PROGRAM_ID,
    Buffer.from(getCompDefAccOffset("tally_votes")).readUInt32LE()
  );
}

export function getRevealResultCompDef() {
  return getCompDefAccAddress(
    PROGRAM_ID,
    Buffer.from(getCompDefAccOffset("reveal_result")).readUInt32LE()
  );
}

// ── Vote encryption ───────────────────────────────────────────

export interface EncryptedVote {
  voteCiphertext: number[];       // encrypted vote byte
  stakeCiphertext: number[];      // encrypted stake u64
  voterPublicKey: number[];       // x25519 pubkey
  nonce: BN;
}

/**
 * Encrypts a vote for submission to Arcium MPC.
 * The vote (YES=1, NO=0) and stake are encrypted with the MXE shared secret.
 * No node ever sees the plaintext during computation.
 */
export async function encryptVote(
  provider: any,
  vote: boolean,
  stakeLamports: bigint
): Promise<EncryptedVote> {
  // Generate ephemeral x25519 keypair
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);

  // Fetch MXE public key and compute shared secret
  const mxePubkey = await getMXEPublicKeyWithRetry(provider, PROGRAM_ID);
  const sharedSecret = x25519.getSharedSecret(privateKey, mxePubkey);

  // Encrypt with Rescue cipher (Arcium's native cipher)
  const cipher = new RescueCipher(sharedSecret);
  const voteVal = BigInt(vote ? 1 : 0);
  const nonce = randomBytes(16);
  const ciphertexts = cipher.encrypt([voteVal, stakeLamports], nonce);

  return {
    voteCiphertext: Array.from(ciphertexts[0]),
    stakeCiphertext: Array.from(ciphertexts[1]),
    voterPublicKey: Array.from(publicKey),
    nonce: new BN(deserializeLE(nonce).toString()),
  };
}

// ── Question encoding ─────────────────────────────────────────

export function encodeQuestion(text: string): number[] {
  const buf = Buffer.alloc(128, 0);
  Buffer.from(text, "utf-8").copy(buf, 0, 0, Math.min(text.length, 128));
  return Array.from(buf);
}

export function decodeQuestion(bytes: number[]): string {
  return Buffer.from(bytes)
    .toString("utf-8")
    .replace(/\0/g, "")
    .trim();
}

// ── Market state helpers ──────────────────────────────────────

export type WinnerLabel = "YES" | "NO" | "TIE" | "UNRESOLVED";

export function getWinnerLabel(winner: number): WinnerLabel {
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
