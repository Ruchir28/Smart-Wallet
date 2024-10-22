"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telbotClient = exports.smartWalletClient = void 0;
const client_smart_wallet_1 = require("@prisma/client-smart-wallet");
const client_telbot_1 = require("@prisma/client-telbot");
const smartWalletClient = new client_smart_wallet_1.PrismaClient();
exports.smartWalletClient = smartWalletClient;
const telbotClient = new client_telbot_1.PrismaClient();
exports.telbotClient = telbotClient;
