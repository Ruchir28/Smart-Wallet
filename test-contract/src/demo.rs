use std::{str::FromStr, thread, time::Duration};
use solana_program::{pubkey::Pubkey, system_instruction};
use solana_sdk::{
    commitment_config::CommitmentConfig, instruction::AccountMeta, signature::{Keypair, Signer}, system_program, sysvar::Sysvar, transaction::Transaction
};
use solana_client::{rpc_client::RpcClient, rpc_config::RpcTransactionConfig};
use smart_contract::instruction::{WalletInstruction, TransferType};
use borsh::BorshSerialize;
use spl_token::{instruction as token_instruction};
use solana_program::clock::Clock;
use lazy_static::lazy_static;
use std::time::{SystemTime, UNIX_EPOCH};    
use spl_associated_token_account::get_associated_token_address;

// Add this at the top level of the file, outside any function
lazy_static! {
    static ref DAPP_KEYPAIR: Keypair = Keypair::new();
}

fn main() {
    println!("Starting smart contract demo");

    // Connect to the local Solana test validator
    let rpc_url = "http://localhost:8899".to_string();
    let connection = RpcClient::new_with_commitment(rpc_url, CommitmentConfig::confirmed());

    // Create a new keypair for the user
    let user_keypair = Keypair::new();
    let user_pubkey = user_keypair.pubkey();

    println!("User public key: {}", user_pubkey);


    // Airdrop some SOL to the user's account
    let airdrop_amount = 5_000_000_000; // 2 SOL in lamports
    let signature = connection
        .request_airdrop(&user_pubkey, airdrop_amount)
        .expect("Failed to request airdrop");
    connection.confirm_transaction(&signature).expect("Failed to confirm airdrop");

    println!("Airdropped {} lamports to user account", airdrop_amount);

    // Verify the balance after airdrop
    let balance = connection.get_balance(&user_pubkey).expect("Failed to get balance");
    println!("User balance after airdrop: {} lamports", balance);

      // Retry mechanism for checking the balance
    let mut retries = 5;
    let mut balance = 0;
    while retries > 0 {
        balance = connection.get_balance(&user_pubkey).expect("Failed to get balance");
        println!("User balance after airdrop: {} lamports", balance);

        if balance >= airdrop_amount {
            break;
        }

        retries -= 1;
        thread::sleep(Duration::from_secs(2)); // Wait for 2 seconds before retrying
    }

// Verify the balance after airdrop
    let balance = connection.get_balance(&user_pubkey).expect("Failed to get balance");
    println!("User balance after airdrop: {} lamports", balance);

    if balance < airdrop_amount {
        panic!("Airdrop failed to provide enough SOL. Current balance: {}", balance);
    }

    // Get the program ID (replace this with your actual program ID)
    let program_id = Pubkey::from_str("5UwRT1ngPvSWjUWYcCoRmwVTs5WFUgdDfAW29Ab5XMx2").unwrap();

    // Derive the wallet address (PDA)
    let (wallet_address, bump_seed) = Pubkey::find_program_address(&[b"wallet", user_pubkey.as_ref()], &program_id);

    // Calculate the rent-exempt balance required for the PDA
    let space = 48; // Adjust this based on your wallet's actual data structure size
    let rent_exempt_balance = connection
        .get_minimum_balance_for_rent_exemption(space)
        .expect("Failed to get rent exemption");

    // Create the instruction data for wallet initialization
    let mut instruction_data = Vec::new();
    WalletInstruction::CreateWallet.serialize(&mut instruction_data).unwrap();

    // Create the instruction to initialize the wallet in the program
    let initialize_wallet_ix = solana_program::instruction::Instruction::new_with_bytes(
        program_id,
        &instruction_data,
        vec![
            solana_program::instruction::AccountMeta::new(user_pubkey, true),
            solana_program::instruction::AccountMeta::new(wallet_address, false),
            solana_program::instruction::AccountMeta::new_readonly(solana_program::system_program::id(), false),
        ],
    );

    // Create and send the transaction with the initialization instruction
    let recent_blockhash = connection.get_latest_blockhash().expect("Failed to get recent blockhash");
    let transaction = Transaction::new_signed_with_payer(
        &[initialize_wallet_ix],
        Some(&user_pubkey),
        &[&user_keypair],
        recent_blockhash,
    );

    let signature = connection
        .send_and_confirm_transaction(&transaction)
        .expect("Failed to send transaction");

    println!("Wallet created and initialized. Transaction signature: {}", signature);

    // Get the Wrapped SOL mint address
    let wsol_mint = spl_token::native_mint::id();

    // // Create Wrapped SOL account for the user
    let user_wsol_account = create_wrapped_sol_account(&connection, &user_keypair, &wsol_mint)
        .expect("Failed to create Wrapped SOL account");
    
    let setup_user_and_wallet_wsol_result = setup_user_and_wallet_wsol(&connection, &user_keypair, &wsol_mint, &program_id, 300_000_000);

    if setup_user_and_wallet_wsol_result.is_err() {
        println!("Failed to setup user and wallet WSOL accounts: {:?}", setup_user_and_wallet_wsol_result.err());
    } else {
        println!("User and wallet WSOL accounts setup successfully");
    }

    // After creating the wallet, let's approve a dApp for both SOL and WSOL
    approve_dapp(&connection, &program_id, &user_keypair, &wallet_address, &wsol_mint)
        .expect("Failed to approve dApp for SOL and WSOL");

    // let wallet_wsol_account = get_associated_token_address(&wallet_address, &wsol_mint);
    // // Now, let's simulate a dApp trying to execute a transaction
    // simulate_dapp_transaction(&connection, &program_id,&user_pubkey, &wallet_address, &wsol_mint, &wallet_wsol_account)
    //     .expect("Failed to simulate dApp transaction");

    // Fund the wallet account with SOL
    let wallet_funding_amount = 1000_000_000; // 1 SOL
    fund_wallet_account(&connection, &user_keypair, &wallet_address, wallet_funding_amount)
        .expect("Failed to fund wallet account with SOL");

    // // Now, let's simulate a dApp trying to execute a transaction with SOL
    // simulate_dapp_transaction_sol(&connection, &program_id, &user_pubkey, &wallet_address)
    //     .expect("Failed to simulate dApp transaction with SOL");

    simulate_excessive_sol_transaction(&connection, &program_id, &user_pubkey, &wallet_address)
        .expect("Failed to simulate excessive SOL transaction");

    println!("Smart contract demo completed");
}

fn create_wrapped_sol_account(
    connection: &RpcClient,
    user_keypair: &Keypair,
    wsol_mint: &Pubkey,
) -> Result<Pubkey, Box<dyn std::error::Error>> {
    let user_pubkey = user_keypair.pubkey();
    let wsol_account = get_associated_token_address(&user_pubkey, wsol_mint);

    // Check if the account already exists
    if connection.get_account(&wsol_account).is_ok() {
        println!("Wrapped SOL account already exists: {}", wsol_account);
        return Ok(wsol_account);
    }

    // Create the Wrapped SOL account
    let create_wsol_account_ix = spl_associated_token_account::instruction::create_associated_token_account(
        &user_pubkey,
        &user_pubkey,
        &wsol_mint,
        &spl_token::id(),
    );

    // Wrap some SOL (e.g., 1 SOL)
    let wrap_amount = 1_000_000_000; // 1 SOL in lamports
    let wrap_sol_ix = spl_token::instruction::sync_native(&spl_token::id(), &wsol_account)?;

    let transfer_sol_ix = system_instruction::transfer(
        &user_pubkey,
        &wsol_account,
        wrap_amount,
    );

    let recent_blockhash = connection.get_latest_blockhash()?;
    let transaction = Transaction::new_signed_with_payer(
        &[create_wsol_account_ix, transfer_sol_ix, wrap_sol_ix],
        Some(&user_pubkey),
        &[user_keypair],
        recent_blockhash,
    );

    let signature = connection.send_and_confirm_transaction(&transaction)?;
    println!("Wrapped SOL account created and funded. Signature: {}", signature);

    Ok(wsol_account)
}

fn approve_dapp(
    connection: &RpcClient,
    program_id: &Pubkey,
    user_keypair: &Keypair,
    wallet_address: &Pubkey,
    token_mint: &Pubkey,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Approving a dApp for both SOL and WSOL");

    // Use the static dApp keypair
    let dapp_pubkey = DAPP_KEYPAIR.pubkey();

    // Approve for WSOL
    approve_single(connection, program_id, user_keypair, wallet_address, token_mint, dapp_pubkey)?;

    // Approve for native SOL
    approve_single(connection, program_id, user_keypair, wallet_address, &Pubkey::default(), dapp_pubkey)?;

    println!("DApp approved for both SOL and WSOL");
    Ok(())
}

fn approve_single(
    connection: &RpcClient,
    program_id: &Pubkey,
    user_keypair: &Keypair,
    wallet_address: &Pubkey,
    token_mint: &Pubkey,
    dapp_pubkey: Pubkey,
) -> Result<(), Box<dyn std::error::Error>> {
    let user_pubkey = user_keypair.pubkey();

    // Derive the approval account address
    let (approval_address, bump_seed) = Pubkey::find_program_address(
        &[b"approval", wallet_address.as_ref(), dapp_pubkey.as_ref(), token_mint.as_ref()],
        program_id,
    );

    // Set approval parameters
    let max_amount = 1_000_000_000; // 1 SOL in lamports
    
    // Get the current Unix timestamp
    let current_time = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64;
    let expiry = current_time + 60; // Approve for 60 seconds

    // Create the instruction data for dApp approval
    let mut instruction_data = Vec::new();
    WalletInstruction::ApproveDapp { max_amount, expiry }
        .serialize(&mut instruction_data)
        .unwrap();

    // Create the instruction to approve the dApp
    let approve_dapp_ix = solana_program::instruction::Instruction::new_with_bytes(
        *program_id,
        &instruction_data,
        vec![
            solana_program::instruction::AccountMeta::new(user_pubkey, true),
            solana_program::instruction::AccountMeta::new(*wallet_address, false),
            solana_program::instruction::AccountMeta::new_readonly(dapp_pubkey, false),
            solana_program::instruction::AccountMeta::new_readonly(*token_mint, false),
            solana_program::instruction::AccountMeta::new(approval_address, false),
            solana_program::instruction::AccountMeta::new_readonly(solana_program::system_program::id(), false),
        ],
    );

    // Create and send the transaction
    let recent_blockhash = connection.get_latest_blockhash()?;
    let transaction = Transaction::new_signed_with_payer(
        &[approve_dapp_ix],
        Some(&user_pubkey),
        &[user_keypair],
        recent_blockhash,
    );

    let signature = connection.send_and_confirm_transaction(&transaction)?;

    println!("DApp approved for {}. Transaction signature: {}", 
             if token_mint == &Pubkey::default() { "SOL" } else { "WSOL" }, 
             signature);
    Ok(())
}

// fn simulate_dapp_transaction(
//     connection: &RpcClient,
//     program_id: &Pubkey,
//     wallet_address: &Pubkey,
//     wsol_mint: &Pubkey,
//     wallet_wsol_account: &Pubkey,
// ) -> Result<(), Box<dyn std::error::Error>> {
//     println!("Simulating a dApp transaction with Wrapped SOL");

//     let dapp_keypair = &DAPP_KEYPAIR;
//     let dapp_pubkey = dapp_keypair.pubkey();

//     // Check dApp account balance and fund if necessary
//     let dapp_balance = connection.get_balance(&dapp_pubkey)?;
//     let minimum_balance = connection.get_minimum_balance_for_rent_exemption(0)?;
    
//     if dapp_balance < minimum_balance {
//         println!("dApp account needs funding. Current balance: {}", dapp_balance);
//         let airdrop_amount = minimum_balance - dapp_balance + 2_000_000; // Extra lamports for transaction fees
//         let airdrop_signature = connection.request_airdrop(&dapp_pubkey, airdrop_amount)?;
        
//         // Retry mechanism for confirming the transaction
//         let mut retries = 5;
//         while retries > 0 {
//             std::thread::sleep(std::time::Duration::from_secs(2));
//             match connection.confirm_transaction(&airdrop_signature) {
//                 Ok(_) => {
//                     println!("Airdropped {} lamports to dApp account", airdrop_amount);
//                     break;
//                 },
//                 Err(_) => {
//                     retries -= 1;
//                     if retries == 0 {
//                         return Err("Failed to confirm airdrop transaction".into());
//                     }
//                 }
//             }
//         }
        
//         // Verify the balance after airdrop with retries
//         let mut retries = 5;
//         let mut new_balance = 0;
//         while retries > 0 {
//             new_balance = connection.get_balance(&dapp_pubkey)?;
//             if new_balance >= minimum_balance {
//                 println!("Airdrop processed successfully. New balance: {}", new_balance);
//                 break;
//             }
//             println!("Airdrop may not have been fully processed. Current balance: {}. Retrying...", new_balance);
//             retries -= 1;
//             std::thread::sleep(std::time::Duration::from_secs(2));
//         }
//         if new_balance < minimum_balance {
//             println!("Airdrop failed to provide enough SOL after retries. Final balance: {}", new_balance);
//         }
//     }

//     let (approval_address, _) = Pubkey::find_program_address(
//         &[b"approval", wallet_address.as_ref(), dapp_pubkey.as_ref(), wsol_mint.as_ref()],
//         program_id,
//     );

//     // Create a new recipient and their associated token account
//     let recipient_keypair = Keypair::new();
//     let recipient_pubkey = recipient_keypair.pubkey();
//     let recipient_wsol_account = get_associated_token_address(&recipient_pubkey, wsol_mint);

//     // Create the recipient's Wrapped SOL account
//     let create_recipient_wsol_account_ix = spl_associated_token_account::instruction::create_associated_token_account(
//         &dapp_pubkey,
//         &recipient_pubkey,
//         &wsol_mint,
//         &spl_token::id(),
//     );

//     let amount = 200_000_000; // 0.2 SOL in lamports

//     // Serialize the instruction data
//     let mut instruction_data = Vec::new();
//     WalletInstruction::ExecuteTransaction { amount }.serialize(&mut instruction_data).unwrap();

//     // Create the instruction to execute the transaction
//     let execute_tx_ix = solana_program::instruction::Instruction::new_with_bytes(
//         *program_id,
//         &instruction_data,
//         vec![
//             solana_program::instruction::AccountMeta::new(dapp_pubkey, true),
//             solana_program::instruction::AccountMeta::new(*wallet_address, false),
//             solana_program::instruction::AccountMeta::new(approval_address, false),
//             solana_program::instruction::AccountMeta::new_readonly(*wsol_mint, false),
//             solana_program::instruction::AccountMeta::new(*wallet_wsol_account, false),
//             solana_program::instruction::AccountMeta::new(recipient_wsol_account, false),
//             solana_program::instruction::AccountMeta::new_readonly(solana_program::system_program::id(), false),
//             solana_program::instruction::AccountMeta::new_readonly(spl_token::id(), false),
//         ],
//     );

//     let recent_blockhash = connection.get_latest_blockhash()?;
//     let transaction = Transaction::new_signed_with_payer(
//         &[
//             create_recipient_wsol_account_ix,
//             execute_tx_ix,
//         ],
//         Some(&dapp_pubkey),
//         &[dapp_keypair],
//         recent_blockhash,
//     );

//     match connection.send_and_confirm_transaction(&transaction) {
//         Ok(signature) => println!("Transaction executed successfully. Signature: {}", signature),
//         Err(e) => println!("Transaction failed: {:?}", e),
//     }

//     // Check recipient's Wrapped SOL balance
//     let recipient_wsol_balance = connection.get_token_account_balance(&recipient_wsol_account)?;
//     println!("Recipient Wrapped SOL balance after transaction: {} lamports", recipient_wsol_balance.amount);

//     Ok(())
// }

fn simulate_dapp_transaction(
    connection: &RpcClient,
    program_id: &Pubkey,
    user_address: &Pubkey,
    wallet_address: &Pubkey,
    wsol_mint: &Pubkey,
    wallet_wsol_account: &Pubkey,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Simulating a dApp transaction with Wrapped SOL");

    let dapp_keypair = &DAPP_KEYPAIR;
    let dapp_pubkey = dapp_keypair.pubkey();

    // Check dApp account balance and fund if necessary
    let dapp_balance = connection.get_balance(&dapp_pubkey)?;
    let minimum_balance = connection.get_minimum_balance_for_rent_exemption(0)?;
    
    if dapp_balance < minimum_balance {
        println!("dApp account needs funding. Current balance: {}", dapp_balance);
        let airdrop_amount = minimum_balance - dapp_balance + 2_000_000; // Extra lamports for transaction fees
        let airdrop_signature = connection.request_airdrop(&dapp_pubkey, airdrop_amount)?;
        
        // Retry mechanism for confirming the transaction
        let mut retries = 5;
        while retries > 0 {
            std::thread::sleep(std::time::Duration::from_secs(2));
            match connection.confirm_transaction(&airdrop_signature) {
                Ok(_) => {
                    println!("Airdropped {} lamports to dApp account", airdrop_amount);
                    break;
                },
                Err(_) => {
                    retries -= 1;
                    if retries == 0 {
                        return Err("Failed to confirm airdrop transaction".into());
                    }
                }
            }
        }
        
        // Verify the balance after airdrop with retries
        let mut retries = 5;
        let mut new_balance = 0;
        while retries > 0 {
            new_balance = connection.get_balance(&dapp_pubkey)?;
            if new_balance >= minimum_balance {
                println!("Airdrop processed successfully. New balance: {}", new_balance);
                break;
            }
            println!("Airdrop may not have been fully processed. Current balance: {}. Retrying...", new_balance);
            retries -= 1;
            std::thread::sleep(std::time::Duration::from_secs(2));
        }
        if new_balance < minimum_balance {
            println!("Airdrop failed to provide enough SOL after retries. Final balance: {}", new_balance);
        }
    }

    let (approval_address, _) = Pubkey::find_program_address(
        &[b"approval", wallet_address.as_ref(), dapp_pubkey.as_ref(), wsol_mint.as_ref()],
        program_id,
    );

    // Create a new recipient and their associated token account
    // let recipient_keypair = Keypair::from;
    let recipient_pubkey = Pubkey::from_str("4gJkyvuBvrhmENBsSRAe7Py1WcdDtrBtUQgonzLEGPnm").unwrap();
    let recipient_wsol_account = get_associated_token_address(&recipient_pubkey, wsol_mint);

    println!("dApp pubkey: {}", dapp_pubkey);
    println!("Wallet address: {}", wallet_address);
    println!("User Address: {}", user_address);
    println!("WSOL mint: {}", wsol_mint);
    println!("Wallet WSOL account: {}", wallet_wsol_account);
    println!("Approval address: {}", approval_address);
    println!("Recipient pubkey: {}", recipient_pubkey);
    println!("Recipient WSOL account: {}", recipient_wsol_account);

    // Check balances before transaction
    let wallet_wsol_balance = connection.get_token_account_balance(wallet_wsol_account)?;
    println!("Wallet WSOL balance before transaction: {}", wallet_wsol_balance.amount);

    // Create the recipient's Wrapped SOL account
    let create_recipient_wsol_account_ix = spl_associated_token_account::instruction::create_associated_token_account_idempotent(
        &dapp_pubkey,
        &recipient_pubkey,
        &wsol_mint,
        &spl_token::id(),
    );


    let amount = 200_000_000; // 0.2 SOL in lamports

    // Serialize the instruction data
    let mut instruction_data = Vec::new();
    WalletInstruction::ExecuteTransaction { amount, transfer_type: TransferType::Token }.serialize(&mut instruction_data).unwrap();

    // Create the instruction to execute the transaction
    let execute_tx_ix = solana_program::instruction::Instruction::new_with_bytes(
        *program_id,
        &instruction_data,
        vec![
            solana_program::instruction::AccountMeta::new(dapp_pubkey, true),
            solana_program::instruction::AccountMeta::new(*user_address, false),
            solana_program::instruction::AccountMeta::new(*wallet_address, false),
            solana_program::instruction::AccountMeta::new(approval_address, false),
            solana_program::instruction::AccountMeta::new(recipient_wsol_account, false),
            solana_program::instruction::AccountMeta::new_readonly(solana_program::system_program::id(), false),
            solana_program::instruction::AccountMeta::new_readonly(*wsol_mint, false),
            solana_program::instruction::AccountMeta::new(*wallet_wsol_account, false),
            solana_program::instruction::AccountMeta::new_readonly(spl_token::id(), false),
        ],
    );

    let recent_blockhash = connection.get_latest_blockhash()?;
    let transaction = Transaction::new_signed_with_payer(
        &[
            create_recipient_wsol_account_ix,
            execute_tx_ix,
        ],
        Some(&dapp_pubkey),
        &[dapp_keypair],
        recent_blockhash,
    );

    println!("Sending transaction...");
    let signature = connection.send_transaction(&transaction)?;
    println!("Transaction sent. Signature: {}", signature);

    // Wait for confirmation
    let mut retries = 10;
    while retries > 0 {
        match connection.get_signature_status(&signature)? {
            Some(Ok(_)) => {
                println!("Transaction confirmed successfully");
                break;
            }
            Some(Err(e)) => {
                println!("Transaction failed: {:?}", e);
                // Attempt to fetch the transaction status for more details
                match connection.get_transaction_with_config(
                    &signature,
                    RpcTransactionConfig {
                        encoding: None,
                        commitment: None,
                        max_supported_transaction_version: None,
                    }
                ) {
                    Ok(confirmed_tx) => println!("Transaction status: {:?}", confirmed_tx),
                    Err(e) => println!("Failed to fetch transaction status: {:?}", e),
                }
                return Err(format!("Transaction failed: {:?}", e).into());
            }
            None => {
                println!("Transaction still pending. Retrying...");
                retries -= 1;
                std::thread::sleep(std::time::Duration::from_secs(2));
            }
        }
    }

    if retries == 0 {
        return Err("Transaction confirmation timed out".into());
    }

    // Check recipient's Wrapped SOL balance
    let recipient_wsol_balance = connection.get_token_account_balance(&recipient_wsol_account)?;
    println!("Recipient Wrapped SOL balance after transaction: {} lamports", recipient_wsol_balance.amount);

    // Check wallet's Wrapped SOL balance after transaction
    let wallet_wsol_balance_after = connection.get_token_account_balance(wallet_wsol_account)?;
    println!("Wallet WSOL balance after transaction: {}", wallet_wsol_balance_after.amount);

    Ok(())
}



fn setup_user_and_wallet_wsol(
    connection: &RpcClient,
    user_keypair: &Keypair,
    wsol_mint: &Pubkey,
    program_id: &Pubkey,
    amount: u64,
) -> Result<(), Box<dyn std::error::Error>> {

    println!("Setting up user and wallet WSOL accounts");

    let user_pubkey = user_keypair.pubkey();
    
    // 1. Create and fund user's own WSOL account
    let user_wsol_account = get_associated_token_address(&user_pubkey, wsol_mint);
    
    // Create user's WSOL account if it doesn't exist
    if connection.get_account(&user_wsol_account).is_err() {
        let create_ata_ix = spl_associated_token_account::instruction::create_associated_token_account(
            &user_pubkey,
            &user_pubkey,
            wsol_mint,
            &spl_token::id(),
        );
        let recent_blockhash = connection.get_latest_blockhash()?;
        let create_ata_tx = Transaction::new_signed_with_payer(
            &[create_ata_ix],
            Some(&user_pubkey),
            &[user_keypair],
            recent_blockhash,
        );
        connection.send_and_confirm_transaction(&create_ata_tx)?;
    }

    // Wrap SOL to WSOL
    let wrap_sol_ix = spl_token::instruction::sync_native(&spl_token::id(), &user_wsol_account)?;
    let transfer_sol_ix = system_instruction::transfer(&user_pubkey, &user_wsol_account, amount);
    
    let recent_blockhash = connection.get_latest_blockhash()?;
    let wrap_sol_tx = Transaction::new_signed_with_payer(
        &[transfer_sol_ix, wrap_sol_ix],
        Some(&user_pubkey),
        &[user_keypair],
        recent_blockhash,
    );
    connection.send_and_confirm_transaction(&wrap_sol_tx)?;
    println!("User's WSOL account funded with {} lamports", amount);


    // 2. Transfer WSOL to smart wallet PDA
    let (wallet_pda, _) = Pubkey::find_program_address(&[b"wallet", user_pubkey.as_ref()], program_id);
    let wallet_wsol_account = get_associated_token_address(&wallet_pda, wsol_mint);

    // Create wallet's WSOL account if it doesn't exist
    if connection.get_account(&wallet_wsol_account).is_err() {
        let create_wallet_ata_ix = spl_associated_token_account::instruction::create_associated_token_account(
            &user_pubkey,
            &wallet_pda,
            wsol_mint,
            &spl_token::id(),
        );
        let recent_blockhash = connection.get_latest_blockhash()?;
        let create_wallet_ata_tx = Transaction::new_signed_with_payer(
            &[create_wallet_ata_ix],
            Some(&user_pubkey),
            &[user_keypair],
            recent_blockhash,
        );
        connection.send_and_confirm_transaction(&create_wallet_ata_tx)?;
    }

    // Transfer WSOL from user's account to wallet's account
    let transfer_wsol_ix = spl_token::instruction::transfer(
        &spl_token::id(),
        &user_wsol_account,
        &wallet_wsol_account,
        &user_pubkey,
        &[&user_pubkey],
        amount,
    )?;

    let recent_blockhash = connection.get_latest_blockhash()?;
    let transfer_wsol_tx = Transaction::new_signed_with_payer(
        &[transfer_wsol_ix],
        Some(&user_pubkey),
        &[user_keypair],
        recent_blockhash,
    );
    connection.send_and_confirm_transaction(&transfer_wsol_tx)?;
    println!("Transferred {} WSOL to smart wallet", amount);

    Ok(())
}

fn simulate_dapp_transaction_sol(
    connection: &RpcClient,
    program_id: &Pubkey,
    user_address: &Pubkey,
    wallet_address: &Pubkey,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Simulating a dApp transaction with SOL");

    let dapp_keypair = &DAPP_KEYPAIR;
    let dapp_pubkey = dapp_keypair.pubkey();

    // Check dApp account balance and fund if necessary
    let dapp_balance = connection.get_balance(&dapp_pubkey)?;
    let minimum_balance = connection.get_minimum_balance_for_rent_exemption(0)?;
    
    if dapp_balance < minimum_balance {
        println!("dApp account needs funding. Current balance: {}", dapp_balance);
        let airdrop_amount = minimum_balance - dapp_balance + 2_000_000; // Extra lamports for transaction fees
        let airdrop_signature = connection.request_airdrop(&dapp_pubkey, airdrop_amount)?;
        
        // Retry mechanism for confirming the transaction
        let mut retries = 5;
        while retries > 0 {
            std::thread::sleep(std::time::Duration::from_secs(2));
            match connection.confirm_transaction(&airdrop_signature) {
                Ok(_) => {
                    println!("Airdropped {} lamports to dApp account", airdrop_amount);
                    break;
                },
                Err(_) => {
                    retries -= 1;
                    if retries == 0 {
                        return Err("Failed to confirm airdrop transaction".into());
                    }
                }
            }
        }
        
        // Verify the balance after airdrop with retries
        let mut retries = 5;
        let mut new_balance = 0;
        while retries > 0 {
            new_balance = connection.get_balance(&dapp_pubkey)?;
            if new_balance >= minimum_balance {
                println!("Airdrop processed successfully. New balance: {}", new_balance);
                break;
            }
            println!("Airdrop may not have been fully processed. Current balance: {}. Retrying...", new_balance);
            retries -= 1;
            std::thread::sleep(std::time::Duration::from_secs(2));
        }
        if new_balance < minimum_balance {
            println!("Airdrop failed to provide enough SOL after retries. Final balance: {}", new_balance);
        }
    }

    let (approval_address, _) = Pubkey::find_program_address(
        &[b"approval", wallet_address.as_ref(), dapp_pubkey.as_ref(), &Pubkey::default().to_bytes()],
        program_id,
    );

    // Use the same recipient as in simulate_dapp_transaction
    let recipient_pubkey = Pubkey::from_str("4gJkyvuBvrhmENBsSRAe7Py1WcdDtrBtUQgonzLEGPnm").unwrap();

    println!("dApp pubkey: {}", dapp_pubkey);
    println!("Wallet address: {}", wallet_address);
    println!("User Address: {}", user_address);
    println!("Approval address: {}", approval_address);
    println!("Recipient pubkey: {}", recipient_pubkey);

    // Check balances before transaction
    let wallet_balance = connection.get_balance(wallet_address)?;
    println!("Wallet SOL balance before transaction: {} lamports", wallet_balance);

    // Ensure the wallet has enough balance for the transaction
    let amount = 100_000_000; // 0.1 SOL in lamports
    if wallet_balance < amount {
        return Err(format!("Insufficient balance in wallet. Current balance: {}, Required: {}", wallet_balance, amount).into());
    }

    // Serialize the instruction data
    let mut instruction_data = Vec::new();
    WalletInstruction::ExecuteTransaction { amount, transfer_type: TransferType::Sol }.serialize(&mut instruction_data).unwrap();

    // Create the instruction to execute the transaction
    let execute_tx_ix = solana_program::instruction::Instruction::new_with_bytes(
        *program_id,
        &instruction_data,
        vec![
            solana_program::instruction::AccountMeta::new(dapp_pubkey, true),
            solana_program::instruction::AccountMeta::new(*user_address, false),
            solana_program::instruction::AccountMeta::new(*wallet_address, false),
            solana_program::instruction::AccountMeta::new(approval_address, false),
            solana_program::instruction::AccountMeta::new(recipient_pubkey, false),
            solana_program::instruction::AccountMeta::new_readonly(solana_program::system_program::id(), false),
        ],
    );

    let recent_blockhash = connection.get_latest_blockhash()?;
    let transaction = Transaction::new_signed_with_payer(
        &[execute_tx_ix],
        Some(&dapp_pubkey),
        &[dapp_keypair],
        recent_blockhash,
    );

    println!("Sending transaction...");
    let signature = connection.send_transaction(&transaction)?;
    println!("Transaction sent. Signature: {}", signature);

    // Wait for confirmation
    let mut retries = 10;
    while retries > 0 {
        match connection.get_signature_status(&signature)? {
            Some(Ok(_)) => {
                println!("Transaction confirmed successfully");
                break;
            }
            Some(Err(e)) => {
                println!("Transaction failed: {:?}", e);
                // Attempt to fetch the transaction status for more details
                match connection.get_transaction_with_config(
                    &signature,
                    RpcTransactionConfig {
                        encoding: None,
                        commitment: None,
                        max_supported_transaction_version: None,
                    }
                ) {
                    Ok(confirmed_tx) => println!("Transaction status: {:?}", confirmed_tx),
                    Err(e) => println!("Failed to fetch transaction status: {:?}", e),
                }
                return Err(format!("Transaction failed: {:?}", e).into());
            }
            None => {
                println!("Transaction still pending. Retrying...");
                retries -= 1;
                std::thread::sleep(std::time::Duration::from_secs(2));
            }
        }
    }

    if retries == 0 {
        return Err("Transaction confirmation timed out".into());
    }

    // Check recipient's SOL balance
    let recipient_balance = connection.get_balance(&recipient_pubkey)?;
    println!("Recipient SOL balance after transaction: {} lamports", recipient_balance);

    // Check wallet's SOL balance after transaction
    let wallet_balance_after = connection.get_balance(wallet_address)?;
    println!("Wallet SOL balance after transaction: {} lamports", wallet_balance_after);

    Ok(())
}

fn simulate_excessive_sol_transaction(
    connection: &RpcClient,
    program_id: &Pubkey,
    user_address: &Pubkey,
    wallet_address: &Pubkey,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Simulating an excessive SOL transaction (should fail)");

    let dapp_keypair = &DAPP_KEYPAIR;
    let dapp_pubkey = dapp_keypair.pubkey();

    // Assume the dApp was approved for 1 SOL (1_000_000_000 lamports)
    let approved_amount = 1_000_000_000;
    let excessive_amount = approved_amount + 1; // Trying to send more than approved

    // Generate a random recipient
    let recipient_keypair = Keypair::new();
    let recipient_pubkey = recipient_keypair.pubkey();

    // Derive the approval account address
    let (approval_address, _) = Pubkey::find_program_address(
        &[b"approval", wallet_address.as_ref(), dapp_pubkey.as_ref(), &Pubkey::default().to_bytes()],
        program_id,
    );

    // Create the instruction data for executing the transaction
    let mut instruction_data = Vec::new();
    WalletInstruction::ExecuteTransaction { 
        amount: excessive_amount, 
        transfer_type: TransferType::Sol 
    }
    .serialize(&mut instruction_data)
    .unwrap();

    // Create the instruction to execute the transaction
    let execute_transaction_ix = solana_program::instruction::Instruction::new_with_bytes(
        *program_id,
        &instruction_data,
        vec![
            AccountMeta::new_readonly(dapp_pubkey, true),
            AccountMeta::new(*user_address, true),
            AccountMeta::new(*wallet_address, false),
            AccountMeta::new(approval_address, false),
            AccountMeta::new(recipient_pubkey, false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
        ],
    );

    // Create and send the transaction
    let recent_blockhash = connection.get_latest_blockhash()?;
    let transaction = Transaction::new_signed_with_payer(
        &[execute_transaction_ix],
        Some(&dapp_pubkey),
        &[dapp_keypair],
        recent_blockhash,
    );

    println!("Attempting to send {} lamports (approved amount: {})", excessive_amount, approved_amount);

    match connection.send_and_confirm_transaction(&transaction) {
        Ok(signature) => {
            println!("Transaction unexpectedly succeeded. Signature: {}", signature);
            Ok(())
        }
        Err(e) => {
            println!("Transaction failed as expected: {:?}", e);
            Ok(())
        }
    }
}


fn fund_wallet_account(
    connection: &RpcClient,
    user_keypair: &Keypair,
    wallet_address: &Pubkey,
    amount: u64,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Funding wallet account with SOL");

    let user_pubkey = user_keypair.pubkey();

    // Create transfer instruction
    let instruction = system_instruction::transfer(
        &user_pubkey,
        wallet_address,
        amount,
    );

    // Create and send transaction
    let recent_blockhash = connection.get_latest_blockhash()?;
    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&user_pubkey),
        &[user_keypair],
        recent_blockhash,
    );

    let signature = connection.send_and_confirm_transaction(&transaction)?;
    println!("Transferred {} lamports to wallet account. Signature: {}", amount, signature);

    // Verify the balance
    let wallet_balance = connection.get_balance(wallet_address)?;
    println!("Wallet balance after funding: {} lamports", wallet_balance);

    Ok(())
}