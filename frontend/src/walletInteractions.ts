import { serialize, deserialize } from "borsh";
import { Buffer } from "buffer";
import { PublicKey } from '@solana/web3.js';
import { ApprovedDapp } from './store/smartWalletSlice';

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
    Withdraw = 3,
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

class WithdrawInstruction {
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
  WithdrawInstruction: { struct: { amount: 'u64', transferType: 'u8' } },
};

// Union type for WalletInstruction
type WalletInstruction =
    | { type: WalletInstructionType.CreateWallet; data: CreateWalletInstruction }
    | { type: WalletInstructionType.ApproveDapp; data: ApproveDappInstruction }
    | { type: WalletInstructionType.ExecuteTransaction; data: ExecuteTransactionInstruction }
    | { type: WalletInstructionType.Withdraw; data: WithdrawInstruction };

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

export function withdrawInstruction(amount: bigint, transferType: TransferType): WalletInstruction {
    return { type: WalletInstructionType.Withdraw, data: new WithdrawInstruction({ amount, transferType }) };
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
        case WalletInstructionType.Withdraw:
            serializedData = serialize(InstructionSchema.WithdrawInstruction, instruction.data);
            break;
        default:
            throw new Error('Unknown instruction type');
    }

    // Concatenate the type and serialized data
    return Buffer.concat([buffer, serializedData]);
}

// decode dapp data
export function decodeDappData(dappId: string, data: Uint8Array): ApprovedDapp | null {
    const decodedData = deserialize(
        {
            struct: {
                is_approved: 'bool',
                max_amount: 'u64',
                expiry: 'i64',
                token_mint: { array: { type: 'u8', len: 32 } },
            }
        },
        Buffer.from(data)
    ) as { is_approved: boolean; max_amount: bigint; expiry: bigint; token_mint: Uint8Array } | null;

    if (!decodedData) {
        return null;
    }

    return {
        dapp: dappId,
        tokenMint: new PublicKey(decodedData.token_mint).toString(),
        maxAmount: decodedData.max_amount.toString(),
        expiry: new Date(Number(decodedData.expiry) * 1000).toISOString(),
    };
}
