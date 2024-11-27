use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct WinningTicket {
    pub raffle_state: Pubkey,
    pub winner: Pubkey,
    pub winning_ticket_number: u64,
    pub draw_time: i64,
}