import { Connection, Commitment } from '@solana/web3.js';

export class ConnectionManager {
  private static instance: ConnectionManager;
  private connection: Connection | null = null;
  private currentEndpoint: string = '';
  private defaultEndpoint: string = 'http://127.0.0.1:8899'; // Default local endpoint

  private constructor() {}

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  public getConnection(): Connection {
    if (!this.connection) {
      console.warn('Connection not initialized. Initializing with default endpoint.');
      this.initializeConnection(this.defaultEndpoint);
    }
    return this.connection!;
  }

  public initializeConnection(endpoint: string, commitment: Commitment = 'confirmed'): void {
    if (this.connection && this.currentEndpoint === endpoint) {
      return;
    }

    this.connection = new Connection(endpoint, commitment);
    this.currentEndpoint = endpoint;
    console.log(`Connection initialized with endpoint: ${endpoint}`);
  }

  public updateConnection(endpoint: string, commitment: Commitment = 'confirmed'): void {
    this.connection = new Connection(endpoint, commitment);
    this.currentEndpoint = endpoint;
    console.log(`Connection updated with new endpoint: ${endpoint}`);
  }

  public getCurrentEndpoint(): string {
    return this.currentEndpoint;
  }

  public setDefaultEndpoint(endpoint: string): void {
    this.defaultEndpoint = endpoint;
  }
}

export const getConnectionManager = ConnectionManager.getInstance;
