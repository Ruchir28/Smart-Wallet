import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store";
import { addNotificationWithTimeout } from "./notificationSlice";
import bs58 from 'bs58';
type TelegramUser = {
    id: number;
    first_name: string;
    username?: string;
    photo_url: string;
    auth_date: number;
    hash: string;
};


type SmartWalletInfo = {
    id: string;
    publicKey: string;
    telegramId: string;
    telegramUsername: string | null;
    createdAt: string;
  };

export type { TelegramUser, SmartWalletInfo };

interface TelegramState {
    telegramUser: TelegramUser | null;
    smartWalletInfo: SmartWalletInfo | null;
    loading: boolean;
    isLinking: boolean;
}

const initialState: TelegramState = {
    telegramUser: null,
    smartWalletInfo: null,
    loading: false,
    isLinking: false
};

const fetchSmartWalletInfo = createAsyncThunk('telegram/fetchSmartWalletInfo', async (_ , thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    if (!state.smartWallet.address) {
        thunkAPI.dispatch(addNotificationWithTimeout({
            notification: {
                message: "Smart Wallet not found",
                type: "error",
            },
            timeout: 5000
        }));
        return null;
    }
    thunkAPI.dispatch(setLoading(true));
    const smartWalletId = state.smartWallet.address;

    try {
        const smartWalletInfo = await fetch(`${import.meta.env.VITE_TELEGRAM_BOT_SERVER_URL}/getSmartWallet?smartWalletId=${smartWalletId}`)
        .then(res => res.json());
        if(smartWalletInfo.success) {
            return smartWalletInfo.data;
        }
        throw new Error("Failed to fetch smart wallet info");
    } catch (error) {
        thunkAPI.dispatch(addNotificationWithTimeout({
            notification: {
                message: "Failed to fetch smart wallet info",
                type: "error",
            },
            timeout: 5000
        }));
        return null;
    } finally {
        thunkAPI.dispatch(setLoading(false));
    }
});



const linkSmartWallet = createAsyncThunk('telegram/linkSmartWallet', async (payload: {message: string, signedMessage: Uint8Array}, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    console.log("Linking Smart Wallet", state.telegram.telegramUser);

    const { message, signedMessage } = payload;

    const telegramUser = state.telegram.telegramUser;


    if (!state.smartWallet.address || !telegramUser) {
        thunkAPI.dispatch(addNotificationWithTimeout({
            notification: {
                message: "Smart Wallet not found",
                type: "error",
            },
            timeout: 5000
        }));
        return null;
    }

    thunkAPI.dispatch(setLinking(true));

     
    try {
        const smartWalletId = state.smartWallet.address;

        
        const response = await fetch(`${import.meta.env.VITE_TELEGRAM_BOT_SERVER_URL}/linkTelegramAccount`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegramId: telegramUser.id.toString(),
                smartWalletId,
                publicKey: state.wallet.publicKey, 
                telegramUsername: telegramUser.first_name,
                signedMessage: bs58.encode(signedMessage),
                message: message
            }),
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to link account');
        }
        
        thunkAPI.dispatch(addNotificationWithTimeout({
            notification: {
                message: "Successfully linked Telegram account to Smart Wallet!",
                type: "success"
            },
            timeout: 5000
        }));
        
        thunkAPI.dispatch(setSmartWalletInfo({
            id: data.id,
            publicKey: data.publicKey,
            telegramId: data.telegramId,
            telegramUsername: data.telegramUsername,
            createdAt: data.createdAt
        }))

    } catch( error ) {
        
        thunkAPI.dispatch(addNotificationWithTimeout({
            notification: {
                message: error as string,
                type: "error"
            },
            timeout: 5000
        }));
    } finally {
        thunkAPI.dispatch(setLinking(false));
    }
    

});

const telegramSlice = createSlice({
    name: 'telegram',
    initialState,
    reducers: {
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setTelegramUser: (state, action: PayloadAction<TelegramUser>) => {
            state.telegramUser = action.payload;
        },
        setLinking: (state, action: PayloadAction<boolean>) => {
            state.isLinking = action.payload;
        },
        setSmartWalletInfo: (state, action: PayloadAction<SmartWalletInfo>) => {
            state.smartWalletInfo = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder.addCase(fetchSmartWalletInfo.fulfilled, (state, action) => {
            state.smartWalletInfo = action.payload;
        });
        builder.addCase(fetchSmartWalletInfo.rejected, (state, action) => {
            state.smartWalletInfo = null;
        })
    },
});



export { fetchSmartWalletInfo, linkSmartWallet };
export const { setLoading, setTelegramUser, setLinking, setSmartWalletInfo } = telegramSlice.actions;
export default telegramSlice.reducer;
