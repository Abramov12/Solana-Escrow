use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Holder {
    pub sender: Pubkey,
    pub receiver: Pubkey,

    pub sender_token: Pubkey,
    pub sender_amount: u64,

    pub receiver_token: Pubkey,
    pub receiver_amount: u64,

    pub expires_at: i64,
}
