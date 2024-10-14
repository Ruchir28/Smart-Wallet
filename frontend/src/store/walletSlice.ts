import { createAsyncThunk, createListenerMiddleware, createSlice } from '@reduxjs/toolkit';
import { RootState } from './store';
import { PublicKey, Connection } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ConnectionManager } from '../utils/ConnectionManager';

interface Token {
    address: string;
    decimals: number;
    symbol: string;
    mint: string;
    amount: string;
    uiAmount: number | null;
    logo: string
}

interface WalletState {
    publicKey: string | null;
    balance: number;
    tokens: Token[];
    connected: boolean;
    loading: boolean;
    error: string | null;
}

const initialState: WalletState = {
    publicKey: null,
    balance: 0,
    tokens: [],
    connected: false,
    loading: false,
    error: null,
}

export const fetchTokens = createAsyncThunk(
    'wallet/fetchTokens',
    async (publicKey: string, _thunkApi) => {
        const connection = ConnectionManager.getInstance().getConnection();

        if (!publicKey) {
            return [];
        }
        try {

            const tokens = await connection.getParsedTokenAccountsByOwner(new PublicKey(publicKey), {
                programId: TOKEN_PROGRAM_ID,
            });

            console.log("In here user tpkens", tokens);

            return tokens.value.map((accountInfo) => {
                const info = accountInfo.account.data.parsed.info;           
                const tokenInfo : Token = {
                    address: accountInfo.pubkey.toBase58(),
                    mint: info.mint,
                    decimals: info.tokenAmount.decimals,
                    amount: info.tokenAmount.amount,
                    uiAmount: info.tokenAmount.uiAmount,
                    symbol: 'unknown',
                    logo: '/unknown-token.svg'
                }
                return tokenInfo;
            });
        } catch (error) {
            console.error('Error fetching token data:', error);
            throw error;
        }
    }
)

const walletSlice = createSlice({
    name: 'wallet',
    initialState: initialState,
    reducers: (create) => ({
        setPublicKey: create.reducer<string | null>((state,action) => {
            state.publicKey = action.payload;
            
        }),
    }),
    extraReducers: (builder) => {
        builder.addCase(fetchTokens.pending, (state) => {
            state.loading = true;
        })
        builder.addCase(fetchTokens.fulfilled, (state, action) => {
            state.loading = false;
            state.tokens =  action.payload;
        })
        builder.addCase(fetchTokens.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message || 'Failed to fetch tokens';
        })
    }
});

export const { setPublicKey } = walletSlice.actions;


export const publicKeyListenerMiddlewareWallet = createListenerMiddleware();
publicKeyListenerMiddlewareWallet.startListening({
    actionCreator: setPublicKey,
    effect: async (action,  listenerApi) => {
        if (action.payload) {
            listenerApi.dispatch(fetchTokens(action.payload));
        }
    }
})


export default walletSlice.reducer;