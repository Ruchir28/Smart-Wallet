import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { serializeWalletInstruction, WalletInstructionType, TransferType, decodeDappData } from '../walletInteractions';
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

    let approvedDapps: ApprovedDapp[] = [];

    try {
        const dappIdsResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/getDappIds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ walletKey: smartWalletId.toString() })
        }).then((resp) => resp.json());

        console.log("dappIdsResponse", dappIdsResponse);

        if(!dappIdsResponse.success) {
            throw new Error("Failed to fetch approved dapps");
        }

        const approvals: {
            dappId: string,
            mintId: string
        }[] = dappIdsResponse.approvals;

        for (const approval of approvals) {
            const dappPublicKey = new PublicKey(approval.dappId);
            const tokenMint = new PublicKey(approval.mintId);
            const dapp = await fetchDapp(connection, smartWalletId, dappPublicKey, tokenMint, programId);
            if (dapp) {
                approvedDapps.push(dapp);
            } else {
                console.warn("Dapp not found");
            }
        }
    } catch (error) {
        console.error("Error fetching approved dapps:", error);
        throw error; // Re-throw the error to be handled by the caller
    }

    return approvedDapps;
}

export const fetchDapp = async (
    connection: Connection,
    userSmartWalletPublicKey: PublicKey,
    dappPublicKey: PublicKey,
    tokenMint: PublicKey,
    programId: PublicKey
): Promise<ApprovedDapp | null> => {

    const dappPda = PublicKey.findProgramAddressSync([Buffer.from("approval"), userSmartWalletPublicKey.toBuffer(), dappPublicKey.toBuffer(), tokenMint.toBuffer()],  programId);

    // decode dapp data
    const dappData = await connection.getAccountInfo(dappPda[0]);

    if (!dappData) {
        return null;
    }

    const dapp = decodeDappData(dappPublicKey.toString(), dappData.data);

    if (!dapp) {
        return null;
    }

    return dapp;
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

    // const fetchTokenMetadata = async (mintAddress: PublicKey): Promise<{ symbol: string; name: string; logo: string }> => {
    //     try {
    //         // Fetch metadata from the Solana Token List
    //         const response = await fetch('https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json');
    //         const tokenList = await response.json();
            
    //         const tokenInfo = tokenList.tokens.find((token: any) => token.address === mintAddress.toString());
            
    //         if (tokenInfo) {
    //             return {
    //                 symbol: tokenInfo.symbol,
    //                 name: tokenInfo.name,
    //                 logo: tokenInfo.logoURI || '/unknown-token.svg' // Use unknown-token.svg if logo is not available
    //             };
    //         }
    //         // If token not found, return default values
    //         return {
    //             symbol: 'UNKNOWN',
    //             name: 'Unknown Token',
    //             logo: '/unknown-token.svg' // Use unknown-token.svg for unknown tokens
    //         };
    //     } catch (error) {
    //         console.error('Error fetching token metadata:', error);
    //         return {
    //             symbol: 'ERROR',
    //             name: 'Error Fetching Token',
    //             logo: '/unknown-token.svg' // Use unknown-token.svg for errors
    //         };
    //     }
    // };
