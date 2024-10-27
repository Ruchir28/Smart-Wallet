import express, { Request, Response } from 'express';
const app = express();
import { v4 as uuidv4 } from 'uuid';
import prisma from './db';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

import cors from 'cors';

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;



app.get('/', (req, res) => {
  res.send('Smart Wallet Telegram Bot Server is running!');
});


app.post('/linkTelegramAccount', async (req: Request, res: Response) => {
  try {
    const { telegramId, smartWalletId, publicKey, telegramUsername, signedMessage, message } = req.body;

    // Input validation
    if (!telegramId || !smartWalletId || !publicKey || !signedMessage || !message) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: telegramId, smartWalletId, publicKey, signedMessage, and message are required'
      });
      return;
    }

    // Validate input types
    if (typeof telegramId !== 'string' || 
        typeof smartWalletId !== 'string' || 
        typeof publicKey !== 'string' ||
        typeof signedMessage !== 'string' ||
        typeof message !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid input types: all fields must be strings'
      });
      return;
    }

    // Verify the signature
    try {
      const verified = nacl.sign.detached.verify(
        new TextEncoder().encode(message),
        bs58.decode(signedMessage),
        new PublicKey(publicKey).toBytes()
      );

      if (!verified) {
        res.status(401).json({
          success: false,
          error: 'Invalid signature'
        });
        return;
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Invalid signature format'
      });
      return;
    }

    // Check if smart wallet already exists
    const existingWallet = await prisma.smartWallet.findUnique({
      where: { id: smartWalletId }
    });

    if (existingWallet) {
      res.status(409).json({
        success: false,
        error: 'Smart wallet already connected to telegram user ' + telegramUsername
      });
      return;
    }

    // Transaction to ensure data consistency
    const result = await prisma.$transaction(async (prisma) => {
      // Find or create user
      const user = await prisma.user.upsert({
        where: { telegramId },
        update: {},
        create: { telegramId, telegramUsername }
      });

      // Create smart wallet
      const smartWallet = await prisma.smartWallet.create({
        data: {
          id: smartWalletId,
          publicKey,
          telegramId: user.telegramId
        }
      });

      return { user, smartWallet };
    });

    res.status(201).json({
      success: true,
      data: {
        id: result.smartWallet.id,
        publicKey: result.smartWallet.publicKey,
        telegramId: result.user.telegramId,
        telegramUsername: result.user.telegramUsername,
        createdAt: result.smartWallet.createdAt
      }
    });

  } catch (error) {
    console.error('Error linking telegram account:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


app.get('/getSmartWallet', async (req: Request, res: Response) => {
  try {
    const { smartWalletId } = req.query;

    // Input validation
    if (!smartWalletId) {
      res.status(400).json({
        success: false,
        error: 'Missing required query parameter: smartWalletId'
      });
      return;
    }

    if (typeof smartWalletId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid input type: smartWalletId must be a string'
      });
      return;
    }

    const smartWallet = await prisma.smartWallet.findUnique({
      where: { id: smartWalletId },
      include: {
        user: true 
      }
    });

    if (!smartWallet) {
      res.status(404).json({
        success: false,
        error: 'Smart wallet not found'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: smartWallet.id,
        publicKey: smartWallet.publicKey,
        telegramId: smartWallet.telegramId,
        telegramUsername: smartWallet.user.telegramUsername,
        createdAt: smartWallet.createdAt
      }
    });

  } catch (error) {
    console.error('Error fetching smart wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/getUserWallets', async (req: Request, res: Response) => {
  try {
    const { telegramId } = req.query;

    if (!telegramId) {
       res.status(400).json({
        success: false,
        error: 'Missing required query parameter: telegramId'
      });
    }

    if (typeof telegramId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid input type: telegramId must be a string'
      });
      return;
    }

    const wallets = await prisma.smartWallet.findMany({
      where: { telegramId },
      select: {
        id: true,
        publicKey: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      data: wallets
    });
  } catch (error) {
    console.error('Error fetching user wallets:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
