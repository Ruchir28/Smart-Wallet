import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { PublicKey } from '@solana/web3.js';
import { getTokenMetadata, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { ConnectionManager } from '../utils/ConnectionManager';
import { RootState } from './store';
import { Token, TokenProgram } from './smartWalletSlice';

interface TokenMetadata {
    image: string;
    name?: string;
    symbol: string;
    uri?: string;
}

interface TokenMetadataState {
    metadata: Record<string, TokenMetadata>;
    loading: boolean;
    error: string | null;
}

const initialState: TokenMetadataState = {
    metadata: {},
    loading: false,
    error: null
};

export const fetchTokensMetadata = createAsyncThunk(
    'tokenMetadata/fetchTokensMetadata',
    async (tokens: Token[], { getState }) => {
        
        const connection = ConnectionManager.getInstance().getConnection();
        
        const state = getState() as RootState;
        
        const existingMetadata = state.tokenMetadata.metadata;
        
        const tokensToFetch = tokens.filter(token => !existingMetadata[token.mint]);
        
        if (tokensToFetch.length === 0) return {};

        const metadataPromises = tokensToFetch.map(async (token): Promise<[string, TokenMetadata]> => {
            try {
                const mint = token.mint;
                const tokenProgram = token.tokenProgram;

                if(tokenProgram == TokenProgram.NATIVE_SOL) {
                    return [mint, {
                        symbol: "SOL",
                        name: "Solana",
                        image: "/sol.png"
                    }]
                }

                const tokenProgramId = tokenProgram == TokenProgram.TOKEN_2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

                    const tokenMetadata = await getTokenMetadata(
                        connection,
                        new PublicKey(mint),
                        undefined,
                        tokenProgramId
                    );

                    if (tokenMetadata?.uri) {
                        const response = await fetch(tokenMetadata.uri);
                        const json = await response.json();
                        return [mint, {
                            image: json.image,
                            name: json.name,
                            symbol: tokenMetadata.symbol,
                            uri: tokenMetadata.uri
                        }];
                    }
                    return [mint, {
                        symbol: 'Unknown',
                        image: '/unknown-token.svg'
                    }];

                } catch (error) {
                    console.error(`Error fetching metadata for token ${token.mint}:`, error);
                    return [token.mint, {
                        symbol: 'Unknown',
                        image: '/unknown-token.svg'
                    }]
                }
        });

        const metadataResults = await Promise.all(metadataPromises);
        return Object.fromEntries(metadataResults);
    }
);

const tokenMetadataSlice = createSlice({
    name: 'tokenMetadata',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchTokensMetadata.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTokensMetadata.fulfilled, (state, action) => {
                state.metadata = {
                    ...state.metadata,
                    ...action.payload
                };
                state.loading = false;
            })
            .addCase(fetchTokensMetadata.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch token metadata';
            });
    }
});

export default tokenMetadataSlice.reducer;