use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod deep_waifu_payment_contract {

    use super::*;
    pub fn initialize(ctx: Context<Initialize>, price_lamports: u64, max_count: u16, _bump: u8) -> ProgramResult {
        let my_pda = &mut ctx.accounts.my_pda;

        if my_pda.count > 0 {
            return Err(ErrorCode::AlreadyInitialized.into());
        }

        my_pda.price_lamports = price_lamports;
        my_pda.beneficiary = *ctx.accounts.payer.key;
        my_pda.max_count = max_count;
        my_pda.count = 1;
        Ok(())
    }

    // pub fn pay_for_mint(ctx: Context<PayForMint>) -> ProgramResult {
    //     let my_pda = &mut ctx.accounts.my_pda;

    //     if my_pda.count == 0 {
    //         return Err(ErrorCode::NotInitialized.into());
    //     }

    //     if ctx.accounts.beneficiary.key != &my_pda.beneficiary {
    //         return Err(ErrorCode::InvalidBeneficiary.into());
    //     }

    //     msg!("Transfer {} lamports to {}", my_pda.price_lamports, my_pda.beneficiary);
    //     invoke(
    //         &system_instruction::transfer(ctx.accounts.user.key, ctx.accounts.beneficiary.key, my_pda.price_lamports),
    //         &[
    //             ctx.accounts.user.clone(),
    //             ctx.accounts.beneficiary.clone(),
    //             ctx.accounts.system_program.clone(),
    //         ],
    //     )?;

    //     my_pda.count += 1;
    //     msg!("New count is {}", my_pda.count);
    //     Ok(())
    // }


}
 
#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Initialize<'info> {
    // #[account(init, payer = payer, seeds = [b"payment-storage".as_ref()], bump = bump, space = 8 + 2 + 2 + 40)]
    #[account(init, payer = payer, seeds = [b"payment-storage".as_ref()], bump = bump, space = 8 + 2 + 2 + 40)]
    pub my_pda: Account<'info, PaymentStorage>,
    #[account(signer)]
    pub payer: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

// #[derive(Accounts)]
// pub struct PayForMint<'info> {
//     #[account(mut, seeds = [b"payment-storage".as_ref()], bump)]
//     pub my_pda: Account<'info, PaymentStorage>,
//     #[account(signer)]
//     pub payer: AccountInfo<'info>,
//     #[account()]
//     pub beneficiary: AccountInfo<'info>,
//     #[account(address = system_program::ID)]
//     pub system_program: AccountInfo<'info>,
// }

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