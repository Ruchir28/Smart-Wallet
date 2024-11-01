import { createAsyncThunk, createListenerMiddleware, createSlice } from '@reduxjs/toolkit';
import { PublicKey , LAMPORTS_PER_SOL} from '@solana/web3.js';
import { getTokenMetadata, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ConnectionManager } from '../utils/ConnectionManager';
import { setConnection } from './connectionSlice';
import { RootState } from './store';

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
    balance: string;
    tokens: Token[];
    connected: boolean;
    loading: boolean;
    error: string | null;
}

interface TokenMetadataResult {
    symbol: string;
    uri: string;
    name?: string;
}

const initialState: WalletState = {
    publicKey: null,
    balance: "0",
    tokens: [],
    connected: false,
    loading: false,
    error: null,
}

export const fetchTokens = createAsyncThunk(
    'wallet/fetchTokens',
    async (publicKey: string, _thunkApi) => {
        if (!publicKey) return {tokens: [], balance: "0"};
        
        const connection = ConnectionManager.getInstance().getConnection();
        
        try {
            // Use Promise.allSettled for the initial token fetching
            const [tokensDataResult, tokens2022DataResult, balanceResult] = await Promise.allSettled([
                connection.getParsedTokenAccountsByOwner(new PublicKey(publicKey), {
                    programId: TOKEN_PROGRAM_ID,
                }),
                connection.getParsedTokenAccountsByOwner(new PublicKey(publicKey), {
                    programId: TOKEN_2022_PROGRAM_ID,
                }),
                connection.getBalance(new PublicKey(publicKey))
            ]);

            let balance = "0";
            if (balanceResult.status === 'fulfilled') {
                balance = (balanceResult.value / LAMPORTS_PER_SOL).toString();
            }


            // Safely combine the results
            const combinedTokens = [
                ...(tokensDataResult.status === 'fulfilled' ? tokensDataResult.value.value : []),
                ...(tokens2022DataResult.status === 'fulfilled' ? tokens2022DataResult.value.value : [])
            ];

            // Filter out tokens with 0 balance and map to our format
            const tokens = combinedTokens
                .filter(accountInfo => {
                    const amount = accountInfo.account.data.parsed.info.tokenAmount.uiAmount;
                    return amount !== null && amount > 0;
                })
                .map((accountInfo) => {
                    const info = accountInfo.account.data.parsed.info;
                    return {
                        address: accountInfo.pubkey.toBase58(),
                        mint: info.mint,
                        decimals: info.tokenAmount.decimals,
                        amount: info.tokenAmount.amount,
                        uiAmount: info.tokenAmount.uiAmount,
                        symbol: 'unknown',
                        logo: '/unknown-token.svg'
                    } as Token;
                });

            // Fetch metadata with retry logic
            const fetchMetadataWithRetry = async (mint: PublicKey, programId: PublicKey): Promise<TokenMetadataResult | null> => {
                for (let i = 0; i < 3; i++) {
                    try {
                        const metadata = await getTokenMetadata(connection, mint, undefined, programId);
                        if (metadata) return metadata;
                    } catch (error) {
                        if (i === 2) console.warn(`Failed to fetch metadata for token ${mint.toString()}:`, error);
                        // Add delay between retries
                        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                    }
                }
                return null;
            };

            // Process tokens in batches to avoid overwhelming the connection
            const batchSize = 5;
            const processedTokens: Token[] = [];
            
            for (let i = 0; i < tokens.length; i += batchSize) {
                const batch = tokens.slice(i, i + batchSize);
                const batchPromises = batch.map(async token => {
                    try {
                        const mint = new PublicKey(token.mint);
                        // Try TOKEN_PROGRAM_ID first, then TOKEN_2022_PROGRAM_ID if the first fails
                        const metadata = await fetchMetadataWithRetry(mint, TOKEN_PROGRAM_ID) || 
                                       await fetchMetadataWithRetry(mint, TOKEN_2022_PROGRAM_ID);
                        
                        return {
                            ...token,
                            symbol: metadata?.symbol || token.symbol,
                            logo: metadata?.uri || token.logo,
                            name: metadata?.name
                        };
                    } catch (error) {
                        console.warn(`Failed to process token ${token.mint}:`, error);
                        return token; // Return original token if metadata fetch fails
                    }
                });

                const batchResults = await Promise.allSettled(batchPromises);
                batchResults.forEach(result => {
                    if (result.status === 'fulfilled') {
                        processedTokens.push(result.value);
                    }
                });

                // Add a small delay between batches to avoid rate limiting
                if (i + batchSize < tokens.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            return {tokens: processedTokens, balance: balance};

        } catch (error) {
            console.error('Error fetching token data:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to fetch tokens');
        }
    }
);

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
            state.tokens =  action.payload.tokens;
            state.balance = action.payload.balance;
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

export const networkListenerMiddlewareWallet = createListenerMiddleware();
networkListenerMiddlewareWallet.startListening({
    actionCreator: setConnection,
    effect: async (action, listenerApi) => {
        if (action.payload) {
            const state = listenerApi.getState() as RootState;
            const publicKey = state.wallet.publicKey;
            if (publicKey) {
                listenerApi.dispatch(fetchTokens(publicKey));
            }
        }
    }
})

export default walletSlice.reducer;