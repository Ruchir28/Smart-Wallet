import React, { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  createWalletInstruction,
  serializeWalletInstruction,
} from '../walletInteractions';
import { Transaction, PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import WalletBalanceManager from './WalletBalanceManager';
import { sendSol, sendToken } from '../utils/smartWalletInteractions';
import { RootState } from '../store/store';
import { useDispatch, useSelector } from 'react-redux';
import { setPublicKey } from '../store/walletSlice';
import { ConnectionManager } from '../utils/ConnectionManager';
import ApproveDappForm from './ApproveDappForm';
import LoadingButton from './LoadingButton';
import { DateTime } from 'luxon';
import Loader from './Loader';

const SmartWalletInteractions: React.FC = () => {
  const connection = ConnectionManager.getInstance().getConnection();
  const wallet = useWallet();
  const dispatch = useDispatch();

  const [txid, setTxid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'balance' | 'approve' | 'send'>('balance');

  const [sendAmount, setSendAmount] = useState<string>('');
  const [sendRecipient, setSendRecipient] = useState<string>('');
  const [sendTokenMint, setSendTokenMint] = useState<string>('');
  const [sendType, setSendType] = useState<'SOL' | 'Token'>('SOL');

  const hasSmartWallet = useSelector((state: RootState) => state.smartWallet.initialized);
  const isLoading = useSelector((state: RootState) => state.smartWallet.isLoading);
  const smartWalletId = useSelector((state: RootState) => state.smartWallet.address);
  const approvedDapps = useSelector((state: RootState) => state.smartWallet.approvedDapps);
  const userTokens = useSelector((state: RootState) => state.smartWallet.tokens);

  const program = useSelector((state: RootState) => state.connection.programId);
  const PROGRAM_ID = useMemo(() => new PublicKey(program), [program]);

  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if(wallet.publicKey) {
      dispatch(setPublicKey(wallet.publicKey.toString()));
    }
  },[wallet.publicKey]);

  const handleCreateWallet = async () => {
    if (!wallet.publicKey) {
      setError("Wallet not connected");
      return;
    }

    setIsCreatingWallet(true);

    try {
      console.log('Creating wallet for', wallet.publicKey.toBase58());

      // Derive the wallet address (PDA)
      const [walletAddress, _] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), wallet.publicKey.toBuffer()],
        PROGRAM_ID
      );

      console.log('Derived wallet address:', walletAddress.toBase58());

      // Create the instruction data for wallet initialization
      const instruction = createWalletInstruction();
      const serializedInstruction = serializeWalletInstruction(instruction);

      // Create the instruction to initialize the wallet in the program
      const createWalletIx = new TransactionInstruction({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: walletAddress, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(serializedInstruction)
      });

      const latestBlockhash = await connection.getLatestBlockhash();
      
      const transaction = new Transaction().add(createWalletIx);
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = latestBlockhash.blockhash;

      if (!wallet.signTransaction) {
        throw new Error('Wallet does not support signing transactions');
      }

      const signedTransaction = await wallet.signTransaction(transaction);
      console.log('Transaction signed');

      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      console.log('Transaction sent. Signature:', signature);

      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      });

      console.log('Transaction confirmed');
      setTxid(signature);
      setError(null);
    } catch (err) {
      console.error('Error creating wallet:', err);
      setError(`Failed to create wallet: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsCreatingWallet(false);
    }
  };

  const handleSend = async () => {
    if (!wallet.publicKey || !smartWalletId) {
      setError("Wallet not connected or Smart Wallet not created");
      return;
    }

    setIsSending(true);

    try {
      const amount = parseFloat(sendAmount);
      const recipientPublicKey = new PublicKey(sendRecipient);

      let transaction: string;

      if (sendType === 'SOL') {
        transaction = await sendSol(
          connection,
          PROGRAM_ID,
          wallet.publicKey,
          recipientPublicKey,
          amount,

        );
      } else {
        const tokenInfo = userTokens.find(token => token.mint === sendTokenMint);
        if (!tokenInfo) {
          throw new Error('Token information not found');
        }
        const decimals = tokenInfo.decimals;
        const tokenMintPublicKey = new PublicKey(sendTokenMint);
        transaction = await sendToken(
          connection,
          PROGRAM_ID,
          wallet.publicKey,
          tokenMintPublicKey,
          recipientPublicKey,
          amount,
          decimals
        );
      }

      // Sign and send the transaction
      const tx = Transaction.from(Buffer.from(transaction, 'base64'));
      if (!wallet.signTransaction) {
        throw new Error('Wallet does not support signing transactions');
      }
      const signedTx = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      });

      setTxid(signature);
      setError(null);
      setSendAmount('');
      setSendRecipient('');
      setSendTokenMint('');
    } catch (err) {
      console.error('Error sending assets:', err);
      setError(`Failed to send assets: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSending(false);
    }
  };

  const renderBalanceTab = () => (
    <div className="space-y-8">
      <div className="bg-gray-900 bg-opacity-50 rounded-lg p-8 border border-gray-800 shadow-xl">
        <WalletBalanceManager onSuccess={(signature: string) => {
          setTxid(signature);
          setError(null);
        }} onError={(errorMessage: string) => {
          setError(errorMessage);
          setTxid(null);
        }} />
      </div>
    </div>
  );

  const renderApproveTab = () => (
    <div className="space-y-8">
      <div className="bg-gray-900 bg-opacity-50 rounded-lg p-8 border border-gray-800 shadow-xl">
        <h2 className="text-2xl font-semibold mb-6 text-white">Approve dApp</h2>
        <ApproveDappForm
          onSuccess={(signature) => {
            setTxid(signature);
            setError(null);
          }}
          onError={(errorMessage) => {
            setError(errorMessage);
            setTxid(null);
          }}
        />
      </div>
      <div className="bg-gray-900 bg-opacity-50 rounded-lg p-8 border border-gray-800 shadow-xl">
        <h2 className="text-2xl font-semibold mb-6 text-white">Approved dApps</h2>
        {approvedDapps.length > 0 ? (
          <div className="flex flex-wrap -mx-3">
            {approvedDapps.map((dapp, index) => {
              const tokenInfo = userTokens.find(token => token.mint === dapp.tokenMint);
              const decimals = tokenInfo ? tokenInfo.decimals : 9;
              const maxAmount = parseFloat(dapp.maxAmount) / Math.pow(10, decimals);

              return (
                <div key={index} className="w-full lg:w-1/2 px-3 mb-6">
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-md hover:shadow-lg transition-shadow duration-300 h-full">
                    <h3 className="text-xl font-semibold text-white mb-4 truncate" title={dapp.dapp}>{dapp.dapp}</h3>
                    <div className="space-y-3 text-base">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span className="text-gray-300">
                          <span className="font-medium">Token:</span> {tokenInfo ? tokenInfo.symbol : 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="text-gray-300">
                          <span className="font-medium">Max:</span> {maxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {tokenInfo ? tokenInfo.symbol : ''}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                        <span className="text-gray-300">
                          <span className="font-medium">Mint:</span> 
                          <span className="ml-2 break-all">{`${dapp.tokenMint.slice(0, 4)}...${dapp.tokenMint.slice(-4)}`}</span>
                        </span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="text-gray-300">
                          <span className="font-medium">Expires:</span> {DateTime.fromISO(dapp.expiry).toRelative()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-4">No approved dApps yet</p>
        )}
      </div>
    </div>
  );

  const renderSendTab = () => (
    <div className="bg-gray-900 bg-opacity-50 rounded-lg p-8 border border-gray-800 shadow-xl">
      <h2 className="text-2xl font-semibold mb-4 text-white">Transfer from Smart Wallet</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Amount"
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value)}
            className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
          />
          <input
            type="text"
            placeholder="Recipient Public Key"
            value={sendRecipient}
            onChange={(e) => setSendRecipient(e.target.value)}
            className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={sendType}
            onChange={(e) => setSendType(e.target.value as 'SOL' | 'Token')}
            className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
          >
            <option value="SOL">SOL</option>
            <option value="Token">Token</option>
          </select>
          {sendType === 'Token' && (
            <select
              value={sendTokenMint}
              onChange={(e) => setSendTokenMint(e.target.value)}
              className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
            >
              <option value="">Select a token</option>
              {userTokens.map((token) => (
                <option key={token.mint} value={token.mint}>
                  {token.mint} (Balance: {token.uiAmount})
                </option>
              ))}
            </select>
          )}
        </div>
        <LoadingButton
          onClick={handleSend}
          isLoading={isSending}
          text="Send"
          loadingText="Sending..."
          className="w-full bg-white text-black hover:bg-gray-200 font-medium py-2 px-6 rounded-md transition duration-300 ease-in-out transform hover:scale-105 mt-4"
        />
      </div>
    </div>
  );

  if(isLoading) {
    return <Loader />
  }

  return (
    <div className="space-y-8">
      {!hasSmartWallet ? (
        <div className="bg-gray-900 bg-opacity-50 rounded-lg p-8 border border-gray-800 shadow-xl">
          <h2 className="text-3xl font-semibold mb-4 text-white">Create Your Smart Wallet</h2>
          <p className="mb-6 text-gray-300">Get started with your own Smart Wallet to manage digital assets securely.</p>
          <LoadingButton
            onClick={handleCreateWallet}
            isLoading={isCreatingWallet}
            text="Create Smart Wallet"
            loadingText="Creating Smart Wallet..."
            className="w-full bg-white text-black hover:bg-gray-200 font-medium py-2 px-6 rounded-md transition duration-300 ease-in-out transform hover:scale-105"
          />
        </div>
      ) : (
        <>
            {txid && (
              <div className="bg-green-900 bg-opacity-50 text-green-200 p-6 rounded-lg border border-green-700 shadow-xl relative">
                <button onClick={() => setTxid('')} className="absolute top-2 right-2 text-green-200 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <h3 className="text-xl font-semibold mb-2">Transaction Successful</h3>
                <p className="text-sm break-all">ID: {txid}</p>
              </div>
            )}
            {error && (
              <div className="bg-red-900 bg-opacity-50 text-red-200 p-6 rounded-lg border border-red-700 shadow-xl relative">
                <button onClick={() => setError('')} className="absolute top-2 right-2 text-red-200 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <h3 className="text-xl font-semibold mb-2">Error</h3>
                <p className="text-sm">{error}</p>
              </div>
            )}
          <div className="bg-gray-900 bg-opacity-50 rounded-lg p-8 border border-gray-800 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4 text-white">Smart Wallet Information</h2>
            <p className="text-gray-300">Smart Wallet ID: {smartWalletId}</p>
          </div>

          <div className="bg-gray-900 bg-opacity-50 rounded-lg p-4 border border-gray-800 shadow-xl">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('balance')}
                className={`px-4 py-2 rounded-md ${activeTab === 'balance' ? 'bg-white text-black' : 'bg-gray-700 text-white'}`}
              >
                Balance & Actions
              </button>
              <button
                onClick={() => setActiveTab('approve')}
                className={`px-4 py-2 rounded-md ${activeTab === 'approve' ? 'bg-white text-black' : 'bg-gray-700 text-white'}`}
              >
                Approve dApps
              </button>
              <button
                onClick={() => setActiveTab('send')}
                className={`px-4 py-2 rounded-md ${activeTab === 'send' ? 'bg-white text-black' : 'bg-gray-700 text-white'}`}
              >
                Send
              </button>
            </div>
          </div>

          {activeTab === 'balance' && renderBalanceTab()}
          {activeTab === 'approve' && renderApproveTab()}
          {activeTab === 'send' && renderSendTab()}
        </>
      )}
    </div>
  );
};

export default SmartWalletInteractions;