import { useMemo, useEffect, useState, useRef } from 'react';
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
import { useDispatch } from 'react-redux';
import { setConnection } from './store/connectionSlice';

function App() {
    const dispatch = useDispatch();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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

    const NetworkButton = () => {
        const handleNetworkChange = (network: 'localnet' | 'devnet') => {
            dispatch(setConnection(network));
            setIsDropdownOpen(false);
        };

        const buttonRef = useRef<HTMLDivElement>(null);

        const handleBlur = (e: React.FocusEvent) => {
            if (!buttonRef.current?.contains(e.relatedTarget as Node)) {
                setIsDropdownOpen(false);
            }
        };

        return (
            <div 
                ref={buttonRef}
                onBlur={handleBlur}
                tabIndex={-1}
                className="relative"
            >
                <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="bg-gray-800 text-white px-4 py-2 rounded-md mr-4 flex items-center"
                >
                    {connectionType.charAt(0).toUpperCase() + connectionType.slice(1)}
                    <svg 
                        className={`ml-2 h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                
                {isDropdownOpen && (
                    <div className="absolute z-10 mt-2 w-48 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5">
                        <div className="py-1" role="menu">
                            <button
                                onClick={() => handleNetworkChange('localnet')}
                                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
                                role="menuitem"
                            >
                                Localnet
                            </button>
                            <button
                                onClick={() => handleNetworkChange('devnet')}
                                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
                                role="menuitem"
                            >
                                Devnet
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            <NotificationManager />
            <WalletProvider autoConnect wallets={wallets} >
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
                                                <div className="flex items-center">
                                                    <NetworkButton />
                                                    <WalletMultiButton className="bg-white text-black hover:bg-gray-200 font-medium py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105" />
                                                </div>
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
