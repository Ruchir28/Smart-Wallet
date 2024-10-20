import { Bot, Context, session, SessionFlavor, CommandContext } from "grammy";
import { Connection, PublicKey, Transaction, Keypair, SystemProgram, TransactionInstruction, TransactionSignature } from "@solana/web3.js";
import { executeTransactionInstruction, serializeWalletInstruction, TransferType } from "./walletInteractions";
import * as fs from 'fs';
import prisma from "./db";
import { Conversation, ConversationFlavor, conversations, createConversation } from "@grammyjs/conversations";
import bcrypt from "bcrypt";
import dotenv from 'dotenv';

dotenv.config();

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
  walletId: string | null;
  publicKey: string | null;
}

// Create a custom context type that includes session data
type MyContext = Context & SessionFlavor<SessionData> & ConversationFlavor;
type MyConversation = Conversation<MyContext>;

function handleError(ctx: MyContext, error: any) {
  console.error("Error:", error);
  ctx.reply("An error occurred. Please try again later or contact support.").catch(console.error);
}

function isValidSolAmount(amount: string): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num <= 1000; // Adjust max amount as needed
}

async function checkBalance(publicKey: string): Promise<number> {
  const balance = await connection.getBalance(new PublicKey(publicKey));
  return balance / 1e9; // Convert lamports to SOL
}

async function collectUserInfo(conversation: MyConversation, ctx: MyContext) {

  const telegramId = ctx.from?.id?.toString();

  if (!telegramId) {
    await ctx.reply("Telegram User ID not found");
    return;
  }

  const userInfo : {
    smart_wallet_id: string;
    public_key: string;
    pin: string;
  } = {
    smart_wallet_id: "",
    public_key: "",
    pin: ""
  }

  // Ask for smart wallet ID
  await ctx.reply("Please enter your smart wallet ID:");
  const smartWalletIdResponse = await conversation.wait();
  userInfo.smart_wallet_id = smartWalletIdResponse.message?.text || "";

  // Ask for public key
  await ctx.reply("Please enter your public key:");
  const publicKeyResponse = await conversation.wait();
  userInfo.public_key = publicKeyResponse.message?.text || "";

  // Ask for PIN and validate
  let validPin = false;
  while (!validPin) {
    await ctx.reply("Please enter your 4-digit PIN:");
    const pinResponse = await conversation.wait();
    const pin = pinResponse.message?.text || "";
    
    if (/^\d{4}$/.test(pin)) {
      userInfo.pin = pin;
      validPin = true;
    } else {
      await ctx.reply("Invalid PIN. Please enter exactly 4 digits.");
    }
  }




  // Confirm the information
  await ctx.reply(`Thank you! Here's what you provided:
    Smart Wallet ID: ${userInfo.smart_wallet_id}
    Public Key: ${userInfo.public_key}
    PIN: ${userInfo.pin}

    Is this correct? (Yes/No)`
  );

  const confirmation = await conversation.wait();

  if (confirmation.message?.text?.toLowerCase() === 'yes') {
    // Save the information to the database

    const pinHash = await bcrypt.hash(userInfo.pin, 10);

    try {
      await prisma.user.create({
        data: {
          id: telegramId,
          smartWalletId: userInfo.smart_wallet_id,
          publicKey: userInfo.public_key,
          pinHash: pinHash,
        },
      });
      await ctx.reply("Great! Your information has been saved.");
      // set context session
      ctx.session.walletId = userInfo.smart_wallet_id;
      ctx.session.publicKey = userInfo.public_key;
      await ctx.reply("You can now use the /sendsol command to send SOL to your smart wallet.");
    } catch (error) {
      console.error("Error saving user information:", error);
      await ctx.reply("There was an error saving your information. Please try again later.");
    }
  } else {
    await ctx.reply("No problem. Let's start over.");
    return collectUserInfo(conversation, ctx);
  }
}

async function collectPINAndSendSOL(conversation: MyConversation, ctx: MyContext) {
  // Get amount and recipient from the original command
  const [amount, recipient] = ctx.message!.text!.split(" ").slice(1);

  if (!ctx.session.walletId || !ctx.session.publicKey) {
    await ctx.reply("You haven't set up your wallet ID yet. Use /setwallet command first.");
    return;
  }

  // Collect PIN
  await ctx.reply("Please enter your 4-digit PIN to confirm the transaction:");
  const pinResponse = await conversation.form.text();

  // Verify PIN
  const user = await prisma.user.findUnique({
    where: { id: ctx.from?.id?.toString() },
  });

  if (!user) {
    await ctx.reply("User not found. Please use /start to set up your account.");
    return;
  }

  const isPinValid = await bcrypt.compare(pinResponse, user.pinHash);

  if (!isPinValid) {
    await ctx.reply("Invalid PIN. Transaction cancelled.");
    return;
  }

  // PIN is valid, proceed with the transaction
  try {
    const amountLamports = BigInt(parseFloat(amount) * 1e9);
    const recipientPubkey = new PublicKey(recipient);
    const walletOwnerPubkey = new PublicKey(ctx.session.publicKey);
    const smartWalletPubkey = new PublicKey(ctx.session.walletId);

    // Create the instruction
    const instruction = executeTransactionInstruction(amountLamports, TransferType.Sol);
    const serializedInstruction = serializeWalletInstruction(instruction);

    // Derive the approval account address
    const [approvalAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("approval"), smartWalletPubkey.toBuffer(), botKeypair.publicKey.toBuffer(), PublicKey.default.toBuffer()],
      PROGRAM_ID
    );

    // Create the transaction
    const transaction = new Transaction().add(
      new TransactionInstruction({
        keys: [
          { pubkey: botKeypair.publicKey, isSigner: true, isWritable: false }, // Bot acting as dApp
          { pubkey: walletOwnerPubkey, isSigner: false, isWritable: false }, // Wallet owner
          { pubkey: smartWalletPubkey, isSigner: false, isWritable: true }, // Smart wallet
          { pubkey: approvalAddress, isSigner: false, isWritable: true },
          { pubkey: recipientPubkey, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(serializedInstruction),
      })
    );

    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.feePayer = botKeypair.publicKey;
    transaction.recentBlockhash = latestBlockhash.blockhash;

    // Sign and send the transaction
    transaction.sign(botKeypair);
    const rawTransaction = transaction.serialize();
    const signature = await connection.sendRawTransaction(rawTransaction);

    // Update the confirmation process
    const confirmationResult = await connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    });

    if (confirmationResult.value.err) {
      throw new Error(`Transaction failed: ${confirmationResult.value.err.toString()}`);
    }

    await ctx.reply(`Transaction sent and confirmed! Signature: ${signature}`);
  } catch (error) {
    console.error("Error sending SOL:", error);
    if (error instanceof Error) {
      await ctx.reply(`An error occurred while sending SOL: ${error.message}`);
    } else {
      await ctx.reply(`An unexpected error occurred while sending SOL.`);
    }
  }
}

const bot = new Bot<MyContext>(BOT_TOKEN || '');

// Use session middleware
bot.use(session({ initial: (): SessionData => ({ walletId: null, publicKey: null }) }));

bot.use(conversations());

bot.use(createConversation(collectUserInfo));
bot.use(createConversation(collectPINAndSendSOL));
bot.use(createConversation(setWalletConversation));
bot.use(createConversation(setPINConversation));



// Solana connection
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const botKeypairFile = JSON.parse(fs.readFileSync('bot_keypair.json', 'utf-8'));
const botKeypair = Keypair.fromSecretKey(new Uint8Array(botKeypairFile));

// Function to check if a string looks like a wallet ID
function isWalletId(text: string): boolean {
  return /^[A-Za-z0-9]{32,44}$/.test(text);
}

// Add this function near the top of the file
function deriveSmartWalletAddress(publicKey: PublicKey): PublicKey {
  const [smartWalletAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("wallet"), publicKey.toBuffer()],
    PROGRAM_ID
  );
  return smartWalletAddress;
}

// Add this new conversation function
async function setWalletConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply("Let's set up your wallet. First, please enter your public key:");
  const publicKeyResponse = await conversation.form.text();

  let publicKey: PublicKey;
  try {
    publicKey = new PublicKey(publicKeyResponse);
    if (!PublicKey.isOnCurve(publicKey)) {
      await ctx.reply("Invalid public key. Please use the /setwallet command again and provide a valid Solana public key.");
      return;
    }
  } catch (error) {
    await ctx.reply("Invalid public key format. Please use the /setwallet command again and provide a valid Solana public key.");
    return;
  }

  const expectedSmartWalletAddress = deriveSmartWalletAddress(publicKey);
  
  await ctx.reply(`Based on your public key, your expected smart wallet address is: ${expectedSmartWalletAddress.toBase58()}\n\nDoes this match your smart wallet address? (Yes/No)`);
  
  const confirmation = await conversation.form.text();
  
  if (confirmation.toLowerCase() !== 'yes') {
    await ctx.reply("If the addresses don't match, there might be an issue with your wallet setup. Please check your wallet configuration and try again.");
    return;
  }

  const success = await setupWallet(ctx, expectedSmartWalletAddress.toBase58(), publicKey.toBase58());
  if (success) {
    await ctx.reply("Great! Your wallet is now set up. Let's set up your PIN next. Use the /setpin command to do this.");
  }
}

// Update the setwallet command
bot.command("setwallet", async (ctx: CommandContext<MyContext>) => {
  await ctx.conversation.enter("setWalletConversation");
});

// Add the new conversation to the bot

// Update the setupWallet function
async function setupWallet(ctx: MyContext, walletId: string, publicKey: string) {
  try {
    const pubKey = new PublicKey(publicKey);
    const expectedSmartWalletAddress = deriveSmartWalletAddress(pubKey);
    
    if (expectedSmartWalletAddress.toBase58() !== walletId) {
      await ctx.reply("The provided wallet ID does not match the expected smart wallet address for this public key. Please check your inputs and try again.");
      return false;
    }

    const telegramId = ctx.from?.id?.toString();
    if (!telegramId) {
      await ctx.reply("Telegram User ID not found");
      return false;
    }

    // Update or create user in the database
    await prisma.user.upsert({
      where: { id: telegramId },
      update: {
        smartWalletId: walletId,
        publicKey: publicKey,
      },
      create: {
        id: telegramId,
        smartWalletId: walletId,
        publicKey: publicKey,
        pinHash: '', // We'll set this later in the PIN setup process
      },
    });

    ctx.session.walletId = walletId;
    ctx.session.publicKey = publicKey;
    await ctx.reply(`Great! Your smart wallet ID has been set to: ${walletId} and public key to: ${publicKey}`);
    return true;
  } catch (error) {
    console.error("Error in setupWallet:", error);
    await ctx.reply("An error occurred while setting up your wallet. Please try again or contact support.");
    return false;
  }
}

// Update the start command
bot.command("start", async (ctx) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.from?.id?.toString() }
  });

  if (!user) {
    await ctx.reply("Welcome! Let's set up your wallet. Use the /setwallet command to get started.");
  } else if (!user.pinHash) {
    await ctx.reply("Your wallet is set up, but you need to set a PIN. Use the /setpin command to do this.");
  } else {
    ctx.session.walletId = user.smartWalletId;
    ctx.session.publicKey = user.publicKey;
    await ctx.reply("Welcome back! You can use the /sendsol command to send SOL, or /updatewallet to change your wallet information.");
  }
});

// Add a setpin command
bot.command("setpin", async (ctx: CommandContext<MyContext>) => {
  await ctx.conversation.enter("setPINConversation");
});

// Add a setPINConversation
async function setPINConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply("Please enter a 4-digit PIN:");
  let pin = await conversation.form.text();

  while (!/^\d{4}$/.test(pin)) {
    await ctx.reply("Invalid PIN. Please enter exactly 4 digits:");
    pin = await conversation.form.text();
  }

  const telegramId = ctx.from?.id?.toString();
  if (!telegramId) {
    await ctx.reply("Telegram User ID not found");
    return;
  }

  const pinHash = await bcrypt.hash(pin, 10);

  try {
    await prisma.user.update({
      where: { id: telegramId },
      data: { pinHash: pinHash },
    });
    await ctx.reply("PIN set successfully. You can now use the /sendsol command.");
  } catch (error) {
    console.error("Error setting PIN:", error);
    await ctx.reply("An error occurred while setting your PIN. Please try again later.");
  }
}


// Update the help command
bot.command("help", async (ctx) => {
  await ctx.reply(
    "Available commands:\n" +
    "/start - Start the bot and check your wallet setup\n" +
    "/setwallet [wallet_id] [public_key] - Set up your smart wallet ID and public key\n" +
    "/updatewallet [wallet_id] [public_key] - Update your smart wallet ID and public key\n" +
    "/setpin - Set or change your PIN\n" +
    "/sendsol [amount] [recipient] - Send SOL to an address\n" +
    "/help - Show this help message"
  );
});

// Command to send SOL
bot.command("sendsol", async (ctx: CommandContext<MyContext>) => {
  try {
    
    if (!ctx.session.walletId || !ctx.session.publicKey) {
      console.log(ctx.session);
      await ctx.reply("You haven't set up your wallet ID yet. Use /setwallet command first.");
      return;
    }

    const [amount, recipient] = ctx.match.split(" ");
    if (!amount || !recipient) {
      await ctx.reply("Invalid format. Use: /sendsol [amount] [recipient_address]");
      return;
    }

    if (!isValidSolAmount(amount)) {
      await ctx.reply("Invalid amount. Please enter a number between 0 and 1000 SOL.");
      return;
    }

    const balance = await checkBalance(ctx.session.publicKey);
    if (balance < parseFloat(amount)) {
      await ctx.reply(`Insufficient balance. Your current balance is ${balance} SOL.`);
      return;
    }

    // Use a conversation to securely collect the PIN and send SOL
    await ctx.conversation.enter("collectPINAndSendSOL");
  } catch (error) {
    if (error instanceof Error && error.message.includes('Too Many Requests')) {
      await ctx.reply("You're sending too many requests. Please wait a bit before trying again.");
    } else {
      handleError(ctx, error);
    }
  }
});

// Handle other text messages
bot.on("message:text", async (ctx) => {
  await ctx.reply("I don't understand that command. Type /help to see available commands.");
});

console.log("Bot is running...");

bot.start();
