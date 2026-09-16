pub mod constants;
pub mod errors;
pub mod instructions;
pub mod structs;

use anchor_lang::prelude::*;

pub use instructions::*;

declare_id!("7N8gcK8wm8uwVHVZtZs3s9KoxCmLd8tvLyLo8sFQpKYc");

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        sender_amount: u64,
        receiver_amount: u64,
    ) -> Result<()> {
        instructions::initialize_escrow::initialize_escrow(ctx, sender_amount, receiver_amount)
    }

    pub fn accept_trade(ctx: Context<AcceptTrade>) -> Result<()> {
        instructions::accept_trade::accept_trade(ctx)
    }

    pub fn reject_trade(ctx: Context<RejectTrade>) -> Result<()> {
        instructions::reject_trade::reject_trade(ctx)
    }

    pub fn cancel_expire_trade(ctx: Context<CancelExpireTrade>) -> Result<()> {
        instructions::cancel_expire_trade::cancel_expire_trade(ctx)
    }
}
