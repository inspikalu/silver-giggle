use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod constants;
pub mod states;
pub mod context;
pub mod utils;


pub use states::*;
pub use context::*;
pub use utils::*;


declare_id!("7qxSTmvtX1ixzXcCgQ322UfaQkbmPvfokXRwKFs8TYh3");



#[program]
pub mod anchor_project {
    use super::*;

pub fn buy_tickets(ctx: Context<BuyTicket>, params: BuyTicketParams) -> Result<()> {
    context::buy_ticket(ctx, params)
}

pub fn claim_prizes(ctx: Context<ClaimPrize>) -> Result<()> {
    context::claim_prize(ctx)
}

pub fn close_raffles(ctx: Context<CloseRaffle>) -> Result<()> {
    context::close_raffle(ctx)
}

pub fn draw_winners(ctx: Context<DrawWinner>) -> Result<()> {
    context::draw_winner(ctx)
}
pub fn initialize_raffles(ctx: Context<InitializeRaffle>, params: InitializeRaffleParams) -> Result<()> {
    context::initialize_raffle(ctx, params)
}


}


