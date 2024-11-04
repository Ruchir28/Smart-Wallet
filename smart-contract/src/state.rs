use borsh::{BorshSerialize, BorshDeserialize};
use solana_program::{
    pubkey::Pubkey,
    program_error::ProgramError,
    account_info::AccountInfo,
};

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
}

// Constants for space calculation
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


pub fn unpack_approval_data(approval_account: &AccountInfo) -> Result<DAppApproval, ProgramError> {
    DAppApproval::try_from_slice(&approval_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)
}

pub fn pack_approval_data(approval_data: &DAppApproval, approval_account: &AccountInfo) -> Result<(), ProgramError> {
    approval_data.serialize(&mut &mut approval_account.data.borrow_mut()[..])
        .map_err(|_| ProgramError::AccountDataTooSmall)
}
