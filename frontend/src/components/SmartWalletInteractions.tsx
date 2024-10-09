import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  createWalletInstruction,
  approveDappInstruction,
  executeTransactionInstruction,
  TransferType,
  serializeWalletInstruction
} from '../walletInteractions';
import { Transaction, PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import WalletBalanceManager from './WalletBalanceManager';
import { DateTime } from 'luxon';
import { TOKEN_PROGRAM_ID, getMint } from '@solana/spl-token';

const SmartWalletInteractions: React.FC = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [txid, setTxid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [maxAmount, setMaxAmount] = useState<string>('');
  const [expiry, setExpiry] = useState<string>(DateTime.now().plus({ years: 1 }).toISO());
  const [amount, setAmount] = useState<string>('');
  const [transferType, setTransferType] = useState<TransferType>(TransferType.Sol);
  const [recipient, setRecipient] = useState<string>('');
  const [walletOwner, setWalletOwner] = useState<string>('');
  const [dappToApprove, setDappToApprove] = useState<string>('');

  const [hasSmartWallet, setHasSmartWallet] = useState<boolean | null>(null);
  const [smartWalletId, setSmartWalletId] = useState<string | null>(null);
  const [approvedDapps, setApprovedDapps] = useState<Array<{
    dapp: string;
    tokenMint: string;
    maxAmount: string;
    expiry: string;
  }>>([]);

  const PROGRAM_ID = new PublicKey('5UwRT1ngPvSWjUWYcCoRmwVTs5WFUgdDfAW29Ab5XMx2');

  const [expiryDateTime, setExpiryDateTime] = useState<string>(
    DateTime.now().plus({ years: 1 }).toFormat("yyyy-MM-dd'T'HH:mm")
  );

  const [approvalType, setApprovalType] = useState<'SOL' | 'Token'>('SOL');
  const [tokenMint, setTokenMint] = useState<string>('');
  const [userTokens, setUserTokens] = useState<Array<{ mint: string, balance: string, decimals: number }>>([]);

  const [approvalAmount, setApprovalAmount] = useState<string>('');

  useEffect(() => {
    if (wallet.publicKey) {
      checkSmartWallet();
      fetchApprovedDapps();
      fetchUserTokens();
    }
  }, [wallet.publicKey, smartWalletId,connection]);

  const checkSmartWallet = async () => {
    if (!wallet.publicKey) return;

    try {
      const [walletAddress, _] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), wallet.publicKey.toBuffer()],
        PROGRAM_ID
      );

      const accountInfo = await connection.getAccountInfo(walletAddress);
      setHasSmartWallet(accountInfo !== null);
      if (accountInfo !== null) {
        setSmartWalletId(walletAddress.toBase58());
      }
    } catch (err) {
      console.error('Error checking smart wallet:', err);
      setHasSmartWallet(false);
      setSmartWalletId(null);
    }
  };

  const fetchApprovedDapps = async () => {
    try {
      if (!wallet.publicKey) return;    

      const DAPP_APPROVAL_SIZE = 49; // Size of the approval account

      const approvals = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { dataSize: DAPP_APPROVAL_SIZE },
        ],
      });

      console.log('Approvals:', approvals);

      const [smartWalletPubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), wallet.publicKey.toBuffer()],
        PROGRAM_ID
      );

      const approvedDapps = approvals.filter(({ pubkey, account }) => {
        const dappPubkey = new PublicKey(account.data.subarray(0, 32));
        const tokenMintPubkey = new PublicKey(account.data.subarray(32, 64));
        const [derivedAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from("approval"), smartWalletPubkey.toBuffer(), dappPubkey.toBuffer(), tokenMintPubkey.toBuffer()],
          PROGRAM_ID
        );
        return derivedAddress.equals(pubkey);
      }).map(({ account }) => {
        const dappPubkey = new PublicKey(account.data.subarray(32, 64));
        const tokenMint = new PublicKey(account.data.subarray(64, 96));
        const maxAmount = account.data.readBigUInt64LE(96);
        const expiry = account.data.readBigInt64LE(104);

        return {
          dapp: dappPubkey.toBase58(),
          tokenMint: tokenMint.toBase58(),
          maxAmount: maxAmount.toString(),
          expiry: new Date(Number(expiry) * 1000).toISOString(),
        };
      });

      setApprovedDapps(approvedDapps);
    } catch (err) {
      console.error('Error fetching approved dapps:', err);
    }
  };

  const fetchUserTokens = async () => {

    console.log('Fetching user tokens for', smartWalletId);
    if (!wallet.publicKey || !smartWalletId) return;

    try {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(new PublicKey(smartWalletId), {
        programId: TOKEN_PROGRAM_ID,
      });

      console.log('Token accounts:', tokenAccounts);

      const tokens = tokenAccounts.value.map(accountInfo => ({
        mint: accountInfo.account.data.parsed.info.mint,
        balance: accountInfo.account.data.parsed.info.tokenAmount.uiAmountString,
        decimals: accountInfo.account.data.parsed.info.tokenAmount.decimals,  
      }));

      setUserTokens(tokens);
    } catch (error) {
      console.error('Error fetching user tokens:', error);
    }
  };

  const handleCreateWallet = async () => {
    if (!wallet.publicKey) {
      setError("Wallet not connected");
      return;
    }

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
      setSmartWalletId(walletAddress.toBase58());
      setHasSmartWallet(true);
    } catch (err) {
      console.error('Error creating wallet:', err);
      setError(`Failed to create wallet: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleApproveDapp = async () => {
    if (!wallet.publicKey || !smartWalletId) {
      setError("Wallet not connected");
      return;
    }

    try {
      console.log('Approving dApp for', wallet.publicKey.toBase58());

      const dappPublicKey = new PublicKey(dappToApprove);
      const mintPublicKey = approvalType === 'Token' ? new PublicKey(tokenMint) : PublicKey.default;

      let amountToApprove: bigint;

      if (approvalType === 'SOL') {
        // Convert SOL to lamports
        amountToApprove = BigInt(Math.floor(parseFloat(approvalAmount) * 1e9));
      } else {
        // Find the selected token in userTokens
        const selectedToken = userTokens.find(token => token.mint === tokenMint);
        if (!selectedToken) {
          throw new Error("Selected token not found in user's tokens");
        }

        // Use the decimals information from the token
        const tokenDecimals = selectedToken.decimals;

        // Convert token amount to smallest units
        amountToApprove = BigInt(Math.floor(parseFloat(approvalAmount) * 10 ** tokenDecimals));

      }

      // Derive the wallet address (PDA)
      const [walletAddress, _] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), wallet.publicKey.toBuffer()],
        PROGRAM_ID
      );

      console.log('Wallet address:', walletAddress.toBase58());

      // Derive the approval account address
      const [approvalAddress, __] = PublicKey.findProgramAddressSync(
        [Buffer.from("approval"), walletAddress.toBuffer(), dappPublicKey.toBuffer(), mintPublicKey.toBuffer()],
        PROGRAM_ID
      );

      console.log('Approval address:', approvalAddress.toBase58());

      // Convert the selected date and time to a Unix timestamp
      const expiryTimestamp = DateTime.fromISO(expiryDateTime).toUnixInteger();

      // Create the instruction data for dApp approval
      const instruction = approveDappInstruction(amountToApprove, expiryTimestamp);
      const instructionBuffer = serializeWalletInstruction(instruction);

      // Create the instruction to approve the dApp
      const approveDappIx = new TransactionInstruction({
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: walletAddress, isSigner: false, isWritable: false },
          { pubkey: dappPublicKey, isSigner: false, isWritable: false },
          { pubkey: mintPublicKey, isSigner: false, isWritable: false },
          { pubkey: approvalAddress, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(instructionBuffer)
      });

      const latestBlockhash = await connection.getLatestBlockhash();
      
      const transaction = new Transaction().add(approveDappIx);
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
      console.error('Error approving dApp:', err);
      setError(`Failed to approve dApp: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleExecuteTransaction = async () => {
    if (!wallet.publicKey) {
      setError("Wallet not connected");
      return;
    }

    try {
      const recipientPubkey = new PublicKey(recipient);
      const walletOwnerPubkey = new PublicKey(walletOwner);
      const instruction = executeTransactionInstruction(BigInt(amount), transferType);
      
      // Derive the wallet address (PDA) for the wallet owner
      const [walletAddress, _] = PublicKey.findProgramAddressSync(
        [Buffer.from("wallet"), walletOwnerPubkey.toBuffer()],
        PROGRAM_ID
      );

      // Derive the approval account address
      const [approvalAddress, __] = PublicKey.findProgramAddressSync(
        [Buffer.from("approval"), walletAddress.toBuffer(), wallet.publicKey.toBuffer(), PublicKey.default.toBuffer()],
        PROGRAM_ID
      );

      const transaction = new Transaction().add(
        new TransactionInstruction({
          keys: [
            { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // Current user (acting as dApp)
            { pubkey: walletOwnerPubkey, isSigner: false, isWritable: false }, // Wallet owner
            { pubkey: walletAddress, isSigner: false, isWritable: true },
            { pubkey: approvalAddress, isSigner: false, isWritable: true },
            { pubkey: recipientPubkey, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId: PROGRAM_ID,
          data: Buffer.from(serializeWalletInstruction(instruction)),
        })
      );

      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = wallet.publicKey;

      if (!wallet.signTransaction) {
        throw new Error('Wallet does not support signing transactions');
      }
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature);
      setTxid(signature);
      setError(null);
    } catch (err) {
      console.error('Error executing transaction:', err);
      setError(`Failed to execute transaction: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="space-y-8">
      {!hasSmartWallet && (
        <div className="bg-gray-900 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-lg p-8 border border-gray-800 shadow-xl">
          <h2 className="text-3xl font-semibold mb-4 text-white">Create Your Smart Wallet</h2>
          <p className="mb-6 text-gray-300">Get started with your own Smart Wallet to manage digital assets securely.</p>
          <button onClick={handleCreateWallet} className="bg-white text-black hover:bg-gray-200 font-medium py-2 px-6 rounded-md transition duration-300 ease-in-out transform hover:scale-105">
            Create Smart Wallet
          </button>
        </div>
      )}

      {hasSmartWallet && (
        <>
          <div className="bg-gray-900 bg-opacity-50 rounded-lg p-8 border border-gray-800 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4 text-white">Smart Wallet Information</h2>
            <p className="text-gray-300">Smart Wallet ID: {smartWalletId}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-900 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-lg p-8 border border-gray-800 shadow-xl">
              <h2 className="text-2xl font-semibold mb-4 text-white">Wallet Balance</h2>
              <WalletBalanceManager programId={PROGRAM_ID} />
            </div>
            <div className="bg-gray-900 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-lg p-8 border border-gray-800 shadow-xl">
              <h2 className="text-2xl font-semibold mb-4 text-white">Quick Actions</h2>
              <div className="flex space-x-4">
                <button className="bg-white text-black hover:bg-gray-200 font-medium py-2 px-6 rounded-md transition duration-300 ease-in-out transform hover:scale-105">
                  Send
                </button>
                <button className="bg-black text-white hover:bg-gray-800 font-medium py-2 px-6 rounded-md transition duration-300 ease-in-out transform hover:scale-105 border border-white">
                  Receive
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-lg p-8 border border-gray-800 shadow-xl">
            <h2 className="text-2xl font-semibold mb-6 text-white">Approve dApp</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <input
                type="text"
                placeholder="dApp Public Key to Approve"
                value={dappToApprove}
                onChange={(e) => setDappToApprove(e.target.value)}
                className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
              />
              <input
                type="text"
                placeholder="Approval Amount"
                value={approvalAmount}
                onChange={(e) => setApprovalAmount(e.target.value)}
                className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <select
                value={approvalType}
                onChange={(e) => {
                  setApprovalType(e.target.value as 'SOL' | 'Token');
                  if (e.target.value === 'SOL') {
                    setTokenMint('');
                  }
                }}
                className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
              >
                <option value="SOL">SOL</option>
                <option value="Token">Token</option>
              </select>
              {approvalType === 'Token' && (
                <select
                  value={tokenMint}
                  onChange={(e) => setTokenMint(e.target.value)}
                  className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
                >
                  <option value="">Select a token</option>
                  {userTokens.map((token) => (
                    <option key={token.mint} value={token.mint}>
                      {token.mint} (Balance: {token.balance})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="mb-6">
              <label htmlFor="expiryDateTime" className="block text-sm font-medium text-gray-400 mb-2">
                Expiry Date and Time
              </label>
              <input
                id="expiryDateTime"
                type="datetime-local"
                value={expiryDateTime}
                onChange={(e) => setExpiryDateTime(e.target.value)}
                className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
                style={{colorScheme: 'dark'}}
              />
            </div>
            <button onClick={handleApproveDapp} className="w-full bg-white text-black hover:bg-gray-200 font-medium py-3 px-6 rounded-md transition duration-300 ease-in-out transform hover:scale-105">
              Approve dApp
            </button>
          </div>

          <div className="bg-gray-900 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-lg p-8 border border-gray-800 shadow-xl">
            <h2 className="text-2xl font-semibold mb-6 text-white">Execute Transaction (as approved dApp)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <input
                type="text"
                placeholder="Wallet Owner Public Key"
                value={walletOwner}
                onChange={(e) => setWalletOwner(e.target.value)}
                className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
              />
              <input
                type="text"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <select
                value={transferType}
                onChange={(e) => setTransferType(parseInt(e.target.value) as TransferType)}
                className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
              >
                <option value={TransferType.Sol}>SOL</option>
                <option value={TransferType.Token}>Token</option>
              </select>
              <input
                type="text"
                placeholder="Recipient Public Key"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
              />
            </div>
            <button onClick={handleExecuteTransaction} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-md transition duration-300 ease-in-out transform hover:scale-105">
              Execute Transaction
            </button>
          </div>

          <div className="bg-gray-900 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-lg p-8 border border-gray-800 shadow-xl">
            <h2 className="text-2xl font-semibold mb-6 text-white">Approved dApps</h2>
            {approvedDapps.length > 0 ? (
              <div className="space-y-4">
                {approvedDapps.map((dapp, index) => (
                  <div key={index} className="bg-gray-700 bg-opacity-50 p-4 rounded-md border border-gray-600">
                    <p className="text-white font-semibold">dApp: {dapp.dapp}</p>
                    <p className="text-gray-300">Token Mint: {dapp.tokenMint}</p>
                    <p className="text-gray-300">Max Amount: {dapp.maxAmount}</p>
                    <p className="text-gray-300">Expiry: {dapp.expiry}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center">No approved dApps yet</p>
            )}
          </div>
        </>
      )}

      {txid && (
        <div className="bg-green-900 bg-opacity-50 text-green-200 p-6 rounded-lg border border-green-700 shadow-xl">
          <h3 className="text-xl font-semibold mb-2">Transaction Successful</h3>
          <p className="text-sm break-all">ID: {txid}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-900 bg-opacity-50 text-red-200 p-6 rounded-lg border border-red-700 shadow-xl">
          <h3 className="text-xl font-semibold mb-2">Error</h3>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default SmartWalletInteractions;