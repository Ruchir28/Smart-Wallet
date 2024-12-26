import { Tool } from "@langchain/core/tools";
import { SmartWallet } from "../wallet/SmartWallet";
import { logToolAction, logToolError } from '../utils/logger';

export class SolTransferTool extends Tool {
  name = "sol_transfer";
  description = `Transfer SOL to another wallet. Input MUST be a properly formatted JSON string: {"recipient": "wallet_address", "amount": "1.5"}. Example: {"recipient": "GsbwXfJraMomNxBcpR3DBVoXHyLd3dpHhY1YJnUbf2ZK", "amount": "0.1"}`;
  
  private wallet: SmartWallet;

  constructor(wallet: SmartWallet) {
    super();
    this.wallet = wallet;
  }

  async _call(input: string): Promise<string> {
    try {
      logToolAction({
        tool: 'SolTransferTool',
        action: 'transfer',
        input
      });

      const cleanedInput = input.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
                               .replace(/:\s*([^",}\s]+)/g, ':"$1"');
      
      const { amount, recipient } = JSON.parse(cleanedInput) as {
        amount: string;
        recipient: string;
      };
      
      if (!amount || !recipient) {
        return `Invalid input. Please provide both amount and recipient address in format: {"amount": 0.2, "recipient": "address"}`;
      }

      const signature = await this.wallet.transferSol(recipient, parseFloat(amount));
      
      logToolAction({
        tool: 'SolTransferTool',
        action: 'transfer_success',
        input: { amount, recipient },
        output: { signature }
      });

      return `Successfully sent ${amount} SOL to ${recipient}. Transaction signature: ${signature}`;
    } catch (error) {
      logToolError({
        tool: 'SolTransferTool',
        action: 'transfer_error',
        input,
        error: error instanceof Error ? error.message : String(error)
      });
      return `Error sending SOL: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
} 