use anchor_lang::prelude::*;

#[error_code]
pub enum RaffleError {
    #[msg("Invalid duration for the raffle.")]
    InvalidDuration,
    #[msg("Raffle is not currently active.")]
    RaffleNotActive,
    #[msg("Exceeded maximum tickets for this raffle.")]
    MaxTicketsExceeded,
    #[msg("Ticket purchase overflow.")]
    TicketPurchaseOverflow,
    #[msg("Error calculating ticket price.")]
    TicketPriceCalculationError,
    #[msg("Raffle is still active.")]
    RaffleStillActive,
    #[msg("Raffle is already finalized.")]
    RaffleAlreadyFinalized,
    #[msg("Unauthorized claim attempt.")]
    UnauthorizedPrizeClaim,
    #[msg("Raffle has not been finalized.")]
    RaffleNotFinalized,
    #[msg("Ticket purchase exceeds limit.")]
    TicketPurchaseExceedsLimit,
}