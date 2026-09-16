use crate::constants::ESCROW_SEED;
use crate::errors::*;
use crate::structs::Holder;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{close_account, transfer_checked, CloseAccount};
use anchor_spl::token::{Mint, Token, TokenAccount, TransferChecked};

#[derive(Accounts)]
pub struct AcceptTrade<'info> {
    #[account(mut)]
    pub receiver: Signer<'info>,
    /// CHECK: sender проверяется через holder.has_one = sender
    /// и участвует в PDA seeds; его data не читаются и не изменяются программой.
    #[account(mut)]
    pub sender: UncheckedAccount<'info>,
    pub sender_mint: Box<Account<'info, Mint>>,
    pub receiver_mint: Box<Account<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = receiver,
        associated_token::mint = receiver_mint,
        associated_token::authority = sender
    )]
    pub sender_atar: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [
            ESCROW_SEED,
            sender.key().as_ref(), 
            receiver.key().as_ref()
            ],
        bump,
        has_one = sender,
        has_one = receiver,
        constraint = holder.sender_token == sender_mint.key() 
            @ EscrowError::WrongSenderMint,
        constraint = holder.receiver_token == receiver_mint.key() 
            @ EscrowError::WrongReceiverMint,
        close = sender
    )]
    pub holder: Box<Account<'info, Holder>>,
    #[account(
        mut, 
        associated_token::mint = sender_mint,
        associated_token::authority = holder
    )]
    pub holder_atas: Box<Account<'info, TokenAccount>>,

    #[account(
        
        init_if_needed, 
        payer = receiver,
        associated_token::mint = sender_mint, 
        associated_token::authority = receiver,
    )]
    pub receiver_atas: Box<Account<'info, TokenAccount>>,
    #[account(
        mut, 
        associated_token::mint = receiver_mint,
        associated_token::authority = receiver
    )]
    pub receiver_atar: Box<Account<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn accept_trade(ctx: Context<AcceptTrade>) -> Result<()> {
    require!(
        ctx.accounts.receiver_atar.amount >= ctx.accounts.holder.receiver_amount,
        EscrowError::NotEnoughTokenAmount
    );

    require!(
        ctx.accounts.holder_atas.amount >= ctx.accounts.holder.sender_amount,
        EscrowError::LostTokens
    );

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.receiver_atar.to_account_info(),
                mint: ctx.accounts.receiver_mint.to_account_info(),
                to: ctx.accounts.sender_atar.to_account_info(),
                authority: ctx.accounts.receiver.to_account_info(),
            },
        ),
        ctx.accounts.holder.receiver_amount,
        ctx.accounts.receiver_mint.decimals,
    )?;

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.holder_atas.to_account_info(),
                mint: ctx.accounts.sender_mint.to_account_info(),
                to: ctx.accounts.receiver_atas.to_account_info(),
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
