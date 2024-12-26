import { Tool } from "@langchain/core/tools";
import { SmartWallet } from "../wallet/SmartWallet";
import { logToolAction, logToolError } from '../utils/logger';

export class TokenTransferTool extends Tool {
  name = "token_transfer";
  description = `Transfer tokens to another wallet. Input MUST be a properly formatted JSON string: {"recipient": "wallet_address", "amount": "1.5", "tokenMint": "token_mint_address"}. The tokenMint is optional - if not provided, SOL will be transferred. Example: {"recipient": "GsbwXfJraMomNxBcpR3DBVoXHyLd3dpHhY1YJnUbf2ZK", "amount": "1.5"}`;

  private wallet: SmartWallet;

  constructor(wallet: SmartWallet) {
    super();
    this.wallet = wallet;
  }

  async _call(input: string): Promise<string> {
    try {
      logToolAction({
        tool: 'TokenTransferTool',
        action: 'transfer',
        input
      });

      const { recipient, amount, tokenMint } = JSON.parse(input) as {
        recipient: string;
        amount: string;
        tokenMint?: string;
      };

      const amountNum = parseFloat(amount);

      let signature: string;
      if (!tokenMint) {
        signature = await this.wallet.transferSol(recipient, amountNum);
      } else {
        signature = await this.wallet.transferToken(recipient, amountNum, tokenMint);
      }
      
      logToolAction({
        tool: 'TokenTransferTool',
        action: 'transfer_success',
        input: { recipient, amount, tokenMint },
        output: { signature }
      });

      return `Transfer sent! Signature: ${signature}`;
    } catch (error) {
      logToolError({
        tool: 'TokenTransferTool',
        action: 'transfer_error',
        input,
        error: error instanceof Error ? error.message : String(error)
      });
      return `Error processing transfer: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
} 