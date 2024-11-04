use solana_program::{
    account_info::{next_account_info, AccountInfo}, clock::Clock, entrypoint::ProgramResult, msg, program::invoke_signed, program_error::ProgramError, pubkey::Pubkey, rent::Rent, system_instruction, sysvar::Sysvar
};
use crate::{instruction::TransferType, state::{derive_approval_address, derive_wallet_address, pack_approval_data, unpack_approval_data, DAppApproval, DAPP_APPROVAL_SIZE}};
use solana_program::program_pack::Pack;
use spl_token::state::Account as SplTokenAccount;
use spl_token_2022::extension::StateWithExtensions;



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

    }

    let approval_data = DAppApproval::new(max_amount, expiry, *token_mint_account.key);
    pack_approval_data(&approval_data, approval_account)?;

    msg!("DApp approved successfully");

    Ok(())
}

fn get_token_balance(token_account: &AccountInfo, token_program: &Pubkey) -> Result<u64, ProgramError> {
    let data = token_account.try_borrow_data()?;
    
    if token_program == &spl_token::id() {
        let account = SplTokenAccount::unpack(&data)?;
        Ok(account.amount)
    } else if token_program == &spl_token_2022::id() {
        let state = StateWithExtensions::<spl_token_2022::state::Account>::unpack(&data)?;
        let account = state.base;
        Ok(account.amount)
    } else {

        Err(ProgramError::IncorrectProgramId)
    }
}

fn create_transfer_instruction(
    token_program: &Pubkey,
    source: &Pubkey,
    destination: &Pubkey,
    mint: &Pubkey,
    authority: &Pubkey,
    amount: u64,
    decimals: u8,
) -> Result<solana_program::instruction::Instruction, ProgramError> {
    if token_program == &spl_token::id() {
        Ok(spl_token::instruction::transfer_checked(
            token_program,
            source,
            mint,
            destination,
            authority,
            &[],
            amount,
            decimals,
        )?)
    } else if token_program == &spl_token_2022::id() {
        Ok(spl_token_2022::instruction::transfer_checked(
            token_program,
            source,
            mint,
            destination,
            authority,
            &[],
            amount,
            decimals,
        )?)
    } else {
        Err(ProgramError::IncorrectProgramId)
    }
}
fn get_token_decimals(mint_account: &AccountInfo, token_program: &Pubkey) -> Result<u8, ProgramError> {
    // Try to borrow data, log error if it fails
    let data = mint_account.try_borrow_data().map_err(|e| {
        msg!("Failed to borrow mint account data: {}", e);
        ProgramError::AccountBorrowFailed
    })?;
    
    msg!("Attempting to get decimals for mint account: {:?}", mint_account.key);
    
    if token_program == &spl_token::id() {
        msg!("Using SPL Token program");
        let mint = spl_token::state::Mint::unpack(&data).map_err(|e| {
            msg!("Failed to unpack SPL Token mint data: {}", e);
            ProgramError::InvalidAccountData
        })?;
        msg!("Successfully got decimals: {}", mint.decimals);
        Ok(mint.decimals)
    } else if token_program == &spl_token_2022::id() {
        msg!("Using Token-2022 program");
        let state = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&data).map_err(|e| {
            msg!("Failed to unpack Token-2022 mint data: {}", e);
            ProgramError::InvalidAccountData
        })?;
        let mint = state.base;
        msg!("Successfully got decimals: {}", mint.decimals);
        Ok(mint.decimals)
    } else {
        msg!("Error: Invalid token program. Expected SPL Token or Token-2022, got: {:?}", token_program);
        Err(ProgramError::IncorrectProgramId)
    }
}

fn validate_token_accounts(
    wallet_token_account: &AccountInfo,
    token_mint_account: &AccountInfo,
    recipient_account: &AccountInfo,
    token_program: &AccountInfo,
) -> ProgramResult {
    // Verify token program
    if token_program.key != &spl_token::id() && 
       token_program.key != &spl_token_2022::id() {
        msg!("Invalid token program");
        return Err(ProgramError::IncorrectProgramId.into());
    }

    // Verify source account ownership
    if wallet_token_account.owner != token_program.key {
        msg!("Source token account not owned by token program");
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Verify mint account ownership
    if token_mint_account.owner != token_program.key {
        msg!("Mint account not owned by token program");
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Verify destination account ownership
    if recipient_account.owner != token_program.key {
        msg!("Destination token account not owned by token program");
        return Err(ProgramError::InvalidAccountData.into());
    }

    Ok(())
}

pub fn execute_transaction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
    transfer_type: TransferType,
) -> ProgramResult {
    // Base transaction fee is 5000 lamports per signature
    const TRANSACTION_FEE: u64 = 5000;

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
        msg!("Dapp is not approved");
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Check approval expiry
    let clock = Clock::get()?;
    if clock.unix_timestamp >= approval_data.expiry {
        msg!("Approval has expired");
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Check transaction amount
    if amount > approval_data.max_amount {
        msg!("Amount is greater than max amount");
        return Err(ProgramError::InvalidAccountData.into());
    }

    match transfer_type {
        TransferType::Sol => {
            // Verify the approval is for SOL 
            if approval_data.token_mint != Pubkey::default() {
                msg!("Approval is not for SOL");
                return Err(ProgramError::InvalidAccountData.into());
            }

            msg!("Transferring SOL from wallet {:?} to recipient {:?}, amount: {:?}", wallet_account.key, recipient_account.key, amount);
            msg!("Wallet account's balance: {:?}", wallet_account.lamports());

            // Check if wallet has enough balance for transfer and fee
            let wallet_balance = wallet_account.lamports();

            if wallet_balance < amount + TRANSACTION_FEE {
                msg!("Wallet does not have enough balance for transfer and fee");
                return Err(ProgramError::InsufficientFunds.into());
            }

            // Transfer amount to recipient
            **wallet_account.try_borrow_mut_lamports()? -= amount;
            **recipient_account.try_borrow_mut_lamports()? += amount;

            // Transfer fee to dApp
            **wallet_account.try_borrow_mut_lamports()? -= TRANSACTION_FEE;
            **dapp_account.try_borrow_mut_lamports()? += TRANSACTION_FEE;

            msg!("Transfer completed. New wallet balance: {}", wallet_account.lamports());
        },
        TransferType::Token => {
            let token_mint_account = next_account_info(account_info_iter)?;
            let wallet_token_account = next_account_info(account_info_iter)?;
            let token_program = next_account_info(account_info_iter)?;

            // Validate all token accounts
            validate_token_accounts(
                wallet_token_account,
                token_mint_account,
                recipient_account,
                token_program,
            )?;

            // Check token account balance
            let token_balance = get_token_balance(wallet_token_account, token_program.key)?;
            if token_balance < amount {
                msg!("Insufficient token balance");
                return Err(ProgramError::InsufficientFunds.into());
            }

            // Get token decimals
            let decimals = get_token_decimals(token_mint_account, token_program.key)?;

            // Create and execute the transfer instruction
            let transfer_ix = create_transfer_instruction(
                token_program.key,
                wallet_token_account.key,
                recipient_account.key,
                token_mint_account.key,
                wallet_account.key,
                amount,
                decimals,
            )?;

            // For Token-2022, we need to include any extra accounts that might be required
            let mut accounts = vec![
                wallet_token_account.clone(),
                token_mint_account.clone(),
                recipient_account.clone(),
                wallet_account.clone(),
                token_program.clone(),
            ];

            // Add memo program if using Token-2022 (optional but recommended)
            if token_program.key == &spl_token_2022::id() {
                if let Ok(memo_program) = next_account_info(account_info_iter) {
                    accounts.push(memo_program.clone());
                }
            }

            invoke_signed(
                &transfer_ix,
                &accounts,
                &[&[b"wallet", user_account.key.as_ref(), &[bump_seed]]],
            )?;

            // Transfer SOL fee to dApp
            **wallet_account.try_borrow_mut_lamports()? -= TRANSACTION_FEE;
            **dapp_account.try_borrow_mut_lamports()? += TRANSACTION_FEE;
        }
    }

    msg!("Transaction executed successfully");
    Ok(())
}

pub fn withdraw(program_id: &Pubkey, accounts: &[AccountInfo], amount: u64, transfer_type: TransferType) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let user_account = next_account_info(account_info_iter)?;
    let wallet_account = next_account_info(account_info_iter)?;
    let recipient_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    // check the signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature.into());
    }

    // Get the wallet PDA
    let (wallet_pda, bump_seed) = derive_wallet_address(user_account.key, program_id);

    // Verify that the provided wallet account is actually the PDA we expect
    if wallet_pda != *wallet_account.key {
        msg!("Wallet account does not match");
        return Err(ProgramError::InvalidAccountData.into());
    }

    match transfer_type {
        TransferType::Sol => {
            msg!("Withdrawing SOL from wallet {:?} to recipient {:?}, amount: {:?}", wallet_account.key, recipient_account.key, amount);
            msg!("Wallet account's balance: {:?}", wallet_account.lamports());

            // Check if wallet has enough balance for withdrawal
            let wallet_balance = wallet_account.lamports();
    
            if wallet_balance < amount {
                msg!("Wallet does not have enough balance for withdrawal");
                return Err(ProgramError::InsufficientFunds.into());
            }
    
            // Withdraw amount from wallet
            **wallet_account.try_borrow_mut_lamports()? -= amount;
            **recipient_account.try_borrow_mut_lamports()? += amount;
        }
        TransferType::Token => {
            msg!("Withdrawing token");
            let token_mint_account = next_account_info(account_info_iter)?;
            let wallet_token_account = next_account_info(account_info_iter)?;
            let token_program = next_account_info(account_info_iter)?;

            // Validate accounts
            validate_token_accounts(
                wallet_token_account,
                token_mint_account,
                recipient_account,
                token_program,
            )?;

            msg!("Validated accounts");

            // Get token decimals
            let decimals = get_token_decimals(token_mint_account, token_program.key)?;

            msg!("Got token decimals: {}", decimals);

            // Check balance
            let token_balance = get_token_balance(wallet_token_account, token_program.key)?;

            msg!("Got token balance: {}", token_balance);

            if token_balance < amount {
                msg!("Insufficient token balance");
                return Err(ProgramError::InsufficientFunds.into());
            }

            msg!("Withdrawing tokens from wallet_token_account {:?} to recipient_account {:?}, amount: {:?}", 
                wallet_token_account.key, recipient_account.key, amount);

            // Create transfer instruction - SPL Token requires specific account order
            let transfer_ix = create_transfer_instruction(
                token_program.key,
                wallet_token_account.key,    // source
                recipient_account.key,        // destination
                token_mint_account.key,       // mint
                wallet_account.key,           // authority
                amount,
                decimals,
            )?;

            // Execute transfer with accounts in SPL Token's required order
            invoke_signed(
                &transfer_ix,
                &[
                    wallet_token_account.clone(),    // source
                    token_mint_account.clone(),      // mint
                    recipient_account.clone(),       // destination
                    wallet_account.clone(),          // authority
                    token_program.clone(),           // program
                ],
                &[&[b"wallet", user_account.key.as_ref(), &[bump_seed]]],
            )?;
        }
    }

    msg!("Withdrawal completed successfully");
    Ok(())
}