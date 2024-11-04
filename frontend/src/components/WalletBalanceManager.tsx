import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { depositSol, withdrawSol, depositToken, withdrawToken } from '../utils/smartWalletInteractions';
import { ConnectionManager } from '../utils/ConnectionManager';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import LoadingButton from './LoadingButton';
import { fetchLatestBalance, TokenProgram } from '../store/smartWalletSlice';
import { ThunkDispatch } from 'redux-thunk';
import BalanceLoader from './BalanceLoader';
import { addNotificationWithTimeout } from '../store/notificationSlice';
import TokenSelectModal from './TokenSelectModal';
import { fetchTokensMetadata } from '../store/tokenMetadataSlice';

interface WalletBalanceManagerProps {
    onSuccess: (signature: string) => void;
    onError: (errorMessage: string) => void;
}

const WalletBalanceManager: React.FC<WalletBalanceManagerProps> = ({ onSuccess, onError }) => {
    const connection  = ConnectionManager.getInstance().getConnection();
    const program = useSelector((state: RootState) => state.connection.programId);
    const programId = useMemo(() => new PublicKey(program), [program]);
    const wallet = useWallet();
    const smartWalletTokens = useSelector((state: RootState) => state.smartWallet.tokens);
    const walletTokens = useSelector((state: RootState) => state.wallet.tokens);

    const [selectedDepositToken, setSelectedDepositToken] = useState<string>(PublicKey.default.toString());
    const [selectedWithdrawToken, setSelectedWithdrawToken] = useState<string>(PublicKey.default.toString());
    const [depositAmount, setDepositAmount] = useState<string>('');
    const [withdrawAmount, setWithdrawAmount] = useState<string>('');
    const [action, setAction] = useState<'deposit' | 'withdraw' | null>(null);
    const [isDepositing, setIsDepositing] = useState(false);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const isLoadingBalance = useSelector((state: RootState) => state.smartWallet.loadingBalance);
    const tokenMetadata = useSelector((state: RootState) => state.tokenMetadata.metadata);
    const dispatch = useDispatch<ThunkDispatch<RootState, any, any>>();
    const showNotification = useCallback((message: string, type: 'success' | 'error') => {
        dispatch(addNotificationWithTimeout({
            notification: {
                message,
                type
            },
            timeout: 5000
        }));
    }, [dispatch]);

    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

    useEffect(() => {
        dispatch(fetchTokensMetadata([...smartWalletTokens, ...walletTokens]));
    }, [smartWalletTokens, walletTokens, dispatch]);

    const handleDeposit = async () => {
        if (!wallet.publicKey) {
            showNotification("Wallet not connected", "error");
            return;
        }

        setIsDepositing(true);

        try {
            let transactionBase64: string;
            if (selectedDepositToken === PublicKey.default.toString()) {
                transactionBase64 = await depositSol(connection, programId, wallet.publicKey, parseFloat(depositAmount));
                console.log("In depositSol");
            } else {
                const tokenMint = new PublicKey(selectedDepositToken);
                const tokenInfo = walletTokens.find(token => token.mint === selectedDepositToken);
                if(!tokenInfo) {
                    throw new Error('Token information not found');
                }
                const tokenProgramId = tokenInfo.tokenProgram === TokenProgram.SPL ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
                console.log("tokenProgramId", tokenProgramId.toString());
                const userATA = await getAssociatedTokenAddress(tokenMint, wallet.publicKey, true, tokenProgramId);

                if(!tokenInfo) {
                    throw new Error('Token information not found');
                }
                console.log("In depositToken", programId.toString());
                transactionBase64 = await depositToken(connection, programId, wallet.publicKey, tokenMint, userATA, parseFloat(depositAmount), tokenInfo.decimals, tokenInfo.tokenProgram);
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
                showNotification(`Deposit successful. Transaction signature: ${signature}`, "success");
                onSuccess(signature);
                dispatch(fetchLatestBalance());
                setDepositAmount('');
            } else {
                console.error('Wallet does not support signing transactions');
                onError("Wallet does not support signing transactions");
            }
        } catch (err) {
            console.error('Error depositing:', err);
            (err as any).getLogs().then((logs: any) => {
                console.log(logs);
            });
            showNotification(`Failed to deposit: ${err instanceof Error ? err.message : String(err)}`, "error");
            onError(`Failed to deposit: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsDepositing(false);
        }
    };

    const handleWithdraw = async () => {
        if (!wallet.publicKey) {
            showNotification("Wallet not connected", "error");
            return;
        }

        setIsWithdrawing(true);

        try {
            let transactionBase64: string;
            if (selectedWithdrawToken === PublicKey.default.toString()) {
                transactionBase64 = await withdrawSol(connection, programId, wallet.publicKey, parseFloat(withdrawAmount));
            } else {
                console.log("In withdrawToken", programId.toString(), selectedWithdrawToken);
                const tokenMint = new PublicKey(selectedWithdrawToken);
                const tokenInfo = smartWalletTokens.find(token => token.mint === selectedWithdrawToken);
            
                if(!tokenInfo) {
                    throw new Error('Token information not found');
                }

                const tokenProgramId = tokenInfo.tokenProgram === TokenProgram.SPL ? TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID;
                const userATA = await getAssociatedTokenAddress(tokenMint, wallet.publicKey, true, tokenProgramId);
          

                transactionBase64 = await withdrawToken(connection, programId, wallet.publicKey, tokenMint, userATA, parseFloat(withdrawAmount),tokenInfo.decimals, tokenInfo.tokenProgram);
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
                showNotification(`Withdrawal successful. Transaction signature: ${signature}`, "success");
                setWithdrawAmount('');
                onSuccess(signature);
                dispatch(fetchLatestBalance());
            } else {
                console.error('Wallet does not support signing transactions');
                onError("Wallet does not support signing transactions");
            }
        } catch (err) {
            console.error('Error withdrawing:', err);
            (err as any).getLogs().then((logs: any) => {
                console.log(logs);
            });

            showNotification(`Failed to withdraw: ${err instanceof Error ? err.message : String(err)}`, "error");
            onError(`Failed to withdraw: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsWithdrawing(false);
        }
    };

    const renderActionForm = () => {
        if (!action) return null;

        const availableTokens = action === 'deposit' ? walletTokens : smartWalletTokens;
        const selectedToken = action === 'deposit' ? selectedDepositToken : selectedWithdrawToken;
        const selectedTokenInfo = availableTokens.find(token => token.mint === selectedToken);

        return (
            <div className="mt-4 bg-gray-800 p-6 rounded-lg shadow-inner">
                <h3 className="text-xl font-semibold text-white mb-4 capitalize">{action}</h3>
                <div className="relative mb-4">
                    <div className="flex items-center bg-gray-700 rounded-md">
                        <button
                            onClick={() => action === 'deposit' ? setIsDepositModalOpen(true) : setIsWithdrawModalOpen(true)}
                            className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-500 rounded-l-md px-4 py-2 text-white"
                        >
                            {selectedTokenInfo && (
                                <>
                                    <img src={tokenMetadata[selectedToken]?.image || "/unknown-token.svg"} alt={tokenMetadata[selectedToken]?.symbol || "Unknown"} className="w-6 h-6 rounded-full" />
                                    <span>{tokenMetadata[selectedToken]?.symbol || "Unknown"}</span>
                                </>
                            )}
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <input
                            type="text"
                            placeholder="Amount"
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
                        {isLoadingBalance ? (
                            <BalanceLoader />
                        ) : (
                            smartWalletTokens.map((token, index) => (
                                <div key={index} className="flex items-center justify-between p-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-800 transition duration-150 ease-in-out rounded-md">
                                    <div className="flex items-center space-x-3 flex-grow">
                                        <img src={tokenMetadata[token.mint]?.image || "/unknown-token.svg"} alt={tokenMetadata[token.mint]?.symbol || "Unknown"} className="w-8 h-8 rounded-full" />
                                        <span className="text-gray-200 font-semibold text-lg truncate">{tokenMetadata[token.mint]?.symbol || "Unknown"}</span>
                                    </div>
                                    <span className="text-gray-200 font-medium text-base whitespace-nowrap">{token.uiAmount?.toFixed(4) || 'Loading...'}</span>
                                </div>
                            ))
                        )}
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
            
            <TokenSelectModal
                isOpen={isDepositModalOpen}
                onClose={() => setIsDepositModalOpen(false)}
                onSelect={(token) => {
                    setSelectedDepositToken(token.mint);
                    console.log("Selected deposit token", token.mint);
                }}
                title="Select Token to Deposit"
                modalType="wallet"
            />
            
            <TokenSelectModal
                isOpen={isWithdrawModalOpen}
                onClose={() => setIsWithdrawModalOpen(false)}
                onSelect={(token) => setSelectedWithdrawToken(token.mint)}
                title="Select Token to Withdraw"
                modalType="smartWallet"
            />
        </div>
    );
};

export default WalletBalanceManager;
