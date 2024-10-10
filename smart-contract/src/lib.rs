use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
};

pub mod instruction;
mod processor;
mod state;
use instruction::WalletInstruction;
use processor::{approve_dapp, create_wallet, execute_transaction, withdraw};


entrypoint!(process_instruction);
 

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = WalletInstruction::unpack(instruction_data)?;

    match instruction {
        WalletInstruction::CreateWallet => {
            msg!("Instruction: Create Wallet");
            create_wallet(program_id, accounts, instruction_data)?;
        }
        WalletInstruction::ApproveDapp { max_amount, expiry } => {
            msg!("Instruction: Approve dApp with max_amount: {} and expiry: {}", max_amount, expiry);
            approve_dapp(program_id, accounts, max_amount, expiry)?;
        }
        WalletInstruction::ExecuteTransaction { amount, transfer_type } => {
            msg!("Instruction: Execute Transaction with amount: {}", amount);
            execute_transaction(program_id, accounts, amount, transfer_type)?;
        }
        WalletInstruction::Withdraw { amount, transfer_type } => {
            msg!("Instruction: Withdraw with amount: {}", amount);
            withdraw(program_id, accounts, amount, transfer_type)?;
        }
    }

    Ok(())
}