import { Connection, PublicKey, Transaction, Keypair, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { SmartWalletConfig } from "../types";
import { createTokenTransferTransaction, createTransferTransaction, executeTransactionInstruction, serializeWalletInstruction, TransferType } from "../utils/walletInteractions";
import * as fs from 'fs';

interface PriceResponse {
  data: {
    [key: string]: {
      price: string;
    };
  };
}

export class SmartWallet {
  private connection: Connection;
  private programId: PublicKey;
  private ownerPublicKey: PublicKey;
  private smartWalletAddress: PublicKey;
  private botKeypair: Keypair;

  constructor(config: SmartWalletConfig) {
    this.connection = config.connection;
    this.programId = new PublicKey(config.programId);
    this.ownerPublicKey = new PublicKey(config.ownerPublicKey);
    this.smartWalletAddress = new PublicKey(config.smartWalletAddress);
    
    const botKeypairData = JSON.parse(fs.readFileSync(config.botKeypairPath, 'utf-8'));
    this.botKeypair = Keypair.fromSecretKey(new Uint8Array(botKeypairData));
  }

  async checkBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.smartWalletAddress);
    return balance / 1e9;
  }

  async checkTokenBalance(tokenMint: PublicKey): Promise<number> {
    const ata = await getAssociatedTokenAddress(tokenMint, this.smartWalletAddress);
    const balance = await this.connection.getTokenAccountBalance(ata);
    return Number(balance.value.uiAmount);
  }

  async transferSol(recipient: string, amount: number): Promise<string> {
    const recipientPublicKey = new PublicKey(recipient);
    const amountLamports = BigInt(Math.floor(amount * 1e9));

    const instruction = executeTransactionInstruction(amountLamports, TransferType.Sol);
    const serializedInstruction = serializeWalletInstruction(instruction);

    const [approvalAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("approval"), this.smartWalletAddress.toBuffer(), this.botKeypair.publicKey.toBuffer(), PublicKey.default.toBuffer()],
      this.programId
    );

    const transaction = new Transaction().add({
      keys: [
        { pubkey: this.botKeypair.publicKey, isSigner: true, isWritable: false },
        { pubkey: this.ownerPublicKey, isSigner: false, isWritable: false },
        { pubkey: this.smartWalletAddress, isSigner: false, isWritable: true },
        { pubkey: approvalAddress, isSigner: false, isWritable: true },
        { pubkey: recipientPublicKey, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from(serializedInstruction),
    });

    transaction.feePayer = this.botKeypair.publicKey;
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    transaction.sign(this.botKeypair);
    
    return await this.connection.sendRawTransaction(transaction.serialize());
  }

  async transferToken(recipient: string, amount: number, tokenMint: string): Promise<string> {
    const recipientPublicKey = new PublicKey(recipient);
    const tokenMintPublicKey = new PublicKey(tokenMint);

    const walletATA = await getAssociatedTokenAddress(
      tokenMintPublicKey,
      this.smartWalletAddress
    );
    
    const recipientATA = await getAssociatedTokenAddress(
      tokenMintPublicKey,
      recipientPublicKey
    );

    const transaction = await createTokenTransferTransaction(
      this.connection,
      this.programId,
      this.ownerPublicKey,
      walletATA,
      recipientATA,
      tokenMintPublicKey,
      amount,
      this.botKeypair.publicKey
    );

    transaction.sign(this.botKeypair);
    return await this.connection.sendRawTransaction(transaction.serialize());
  }

  async checkTokenPrice(tokenMint: string): Promise<number> {
    try {
      const response = await fetch(`https://api.jup.ag/price/v2?ids=${tokenMint}`);
      if (!response.ok) {
        throw new Error("Failed to fetch price from Jupiter");
      }
      
      const data = await response.json() as PriceResponse;
      
      if (!data.data || !data.data[tokenMint] || !data.data[tokenMint].price) {
        throw new Error("Token price not found");
      }
      
      const price = parseFloat(data.data[tokenMint].price);
      if (isNaN(price)) {
        throw new Error("Invalid price data received");
      }
      
      return price;
    } catch (error) {
      throw new Error(`Failed to fetch token price: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 