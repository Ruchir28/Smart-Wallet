import React, { useMemo } from 'react';
import { Token } from '../store/smartWalletSlice';
import { RootState } from '../store/store';
import { useSelector } from 'react-redux';

interface TokenSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (token: Token) => void;
    title: string;
    modalType: 'smartWallet' | 'wallet';
}

const TokenSelectModal: React.FC<TokenSelectModalProps> = ({ isOpen, onClose, modalType, onSelect, title }) => {
    if (!isOpen) return null;
    const smartWalletTokens = useSelector((state: RootState) => state.smartWallet.tokens);
    const walletTokens = useSelector((state: RootState) => state.wallet.tokens);
    const walletBalance = useSelector((state: RootState) => state.wallet.balance);
    const smartWalletBalance = useSelector((state: RootState) => state.smartWallet.balance);
    const solToken = useMemo(() => {
        const solToken = {
            mint: 'SOL',
            symbol: 'SOL',
            address: 'SOL',
            decimals: 9,
            logo: "/sol.png",
            amount: modalType === 'smartWallet' ? smartWalletBalance : walletBalance,
            uiAmount: parseFloat(modalType === 'smartWallet' ? smartWalletBalance : walletBalance)
        };
        if (modalType === 'smartWallet') return solToken;
        return solToken;
    }, [modalType, smartWalletBalance, walletBalance]);
    const tokens = useMemo(() => {
        if (modalType === 'smartWallet') return smartWalletTokens;
        return walletTokens;
    }, [modalType, smartWalletTokens, walletTokens]);
    const tokenMetadata = useSelector((state: RootState) => state.tokenMetadata.metadata);


    const truncateAddress = (address: string) => {
        if (address === 'SOL') return 'SOL';
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };

    const getTokenImage = (token: Token) => {
        if (token.mint === 'SOL') return "/sol.png";
        return tokenMetadata[token.mint]?.image || token.logo || "/default-token.png";
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-gray-800 rounded-lg p-6 w-[420px] max-h-[80vh] overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-white">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="overflow-y-auto max-h-[60vh]">
                    {[solToken, ...tokens].map((token, index) => (
                        <div
                            key={index}
                            onClick={() => {
                                onSelect(token);
                                onClose();
                            }}
                            className="flex items-center justify-between p-4 hover:bg-gray-700 cursor-pointer rounded-lg mb-2 group"
                        >
                            <div className="flex items-center space-x-3 min-w-0">
                                <img 
                                    src={getTokenImage(token)} 
                                    alt={token.symbol} 
                                    className="w-8 h-8 rounded-full flex-shrink-0"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = "/default-token.png";
                                    }}
                                />
                                <div className="min-w-0">
                                    <div className="text-white font-medium truncate">
                                        {token.symbol}
                                    </div>
                                    <div 
                                        className="text-gray-400 text-sm truncate"
                                        title={token.mint}
                                    >
                                        {truncateAddress(token.mint)}
                                    </div>
                                </div>
                            </div>
                            <div className="text-white text-right flex-shrink-0 ml-2">
                                {token.uiAmount?.toFixed(4)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TokenSelectModal; 