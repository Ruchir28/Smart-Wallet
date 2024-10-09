import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { depositSol, withdrawSol, depositToken, withdrawToken } from '../utils/smartWalletInteractions';


interface WalletBalanceManagerProps {
    programId: PublicKey;
}

interface TokenAccount {
    mint: string;
    balance: number;
    symbol: string;
    name: string;
    logo: string;
}

const WalletBalanceManager: React.FC<WalletBalanceManagerProps> = ({ programId }) => {
    const { connection } = useConnection();
    const wallet = useWallet();

    const [solBalance, setSolBalance] = useState<number | null>(null);
    const [tokenAccounts, setTokenAccounts] = useState<TokenAccount[]>([]);
    const [selectedToken, setSelectedToken] = useState<string>('SOL');
    const [depositAmount, setDepositAmount] = useState<string>('');
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [action, setAction] = useState<'deposit' | 'withdraw' | null>(null);
    const [userTokenAccounts, setUserTokenAccounts] = useState<TokenAccount[]>([]);

    useEffect(() => {
        if (wallet.publicKey) {
            fetchBalances();
            fetchUserTokenAccounts();
        }
    }, [wallet.publicKey, connection]);

    const fetchBalances = async () => {
        if (!wallet.publicKey) return;

        try {
            const [walletAddress, _] = PublicKey.findProgramAddressSync(
                [Buffer.from("wallet"), wallet.publicKey.toBuffer()],
                programId
            );

            // Fetch SOL balance
            const solBalance = await connection.getBalance(walletAddress);
            setSolBalance(solBalance / 1e9); // Convert lamports to SOL

            // Fetch all token accounts
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletAddress, {
                programId: TOKEN_PROGRAM_ID
            });

            const tokens = await Promise.all(tokenAccounts.value.map(async ({ account }) => {
                const mintAddress = new PublicKey(account.data.parsed.info.mint);
                const tokenInfo = await fetchTokenMetadata(mintAddress);
                return {
                    mint: account.data.parsed.info.mint,
                    balance: account.data.parsed.info.tokenAmount.uiAmount,
                    symbol: tokenInfo.symbol,
                    name: tokenInfo.name,
                    logo: tokenInfo.logo
                };
            }));

            setTokenAccounts(tokens);
        } catch (err) {
            console.error('Error fetching balances:', err);
        }
    };

    const fetchUserTokenAccounts = async () => {
        if (!wallet.publicKey) return;

        try {
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
                programId: TOKEN_PROGRAM_ID
            });

            const tokens = await Promise.all(tokenAccounts.value.map(async ({ account }) => {
                const mintAddress = new PublicKey(account.data.parsed.info.mint);
                const tokenInfo = await fetchTokenMetadata(mintAddress);
                return {
                    mint: account.data.parsed.info.mint,
                    balance: account.data.parsed.info.tokenAmount.uiAmount,
                    symbol: tokenInfo.symbol,
                    name: tokenInfo.name,
                    logo: tokenInfo.logo
                };
            }));

            setUserTokenAccounts(tokens);
        } catch (err) {
            console.error('Error fetching user token accounts:', err);
        }
    };

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
                    logo: tokenInfo.logoURI || '/sol.png' // Default to SOL logo if not available
                };
            }
            // If still not found, return default values
            return {
                symbol: 'UNKNOWN',
                name: 'Unknown Token',
                logo: '/sol.png' // Default to SOL logo
            };
        } catch (error) {
            console.error('Error fetching token metadata:', error);
            return {
                symbol: 'ERROR',
                name: 'Error Fetching Token',
                logo: '/sol.png' // Default to SOL logo
            };
        }
    };

    const handleDeposit = async () => {
        if (!wallet.publicKey) {
            setError("Wallet not connected");
            return;
        }

        try {
            let transactionBase64: string;
            if (selectedToken === 'SOL') {
                transactionBase64 = await depositSol(connection, programId, wallet.publicKey, parseFloat(depositAmount));
            } else {
                const tokenMint = new PublicKey(selectedToken);
                const userATA = await getAssociatedTokenAddress(tokenMint, wallet.publicKey);
                transactionBase64 = await depositToken(connection, programId, wallet.publicKey, tokenMint, userATA, parseFloat(depositAmount));
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
                fetchBalances();
                setDepositAmount('');
            } else {
                console.error('Wallet does not support signing transactions');
                setError("Wallet does not support signing transactions");
            }
        } catch (err) {
            console.error('Error depositing:', err);
            setError(`Failed to deposit: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const handleWithdraw = async () => {
        if (!wallet.publicKey) {
            setError("Wallet not connected");
            return;
        }

        try {
            let transactionBase64: string;
            if (selectedToken === 'SOL') {
                transactionBase64 = await withdrawSol(connection, programId, wallet.publicKey, parseFloat(withdrawAmount));
            } else {
                const tokenMint = new PublicKey(selectedToken);
                const userATA = await getAssociatedTokenAddress(tokenMint, wallet.publicKey);
                transactionBase64 = await withdrawToken(connection, programId, wallet.publicKey, tokenMint, userATA, parseFloat(withdrawAmount));
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
                fetchBalances();
                setWithdrawAmount('');
            } else {
                console.error('Wallet does not support signing transactions');
                setError("Wallet does not support signing transactions");
            }
        } catch (err) {
            console.error('Error withdrawing:', err);
            setError(`Failed to withdraw: ${err instanceof Error ? err.message : String(err)}`);
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
                <button 
                    onClick={action === 'deposit' ? handleDeposit : handleWithdraw} 
                    className={`w-full ${action === 'deposit' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105`}
                >
                    {action === 'deposit' ? 'Deposit' : 'Withdraw'}
                </button>
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
                        {[{ mint: 'SOL', symbol: 'SOL', balance: solBalance, logo: "/sol.png" }, ...tokenAccounts].map((token, index) => (
                            <div key={index} className="flex items-center justify-between p-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-800 transition duration-150 ease-in-out rounded-md">
                                <div className="flex items-center space-x-3 flex-grow">
                                    <img src={token.logo} alt={token.symbol} className="w-8 h-8 rounded-full" />
                                    <span className="text-gray-200 font-semibold text-lg truncate">{token.symbol}</span>
                                </div>
                                <span className="text-gray-200 font-medium text-base whitespace-nowrap">{token.balance?.toFixed(4) || 'Loading...'}</span>
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
            {error && (
                <div className="mt-6 bg-red-900 text-red-200 p-4 rounded-md">
                    <p className="font-semibold">Error</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}
        </div>
    );
};

export default WalletBalanceManager;