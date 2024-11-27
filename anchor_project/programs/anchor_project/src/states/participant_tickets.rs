use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ParticipantTickets {
    pub participant: Pubkey,
    pub tickets_bought: u64,
    pub first_purchase_time: i64,
}
