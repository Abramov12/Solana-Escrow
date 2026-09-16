use crate::constants::ESCROW_SEED;
use crate::errors::*;
use crate::structs::Holder;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    /// CHECK: receiver не участвует на текущем этапе
    pub receiver: UncheckedAccount<'info>,
    #[account(
        init,
        payer = sender,
        space = 8 + Holder::INIT_SPACE,
        seeds = [ESCROW_SEED, sender.key().as_ref(), receiver.key().as_ref()],
        bump,
        )]
    pub holder: Account<'info, Holder>,

    pub sender_mint: Account<'info, Mint>,

    pub receiver_mint: Account<'info, Mint>,

    #[account(
        mut,
         associated_token::mint = sender_mint,
         associated_token::authority = sender
    )]
    pub sender_atas: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = sender,
        associated_token::mint = sender_mint,
        associated_token::authority = holder,
    )]
    pub holder_atas: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn initialize_escrow(
    ctx: Context<InitializeEscrow>,
    sender_amount: u64,
    receiver_amount: u64,
) -> Result<()> {
    require!(sender_amount > 0, EscrowError::NeedToSwapMoreThanZeroTokens);

    require!(
        receiver_amount > 0,
        EscrowError::NeedToSwapMoreThanZeroTokens
    );

    require!(
        ctx.accounts.sender_atas.amount >= sender_amount,
        EscrowError::NotEnoughTokenAmount
    );

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.sender_atas.to_account_info(),
                mint: ctx.accounts.sender_mint.to_account_info(),
                to: ctx.accounts.holder_atas.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
            },
        ),
        sender_amount,
        ctx.accounts.sender_mint.decimals,
    )?;

    ctx.accounts.holder.sender = ctx.accounts.sender.key();
    ctx.accounts.holder.receiver = ctx.accounts.receiver.key();
    ctx.accounts.holder.sender_token = ctx.accounts.sender_mint.key();
    ctx.accounts.holder.receiver_token = ctx.accounts.receiver_mint.key();
    ctx.accounts.holder.sender_amount = sender_amount;
    ctx.accounts.holder.receiver_amount = receiver_amount;
    ctx.accounts.holder.expires_at = Clock::get()?.unix_timestamp + 24 * 60 * 60;

    Ok(())
}
