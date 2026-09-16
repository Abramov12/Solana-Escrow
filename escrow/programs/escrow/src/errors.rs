use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("The specified receiver does not have the specified token")]
    AccountWithoutToken,

    #[msg("Insufficient tokens in the sender's account")]
    NotEnoughTokenAmount,

    #[msg("Invalid mint")]
    InvalidMint,

    #[msg("Account for token not found")]
    NoTokenAccount,

    #[msg("Deal with 0 tokens are not allowed")]
    NeedToSwapMoreThanZeroTokens,

    #[msg("Escrow initialized with other sender mint.")]
    WrongSenderMint,

    #[msg("Escrow initialized with other receiver mint.")]
    WrongReceiverMint,

    #[msg("Holder ATA cannot be cleareв, couse of positive balance")]
    WrongExtraTokens,

    #[msg("Holder ATA has less tokens than sender sent")]
    LostTokens,

    #[msg("It is too early to cancel the deal.")]
    TooEarlyToCancel,
}
