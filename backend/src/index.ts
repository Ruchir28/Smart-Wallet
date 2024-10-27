import express from 'express';
import { Request, Response } from 'express';
import prisma from './db';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

const frontendUrl = process.env.FRONTEND_URL;

console.log("frontendUrl", frontendUrl);

app.use(cors({
  origin: frontendUrl,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

app.use(express.json());

app.post('/dapp', async (req: Request, res: Response) => {
  try {
    const { walletKey, dAppId, mintId } = req.body;

    if (!walletKey || !dAppId || !mintId) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    // Use a transaction for atomicity
    const result = await prisma.$transaction(async (prisma) => {
      const user = await prisma.user.upsert({
        where: { walletKey },
        update: {},
        create: { walletKey },
      });

      const approval = await prisma.approval.upsert({
        where: {
          userId_dappId_mintId: {
            userId: user.id,
            dappId: dAppId,
            mintId: mintId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          dappId: dAppId,
          mintId: mintId,
        },
      });

      return { user, approval };
    });

    console.log(`Approval created/updated for wallet ${walletKey}`, { dAppId, mintId });
    res.json({
      success: true,
      message: 'Approval processed successfully',
      data: {
        userId: result.user.id,
        approvalId: result.approval.id,
      },
    });
  } catch (error) {
    console.error('Internal server error');
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.post('/getDappIds', async (req: Request, res: Response) => {
  try {
    const { walletKey } = req.body;
    console.log("get dapp id's request:", walletKey);
    const user = await prisma.user.findUnique({
      where: {
        walletKey
      },
      include: {
        approvals: true
      }
    });
    if (!user) {
      res.json({ success: false, error: "User not found" });
    } else {
      res.json({ success: true, approvals: user.approvals });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
