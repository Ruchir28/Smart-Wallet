import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { AgentWebSocket, AgentResponse } from '../services/AgentWebSocket';
import { addNotificationWithTimeout } from '../store/notificationSlice';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { addMessage, setConnectionStatus, setConnectionError } from '../store/chatSlice';
import type { Message } from '../store/chatSlice';
import { approveDapp } from '../utils/smartWalletInteractions';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { ConnectionManager } from '../utils/ConnectionManager';
import { DateTime } from 'luxon';
import LoadingButton from './LoadingButton';
import { fetchLatestApprovedDapps } from '../store/smartWalletSlice';

// Add WebSocket type definition
declare const WebSocket: {
  prototype: WebSocket;
  new(url: string): WebSocket;
  readonly CONNECTING: 0;
  readonly OPEN: 1;
  readonly CLOSING: 2;
  readonly CLOSED: 3;
};

const AIAssistant: React.FC = () => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch<AppDispatch>();
  
  const messages = useSelector((state: RootState) => state.chat.messages);
  const connectionStatus = useSelector((state: RootState) => state.chat.connectionStatus);
  const connectionError = useSelector((state: RootState) => state.chat.connectionError);

  const smartWalletId = useSelector((state: RootState) => state.smartWallet.address);
  const userPublicKey = useSelector((state: RootState) => state.wallet.publicKey);
  const agentWebSocket = useRef(AgentWebSocket.getInstance());

  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [maxAmount, setMaxAmount] = useState<string>('1');
  const [expiryDate, setExpiryDate] = useState<string>(
    DateTime.now().plus({ year: 1 }).toFormat("yyyy-MM-dd'T'HH:mm")
  );
  const wallet = useWallet();
  const connection = ConnectionManager.getInstance().getConnection();
  const program = useSelector((state: RootState) => state.connection.programId);
  const PROGRAM_ID = useMemo(() => new PublicKey(program), [program]);
  
  // AI Assistant's public key
  const AI_ASSISTANT_PUBLIC_KEY = '9gN84KSzFJd4VeqQ9smHogDmeMrP9txd5xe7gDp4xHKk';
  
  const approvedDapps = useSelector((state: RootState) => state.smartWallet.approvedDapps);
  const isAssistantApproved = approvedDapps.some(dapp => dapp.dapp === AI_ASSISTANT_PUBLIC_KEY);

  useEffect(() => {
    const ws = agentWebSocket.current;

    // Check if we need to connect
    const shouldConnect = () => {
      if (!smartWalletId || !userPublicKey) return false;
      
      const readyState = ws.getReadyState();
      return readyState === undefined || 
             readyState === WebSocket.CLOSED || 
             readyState === WebSocket.CLOSING || 
             readyState === null;
    };

    if (shouldConnect()) {
      try {
        if (!smartWalletId || !userPublicKey) {
          throw new Error('Smart wallet ID or user public key is missing');
        }
        dispatch(setConnectionStatus('connecting'));
        ws.connect(smartWalletId, userPublicKey);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Unknown connection error';
          
        console.error('Failed to connect to agent:', error);
        dispatch(setConnectionError(errorMessage));
        dispatch(addNotificationWithTimeout({
          notification: {
            message: 'Failed to connect to AI Assistant',
            type: 'error'
          },
          timeout: 5000
        }));
      }
    } else if (ws.isConnected()) {
      // If we're already connected, update the UI state
      dispatch(setConnectionStatus('connected'));
      dispatch(setConnectionError(null));
    }

    const messageHandler = (response: AgentResponse) => {
      dispatch(addMessage({
        text: response.text,
        type: response.type,
        timestamp: Date.now()
      }));
    };

    const errorHandler = (error: Error) => {
      dispatch(setConnectionError(error.message));
      dispatch(addNotificationWithTimeout({
        notification: {
          message: 'AI Assistant connection error',
          type: 'error'
        },
        timeout: 5000
      }));
    };

    const connectHandler = () => {
      dispatch(setConnectionStatus('connected'));
      dispatch(setConnectionError(null));
    };

    const disconnectHandler = () => {
      dispatch(setConnectionStatus('disconnected'));
    };

    // Only add event listeners if they haven't been added yet
    ws.off('message', messageHandler); // Remove any existing listeners first
    ws.off('error', errorHandler);
    ws.off('connect', connectHandler);
    ws.off('disconnect', disconnectHandler);

    ws.on('message', messageHandler);
    ws.on('error', errorHandler);
    ws.on('connect', connectHandler);
    ws.on('disconnect', disconnectHandler);

    return () => {
      // Only remove the event listeners, don't disconnect
      ws.off('message', messageHandler);
      ws.off('error', errorHandler);
      ws.off('connect', connectHandler);
      ws.off('disconnect', disconnectHandler);
    };
  }, [smartWalletId, userPublicKey, dispatch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      dispatch(addMessage({
        text: input,
        type: 'user',
        timestamp: Date.now()
      }));

      agentWebSocket.current.sendCommand(input);
      setInput('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error sending command';
        
      console.error('Error sending command:', error);
      dispatch(addNotificationWithTimeout({
        notification: {
          message: errorMessage,
          type: 'error'
        },
        timeout: 5000
      }));
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderMessage = (msg: Message, index: number, messages: Message[]) => {
    const isConsecutive = index > 0 && messages[index - 1].type === msg.type;
    
    return (
      <div
        key={`${msg.timestamp}-${index}`}
        className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} ${!isConsecutive ? 'mt-6' : 'mt-2'}`}
      >
        {msg.type !== 'user' && !isConsecutive && (
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center mr-2">
            <span className="text-white text-sm">AI</span>
          </div>
        )}
        <div className={`max-w-[80%] ${msg.type === 'user' ? 'order-1' : 'order-2'}`}>
          <div className={`
            px-4 py-3 rounded-2xl shadow-sm
            ${msg.type === 'error' 
              ? 'bg-red-500/10 text-red-200 border border-red-500/20' 
              : msg.type === 'system'
              ? 'bg-blue-500/10 text-blue-200 border border-blue-500/20'
              : msg.type === 'user'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800/80 text-gray-100 border border-gray-700'}
            ${msg.type === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}
          `}>
            <p className="text-sm leading-relaxed">{msg.text}</p>
            <div className={`text-[10px] mt-1 opacity-70 ${
              msg.type === 'user' ? 'text-right' : 'text-left'
            }`}>
              {formatTimestamp(msg.timestamp)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleReconnect = () => {
    if (!smartWalletId || !userPublicKey) {
      dispatch(setConnectionError('Wallet connection required'));
      return;
    }

    try {
      dispatch(setConnectionStatus('connecting'));
      agentWebSocket.current.connect(smartWalletId, userPublicKey);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown connection error';
      
      console.error('Failed to reconnect:', error);
      dispatch(setConnectionError(errorMessage));
      dispatch(addNotificationWithTimeout({
        notification: {
          message: 'Failed to reconnect to AI Assistant',
          type: 'error'
        },
        timeout: 5000
      }));
    }
  };

  const ConnectionIndicator = () => {
    const getStatusConfig = () => {
      switch (connectionStatus) {
        case 'connected':
          return {
            dotColor: 'bg-green-500',
            text: 'Connected',
            className: 'bg-green-500/10 text-green-300 border border-green-500/20',
            showReconnect: false
          };
        case 'connecting':
          return {
            dotColor: 'bg-yellow-500',
            text: 'Connecting',
            className: 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20',
            showReconnect: false
          };
        case 'error':
          return {
            dotColor: 'bg-red-500',
            text: 'Error',
            className: 'bg-red-500/10 text-red-300 border border-red-500/20',
            showReconnect: true
          };
        default:
          return {
            dotColor: 'bg-red-500',
            text: 'Disconnected',
            className: 'bg-red-500/10 text-red-300 border border-red-500/20',
            showReconnect: true
          };
      }
    };

    const config = getStatusConfig();

    return (
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-2.5 h-2.5 rounded-full ${config.dotColor} animate-pulse`} />
            <h2 className="text-lg font-medium text-white">Soul Wallet AI Assistant</h2>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${config.className}`}>
            {config.text}
          </span>
        </div>
        
        {config.showReconnect && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-300">
              {connectionError || 'Connection lost'}
            </span>
            <button
              onClick={handleReconnect}
              className="text-xs px-3 py-1 rounded-md bg-indigo-600 text-white
                hover:bg-indigo-700 transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              Try Reconnecting
            </button>
          </div>
        )}
      </div>
    );
  };

  const isInputDisabled = connectionStatus !== 'connected';

  const handleApproveAssistant = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      dispatch(addNotificationWithTimeout({
        notification: {
          message: "Wallet not connected or doesn't support signing",
          type: "error"
        },
        timeout: 5000
      }));
      return;
    }

    setIsApproving(true);

    try {
      const assistantPublicKey = new PublicKey(AI_ASSISTANT_PUBLIC_KEY);
      const maxAmountValue = parseFloat(maxAmount);
      const expiryTimestamp = DateTime.fromISO(expiryDate).toUnixInteger();

      const transaction = await approveDapp(
        connection,
        PROGRAM_ID,
        wallet.publicKey,
        assistantPublicKey,
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

      // Save approval to backend
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/dapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletKey: smartWalletId,
          dAppId: AI_ASSISTANT_PUBLIC_KEY,
          mintId: PublicKey.default.toString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save approval');
      }

      dispatch(fetchLatestApprovedDapps());
      dispatch(addNotificationWithTimeout({
        notification: {
          message: "AI Assistant approved successfully",
          type: "success"
        },
        timeout: 5000
      }));

      setShowApprovalForm(false);
    } catch (error) {
      console.error('Error approving AI Assistant:', error);
      dispatch(addNotificationWithTimeout({
        notification: {
          message: `Failed to approve AI Assistant: ${error instanceof Error ? error.message : String(error)}`,
          type: "error"
        },
        timeout: 5000
      }));
    } finally {
      setIsApproving(false);
    }
  };

  const renderApprovalForm = () => (
    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium text-white">Approve AI Assistant</h3>
        <button
          onClick={() => setShowApprovalForm(false)}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Close approval form"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path 
              fillRule="evenodd" 
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
              clipRule="evenodd" 
            />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            AI Assistant Public Key
          </label>
          <input
            type="text"
            value={AI_ASSISTANT_PUBLIC_KEY}
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
      <div className="flex gap-3">
        <LoadingButton
          onClick={handleApproveAssistant}
          isLoading={isApproving}
          text="Approve AI Assistant"
          loadingText="Approving..."
          className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-medium py-2 px-6 rounded-md transition duration-300 ease-in-out transform hover:scale-105"
        />
        <button
          onClick={() => setShowApprovalForm(false)}
          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl border border-gray-800/50 shadow-2xl flex flex-col h-[600px] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800/50 backdrop-blur-sm bg-gray-900/50">
        <ConnectionIndicator />
        {!isAssistantApproved && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-yellow-400 text-sm">
                ⚠️ AI Assistant needs approval to transfer tokens from your Soul Wallet
              </span>
              {!showApprovalForm && (
                <button
                  onClick={() => setShowApprovalForm(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Approve Assistant
                </button>
              )}
            </div>
            {showApprovalForm && renderApprovalForm()}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 scroll-smooth">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3">
            <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm">No messages yet. Start a conversation!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, index) => renderMessage(msg, index, messages))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-gray-800/50 backdrop-blur-sm bg-gray-900/50">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={connectionStatus === 'connected' ? "Type your message..." : "Connecting..."}
            className="flex-1 bg-gray-800/50 text-white px-4 py-2.5 rounded-lg 
              placeholder-gray-500 border border-gray-700/50
              focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent
              transition-all duration-200"
            disabled={isInputDisabled}
          />
          <button
            type="submit"
            disabled={isInputDisabled || !input.trim()}
            className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium
              transition-all duration-200 ease-in-out
              hover:bg-indigo-700 active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600 
              disabled:active:scale-100 focus:outline-none focus:ring-2 
              focus:ring-indigo-500/50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistant; 