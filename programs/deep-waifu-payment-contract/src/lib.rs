use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction;

declare_id!("deepDCigiqV6vbvjbXQRvYsQGcWc7ynVgVo3qBAj2DJ");

#[program]
pub mod deep_waifu_payment_contract {

    use super::*;
    pub fn initialize(ctx: Context<Initialize>,
        bump: u8) -> ProgramResult {
        let my_pda = &mut ctx.accounts.my_pda;

        my_pda.authority = *ctx.accounts.authority.key;
        my_pda.bump = bump;

        Ok(())
    }

    pub fn set_params(ctx: Context<SetParams>,
        price_lamports: Option<u64>,
        count: Option<u16>,
        max_count: Option<u16>,
        beneficiary: Option<Pubkey>,
        new_authority: Option<Pubkey>,
        ) -> ProgramResult {
        let my_pda = &mut ctx.accounts.my_pda;

        if price_lamports.is_some() {
            my_pda.price_lamports = price_lamports.unwrap();
        }
        if count.is_some() {
            my_pda.count = count.unwrap()
        }
        if max_count.is_some() {
            my_pda.max_count = max_count.unwrap()
        }
        if beneficiary.is_some() {
            my_pda.beneficiary = beneficiary.unwrap()
        }
        if new_authority.is_some() {
            my_pda.authority = new_authority.unwrap()
        }

        Ok(())
    }

    pub fn pay_for_mint(ctx: Context<PayForMint>) -> ProgramResult {
        let my_pda = &mut ctx.accounts.my_pda;

        msg!("Transfer {} lamports to {}", my_pda.price_lamports, my_pda.beneficiary);
        invoke(
            &system_instruction::transfer(ctx.accounts.payer.key, ctx.accounts.beneficiary.key, my_pda.price_lamports),
            &[
                ctx.accounts.payer.clone(),
                ctx.accounts.beneficiary.clone(),
                ctx.accounts.system_program.clone(),
            ],
        )?;

        my_pda.count += 1;
        msg!("Paid for mint [{}:{}]", ctx.accounts.payer.key, my_pda.count);

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, seeds = [b"payment-storage".as_ref()], bump = bump)]
    pub my_pda: Account<'info, PaymentStorage>,
    #[account(signer)]
    pub authority: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct SetParams<'info> {
    #[account(mut, seeds = [b"payment-storage".as_ref()], bump, has_one = authority)]
    pub my_pda: Account<'info, PaymentStorage>,
    #[account(signer)]
    pub authority: AccountInfo<'info>,
    // pub beneficiary: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct PayForMint<'info> {
    #[account(mut, seeds = [b"payment-storage".as_ref()], bump, has_one = beneficiary, constraint = &my_pda.count < &my_pda.max_count)]
    pub my_pda: Account<'info, PaymentStorage>,
    #[account(signer)]
    pub payer: AccountInfo<'info>,
    pub beneficiary: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[account]
#[derive(Default)]
pub struct PaymentStorage {
    pub price_lamports: u64,
    pub count: u16,
    pub max_count: u16,
    pub beneficiary: Pubkey,
    pub authority: Pubkey,
    pub bump: u8,
}
