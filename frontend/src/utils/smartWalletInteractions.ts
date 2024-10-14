import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { serializeWalletInstruction, WalletInstructionType, TransferType } from '../walletInteractions';
import { ApprovedDapp } from '../store/smartWalletSlice';

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
    amount: number,
    decimals: number
): Promise<string> {
    const [walletAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), walletPublicKey.toBuffer()],
        programId
    );

    const walletATA = await getAssociatedTokenAddress(tokenMint, walletAddress, true);

    const transaction = new Transaction();

    // Check if the wallet's associated token account exists
    const walletATAInfo = await connection.getAccountInfo(walletATA);

    if (!walletATAInfo) {
        // If the account doesn't exist, add an instruction to create it
        transaction.add(
            createAssociatedTokenAccountInstruction(
                walletPublicKey,
                walletATA,
                walletAddress,
                tokenMint
            )
        );
    }

    // Add the transfer instruction
    transaction.add(
        createTransferInstruction(
            userATA,
            walletATA,
            walletPublicKey,
            amount * Math.pow(10, decimals) // Use the correct number of decimals
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
    amount: number,
    decimals: number
): Promise<string> {
    const [walletAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), walletPublicKey.toBuffer()],
        programId
    );

    const walletATA = await getAssociatedTokenAddress(tokenMint, walletAddress, true);

    const instructionData = serializeWalletInstruction({
        type: WalletInstructionType.Withdraw,
        data: {
            amount: BigInt(amount * Math.pow(10, decimals)),
            transferType: TransferType.Token
        }
    });

    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: walletPublicKey, isSigner: true, isWritable: false },
            { pubkey: walletAddress, isSigner: false, isWritable: true },
            { pubkey: walletPublicKey, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: userATA, isSigner: false, isWritable: true },
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
    amount: number,
    decimals: number
): Promise<string> {
    const [walletAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), walletPublicKey.toBuffer()],
        programId
    );

    const walletATA = await getAssociatedTokenAddress(tokenMint, walletAddress, true);
    const recipientATA = await getAssociatedTokenAddress(tokenMint, recipientPublicKey);

    const transaction = new Transaction();

    // Check if the recipient's associated token account exists
    const recipientATAInfo = await connection.getAccountInfo(recipientATA);

    if (!recipientATAInfo) {
        // If the account doesn't exist, add an instruction to create it
        transaction.add(
            createAssociatedTokenAccountInstruction(
                walletPublicKey,
                recipientATA,
                recipientPublicKey,
                tokenMint
            )
        );
    }

    const instructionData = serializeWalletInstruction({
        type: WalletInstructionType.Withdraw,
        data: {
            amount: BigInt(amount * Math.pow(10, decimals)), // Use the correct number of decimals
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

    transaction.add(instruction);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    return transaction.serialize({ requireAllSignatures: false }).toString('base64');
}

export async function fetchApprovedDapps(
    connection: Connection,
    programId: PublicKey,
    smartWalletId: PublicKey,
): Promise<ApprovedDapp[]> {
    // TODO: 
    return [];
}

export const approveDapp = async (
    connection: Connection,
    programId: PublicKey,
    walletPublicKey: PublicKey,
    dappPublicKey: PublicKey,
    mintPublicKey: PublicKey,
    amount: number,
    expiryTimestamp: number,
    decimals: number
): Promise<Transaction> => {
    const [walletAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), walletPublicKey.toBuffer()],
        programId
    );

    const [approvalAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("approval"), walletAddress.toBuffer(), dappPublicKey.toBuffer(), mintPublicKey.toBuffer()],
        programId
    );

    const amountBigInt = BigInt(Math.floor(amount * (10 ** decimals)));

    const instructionData = serializeWalletInstruction({
        type: WalletInstructionType.ApproveDapp,
        data: {
            maxAmount: amountBigInt,
            expiry: expiryTimestamp,
        }
    });

    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: walletPublicKey, isSigner: true, isWritable: true },
            { pubkey: walletAddress, isSigner: false, isWritable: false },
            { pubkey: dappPublicKey, isSigner: false, isWritable: false },
            { pubkey: mintPublicKey, isSigner: false, isWritable: false },
            { pubkey: approvalAddress, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId,
        data: Buffer.from(instructionData)
    });

    const transaction = new Transaction().add(instruction);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPublicKey;

    return transaction;
};
