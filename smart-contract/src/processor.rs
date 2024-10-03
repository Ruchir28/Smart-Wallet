use solana_program::{
    account_info::{next_account_info, AccountInfo}, clock::Clock, entrypoint::ProgramResult, msg, program::invoke_signed, program_error::ProgramError, pubkey::Pubkey, rent::Rent, system_instruction, sysvar::Sysvar
};

use crate::{instruction::TransferType, state::{derive_approval_address, derive_wallet_address, pack_approval_data, pack_wallet_data, unpack_approval_data, unpack_wallet_data, DAppApproval, WalletData, DAPP_APPROVAL_SIZE}};
use spl_token::instruction as token_instruction;

pub fn create_wallet(program_id: &Pubkey, accounts: &[AccountInfo], _instrcution_data: &[u8]) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let user_account = next_account_info(accounts_iter)?;
    let wallet_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    // Derive the PDA and verify it
    let (expected_pda, bump_seed) = Pubkey::find_program_address(&[b"wallet", user_account.key.as_ref()], program_id);
    if *wallet_account.key != expected_pda {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Create PDA using `invoke_signed`
    let rent_exempt_balance = Rent::get()?.minimum_balance(0);
    let create_account_ix = system_instruction::create_account(
        user_account.key,
        wallet_account.key,
        rent_exempt_balance,
        0,
        program_id,
    );
    
    invoke_signed(
        &create_account_ix,
        &[user_account.clone(), wallet_account.clone(), system_program.clone()],
        &[&[b"wallet", user_account.key.as_ref(), &[bump_seed]]],
    )?;

    // // Now initialize the data in the PDA
    // let mut wallet_data = unpack_wallet_data(&wallet_account)?;
    // wallet_data.owner = *user_account.key;
    // wallet_data.transaction_count = 0;
    // wallet_data.approved_dapps_count = 0;
    // pack_wallet_data(&wallet_data, wallet_account)?;

    Ok(())
}

pub fn approve_dapp(program_id: &Pubkey, accounts: &[AccountInfo], max_amount: u64, expiry: i64) -> ProgramResult {
    msg!("Approving dApp Request");

    let account_info_iter = &mut accounts.iter();

    let user_account = next_account_info(account_info_iter)?;
    let wallet_account = next_account_info(account_info_iter)?; // user's pda smart wallet
    let dapp_account = next_account_info(account_info_iter)?; // dapp's to approve for auto transaction
    let token_mint_account = next_account_info(account_info_iter)?; // token to approve for spending 
    let approval_account = next_account_info(account_info_iter)?; // approval account i.e pda storing approval details 
    let system_program = next_account_info(account_info_iter)?; 
    
    // let mut wallet_data = unpack_wallet_data(wallet_account)?;

    // let _ = wallet_data.verify_owner(user_account.key);

    let (wallet_pda, _) = Pubkey::find_program_address(&[b"wallet", user_account.key.as_ref()], program_id);
    
    if wallet_pda != *wallet_account.key {
        msg!("Wallet account does not match");
        return Err(ProgramError::InvalidAccountData.into());
    }


    let (approval_address, bump_seed) = derive_approval_address(wallet_account.key, dapp_account.key, token_mint_account.key, program_id);

    if approval_address != *approval_account.key {
        msg!("Approval account does not match");
        return Err(ProgramError::InvalidAccountData.into());
    }

    if approval_account.data_is_empty() {
        let rent = Rent::get()?;
        let space = DAPP_APPROVAL_SIZE as u64;
        let lamports = rent.minimum_balance(space as usize);

        invoke_signed(
            &system_instruction::create_account(
                user_account.key,
                approval_account.key,
                lamports,
                DAPP_APPROVAL_SIZE as u64,
                program_id,
            ),
            &[user_account.clone(), approval_account.clone(), system_program.clone()],
            &[&[b"approval", wallet_account.key.as_ref(), dapp_account.key.as_ref(), token_mint_account.key.as_ref(), &[bump_seed]]],
        )?;

        // wallet_data.increment_approved_dapps_count();
    }

    let approval_data = DAppApproval::new(max_amount, expiry, *token_mint_account.key);
    pack_approval_data(&approval_data, approval_account)?;

    // Update wallet data
    // pack_wallet_data(&wallet_data, wallet_account)?;

    msg!("DApp approved successfully");

    Ok(())
}


pub fn execute_transaction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
    transfer_type: TransferType,
) -> ProgramResult {
    msg!("execute_transaction: Beginning execution");

    let account_info_iter = &mut accounts.iter();

    let dapp_account = next_account_info(account_info_iter)?;
    let user_account = next_account_info(account_info_iter)?;
    let wallet_account = next_account_info(account_info_iter)?;
    let approval_account = next_account_info(account_info_iter)?;
    let recipient_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    // Add detailed logging
    msg!("Executing transaction");
    msg!("DApp account: {:?}", dapp_account.key);
    msg!("User account: {:?}", user_account.key);
    msg!("Wallet account: {:?}", wallet_account.key);
    msg!("Approval account: {:?}", approval_account.key);
    msg!("Recipient account: {:?}", recipient_account.key);
    msg!("Amount: {}", amount);

    // Verify that the dApp is a signer
    if !dapp_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature.into());
    }

    // Get the wallet PDA
    let (wallet_pda, bump_seed) = derive_wallet_address(user_account.key, program_id);

    // Verify that the provided wallet account is actually the PDA we expect
    if wallet_pda != *wallet_account.key {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Verify that the wallet account is owned by the program
    if wallet_account.owner != program_id {
        msg!("Wallet account is not owned by the program");
        return Err(ProgramError::IllegalOwner.into());
    }

    // Unpack and verify approval data
    let approval_data = unpack_approval_data(approval_account)?;
    if !approval_data.is_approved {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Check approval expiry
    let clock = Clock::get()?;
    if clock.unix_timestamp >= approval_data.expiry {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Check transaction amount
    if amount > approval_data.max_amount {
        return Err(ProgramError::InvalidAccountData.into());
    }

    match transfer_type {
        TransferType::Sol => {
            // Verify the approval is for SOL (you might want to add a field in DAppApproval for this)
            if approval_data.token_mint != Pubkey::default() {
                return Err(ProgramError::InvalidAccountData.into());
            }

            msg!("Transferring SOL from wallet {:?} to recipient {:?}, amount: {:?}", wallet_account.key, recipient_account.key, amount);
            msg!("Wallet account's balance: {:?}", wallet_account.lamports());

            // Create the transfer instruction
            let ix = solana_program::system_instruction::transfer(
                wallet_account.key,
                recipient_account.key,
                amount
            );

            // Execute the transfer
            // solana_program::program::invoke_signed(
            //     &ix,
            //     &[
            //         wallet_account.clone(),
            //         recipient_account.clone(),
            //         system_program.clone(),
            //     ],
            //     &[&[b"wallet", user_account.key.as_ref(), &[bump_seed]]],
            // )?;

            // Decrease lamports from wallet account
            let wallet_balance = wallet_account.lamports();
            if wallet_balance < amount {
                return Err(ProgramError::InsufficientFunds.into());
            }
            **wallet_account.try_borrow_mut_lamports()? -= amount;

            // Increase lamports for recipient account
            **recipient_account.try_borrow_mut_lamports()? += amount;

            msg!("Transfer completed. New wallet balance: {}", wallet_account.lamports());
        },
        TransferType::Token => {
            let token_mint_account = next_account_info(account_info_iter)?;
            let wallet_token_account = next_account_info(account_info_iter)?;
            let token_program = next_account_info(account_info_iter)?;

            // Verify the approval is for the correct token
            if approval_data.token_mint != *token_mint_account.key {
                return Err(ProgramError::InvalidAccountData.into());
            }

            // Verify that the associated token account is valid
            if wallet_token_account.owner != token_program.key {
                return Err(ProgramError::InvalidAccountData.into());
            }

            msg!("Transferring tokens from wallet_token_account {:?} to recipient_account {:?}, amount: {:?}", wallet_token_account.key, recipient_account.key, amount);

            // Execute the token transfer
            invoke_signed(
                &spl_token::instruction::transfer(
                    token_program.key,
                    wallet_token_account.key,
                    recipient_account.key,
                    wallet_account.key,
                    &[],
                    amount,
                )?,
                &[
                    wallet_account.clone(),
                    wallet_token_account.clone(),
                    recipient_account.clone(),
                    token_program.clone(),
                    system_program.clone(),
                ],
                &[&[b"wallet", user_account.key.as_ref(), &[bump_seed]]],
            )?;
        }
    }

    // // Update approval data
    // approval_data.max_amount = approval_data.max_amount.saturating_sub(amount);
    // pack_approval_data(&approval_data, approval_account)?;

    msg!("Transaction executed successfully");
    Ok(())
}

