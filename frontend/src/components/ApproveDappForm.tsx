import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { DateTime } from 'luxon';
import { PublicKey } from '@solana/web3.js';
import { approveDapp } from '../utils/smartWalletInteractions';
import { useWallet } from '@solana/wallet-adapter-react';
import { ConnectionManager } from '../utils/ConnectionManager';
import LoadingButton from './LoadingButton';

interface ApproveDappFormProps {
  onSuccess: (txid: string) => void;
  onError: (error: string) => void;
}

const ApproveDappForm: React.FC<ApproveDappFormProps> = ({ onSuccess, onError }) => {
  const wallet = useWallet();
  const connection = ConnectionManager.getInstance().getConnection();
  const program = useSelector((state: RootState) => state.connection.programId);
  const PROGRAM_ID = useMemo(() => new PublicKey(program), [program]);
  const smartWalletId = useSelector((state: RootState) => state.smartWallet.address);

  const [dappToApprove, setDappToApprove] = useState<string>('');
  const [approvalAmount, setApprovalAmount] = useState<string>('');
  const [approvalType, setApprovalType] = useState<'SOL' | 'Token'>('SOL');
  const [tokenMint, setTokenMint] = useState<string>('');
  const [expiryDateTime, setExpiryDateTime] = useState<string>(
    DateTime.now().plus({ years: 1 }).toFormat("yyyy-MM-dd'T'HH:mm")
  );
  const [isLoading, setIsLoading] = useState(false);

  const userTokens = useSelector((state: RootState) => state.smartWallet.tokens);

  const handleApproveDapp = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      onError("Wallet not connected or doesn't support signing");
      return;
    }

    setIsLoading(true);

    try {
      const dappPublicKey = new PublicKey(dappToApprove);
      const mintPublicKey = approvalType === 'Token' ? new PublicKey(tokenMint) : PublicKey.default;
      const amount = parseFloat(approvalAmount);
      const expiryTimestamp = DateTime.fromISO(expiryDateTime).toUnixInteger();

      let transaction;

      if (approvalType === 'SOL') {
        transaction = await approveDapp(
          connection,
          PROGRAM_ID,
          wallet.publicKey,
          dappPublicKey,
          mintPublicKey,
          amount,
          expiryTimestamp,
          9
        );
      } else {
        const token = userTokens.find(token => token.mint === tokenMint);

        if (!token) {
          onError("Token not found in user's tokens");
          return;
        }

        transaction = await approveDapp(
          connection,
          PROGRAM_ID,
          wallet.publicKey,
          dappPublicKey,
          mintPublicKey,
          amount,
          expiryTimestamp,
          token.decimals
        );
      }

      const signedTx = await wallet.signTransaction(transaction);
      
      // Send the signed transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      // Wait for the transaction to be confirmed
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      // Call the API to save the approval
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/dapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletKey: smartWalletId,
            dAppId: dappPublicKey.toString(),
            mintId: mintPublicKey.toString(),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`API error: ${response.status} ${response.statusText}. ${errorData.message || ''}`);
        }

        const result = await response.json();
        console.log('Approval saved successfully:', result);
      } catch (apiError) {
        console.error('Error saving approval:', apiError);
        onError(`Failed to save approval: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
      }

      onSuccess(signature);
      // Reset form fields
      setDappToApprove('');
      setApprovalAmount('');
      setTokenMint('');
    } catch (err) {
      console.error('Error approving dApp:', err);
      onError(`Failed to approve dApp: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="dApp Public Key to Approve"
          value={dappToApprove}
          onChange={(e) => setDappToApprove(e.target.value)}
          className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
        />
        <input
          type="text"
          placeholder="Approval Amount"
          value={approvalAmount}
          onChange={(e) => setApprovalAmount(e.target.value)}
          className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <select
          value={approvalType}
          onChange={(e) => {
            setApprovalType(e.target.value as 'SOL' | 'Token');
            if (e.target.value === 'SOL') {
              setTokenMint('');
            }
          }}
          className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
        >
          <option value="SOL">SOL</option>
          <option value="Token">Token</option>
        </select>
        {approvalType === 'Token' && (
          <select
            value={tokenMint}
            onChange={(e) => setTokenMint(e.target.value)}
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
      <div>
        <label htmlFor="expiryDateTime" className="block text-sm font-medium text-gray-400 mb-2">
          Expiry Date and Time
        </label>
        <input
          id="expiryDateTime"
          type="datetime-local"
          value={expiryDateTime}
          onChange={(e) => setExpiryDateTime(e.target.value)}
          className="w-full bg-gray-700 bg-opacity-50 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-600"
          style={{colorScheme: 'dark'}}
        />
      </div>
      <LoadingButton 
        onClick={handleApproveDapp}
        isLoading={isLoading}
        text="Approve dApp"
        loadingText="Approving dApp..."
        className="w-full bg-white text-black hover:bg-gray-200 font-medium py-2 px-6 rounded-md transition duration-300 ease-in-out transform hover:scale-105"
      />
    </div>
  );
};

export default ApproveDappForm;
