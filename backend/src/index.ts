import express from 'express';
import { Request, Response } from 'express';
import prisma from './db';
import cors from 'cors';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.post('/dapp', async (req: Request, res: Response) => {
  try {
    const { walletKey, dAppId, mintId } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        walletKey
      }
    });

    if (!user) {
      const newUser = await prisma.user.create({
        data: {
          walletKey,
          approvals: {
            create: {
              dappId: dAppId,
              mintId: mintId
            }
          }
        }
      });
      res.json(newUser);
    } else {
      // Check if approval already exists
      const existingApproval = await prisma.approval.findUnique({
        where: {
          userId_dappId_mintId: {
            userId: user.id,
            dappId: dAppId,
            mintId: mintId
          }
        }
      });

      if (!existingApproval) {
        await prisma.approval.create({
          data: {
            userId: user.id,
            dappId: dAppId,
            mintId: mintId
          }
        });
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
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
