import { createAsyncThunk, createListenerMiddleware, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { fetchApprovedDapps } from '../utils/smartWalletInteractions';
import { setPublicKey } from './walletSlice';
import { ConnectionManager } from '../utils/ConnectionManager';
import {  RootState } from './store';
import { setConnection } from './connectionSlice';
import { Connection } from '@solana/web3.js';
import { addNotificationWithTimeout } from './notificationSlice';

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
    loadingBalance: boolean;
    loadingApprovedDapps: boolean;
}

const initialState: SmartWalletState = {
    address: null,
    balance: "0",
    tokens: [],
    initialized: false,
    isLoading: false,
    error: null,
    approvedDapps: [],
    loadingBalance: false,
    loadingApprovedDapps: false,
};


// New helper functions
const deriveSmartWalletAddress = (walletPublicKey: PublicKey, programId: PublicKey): PublicKey => {
    const [smartWalletAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), walletPublicKey.toBuffer()],
        programId
    );
    return smartWalletAddress;
};

const fetchSmartWalletAccountInfo = async (connection: Connection, smartWalletAddress: PublicKey) => {
    const accountInfo = await connection.getAccountInfo(smartWalletAddress);
    if (!accountInfo) {
        throw new Error("Smart wallet not initialized");
    }
    return accountInfo;
};

const processTokenAccount = (tokenAccount: any): Token => {
    const tokenInfo = tokenAccount.account.data.parsed.info;
    return {
        address: tokenAccount.pubkey.toString(),
        decimals: tokenInfo.tokenAmount.decimals,
        mint: tokenInfo.mint,
        amount: tokenInfo.tokenAmount.amount,
        uiAmount: tokenInfo.tokenAmount.uiAmount,
        logo: '/unknown-token.svg',
        symbol: 'Unknown',
    };
};

export const fetchSmartWallet = createAsyncThunk(
    'smartWallet/fetchSmartWallet',
    async (publicKey: string, thunkApi) => {
        const state = thunkApi.getState() as RootState;
        const programId = new PublicKey(state.connection.programId);
        const connection = ConnectionManager.getInstance().getConnection();

        try {
            thunkApi.dispatch(setLoading(true));

            if (!publicKey) {
                throw new Error("Wallet public key is not set");
            }

            const walletPublicKey = new PublicKey(publicKey);
            const smartWalletAddress = deriveSmartWalletAddress(walletPublicKey, programId);

            await fetchSmartWalletAccountInfo(connection, smartWalletAddress);

            const results = await Promise.allSettled([
                connection.getBalance(smartWalletAddress),
                connection.getParsedTokenAccountsByOwner(smartWalletAddress, { programId: TOKEN_PROGRAM_ID }),
                fetchApprovedDapps(connection, programId, smartWalletAddress)
            ]);

            let balance = 0;
            let tokens: Token[] = [];
            let approvedDapps: ApprovedDapp[] = [];

            if (results[0].status === 'fulfilled') {
                balance = results[0].value;
            } else {
                console.error('Error fetching balance:', results[0].reason);
            }

            if (results[1].status === 'fulfilled') {
                tokens = results[1].value.value.map(processTokenAccount);
            } else {
                console.error('Error fetching tokens:', results[1].reason);
            }

            if (results[2].status === 'fulfilled') {
                approvedDapps = results[2].value;
            } else {
                console.error('Error fetching approved dapps:', results[2].reason);
            }

            return {
                address: smartWalletAddress.toString(),
                balance: (balance / LAMPORTS_PER_SOL).toString(),
                tokens,
                initialized: true,
                approvedDapps,
                owner: publicKey
            };
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch smart wallet: ${error.message}`);
            }
            throw new Error('An unknown error occurred while fetching smart wallet');
        } finally {
            thunkApi.dispatch(setLoading(false));
        }
    }
);

export const fetchLatestBalance = createAsyncThunk(
    'smartWallet/fetchLatestBalance',
    async (_ , thunkApi) => {
        const state = thunkApi.getState() as RootState;
        const connection = ConnectionManager.getInstance().getConnection();
        const smartWalletAddress = state.smartWallet.address;
        if (!smartWalletAddress) {
            thunkApi.dispatch(addNotificationWithTimeout({
                notification: {
                    message: "Smart wallet address is not set",
                    type: "error"
                },
                timeout: 5000
            }));
            throw new Error("Smart wallet address is not set");
        }
        const balance = await connection.getBalance(new PublicKey(smartWalletAddress));
        // fetch tokens
        const tokens = await connection.getParsedTokenAccountsByOwner(new PublicKey(smartWalletAddress), { programId: TOKEN_PROGRAM_ID });
        return {
            balance: (balance / LAMPORTS_PER_SOL).toString(),
            tokens: tokens.value.map(processTokenAccount)
        };
    }
);

export const fetchLatestApprovedDapps = createAsyncThunk(
    'smartWallet/fetchLatestApprovedDapps',
    async (_ , thunkApi) => {
        const state = thunkApi.getState() as RootState;
        const connection = ConnectionManager.getInstance().getConnection();
        const smartWalletAddress = state.smartWallet.address;
        if (!smartWalletAddress) {
            thunkApi.dispatch(addNotificationWithTimeout({
                notification: {
                    message: "Smart wallet address is not set",
                    type: "error"
                },
                timeout: 5000
            }));
            throw new Error("Smart wallet address is not set");
        }
        const approvedDapps = await fetchApprovedDapps(connection, new PublicKey(state.connection.programId), new PublicKey(smartWalletAddress));
        return approvedDapps;
    }
);

const smartWalletSlice = createSlice({
    name: 'smartwallet',
    initialState,
    reducers: {
       setLoading: (state, action: PayloadAction<boolean>) => {
        state.isLoading = action.payload;
       },
       setError: (state, action: PayloadAction<string>) => {
        state.error = action.payload;
       },
       setAddress: (state, action: PayloadAction<string>) => {
        state.address = action.payload;
       },
       
    },
    extraReducers(builder) {
        builder
            .addCase(fetchSmartWallet.pending, (state) => {
                state.isLoading = true;
                state.error = null;
                state.loadingBalance = true;
                state.loadingApprovedDapps = true;
            })
            .addCase(fetchSmartWallet.fulfilled, (state, action) => {
                state.isLoading = false;
                state.address = action.payload.address;
                state.balance = action.payload.balance;
                state.tokens = action.payload.tokens;
                state.initialized = action.payload.initialized;
                state.approvedDapps = action.payload.approvedDapps;
                state.loadingBalance = false;
                state.loadingApprovedDapps = false;
            })
            .addCase(fetchSmartWallet.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.error.message || null;
                state.loadingBalance = false;
                state.loadingApprovedDapps = false;
            })
            .addCase(fetchLatestBalance.pending, (state) => {
                state.error = null;
                state.loadingBalance = true;
            })
            .addCase(fetchLatestBalance.fulfilled, (state, action) => {
                state.balance = action.payload.balance;
                state.tokens = action.payload.tokens;
                state.loadingBalance = false;
            })
            .addCase(fetchLatestBalance.rejected, (state, action) => {
                state.error = action.error.message || null;
                state.loadingBalance = false;
            })
            .addCase(fetchLatestApprovedDapps.pending, (state) => {
                state.error = null;
                state.loadingApprovedDapps = true;
            })
            .addCase(fetchLatestApprovedDapps.fulfilled, (state, action) => {
                state.approvedDapps = action.payload;
                state.loadingApprovedDapps = false;
            })
            .addCase(fetchLatestApprovedDapps.rejected, (state, action) => {
                state.error = action.error.message || null;
                state.loadingApprovedDapps = false;
            })
    },
});

export const networkListenerMiddleware = createListenerMiddleware()
networkListenerMiddleware.startListening({
    actionCreator: setConnection,
    effect: async (action, listenerApi) => {
        if (action.payload) {
            const state = listenerApi.getState() as RootState;
            const publicKey = state.wallet.publicKey;
            if (publicKey) {
                listenerApi.dispatch(fetchSmartWallet(publicKey));
            }
        }
    }
})

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
    setLoading,
    setError,
    setAddress,
    
} = smartWalletSlice.actions;



export default smartWalletSlice.reducer;
