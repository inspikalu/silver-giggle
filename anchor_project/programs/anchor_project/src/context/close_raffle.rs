use anchor_lang::prelude::*;
use crate::states::*;
use crate::errors::*;


#[derive(Accounts)]
pub struct CloseRaffle<'info> {
    pub raffle_state: Account<'info, RaffleState>,
}


pub fn close_raffle(ctx: Context<CloseRaffle>) -> Result<()> {
    let raffle_state = &ctx.accounts.raffle_state;

    require!(
        raffle_state.is_finalized,
        RaffleError::RaffleNotFinalized
    );

    Ok(())
}