import { configureStore } from '@reduxjs/toolkit';
import connectionReducer from './connectionSlice';
import walletReducer, { publicKeyListenerMiddlewareWallet } from './walletSlice';
import smartWalletReducer from './smartWalletSlice';
import notificationReducer from './notificationSlice';
import {publicKeyListenerMiddleware} from './smartWalletSlice'

const store = configureStore({
    reducer: {
        connection: connectionReducer,
        wallet: walletReducer,
        smartWallet: smartWalletReducer,
        notification: notificationReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().prepend(publicKeyListenerMiddleware.middleware, publicKeyListenerMiddlewareWallet.middleware),

});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;


