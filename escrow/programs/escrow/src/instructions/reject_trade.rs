use crate::constants::ESCROW_SEED;
use crate::structs::Holder;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{close_account, transfer_checked, CloseAccount};
use anchor_spl::token::{Mint, Token, TokenAccount, TransferChecked};

#[derive(Accounts)]
pub struct RejectTrade<'info> {
    /// CHECK: sender проверяется через holder.has_one = sender
    /// и участвует в PDA seeds; его data не читаются и не изменяются программой.
    #[account(mut)]
    pub sender: UncheckedAccount<'info>,
    #[account(mut)]
    pub receiver: Signer<'info>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, sender.key().as_ref(), receiver.key().as_ref()],
        bump,
        has_one = sender,
        has_one = receiver,
        close = sender
    )]
    pub holder: Account<'info, Holder>,
    #[account(
        constraint = sender_mint.key() == holder.sender_token
    )]
    pub sender_mint: Account<'info, Mint>,
    //pub receiver_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = receiver,
        associated_token::mint = sender_mint,
        associated_token::authority = sender
    )]
    pub sender_atas: Account<'info, TokenAccount>,
    //pub receiver_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = sender_mint,
        associated_token::authority = holder
    )]
    pub holder_atas: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn reject_trade(ctx: Context<RejectTrade>) -> Result<()> {
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.holder_atas.to_account_info(),
                mint: ctx.accounts.sender_mint.to_account_info(),
                to: ctx.accounts.sender_atas.to_account_info(),
                authority: ctx.accounts.holder.to_account_info(),
            },
            &[&[
                ESCROW_SEED,
                ctx.accounts.sender.key().as_ref(),
                ctx.accounts.receiver.key().as_ref(),
                &[ctx.bumps.holder],
            ]],
        ),
        ctx.accounts.holder_atas.amount,
        ctx.accounts.sender_mint.decimals,
    )?;

    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.holder_atas.to_account_info(),
            destination: ctx.accounts.sender.to_account_info(),
            authority: ctx.accounts.holder.to_account_info(),
        },
        &[&[
            ESCROW_SEED,
            ctx.accounts.sender.key().as_ref(),
            ctx.accounts.receiver.key().as_ref(),
            &[ctx.bumps.holder],
        ]],
    ))?;

    Ok(())
}
