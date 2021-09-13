use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod deep_waifu_payment_contract {

    use super::*;
    pub fn initialize(ctx: Context<Initialize>, beneficiary: Pubkey, price_lamports: u64, max_count: u16) -> ProgramResult {
        let storage_account = &mut ctx.accounts.storage_account;

        if storage_account.count > 0 {
            return Err(ErrorCode::AlreadyInitialized.into());
        }

        storage_account.price_lamports = price_lamports;
        storage_account.beneficiary = beneficiary;
        storage_account.max_count = max_count;
        storage_account.count = 1;
        Ok(())
    }

    pub fn pay_for_mint(ctx: Context<PayForMint>) -> ProgramResult {
        let storage_account = &mut ctx.accounts.storage_account;

        if storage_account.count == 0 {
            return Err(ErrorCode::NotInitialized.into());
        }

        if ctx.accounts.beneficiary.key != &storage_account.beneficiary {
            return Err(ErrorCode::InvalidBeneficiary.into());
        }

        msg!("Transfer {} lamports to {}", storage_account.price_lamports, storage_account.beneficiary);
        invoke(
            &system_instruction::transfer(ctx.accounts.user.key, ctx.accounts.beneficiary.key, storage_account.price_lamports),
            &[
                ctx.accounts.user.clone(),
                ctx.accounts.beneficiary.clone(),
                ctx.accounts.system_program.clone(),
            ],
        )?;

        storage_account.count += 1;
        msg!("New count is {}", storage_account.count);
        Ok(())
    }


}
 
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 2 + 2 + 40)]
    pub storage_account: Account<'info, PaymentStorage>,
    #[account(signer)]
    pub user: AccountInfo<'info>, 
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct PayForMint<'info> {
    #[account(mut)]
    pub storage_account: Account<'info, PaymentStorage>,
    #[account(signer)]
    pub user: AccountInfo<'info>,
    #[account()]
    pub beneficiary: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[account]
pub struct PaymentStorage {
    pub price_lamports: u64,
    pub count: u16,
    pub max_count: u16,
    pub beneficiary: Pubkey,
}

#[error]
pub enum ErrorCode {
    #[msg("Program not initialized.")]
    NotInitialized,
    #[msg("Program already initialized.")]
    AlreadyInitialized,
    #[msg("Invalid beneficiary.")]
    InvalidBeneficiary,
}