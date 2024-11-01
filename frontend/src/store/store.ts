import { configureStore } from '@reduxjs/toolkit';
import connectionReducer from './connectionSlice';
import walletReducer, { publicKeyListenerMiddlewareWallet } from './walletSlice';
import smartWalletReducer from './smartWalletSlice';
import notificationReducer from './notificationSlice';
import {publicKeyListenerMiddleware} from './smartWalletSlice'
import telegramReducer from './telegramSlice';
import tokenMetadataReducer from './tokenMetadataSlice';
const store = configureStore({
    reducer: {
        connection: connectionReducer,
        wallet: walletReducer,
        smartWallet: smartWalletReducer,
        tokenMetadata: tokenMetadataReducer,
        notification: notificationReducer,
        telegram: telegramReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().prepend(publicKeyListenerMiddleware.middleware, publicKeyListenerMiddlewareWallet.middleware),

});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;


