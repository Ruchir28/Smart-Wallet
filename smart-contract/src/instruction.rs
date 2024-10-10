use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_error::ProgramError;

#[derive(BorshSerialize, BorshDeserialize)]
pub enum WalletInstruction {
    /// Creates a new wallet
    /// 
    /// Accounts expected:
    /// 1. `[signer]` The account of the person initializing the wallet
    /// 2. `[writable]` The wallet to create
    /// 3. `[]` The system program
    CreateWallet,

    /// Approves a dApp to interact with the wallet
    /// 
    /// Accounts expected:
    /// 1. `[signer]` The wallet owner
    /// 2. `[writable]` The wallet account
    /// 3. `[]` The dApp to approve
    ApproveDapp {
        max_amount: u64,
        expiry: i64,
    },

    /// Executes a transaction on behalf of the user
    /// 
    /// Accounts expected:
    /// 1. `[writable]` The wallet account
    /// 2. `[writable]` The recipient account
    /// 3. `[signer]` The approved dApp's account
    /// 4. `[]` The system program
    ExecuteTransaction {
        amount: u64,
        transfer_type: TransferType,
    },

    /// Withdraws funds from the wallet
    /// 
    /// Accounts expected:
    /// 1. `[signer]` The wallet owner
    /// 2. `[writable]` The wallet account
    /// 3. `[writable]` The recipient account (usually the owner's main account)
    /// 4. `[]` The system program
    Withdraw {
        amount: u64,
        transfer_type: TransferType,
    },
}

#[derive(BorshSerialize, BorshDeserialize)]
pub enum TransferType {
    Sol,
    Token,
}

impl WalletInstruction {
    /// Unpacks a byte buffer into a WalletInstruction
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        WalletInstruction::try_from_slice(input)
            .map_err(|_| ProgramError::InvalidInstructionData)
    }
}
