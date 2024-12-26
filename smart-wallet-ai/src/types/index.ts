import { Connection } from "@solana/web3.js";

export interface SmartWalletConfig {
  programId: string;
  connection: Connection;
  smartWalletAddress: string;
  ownerPublicKey: string;
  botKeypairPath: string;
}

export interface TokenTransfer {
  recipient: string;
  amount: number;
  tokenMint?: string; // Optional: if not provided, assumes SOL
  wallet: string; // The smart wallet address that will send the tokens
}

export interface PriceCheck {
  token: string;
  vs_currency?: string; // Optional: defaults to USD
}

export interface BalanceCheck {
  wallet: string;
  tokenMint?: string; // Optional: if not provided, checks SOL balance
}

export interface DAppApproval {
  dappAddress: string;
  spendLimit: number;
  expiryTime?: number; // Optional: Unix timestamp for approval expiry
}

// Jupiter API Types
export interface JupiterPriceData {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
}

export interface JupiterPriceResponse {
  data: {
    [key: string]: JupiterPriceData;
  };
} 