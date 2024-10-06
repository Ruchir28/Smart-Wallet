import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
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

    useEffect(() => {
        if (wallet.publicKey) {
            fetchBalances();
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

            console.log("tokenAccounts", tokenAccounts);

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
                    logo: tokenInfo.logoURI || 'https://cryptologos.cc/logos/solana-sol-logo.png?v=024' // Default to SOL logo if not available
                };
            }
            // If still not found, return default values
            return {
                symbol: 'UNKNOWN',
                name: 'Unknown Token',
                logo: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=024' // Default to SOL logo
            };
        } catch (error) {
            console.error('Error fetching token metadata:', error);
            return {
                symbol: 'ERROR',
                name: 'Error Fetching Token',
                logo: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=024' // Default to SOL logo
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
                transactionBase64 = await depositToken(connection, programId, wallet.publicKey, tokenMint, parseFloat(depositAmount));
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
                transactionBase64 = await withdrawToken(connection, programId, wallet.publicKey, tokenMint, parseFloat(withdrawAmount));
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

    const renderActionForm = () => {
        if (!action) return null;

        return (
            <div className="mt-4 bg-gray-700 p-4 rounded-lg">
                <h3 className="text-xl font-semibold text-white mb-4 capitalize">{action}</h3>
                <select
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                    className="w-full bg-gray-600 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                >
                    <option value="SOL">SOL</option>
                    {tokenAccounts.map((token, index) => (
                        <option key={index} value={token.mint}>{token.symbol}</option>
                    ))}
                </select>
                <input
                    type="text"
                    placeholder={`Amount to ${action}`}
                    value={action === 'deposit' ? depositAmount : withdrawAmount}
                    onChange={(e) => action === 'deposit' ? setDepositAmount(e.target.value) : setWithdrawAmount(e.target.value)}
                    className="w-full bg-gray-600 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
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
        <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-1/3 space-y-4">
                <h3 className="text-2xl font-semibold text-white mb-4">Balances</h3>
                <div className="space-y-4">
                    <div className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 p-4 rounded-lg border border-gray-600">
                        <img src="https://cryptologos.cc/logos/solana-sol-logo.png?v=024" alt="SOL" className="w-12 h-12 mb-2" />
                        <h4 className="text-lg font-semibold text-white">SOL</h4>
                        <p className="text-gray-300">Balance: {solBalance !== null ? solBalance.toFixed(2) : 'Loading...'}</p>
                    </div>
                    {tokenAccounts.map((token, index) => (
                        <div key={index} className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 p-4 rounded-lg border border-gray-600">
                            <img src={token.logo} alt={token.symbol} className="w-12 h-12 mb-2" />
                            <h4 className="text-lg font-semibold text-white">{token.symbol}</h4>
                            <p className="text-gray-300">Balance: {token.balance.toFixed(2)}</p>
                            <p className="text-gray-400 text-sm">{token.name}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="lg:w-2/3 bg-gray-800 rounded-lg p-6 space-y-4">
                <h3 className="text-2xl font-semibold text-white mb-4">Actions</h3>
                <div className="flex space-x-4">
                    <button
                        onClick={() => setAction('deposit')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        Deposit
                    </button>
                    <button
                        onClick={() => setAction('withdraw')}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        Withdraw
                    </button>
                </div>
                {renderActionForm()}
                {error && (
                    <div className="mt-4 bg-red-900 text-red-200 p-4 rounded-md">
                        <p className="font-semibold">Error</p>
                        <p className="text-sm">{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WalletBalanceManager;