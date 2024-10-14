import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import { Connection } from '@solana/web3.js';
type ConnectionType = 'localnet' | 'devnet' | 'testnet' | 'mainnet-beta';

interface ConnectionState {
    connectionType: ConnectionType;
}

const initialState: ConnectionState = {
    connectionType: 'localnet'
}

const connectionSlice = createSlice({
    name: 'connection',
    initialState,
    reducers: {
        setConnection: (state, action: PayloadAction<ConnectionType>) => {
            state.connectionType = action.payload;
       }
    },
});

export const { setConnection } = connectionSlice.actions;
export const selectConnection = (state: RootState) => state.connection;
export default connectionSlice.reducer;
