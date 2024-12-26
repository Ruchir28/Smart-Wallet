import { Tool } from "@langchain/core/tools";
import { SmartWallet } from "../wallet/SmartWallet";
import { logToolAction, logToolError } from '../utils/logger';

export class PriceCheckTool extends Tool {
  name = "price_check";
  description = `Check the current price of a token. Input MUST be a properly formatted JSON string: {"token": "token_mint_address"}. Example: {"token": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}`;

  private wallet: SmartWallet;

  constructor(wallet: SmartWallet) {
    super();
    this.wallet = wallet;
  }

  private cleanInput(input: string): string {
    let cleaned = input.trim();
    if (!cleaned.startsWith('{')) cleaned = '{' + cleaned;
    if (!cleaned.endsWith('}')) cleaned = cleaned + '}';
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    cleaned = cleaned.replace(/:\s*([^",}\s][^,}]*)/g, ':"$1"');
    return cleaned;
  }

  protected async _call(input: string): Promise<string> {
    try {
      logToolAction({
        tool: 'PriceCheckTool',
        action: 'check_price',
        input
      });

      const cleanedInput = this.cleanInput(input);
      const { token } = JSON.parse(cleanedInput) as { token: string };
      
      if (!token || !token.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
        throw new Error("Please provide a valid token mint address");
      }

      const price = await this.wallet.checkTokenPrice(token);
      
      logToolAction({
        tool: 'PriceCheckTool',
        action: 'check_price_success',
        input: { token },
        output: { price }
      });

      return `Price of token ${token}: $${price.toFixed(6)} USD`;
    } catch (error) {
      logToolError({
        tool: 'PriceCheckTool',
        action: 'check_price_error',
        input,
        error: error instanceof Error ? error.message : String(error)
      });
      return `Error checking price: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
} 