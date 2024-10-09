import React, { useMemo } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import {
    LedgerWalletAdapter,
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import {
    WalletModalProvider,
    WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import SmartWalletInteractions from './components/SmartWalletInteractions';
import LandingPage from './components/LandingPage';
import './App.css';

import '@solana/wallet-adapter-react-ui/styles.css';

function App() {
    const network = 'http://127.0.0.1:8899';
    const endpoint = useMemo(() => network, []);

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
            new TorusWalletAdapter(),
            new LedgerWalletAdapter(),
        ],
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
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
        </ConnectionProvider>
    );
}

export default App;
