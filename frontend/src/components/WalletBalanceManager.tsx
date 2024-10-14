import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { depositSol, withdrawSol, depositToken, withdrawToken } from '../utils/smartWalletInteractions';
import { ConnectionManager } from '../utils/ConnectionManager';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import LoadingButton from './LoadingButton';


interface WalletBalanceManagerProps {
    programId: PublicKey;
    onSuccess: (signature: string) => void;
    onError: (errorMessage: string) => void;
}

interface TokenAccount {
    mint: string;
    balance: number;
    decimals: number;
    symbol: string;
    name: string;
    logo: string;
}

const WalletBalanceManager: React.FC<WalletBalanceManagerProps> = ({ programId, onSuccess, onError }) => {
    const connection  = ConnectionManager.getInstance().getConnection();
    const wallet = useWallet();
    const tokenAccounts = useSelector((state: RootState) => state.smartWallet.tokens);
    const userTokenAccounts = useSelector((state: RootState) => state.wallet.tokens);
    const solBalance = useSelector((state: RootState) => state.smartWallet.balance);
    
    const [selectedToken, setSelectedToken] = useState<string>('SOL');
    const [depositAmount, setDepositAmount] = useState<string>('');
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');
    const [action, setAction] = useState<'deposit' | 'withdraw' | null>(null);
    const [isDepositing, setIsDepositing] = useState(false);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
  
    const fetchTokenMetadata = async (mintAddress: PublicKey): Promise<{ symbol: string; name: string; logo: string }> => {
        try {
            // Fetch metadata from the Solana Token List
            const response = await fetch('https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json');
            const tokenList = await response.json();
            
            const tokenInfo = tokenList.tokens.find((token: any) => token.address === mintAddress.toString());
            
            if (tokenInfo) {
                return {
                    symbol: tokenInfo.symbol,
                    name: tokenInfo.name,
                    logo: tokenInfo.logoURI || '/unknown-token.svg' // Use unknown-token.svg if logo is not available
                };
            }
            // If token not found, return default values
            return {
                symbol: 'UNKNOWN',
                name: 'Unknown Token',
                logo: '/unknown-token.svg' // Use unknown-token.svg for unknown tokens
            };
        } catch (error) {
            console.error('Error fetching token metadata:', error);
            return {
                symbol: 'ERROR',
                name: 'Error Fetching Token',
                logo: '/unknown-token.svg' // Use unknown-token.svg for errors
            };
        }
    };

    const handleDeposit = async () => {
        if (!wallet.publicKey) {
            onError("Wallet not connected");
            return;
        }

        setIsDepositing(true);

        try {
            let transactionBase64: string;
            if (selectedToken === 'SOL') {
                transactionBase64 = await depositSol(connection, programId, wallet.publicKey, parseFloat(depositAmount));
            } else {
                const tokenMint = new PublicKey(selectedToken);
                const userATA = await getAssociatedTokenAddress(tokenMint, wallet.publicKey);
                const tokenInfo = userTokenAccounts.find(token => token.mint === selectedToken);
                if(!tokenInfo) {
                    throw new Error('Token information not found');
                }
                transactionBase64 = await depositToken(connection, programId, wallet.publicKey, tokenMint, userATA, parseFloat(depositAmount), tokenInfo.decimals);
            }

            const transaction = Transaction.from(Buffer.from(transactionBase64, 'base64'));

            if (wallet.signTransaction) {
                const signedTransaction = await wallet.signTransaction(transaction);
                const signature = await connection.sendRawTransaction(signedTransaction.serialize());
                
                const latestBlockhash = await connection.getLatestBlockhash();
                await connection.confirmTransaction({
                    signature,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                });

                console.log(`Deposit successful. Transaction signature: ${signature}`);
                onSuccess(signature);
                // fetchBalances();
                setDepositAmount('');
            } else {
                console.error('Wallet does not support signing transactions');
                onError("Wallet does not support signing transactions");
            }
        } catch (err) {
            console.error('Error depositing:', err);
            onError(`Failed to deposit: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsDepositing(false);
        }
    };

    const handleWithdraw = async () => {
        if (!wallet.publicKey) {
            onError("Wallet not connected");
            return;
        }

        setIsWithdrawing(true);

        try {
            let transactionBase64: string;
            if (selectedToken === 'SOL') {
                transactionBase64 = await withdrawSol(connection, programId, wallet.publicKey, parseFloat(withdrawAmount));
            } else {
                const tokenMint = new PublicKey(selectedToken);
                const userATA = await getAssociatedTokenAddress(tokenMint, wallet.publicKey);
                const tokenInfo = userTokenAccounts.find(token => token.mint === selectedToken);
                if(!tokenInfo) {
                    throw new Error('Token information not found');
                }
                transactionBase64 = await withdrawToken(connection, programId, wallet.publicKey, tokenMint, userATA, parseFloat(withdrawAmount),tokenInfo.decimals);
            }

            const transaction = Transaction.from(Buffer.from(transactionBase64, 'base64'));

            if (wallet.signTransaction) {
                const signedTransaction = await wallet.signTransaction(transaction);
                const signature = await connection.sendRawTransaction(signedTransaction.serialize());
                
                const latestBlockhash = await connection.getLatestBlockhash();
                await connection.confirmTransaction({
                    signature,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                });

                console.log(`Withdrawal successful. Transaction signature: ${signature}`);
                // fetchBalances();
                setWithdrawAmount('');
                onSuccess(signature);
            } else {
                console.error('Wallet does not support signing transactions');
                onError("Wallet does not support signing transactions");
            }
        } catch (err) {
            console.error('Error withdrawing:', err);
            onError(`Failed to withdraw: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsWithdrawing(false);
        }
    };

    const renderTokenOption = (token: TokenAccount) => (
        <div className="flex items-center space-x-2 p-2 hover:bg-gray-700 cursor-pointer">
            <img src={token.logo} alt={token.symbol} className="w-6 h-6 rounded-full" />
            <span className="text-white">{token.symbol}</span>
        </div>
    );

    const renderActionForm = () => {
        if (!action) return null;

        const availableTokens = action === 'deposit' ? userTokenAccounts : tokenAccounts;

        return (
            <div className="mt-4 bg-gray-800 p-6 rounded-lg shadow-inner">
                <h3 className="text-xl font-semibold text-white mb-4 capitalize">{action}</h3>
                <div className="relative mb-4">
                    <div className="flex items-center bg-gray-700 rounded-md">
                        <div className="relative w-full">
                            <select
                                value={selectedToken}
                                onChange={(e) => setSelectedToken(e.target.value)}
                                className="appearance-none w-full bg-transparent text-white px-4 py-2 pr-8 rounded-md focus:outline-none"
                            >
                                <option value="SOL">SOL</option>
                                {availableTokens.map((token, index) => (
                                    <option key={index} value={token.mint}>{token.symbol}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                                </svg>
                            </div>
                        </div>
                        <input
                            type="text"
                            placeholder={`Amount`}
                            value={action === 'deposit' ? depositAmount : withdrawAmount}
                            onChange={(e) => action === 'deposit' ? setDepositAmount(e.target.value) : setWithdrawAmount(e.target.value)}
                            className="flex-grow bg-transparent text-white px-4 py-2 focus:outline-none truncate"
                        />
                    </div>
                </div>
                <LoadingButton 
                    onClick={action === 'deposit' ? handleDeposit : handleWithdraw}
                    isLoading={action === 'deposit' ? isDepositing : isWithdrawing}
                    text={action === 'deposit' ? 'Deposit' : 'Withdraw'}
                    loadingText={action === 'deposit' ? 'Depositing...' : 'Withdrawing...'}
                    className={`w-full font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105 ${
                        action === 'deposit' 
                            ? 'bg-green-600 hover:bg-green-700 text-white' 
                            : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                />
            </div>
        );
    };

    return (
        <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6">Wallet Balance Manager</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-white mb-4">Balances</h3>
                    <div className="bg-gray-900 rounded-xl p-6 space-y-4 shadow-lg">
                        {[{ mint: 'SOL', symbol: 'SOL', uiAmount: Number(solBalance), logo: "/sol.png" }, ...tokenAccounts].map((token, index) => (
                            <div key={index} className="flex items-center justify-between p-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-800 transition duration-150 ease-in-out rounded-md">
                                <div className="flex items-center space-x-3 flex-grow">
                                    <img src={token.logo} alt={token.symbol} className="w-8 h-8 rounded-full" />
                                    <span className="text-gray-200 font-semibold text-lg truncate">{token.symbol}</span>
                                </div>
                                <span className="text-gray-200 font-medium text-base whitespace-nowrap">{token.uiAmount?.toFixed(4) || 'Loading...'}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-white mb-4">Actions</h3>
                    <div className="flex space-x-4">
                        <button
                            onClick={() => setAction('deposit')}
                            className={`flex-1 py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105 ${action === 'deposit' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                        >
                            Deposit
                        </button>
                        <button
                            onClick={() => setAction('withdraw')}
                            className={`flex-1 py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105 ${action === 'withdraw' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                        >
                            Withdraw
                        </button>
                    </div>
                    {renderActionForm()}
                </div>
            </div>
        </div>
    );
};

export default WalletBalanceManager;