import { createAsyncThunk, createListenerMiddleware, createSlice } from '@reduxjs/toolkit';
import { PublicKey , LAMPORTS_PER_SOL} from '@solana/web3.js';
import { getTokenMetadata, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ConnectionManager } from '../utils/ConnectionManager';
import { setConnection } from './connectionSlice';
import { RootState } from './store';
import { addNotificationWithTimeout } from './notificationSlice';
import { Token, TokenProgram, processTokenAccount } from './smartWalletSlice';

interface WalletState {
    publicKey: string | null;
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
    tokens: [],
    connected: false,
    loading: false,
    error: null,
}

export const fetchTokens = createAsyncThunk(
    'wallet/fetchTokens',
    async (publicKey: string, thunkApi) => {
        if (!publicKey) return [];
        
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


            let nativeSolInfoAsToken: Token = {
                address: publicKey,
                decimals: 9,
                mint: PublicKey.default.toString(),
                amount: "0",
                uiAmount: 0,
                tokenProgram: TokenProgram.NATIVE_SOL
            }

            if (balanceResult.status === 'fulfilled') {
                nativeSolInfoAsToken.amount = balanceResult.value.toString();
                nativeSolInfoAsToken.uiAmount = balanceResult.value / LAMPORTS_PER_SOL;
            } else {
                console.error('Error fetching balance:', balanceResult.reason);
                thunkApi.dispatch(addNotificationWithTimeout(
                    {
                        notification: {
                            message: `Failed to fetch Native SOL balance for your wallet`,
                            type: "error"
                        },
                        timeout: 5000
                    }
                ));
            }

            // Safely combine the results
            const combinedTokens = [
                ...(tokensDataResult.status === 'fulfilled' ? tokensDataResult.value.value : []),
                ...(tokens2022DataResult.status === 'fulfilled' ? tokens2022DataResult.value.value : [])
            ];

            // Filter out tokens with 0 balance and map to our format
            const tokens = combinedTokens.map(processTokenAccount);

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
                        if(token.tokenProgram == TokenProgram.NATIVE_SOL) {
                            return token; // SOL is not a token
                        }
                        const programId = token.tokenProgram === TokenProgram.SPL ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
                        const metadata = await fetchMetadataWithRetry(mint, programId);
                        
                        return {
                            ...token,
                            symbol: metadata?.symbol,
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

            return [nativeSolInfoAsToken, ...processedTokens];

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