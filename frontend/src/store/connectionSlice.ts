import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
type ConnectionType = 'localnet' | 'devnet' | 'testnet' | 'mainnet-beta';

interface ConnectionState {
    connectionType: ConnectionType;
    programId: string;
}

const initialState: ConnectionState = {
    connectionType: 'devnet',
    programId: 'G4rRSg4E9i3hWpHVCioQ3YZDutswuz2PPr1J38EJtzST'
}

const connectionSlice = createSlice({
    name: 'connection',
    initialState,
    reducers: {
        setConnection: (state, action: PayloadAction<ConnectionType>) => {
            state.connectionType = action.payload;
            switch(action.payload) {
                case 'localnet':
                    state.programId = 'G4rRSg4E9i3hWpHVCioQ3YZDutswuz2PPr1J38EJtzST';
                    break;
                case 'devnet':
                    state.programId = 'G4rRSg4E9i3hWpHVCioQ3YZDutswuz2PPr1J38EJtzST';
                    break;
            }
       }
    },
});

export const { setConnection } = connectionSlice.actions;
export const selectConnection = (state: RootState) => state.connection;
export default connectionSlice.reducer;
