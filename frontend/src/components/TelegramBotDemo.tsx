import React, { useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { PublicKey } from '@solana/web3.js';
import { approveDapp } from '../utils/smartWalletInteractions';
import LoadingButton from './LoadingButton';
import { useWallet } from '@solana/wallet-adapter-react';
import { ConnectionManager } from '../utils/ConnectionManager';
import { DateTime } from 'luxon';
import { fetchLatestApprovedDapps } from '../store/smartWalletSlice';
import { ThunkDispatch } from 'redux-thunk';
import { addNotificationWithTimeout } from '../store/notificationSlice';

const TelegramBotDemo: React.FC = () => {
    const wallet = useWallet();
    const connection = ConnectionManager.getInstance().getConnection();
    const [isApproving, setIsApproving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showApprovalForm, setShowApprovalForm] = useState(false);
    const [maxAmount, setMaxAmount] = useState<string>('1');
    const [expiryDate, setExpiryDate] = useState<string>(
        DateTime.now().plus({ year: 1 }).toFormat("yyyy-MM-dd'T'HH:mm")
    );
    const dispatch = useDispatch<ThunkDispatch<RootState, any, any>>();
    const smartWalletId = useSelector((state: RootState) => state.smartWallet.address);
    const userPublicKey = useSelector((state: RootState) => state.wallet.publicKey);
    const approvedDapps = useSelector((state: RootState) => state.smartWallet.approvedDapps);
    const program = useSelector((state: RootState) => state.connection.programId);
    const PROGRAM_ID = useMemo(() => new PublicKey(program), [program]);

    const isTelegramBotApproved = approvedDapps.some(dapp => dapp.dapp === 'CXia64u8Ku8pYkun12Au4mtd3bfqYGhd6sSQC6H84WXW');
    const telegramBotPublicKey = 'CXia64u8Ku8pYkun12Au4mtd3bfqYGhd6sSQC6H84WXW';

    const steps = [
        { // Step 1: Searching for the bot in Telegram.
            number: '1',
            title: 'Open Telegram and search for @smartWallletBot',
            description: (
                <p className="ml-0">
                    You can click the link to open the bot 👉
                    <a href="https://t.me/smartWallletBot" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-300">
                        @smartWallletBot
                    </a>
                </p>
            ),
        },
        { // Step 2: Setting up the smart wallet with a specific command.
            number: '2',
            title: 'Set the smart wallet using command /setwallet SMART_WALLET_ID PUBLIC_KEY',
            command: (
                <code className="bg-gray-700 rounded-md p-1 break-all">
                    /setwallet {smartWalletId} {userPublicKey}
                </code>
            ),
        },
        { // Step 3: Sending SOL to friends using a command.
            number: '3',
            title: 'Send SOL to friends using command /send SOL_AMOUNT TO_PUBLIC_KEY',
            command: (
                <code className="bg-gray-700 rounded-md p-1 break-all">
                    /sendsol 1.5 {userPublicKey}
                </code>
            ),
        },
    ];


    const handleApproveTelegramBot = async () => {
        if (!wallet.publicKey || !wallet.signTransaction) {
            setError("Wallet not connected or doesn't support signing");
            return;
        }

        setIsApproving(true);
        setError(null);
        setSuccess(null);

        try {
            const botPublicKey = new PublicKey(telegramBotPublicKey);
            const maxAmountValue = parseFloat(maxAmount);
            const expiryTimestamp = DateTime.fromISO(expiryDate).toUnixInteger();

            const transaction = await approveDapp(
                connection,
                PROGRAM_ID,
                wallet.publicKey,
                botPublicKey,
                PublicKey.default,
                maxAmountValue,
                expiryTimestamp,
                9
            );

            const signedTx = await wallet.signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signedTx.serialize());

            await connection.confirmTransaction({
                signature,
                ...(await connection.getLatestBlockhash()),
            });

            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/dapp`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        walletKey: smartWalletId,
                        dAppId: telegramBotPublicKey,
                        mintId: PublicKey.default.toString(),
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`Failed to save approval`);
                }

                const result = await response.json();
                dispatch(fetchLatestApprovedDapps());
                dispatch(addNotificationWithTimeout({
                    notification: {
                        message: "Approval saved successfully",
                        type: "success"
                    },
                    timeout: 5000
                }));
                console.log('Approval saved successfully:', result);
            } catch (apiError) {
                console.error('Error saving approval:', apiError);
                dispatch(addNotificationWithTimeout({
                    notification: {
                        message: `Failed to save approval}`,
                        type: "error"
                    },
                    timeout: 5000
                }));
                setError(`Failed to save approval: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
                return;
            }

            setSuccess(`Telegram bot approved successfully!`);
            setShowApprovalForm(false);
        } catch (err) {
            dispatch(addNotificationWithTimeout({
                notification: {
                    message: `Failed to approve Telegram bot: ${err instanceof Error ? err.message : String(err)}`,
                    type: "error"
                },
                timeout: 5000
            }));
            console.error('Error approving Telegram bot:', err);
            setError(`Failed to approve Telegram bot: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsApproving(false);
        }
    };

    const renderApprovalForm = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        dApp Public Key to Approve
                    </label>
                    <input
                        type="text"
                        value={telegramBotPublicKey}
                        readOnly
                        className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-2 rounded-md border border-gray-600 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Approval Amount (SOL)
                    </label>
                    <input
                        type="number"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        min="0"
                        step="0.1"
                        className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-2 rounded-md border border-gray-600"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Approval Type
                    </label>
                    <input
                        type="text"
                        value="SOL"
                        readOnly
                        className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-2 rounded-md border border-gray-600 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Expiry Date and Time
                    </label>
                    <input
                        type="datetime-local"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-2 rounded-md border border-gray-600"
                    />
                </div>
            </div>
            <LoadingButton
                onClick={handleApproveTelegramBot}
                isLoading={isApproving}
                text="Approve Telegram Bot"
                loadingText="Approving..."
                className="w-full bg-white text-black hover:bg-gray-200 font-medium py-2 px-6 rounded-md transition duration-300 ease-in-out transform hover:scale-105"
            />
        </div>
    );

    return (
        <div className="bg-gray-900 bg-opacity-50 rounded-lg p-8 border border-gray-800 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4 text-white">Telegram Bot Integration</h2>
            <p className="text-gray-300 mb-6">
                Approve the Telegram bot @smartWallletBot to send SOL on your behalf. This allows you to interact with your Smart Wallet through Telegram without
                having to sign every transaction.
            </p>

            {isTelegramBotApproved ? (
                <div className="bg-green-900 bg-opacity-50 text-green-200 p-4 rounded-lg mb-6">
                    ✅ Telegram bot is approved! You can now use it to send SOL.

                </div>
            ) : showApprovalForm ? (
                renderApprovalForm()
            ) : (
                <LoadingButton
                    onClick={() => setShowApprovalForm(true)}
                    isLoading={false}
                    text="Approve Telegram Bot"
                    className="w-full bg-white text-black hover:bg-gray-200 font-medium py-2 px-6 rounded-md transition duration-300 ease-in-out transform hover:scale-105 mb-6"
                />
            )}

            {error && (
                <div className="bg-red-900 bg-opacity-50 text-red-200 p-4 rounded-lg mb-6 relative">
                    <button
                        onClick={() => setError(null)}
                        className="absolute top-2 right-2 text-red-200 hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                    ❌ {error}
                </div>
            )}

            {success && (
                <div className="bg-green-900 bg-opacity-50 text-green-200 p-4 rounded-lg mb-6 relative">
                    <button
                        onClick={() => setSuccess(null)}
                        className="absolute top-2 right-2 text-green-200 hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                    ✅ {success}
                </div>
            )}

            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-6 border border-gray-700">
                {/* Header explaining what the section is about */}
                <h3 className="text-xl font-semibold mb-4 text-white">How to use the Telegram Bot</h3>
                <div className="flex flex-col space-y-4"> {/* Main container for all steps, ensuring each step is spaced appropriately */}
                    {steps.map((step, index) => (
                        <div key={index} className="flex space-x-4 items-start flex-wrap"> {/* Container for each individual step with flex-wrap for responsiveness */}
                            {/* Icon for the step number */}
                            <div className="bg-gray-500 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                                <h2 className="text-white text-lg font-semibold">{step.number}</h2>
                            </div>
                            {/* Step details: title, description, command */}
                            <div className="border-b-lime-600 flex-1 flex flex-col text-left break-words">
                                <div>
                                    <h3 className="text-lg font-semibold break-words">{step.title}</h3> {/* Step title */}
                                </div>
                                {step.description && (
                                    <div className="mt-1 break-words">
                                        {step.description} {/* Optional description for the step */}
                                    </div>
                                )}
                                {step.command && (
                                    <div className="mt-2">
                                        {step.command} {/* Optional command code for the step */}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>


        </div>
    );
};

export default TelegramBotDemo;
