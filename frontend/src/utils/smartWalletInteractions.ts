import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, createTransferInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { serializeWalletInstruction, WalletInstructionType, TransferType } from '../walletInteractions';

export async function depositSol(
    connection: Connection,
    programId: PublicKey,
    walletPublicKey: PublicKey,
    amount: number
): Promise<string> {
    const [walletAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), walletPublicKey.toBuffer()],
        programId
    );

    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: walletPublicKey,
            toPubkey: walletAddress,
            lamports: amount * LAMPORTS_PER_SOL,
        })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    return transaction.serialize({ requireAllSignatures: false }).toString('base64');
}

export async function withdrawSol(
    connection: Connection,
    programId: PublicKey,
    walletPublicKey: PublicKey,
    amount: number
): Promise<string> {
    const [walletAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), walletPublicKey.toBuffer()],
        programId
    );

    const instructionData = serializeWalletInstruction({
        type: WalletInstructionType.Withdraw,
        data: {
            amount: BigInt(amount * LAMPORTS_PER_SOL),
            transferType: TransferType.Sol
        }
    });

    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: walletPublicKey, isSigner: true, isWritable: true },
            { pubkey: walletAddress, isSigner: false, isWritable: true },
            { pubkey: walletPublicKey, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId,
        data: Buffer.from(instructionData)
    });
    
    const transaction = new Transaction().add(instruction);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    return transaction.serialize({ requireAllSignatures: false }).toString('base64');
}

export async function depositToken(
    connection: Connection,
    programId: PublicKey,
    walletPublicKey: PublicKey,
    tokenMint: PublicKey,
    userATA: PublicKey,
    amount: number
): Promise<string> {
    const [walletAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), walletPublicKey.toBuffer()],
        programId
    );

    const toTokenAccount = await connection.getTokenAccountsByOwner(walletAddress, { mint: tokenMint });

    if (toTokenAccount.value.length === 0) {
        throw new Error("Token account not found in smart wallet");
    }

    const transaction = new Transaction().add(
        createTransferInstruction(
            userATA,
            toTokenAccount.value[0].pubkey,
            walletPublicKey,
            amount * Math.pow(10, 9) // Assuming 9 decimals, adjust if needed
        )
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    return transaction.serialize({ requireAllSignatures: false }).toString('base64');
}

export async function withdrawToken(
    connection: Connection,
    programId: PublicKey,
    walletPublicKey: PublicKey,
    tokenMint: PublicKey,
    userATA: PublicKey,
    amount: number
): Promise<string> {
    const [walletAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), walletPublicKey.toBuffer()],
        programId
    );

    const walletATA = await getAssociatedTokenAddress(tokenMint, walletAddress, true);

    const instructionData = serializeWalletInstruction({
        type: WalletInstructionType.Withdraw,
        data: {
            amount: BigInt(amount),
            transferType: TransferType.Token
        }
    });

    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: walletPublicKey, isSigner: true, isWritable: false },
            { pubkey: walletAddress, isSigner: false, isWritable: true },
            { pubkey: userATA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: tokenMint, isSigner: false, isWritable: false },
            { pubkey: walletATA, isSigner: false, isWritable: true },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId,
        data: Buffer.from(instructionData)
    });

    const transaction = new Transaction().add(instruction);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    return transaction.serialize({ requireAllSignatures: false }).toString('base64');
}

export async function sendSol(
    connection: Connection,
    programId: PublicKey,
    walletPublicKey: PublicKey,
    recipientPublicKey: PublicKey,
    amount: number
): Promise<string> {
    const [walletAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), walletPublicKey.toBuffer()],
        programId
    );

    const instructionData = serializeWalletInstruction({
        type: WalletInstructionType.Withdraw,
        data: {
            amount: BigInt(amount * LAMPORTS_PER_SOL),
            transferType: TransferType.Sol
        }
    });

    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: walletPublicKey, isSigner: true, isWritable: false },
            { pubkey: walletAddress, isSigner: false, isWritable: true },
            { pubkey: recipientPublicKey, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId,
        data: Buffer.from(instructionData)
    });
    
    const transaction = new Transaction().add(instruction);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    return transaction.serialize({ requireAllSignatures: false }).toString('base64');
}

export async function sendToken(
    connection: Connection,
    programId: PublicKey,
    walletPublicKey: PublicKey,
    tokenMint: PublicKey,
    recipientPublicKey: PublicKey,
    amount: number
): Promise<string> {
    const [walletAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), walletPublicKey.toBuffer()],
        programId
    );

    const walletATA = await getAssociatedTokenAddress(tokenMint, walletAddress, true);
    const recipientATA = await getAssociatedTokenAddress(tokenMint, recipientPublicKey);

    const instructionData = serializeWalletInstruction({
        type: WalletInstructionType.Withdraw,
        data: {
            amount: BigInt(amount),
            transferType: TransferType.Token
        }
    });

    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: walletPublicKey, isSigner: true, isWritable: false },
            { pubkey: walletAddress, isSigner: false, isWritable: true },
            { pubkey: recipientATA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: tokenMint, isSigner: false, isWritable: false },
            { pubkey: walletATA, isSigner: false, isWritable: true },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId,
        data: Buffer.from(instructionData)
    });

    const transaction = new Transaction().add(instruction);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    return transaction.serialize({ requireAllSignatures: false }).toString('base64');
}