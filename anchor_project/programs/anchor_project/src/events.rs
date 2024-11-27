use anchor_lang::prelude::*;


#[event]
pub struct RaffleInitialized {
    pub raffle_id: u64,
    pub authority: Pubkey,
}

#[event]
pub struct TicketsBought {
    pub participant: Pubkey,
    pub ticket_quantity: u64,
}

#[event]
pub struct WinnerDrawn {
    pub raffle_id: u64,
    pub winning_ticket_number: u64,
}

#[event]
pub struct PrizeClaimed {
    pub raffle_id: u64,
    pub winner: Pubkey,
}
