import { Bot, Context, session, SessionFlavor, InlineKeyboard } from "grammy";
import { Connection, PublicKey, Transaction, Keypair, SystemProgram } from "@solana/web3.js";
import { executeTransactionInstruction, serializeWalletInstruction, TransferType } from "./walletInteractions";
import * as fs from 'fs';
import prisma from "./db";
import dotenv from 'dotenv';

dotenv.config();

// Load bot keypair
const botKeypairData = JSON.parse(fs.readFileSync('bot_keypair.json', 'utf-8'));
const botKeypair = Keypair.fromSecretKey(new Uint8Array(botKeypairData));

if(!process.env.BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not set");
}

const BOT_TOKEN = process.env.BOT_TOKEN;

if(!process.env.PROGRAM_ID) {
  throw new Error("PROGRAM_ID is not set");
}

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID);


// Define the structure for our session data
interface SessionData {
  activeWalletId: string | null;
  activePublicKey: string | null
}

// Create a custom context type that includes session data
type MyContext = Context & SessionFlavor<SessionData>;

function handleError(ctx: MyContext, error: any) {
  console.error("Error:", error);
  ctx.reply("An error occurred. Please try again later or contact support.").catch(console.error);
}

function isValidSolAmount(amount: string): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num <= 1000; // Adjust max amount as needed
}

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function checkBalance(publicKey: string): Promise<number> {
  const balance = await connection.getBalance(new PublicKey(publicKey));
  return balance / 1e9; // Convert lamports to SOL
}


const bot = new Bot<MyContext>(BOT_TOKEN);

// Add the session middleware
bot.use(session({
  initial: (): SessionData => ({ 
    activeWalletId: null, 
    activePublicKey: null 
  }),
}));

bot.command("start", async (ctx) => {
  await ctx.reply("Welcome to the Smart Wallet Telegram Bot! Use /help to see available commands.");
});

bot.command("setwallet", async (ctx) => {
  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) {
    await ctx.reply("Telegram User ID not found");
    return;
  }
  try {

    const wallets = await prisma.smartWallet.findMany({
      where: {
        telegramId
      }
    });
    
    const keyboard = new InlineKeyboard();
    
    wallets.forEach((wallet) => {
      keyboard.text(wallet.id, `select_wallet:${wallet.id}`);
      keyboard.row();
    });


    await ctx.reply("Select a wallet:", { reply_markup: keyboard });


  } catch(error) {
    console.error(error);
    await ctx.reply("An error occurred while fetching your wallets. Please try again later or contact support.");
  }
  
});

bot.callbackQuery(/^select_wallet:(.+)$/, async (ctx) => {
  // Extract wallet ID from callback data
  const walletId = ctx.match[1];
  console.log(walletId);
  const wallet = await prisma.smartWallet.findUnique({
    where: {
      id: walletId
    }
  });
  if (!wallet) {
    await ctx.answerCallbackQuery("Wallet not found");
    return;
  }
  ctx.session.activeWalletId = walletId;
  ctx.session.activePublicKey = wallet.publicKey;
  
  // Answer the callback query to stop the loading indicator
  await ctx.answerCallbackQuery();
  
  // Edit the original message to remove the keyboard and show the selected wallet
  await ctx.editMessageText(`You have selected wallet ${wallet.id}`);
});

bot.command("sendsol", async (ctx) => {
  if (!ctx.message) {
    await ctx.reply("Invalid command format.");
    return;
  }

  if (!ctx.session.activeWalletId || !ctx.session.activePublicKey) {
    await ctx.reply("Please select a wallet first using /setwallet");
    return;
  }

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length !== 2) {
    await ctx.reply("Usage: /sendsol <amount> <recipient_address>");
    return;
  }

  const [amount, recipientAddress] = args;

  if (!isValidSolAmount(amount)) {
    await ctx.reply("Invalid SOL amount. Please enter a valid number between 0 and 1000 SOL.");
    return;
  }


  try {
    const amountLamports = BigInt(Math.floor(parseFloat(amount) * 1e9)); // Convert SOL to lamports
    const walletPublicKey = new PublicKey(ctx.session.activePublicKey);
    const walletPDA = new PublicKey(ctx.session.activeWalletId);
    const recipientPublicKey = new PublicKey(recipientAddress);

    // Create the transaction instruction
    const instruction = executeTransactionInstruction(amountLamports, TransferType.Sol);
    const serializedInstruction = serializeWalletInstruction(instruction);

    // Derive the approval account address
    const [approvalAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("approval"), walletPDA.toBuffer(), botKeypair.publicKey.toBuffer(), PublicKey.default.toBuffer()],
      PROGRAM_ID
    );

    // Create the transaction
    const transaction = new Transaction().add({
      keys: [
        { pubkey: botKeypair.publicKey, isSigner: true, isWritable: false }, // dapp_account (bot is acting as dapp)
        { pubkey: walletPublicKey, isSigner: false, isWritable: false }, // user_account
        { pubkey: walletPDA, isSigner: false, isWritable: true }, // wallet_account
        { pubkey: approvalAddress, isSigner: false, isWritable: true }, // approval_account (same as wallet for simplicity)
        { pubkey: recipientPublicKey, isSigner: false, isWritable: true }, // recipient_account
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      ],
      programId: PROGRAM_ID,
      data: Buffer.from(serializedInstruction),
    });

    // Sign and send the transaction
    transaction.feePayer = botKeypair.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.sign(botKeypair);
    const signature = await connection.sendRawTransaction(transaction.serialize());

    await ctx.reply(`Transaction sent! Signature: ${signature}`);
  } catch (error) {
    console.error("Error sending SOL:", error);
    await ctx.reply("An error occurred while sending SOL. Please try again later or contact support.");
  }
});

console.log("Starting bot...");

bot.start();
