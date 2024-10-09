import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createTransferInstruction } from '@solana/spl-token';

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

    const instruction = await SystemProgram.transfer({
        fromPubkey: walletAddress,
        toPubkey: walletPublicKey,
        lamports: amount * LAMPORTS_PER_SOL,
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

    const fromTokenAccount = await connection.getTokenAccountsByOwner(walletAddress, { mint: tokenMint });

    if (fromTokenAccount.value.length === 0) {
        throw new Error("Token account not found in smart wallet");
    }

    const transaction = new Transaction().add(
        createTransferInstruction(
            fromTokenAccount.value[0].pubkey,
            userATA,
            walletAddress,
            amount * Math.pow(10, 9) // Assuming 9 decimals, adjust if needed
        )
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    return transaction.serialize({ requireAllSignatures: false }).toString('base64');
}