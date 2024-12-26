import { serialize } from "borsh";
import { Buffer } from "buffer";
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

// Define the transfer types
export enum TransferType {
    Sol = 0,
    Token = 1,
}

// Define instruction types
export enum WalletInstructionType {
    CreateWallet = 0,
    ApproveDapp = 1,
    ExecuteTransaction = 2,
}

// Data classes for each instruction
class ExecuteTransactionInstruction {
    amount: bigint;
    transferType: TransferType;

    constructor(properties: { amount: bigint; transferType: TransferType }) {
        this.amount = properties.amount;
        this.transferType = properties.transferType;
    }
}

// Borsh schema for serialization
const InstructionSchema = {
    ExecuteTransactionInstruction: { struct: { amount: 'u64', transferType: 'u8' } },
};

export function executeTransactionInstruction(amount: bigint, transferType: TransferType) {
    return {
        type: WalletInstructionType.ExecuteTransaction,
        data: new ExecuteTransactionInstruction({ amount, transferType })
    };
}

export function serializeWalletInstruction(instruction: { type: WalletInstructionType; data: any }): Uint8Array {
    let buffer = Buffer.alloc(1);
    buffer.writeUInt8(instruction.type, 0);

    const serializedData = serialize(
        InstructionSchema.ExecuteTransactionInstruction,
        instruction.data
    );

    return Buffer.concat([buffer, serializedData]);
}

export async function createTransferTransaction(
    connection: Connection,
    programId: PublicKey,
    ownerPublicKey: PublicKey,
    recipientPublicKey: PublicKey,
    amount: number,
    botKeypair: PublicKey
): Promise<Transaction> {
    const [walletPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), ownerPublicKey.toBuffer()],
        programId
    );

    const [approvalAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("approval"), walletPDA.toBuffer(), botKeypair.toBuffer(), PublicKey.default.toBuffer()],
        programId
    );

    const amountLamports = BigInt(Math.floor(amount * 1e9));
    const instruction = executeTransactionInstruction(amountLamports, TransferType.Sol);
    const serializedInstruction = serializeWalletInstruction(instruction);

    const transaction = new Transaction().add(
        new TransactionInstruction({
            keys: [
                { pubkey: botKeypair, isSigner: true, isWritable: false },
                { pubkey: ownerPublicKey, isSigner: false, isWritable: false },
                { pubkey: walletPDA, isSigner: false, isWritable: true },
                { pubkey: approvalAddress, isSigner: false, isWritable: true },
                { pubkey: recipientPublicKey, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId,
            data: Buffer.from(serializedInstruction),
        })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = botKeypair;

    return transaction;
}

export async function createTokenTransferTransaction(
    connection: Connection,
    programId: PublicKey,
    ownerPublicKey: PublicKey,
    walletTokenAccount: PublicKey,
    recipientTokenAccount: PublicKey,
    tokenMint: PublicKey,
    amount: number,
    botKeypair: PublicKey
): Promise<Transaction> {
    const [walletPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), ownerPublicKey.toBuffer()],
        programId
    );

    const [approvalAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("approval"), walletPDA.toBuffer(), botKeypair.toBuffer(), tokenMint.toBuffer()],
        programId
    );

    // Convert amount to token units (considering decimals)
    const tokenInfo = await connection.getParsedAccountInfo(tokenMint);
    const decimals = (tokenInfo.value?.data as any)?.parsed?.info?.decimals ?? 9;
    const tokenAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    const instruction = executeTransactionInstruction(tokenAmount, TransferType.Token);
    const serializedInstruction = serializeWalletInstruction(instruction);

    // Determine which token program to use based on the mint
    const tokenProgramId = (await connection.getAccountInfo(tokenMint))?.owner || TOKEN_PROGRAM_ID;

    const transaction = new Transaction().add(
        new TransactionInstruction({
            keys: [
                { pubkey: botKeypair, isSigner: true, isWritable: false },
                { pubkey: ownerPublicKey, isSigner: false, isWritable: false },
                { pubkey: walletPDA, isSigner: false, isWritable: true },
                { pubkey: approvalAddress, isSigner: false, isWritable: true },
                { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: tokenMint, isSigner: false, isWritable: false },
                { pubkey: walletTokenAccount, isSigner: false, isWritable: true },
                { pubkey: tokenProgramId, isSigner: false, isWritable: false },
            ],
            programId,
            data: Buffer.from(serializedInstruction),
        })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = botKeypair;

    return transaction;
} 