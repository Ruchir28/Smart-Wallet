use borsh::{BorshSerialize, BorshDeserialize};
use solana_program::{
    pubkey::Pubkey,
    program_error::ProgramError,
    account_info::AccountInfo,
};

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct WalletData {
    pub owner: Pubkey,
    pub transaction_count: u64,
    pub approved_dapps_count: u8,
}

impl WalletData {
    pub fn new(owner: Pubkey) -> Self {
        Self {
            owner,
            transaction_count: 0,
            approved_dapps_count: 0,
        }
    }

    pub fn increment_transaction_count(&mut self) {
        self.transaction_count += 1;
    }

    pub fn increment_approved_dapps_count(&mut self) {
        self.approved_dapps_count += 1;
    }

    pub fn decrement_approved_dapps_count(&mut self) {
        self.approved_dapps_count = self.approved_dapps_count.saturating_sub(1);
    }

    pub fn verify_owner(&self, signer: &Pubkey) -> Result<(), ProgramError> {
        if &self.owner != signer {
            return Err(ProgramError::InvalidAccountData);
        }
        Ok(())
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct DAppApproval {
    pub is_approved: bool,
    pub max_amount: u64,
    pub expiry: i64,
    pub token_mint: Pubkey,
}

impl DAppApproval {
    pub fn new(max_amount: u64, expiry: i64, token_mint: Pubkey) -> Self {
        Self {
            is_approved: true,
            max_amount,
            expiry,
            token_mint,
        }
    }

    pub fn is_valid(&self, current_timestamp: i64) -> bool {
        self.is_approved && self.expiry > current_timestamp
    }

    pub fn revoke(&mut self) {
        self.is_approved = false;
    }

    pub fn update(&mut self, max_amount: u64, expiry: i64) {
        self.max_amount = max_amount;
        self.expiry = expiry;
        self.is_approved = true;
    }

    pub fn calculate_size() -> usize {
        let account_size = 1 + 8 + 8 + 32;
        return account_size;
    }
}

// Constants for space calculation
pub const WALLET_DATA_SIZE: usize = 32 + 8 + 1; // owner + transaction_count + approved_dapps_count
pub const DAPP_APPROVAL_SIZE: usize = 1 + 8 + 8 + 32; // is_approved + max_amount + expiry + token_mint

pub fn derive_wallet_address(owner: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"wallet", owner.as_ref()], program_id)
}

pub fn derive_approval_address(
    wallet: &Pubkey,
    dapp: &Pubkey,
    token_mint: &Pubkey,
    program_id: &Pubkey
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"approval", wallet.as_ref(), dapp.as_ref(), token_mint.as_ref()],
        program_id
    )
}

pub fn get_associated_token_address(wallet_pda: &Pubkey, token_mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[
            wallet_pda.as_ref(),
            spl_token::id().as_ref(),
            token_mint.as_ref(),
        ],
        &spl_associated_token_account::id(),
    ).0
}

// Helper functions for account operations
pub fn unpack_wallet_data(wallet_account: &AccountInfo) -> Result<WalletData, ProgramError> {
    WalletData::try_from_slice(&wallet_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)
}

pub fn pack_wallet_data(wallet_data: &WalletData, wallet_account: &AccountInfo) -> Result<(), ProgramError> {
    wallet_data.serialize(&mut &mut wallet_account.data.borrow_mut()[..])
        .map_err(|_| ProgramError::AccountDataTooSmall)
}

pub fn unpack_approval_data(approval_account: &AccountInfo) -> Result<DAppApproval, ProgramError> {
    DAppApproval::try_from_slice(&approval_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)
}

pub fn pack_approval_data(approval_data: &DAppApproval, approval_account: &AccountInfo) -> Result<(), ProgramError> {
    approval_data.serialize(&mut &mut approval_account.data.borrow_mut()[..])
        .map_err(|_| ProgramError::AccountDataTooSmall)
}
