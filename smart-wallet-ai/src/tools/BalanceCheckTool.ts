import { Tool } from "@langchain/core/tools";
import { SmartWallet } from "../wallet/SmartWallet";
import { logToolAction, logToolError } from '../utils/logger';

export class BalanceCheckTool extends Tool {
  name = "balance_check";
  description = `Check smart wallet balance. For SOL balance, use empty JSON: {}. For token balance, input MUST be a properly formatted JSON string: {"token": "token_mint_address"}. Example: {"token": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}`;

  private wallet: SmartWallet;

  constructor(wallet: SmartWallet) {
    super();
    this.wallet = wallet;
  }

  async _call(input: string): Promise<string> {
    try {
      logToolAction({
        tool: 'BalanceCheckTool',
        action: 'check_balance',
        input
      });

      const balance = await this.wallet.checkBalance();
      
      logToolAction({
        tool: 'BalanceCheckTool',
        action: 'check_balance_success',
        output: { balance }
      });

      return `Your Smart Wallet Balance is ${balance} SOL`;
    } catch (error) {
      logToolError({
        tool: 'BalanceCheckTool',
        action: 'check_balance_error',
        error: error instanceof Error ? error.message : String(error)
      });
      return `Error checking balance: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
} 