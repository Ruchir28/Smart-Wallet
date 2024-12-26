import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Message {
  text: string;
  type: 'user' | 'response' | 'error' | 'system';
  timestamp: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ChatState {
  messages: Message[];
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
}

const initialState: ChatState = {
  messages: [],
  connectionStatus: 'disconnected',
  connectionError: null
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    clearMessages: (state) => {
      state.messages = [];
    },
    setConnectionStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.connectionStatus = action.payload;
    },
    setConnectionError: (state, action: PayloadAction<string | null>) => {
      state.connectionError = action.payload;
      if (action.payload) {
        state.connectionStatus = 'error';
      }
    }
  }
});

export const { 
  addMessage, 
  clearMessages, 
  setConnectionStatus, 
  setConnectionError 
} = chatSlice.actions;

export default chatSlice.reducer; 