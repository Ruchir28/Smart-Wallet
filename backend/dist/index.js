"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("./db"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const port = 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.post('/dapp', async (req, res) => {
    try {
        const { walletKey, dAppId, mintId } = req.body;
        const user = await db_1.default.user.findUnique({
            where: {
                walletKey
            }
        });
        if (!user) {
            const newUser = await db_1.default.user.create({
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
        }
        else {
            // Check if approval already exists
            const existingApproval = await db_1.default.approval.findUnique({
                where: {
                    userId_dappId_mintId: {
                        userId: user.id,
                        dappId: dAppId,
                        mintId: mintId
                    }
                }
            });
            if (!existingApproval) {
                await db_1.default.approval.create({
                    data: {
                        userId: user.id,
                        dappId: dAppId,
                        mintId: mintId
                    }
                });
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
app.post('/getDappIds', async (req, res) => {
    try {
        const { walletKey } = req.body;
        console.log("get dapp id's request:", walletKey);
        const user = await db_1.default.user.findUnique({
            where: {
                walletKey
            },
            include: {
                approvals: true
            }
        });
        if (!user) {
            res.json({ success: false, error: "User not found" });
        }
        else {
            res.json({ success: true, approvals: user.approvals });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
