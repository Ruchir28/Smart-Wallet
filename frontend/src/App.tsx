import { useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { WalletProvider } from '@solana/wallet-adapter-react';
import {
    LedgerWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import {
    WalletModalProvider,
    WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import SmartWalletInteractions from './components/SmartWalletInteractions';
import LandingPage from './components/LandingPage';
import { getConnectionManager } from './utils/ConnectionManager';
import './App.css';

import '@solana/wallet-adapter-react-ui/styles.css';
import { useSelector } from 'react-redux';
import { RootState } from './store/store';
import NotificationManager from './components/NotificationManager';

function App() {

    const connectionType = useSelector((state: RootState) => state.connection.connectionType);

    const endpoint = useMemo(() => {
        switch(connectionType) {
            case 'localnet':
                return 'http://127.0.0.1:8899';
            case 'devnet':
                return 'https://api.devnet.solana.com';
            case 'testnet':
                return 'https://api.testnet.solana.com';
            case 'mainnet-beta':
                return 'https://api.mainnet-beta.solana.com';
            default:
                return 'https://api.devnet.solana.com';
        }
    }, [connectionType]);

    const wallets = useMemo(
        () => [
            new SolflareWalletAdapter(),
            new TorusWalletAdapter(),
            new LedgerWalletAdapter(),
        ],
        []
    );

    useEffect(() => {
        const connectionManager = getConnectionManager();
        connectionManager.setDefaultEndpoint(endpoint);
        connectionManager.initializeConnection(endpoint);
    }, [endpoint]);

    return (
        <>
            <NotificationManager />
            <WalletProvider autoConnect wallets={wallets}>
                <WalletModalProvider>
                    <Router>
                        <Routes>
                            <Route path="/" element={<LandingPage />} />
                            <Route path="/app" element={
                                <div className="min-h-screen w-screen bg-gradient-to-br from-black to-gray-900 text-white">
                                    <nav className="bg-black bg-opacity-50 backdrop-filter backdrop-blur-lg border-b border-gray-800">
                                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                            <div className="flex justify-between items-center h-16">
                                                <h1 className="text-2xl font-semibold text-white">Smart Wallet</h1>
                                                <WalletMultiButton className="bg-white text-black hover:bg-gray-200 font-medium py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105" />
                                            </div>
                                        </div>
                                    </nav>
                                    <main className="p-4 sm:p-6 md:p-8">
                                        <div className="max-w-7xl mx-auto">
                                            <SmartWalletInteractions />
                                        </div>
                                    </main>
                                </div>
                            } />
                        </Routes>
                    </Router>
                </WalletModalProvider>
            </WalletProvider>
        </>
    );
}

export default App;
