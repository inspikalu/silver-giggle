use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct RaffleState {
    pub raffle_id: u64,
    pub authority: Pubkey,
    pub ticket_mint: Pubkey,
    pub proceeds_token_account: Pubkey,
    pub ticket_price: u64,
    pub max_tickets: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub total_tickets_sold: u64,
    pub is_finalized: bool,
    pub prize_mint: Option<Pubkey>,
}
