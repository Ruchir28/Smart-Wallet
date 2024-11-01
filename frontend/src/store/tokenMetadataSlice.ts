import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { PublicKey } from '@solana/web3.js';
import { getTokenMetadata, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { ConnectionManager } from '../utils/ConnectionManager';
import { RootState } from './store';

interface TokenMetadata {
    image?: string;
    name?: string;
    symbol?: string;
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
    async (mints: string[], { getState }) => {
        const connection = ConnectionManager.getInstance().getConnection();
        const state = getState() as RootState;
        const existingMetadata = state.tokenMetadata.metadata;
        
        const mintsToFetch = mints.filter(mint => !existingMetadata[mint]);
        
        if (mintsToFetch.length === 0) return {};

        const metadataPromises = mintsToFetch.map(async (mint) => {
            try {
                // Try Token-2022 first
                try {
                    const token2022Metadata = await getTokenMetadata(
                        connection,
                        new PublicKey(mint),
                        undefined,
                        TOKEN_2022_PROGRAM_ID
                    );

                    if (token2022Metadata?.uri) {
                        const response = await fetch(token2022Metadata.uri);
                        const json = await response.json();
                        return [mint, {
                            image: json.image,
                            name: json.name,
                            symbol: token2022Metadata.symbol,
                            uri: token2022Metadata.uri
                        }];
                    }
                } catch (error) {
                    console.log(`Token ${mint} not found in Token-2022 program, trying standard Token program...`);
                }

                // If Token-2022 fails, try standard Token program
                const tokenMetadata = await getTokenMetadata(
                    connection,
                    new PublicKey(mint),
                    undefined,
                    TOKEN_PROGRAM_ID
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

                return [mint, { symbol: tokenMetadata?.symbol }];
            } catch (error) {
                console.error(`Error fetching token metadata for ${mint}:`, error);
                return [mint, {}];
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