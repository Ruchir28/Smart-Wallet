import { serialize } from "borsh";
import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";

// Define the transfer types
export enum TransferType {
    Sol = 0,
    Token = 1,
}

// Define instruction types
export enum WalletInstructionType {
    CreateWallet = 0,
    ApproveDapp = 1,
    ExecuteTransaction = 2,
}

// Data classes for each instruction
class CreateWalletInstruction {
    constructor() {}
}

class ApproveDappInstruction {
    maxAmount: bigint;
    expiry: number;
    constructor(properties: { maxAmount: bigint; expiry: number; }) {
        this.maxAmount = properties.maxAmount;
        this.expiry = properties.expiry;
    }
}

class ExecuteTransactionInstruction {
    amount: bigint;
    transferType: TransferType;

    constructor(properties: { amount: bigint; transferType: TransferType }) {
        this.amount = properties.amount;
        this.transferType = properties.transferType;
    }
}

const InstructionSchema = {
  CreateWalletInstruction: { struct: {} },
  ApproveDappInstruction: { struct: { maxAmount: 'u64', expiry: 'i64'} },
  ExecuteTransactionInstruction: { struct: { amount: 'u64', transferType: 'u8' } },
};

// Union type for WalletInstruction
type WalletInstruction =
    | { type: WalletInstructionType.CreateWallet; data: CreateWalletInstruction }
    | { type: WalletInstructionType.ApproveDapp; data: ApproveDappInstruction }
    | { type: WalletInstructionType.ExecuteTransaction; data: ExecuteTransactionInstruction };

// WalletInstruction creation functions
export function createWalletInstruction(): WalletInstruction {
    return { type: WalletInstructionType.CreateWallet, data: new CreateWalletInstruction() };
}

export function approveDappInstruction(maxAmount: bigint, expiry: number): WalletInstruction {
    return { type: WalletInstructionType.ApproveDapp, data: new ApproveDappInstruction({ maxAmount, expiry }) };
}

export function executeTransactionInstruction(amount: bigint, transferType: TransferType): WalletInstruction {
    return { type: WalletInstructionType.ExecuteTransaction, data: new ExecuteTransactionInstruction({ amount, transferType }) };
}

// Serialization method for WalletInstruction using Borsh
export function serializeWalletInstruction(instruction: WalletInstruction): Uint8Array {
    let buffer: Buffer;

    // Create a buffer for the instruction type
    buffer = Buffer.alloc(1); // 1 byte for the type
    buffer.writeUInt8(instruction.type, 0);

    // Serialize the data according to its type using Borsh
    let serializedData: Uint8Array;
    switch (instruction.type) {
        case WalletInstructionType.CreateWallet:
            serializedData = serialize(InstructionSchema.CreateWalletInstruction, instruction.data);
            break;
        case WalletInstructionType.ApproveDapp:
            console.log("ApproveDappInstruction", instruction.data);
            serializedData = serialize(InstructionSchema.ApproveDappInstruction, instruction.data);
            break;
        case WalletInstructionType.ExecuteTransaction:
            serializedData = serialize(InstructionSchema.ExecuteTransactionInstruction, instruction.data);
            break;
        default:
            throw new Error('Unknown instruction type');
    }

    // Concatenate the type and serialized data
    return Buffer.concat([buffer, serializedData]);
}