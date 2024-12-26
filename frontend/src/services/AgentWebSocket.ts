import { EventEmitter } from 'events';

// Add WebSocket type definition if not already imported
declare const WebSocket: {
  prototype: WebSocket;
  new(url: string): WebSocket;
  readonly CONNECTING: 0;
  readonly OPEN: 1;
  readonly CLOSING: 2;
  readonly CLOSED: 3;
};

export interface AgentResponse {
  type: 'system' | 'response' | 'error';
  text: string;
}

export class AgentWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private static instance: AgentWebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  private constructor() {
    super();
  }

  public static getInstance(): AgentWebSocket {
    if (!AgentWebSocket.instance) {
      AgentWebSocket.instance = new AgentWebSocket();
    }
    return AgentWebSocket.instance;
  }

  public connect(smartWalletAddress: string, ownerPublicKey: string) {
    if (this.ws?.readyState === WebSocket.OPEN || 
        this.ws?.readyState === WebSocket.CONNECTING || 
        this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    this.ws = new WebSocket(import.meta.env.VITE_SMART_WALLET_AI_URL);

    this.ws.onopen = () => {
      console.log('Connected to agent WebSocket');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.isConnecting = false;
      
      // Send connection details
      this.ws?.send(JSON.stringify({
        type: 'connection',
        smartWalletAddress,
        ownerPublicKey
      }));

      this.emit('connect');
    };

    this.ws.onmessage = (event) => {
      const response: AgentResponse = JSON.parse(event.data);
      this.emit('message', response);
    };

    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
      this.isConnecting = false;
      this.emit('disconnect');
      this.handleReconnect(smartWalletAddress, ownerPublicKey);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnecting = false;
      this.emit('error', error);

    };
  }

  private handleReconnect(smartWalletAddress: string, ownerPublicKey: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect(smartWalletAddress, ownerPublicKey);
      }, this.reconnectDelay);

    } else {
      console.log('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
    }
  }

  public sendCommand(text: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'command',
        text
      }));
    } else {
      throw new Error('WebSocket is not connected');
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public getReadyState(): number | undefined {
    return this.ws?.readyState;
  }
} 