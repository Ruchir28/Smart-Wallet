import { createAsyncThunk, createListenerMiddleware, createSlice } from '@reduxjs/toolkit';
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { fetchApprovedDapps } from '../utils/smartWalletInteractions';
import { setPublicKey } from './walletSlice';
import { ConnectionManager } from '../utils/ConnectionManager';

export interface Token {
    address: string;
    decimals: number;
    symbol: string;
    mint: string;
    amount: string;
    uiAmount: number | null;
    logo: string
}

export interface ApprovedDapp {
    dapp: string;
    tokenMint: string;
    maxAmount: string;
    expiry: string;
}


interface SmartWalletState {
    address: string | null;
    balance: string;
    tokens: Token[];
    initialized: boolean;
    isLoading: boolean;
    error: string | null;
    approvedDapps: ApprovedDapp[];
    // transactions: []; TODO:
    programId: string;
}

const initialState: SmartWalletState = {
    address: null,
    balance: "0",
    tokens: [],
    initialized: false,
    isLoading: false,
    error: null,
    approvedDapps: [],
    programId: '5UwRT1ngPvSWjUWYcCoRmwVTs5WFUgdDfAW29Ab5XMx2' // Your program ID
};


export const fetchSmartWallet = createAsyncThunk(
    'smartWallet/fetchSmartWallet',
    async (publicKey: string, _thunkApi) => {
        const walletPublicKeyString = publicKey;
        const connection = ConnectionManager.getInstance().getConnection();

        if (!walletPublicKeyString) {
            throw new Error("Wallet public key is not set");
        }

        const walletPublicKey = new PublicKey(walletPublicKeyString);
        const programId = new PublicKey('5UwRT1ngPvSWjUWYcCoRmwVTs5WFUgdDfAW29Ab5XMx2');

        // Derive the smart wallet address
        const [smartWalletAddress] = PublicKey.findProgramAddressSync(
            [Buffer.from("wallet"), walletPublicKey.toBuffer()],
            programId
        );
        // Fetch smart wallet account data
        const accountInfo = await connection.getAccountInfo(smartWalletAddress);
        if (!accountInfo) {
            throw new Error("Smart wallet not initialized");
        }

        // Fetch SOL balance
        const balance = await connection.getBalance(smartWalletAddress);

        // Fetch token accounts
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(smartWalletAddress, { programId: TOKEN_PROGRAM_ID });

        // Process token accounts
        const tokens = await Promise.all(tokenAccounts.value.map(async (tokenAccount) => {
            const tokenInfo = tokenAccount.account.data.parsed.info;
            // const mintAddress = new PublicKey(tokenInfo.mint);
            
            // TODO: token metadata 
            // const metadata = await fetchTokenMetadata(connection, mintAddress);

            return {
                address: tokenAccount.pubkey.toString(),
                decimals: tokenInfo.tokenAmount.decimals,
                mint: tokenInfo.mint,
                amount: tokenInfo.tokenAmount.amount,
                uiAmount: tokenInfo.tokenAmount.uiAmount,
                logo: '/unknown-token.svg',
                symbol: 'Unknown',
            };
        }));

        // TODO:
        const approvedDapps = await fetchApprovedDapps(connection, programId, smartWalletAddress);

        return {
            address: smartWalletAddress.toString(),
            balance: (balance / LAMPORTS_PER_SOL).toString(),
            tokens,
            initialized: true,
            approvedDapps,
            owner: walletPublicKeyString
        };
    }
);

const smartWalletSlice = createSlice({
    name: 'smartwallet',
    initialState,
    reducers: {
       
    },
    extraReducers(builder) {
        builder
            .addCase(fetchSmartWallet.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchSmartWallet.fulfilled, (state, action) => {
                state.isLoading = false;
                state.address = action.payload.address;
                state.balance = action.payload.balance;
                state.tokens = action.payload.tokens;
                state.initialized = action.payload.initialized;
                state.approvedDapps = action.payload.approvedDapps;
            })
            .addCase(fetchSmartWallet.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.error.message || null;
            })
    },
});

export const publicKeyListenerMiddleware = createListenerMiddleware()
publicKeyListenerMiddleware.startListening({
    actionCreator: setPublicKey,
    effect: async (action,  listenerApi) => {
        if (action.payload) {
            listenerApi.dispatch(fetchSmartWallet(action.payload));
        }
    }
})

export const {
    
} = smartWalletSlice.actions;



export default smartWalletSlice.reducer;