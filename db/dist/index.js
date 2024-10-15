"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
// Create a single instance of the Prisma client
const prisma = new client_1.PrismaClient();
// Create an object with database-related functions
const db = {
    // Expose the Prisma client instance
    prisma,
    // Function to disconnect the Prisma client
    async disconnect() {
        await prisma.$disconnect();
    },
};
// Export the db object
exports.default = db;
// Optionally, export types if needed
__exportStar(require("@prisma/client"), exports);
