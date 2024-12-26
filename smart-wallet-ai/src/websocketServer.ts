import { WebSocketServer } from 'ws';
import { WalletAgent } from './agent/WalletAgent';
import { ChatOpenAI } from '@langchain/openai';
import { SmartWalletConfig } from './types';
import { Connection } from '@solana/web3.js';
import dotenv from 'dotenv';
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PROGRAM_ID = process.env.PROGRAM_ID;

if (!OPENAI_API_KEY || !PROGRAM_ID) {
  throw new Error('OPENAI_API_KEY and PROGRAM_ID must be set in the environment variables');
}

// Configuration for the WebSocket server
const PORT = 8080;
const RPC_URL = 'https://api.devnet.solana.com';

// Create a WebSocket server
const wss = new WebSocketServer({ port: PORT });

interface ConnectionMessage {
  type: 'connection';
  smartWalletAddress: string;
  ownerPublicKey: string;
}

interface CommandMessage {
  type: 'command';
  text: string;
}

type Message = ConnectionMessage | CommandMessage;

wss.on('connection', (ws) => {
  console.log('New client connected');
  let agent: WalletAgent | null = null;

  ws.on('message', async (message) => {
    try {
      const parsedMessage: Message = JSON.parse(message.toString());

      if (parsedMessage.type === 'connection') {
        // Initialize the agent with the provided wallet details
        const config: SmartWalletConfig = {
          programId: PROGRAM_ID,
          connection: new Connection(RPC_URL),
          smartWalletAddress: parsedMessage.smartWalletAddress,
          ownerPublicKey: parsedMessage.ownerPublicKey,
          botKeypairPath: 'agent-keypair.json',
        };

        console.log(parsedMessage.smartWalletAddress, parsedMessage.ownerPublicKey);

        const model = new ChatOpenAI({
          modelName: 'gpt-4o-mini',
          temperature: 0.0,
          openAIApiKey: OPENAI_API_KEY,
        });

        agent = new WalletAgent(model, RPC_URL, config);
        ws.send(JSON.stringify({
          type: 'system',
          text: 'Connected successfully. Smart Wallet AI Assistant is ready.',
        }));
      } else if (parsedMessage.type === 'command') {
        if (!agent) {
          throw new Error('Agent not initialized. Please send connection details first.');
        }
        const response = await agent.processCommand(parsedMessage.text);
        ws.send(JSON.stringify({
          type: 'response',
          text: response,
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error processing message:', errorMessage);
      ws.send(JSON.stringify({
        type: 'error',
        text: `Error: ${errorMessage}. Please try again or contact support if the issue persists.`,
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    agent = null;
  });
});

console.log(`WebSocket server is running on ws://localhost:${PORT}`); 