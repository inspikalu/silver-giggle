use anchor_lang::prelude::*;
use crate::states::*;
use crate::utils::*;
use crate::errors::*;
use crate::events::*;




#[derive(Accounts)]
pub struct DrawWinner<'info> {
    #[account(mut)]
    pub raffle_state: Account<'info, RaffleState>,
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<WinningTicket>(),
        seeds = [b"winning-ticket", raffle_state.key().as_ref()],
        bump
    )]
    pub winning_ticket: Account<'info, WinningTicket>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}


pub fn draw_winner(ctx: Context<DrawWinner>) -> Result<()> {
    let raffle_state = &mut ctx.accounts.raffle_state;
    let current_time = Clock::get()?.unix_timestamp;

    require!(
        current_time > raffle_state.end_time,
        RaffleError::RaffleStillActive
    );
    require!(
        !raffle_state.is_finalized,
        RaffleError::RaffleAlreadyFinalized
    );

    let winning_ticket_number = generate_pseudo_random_winner(
        raffle_state.total_tickets_sold,
        current_time,
    );

    let winning_ticket = &mut ctx.accounts.winning_ticket;
    winning_ticket.raffle_state = raffle_state.key();
    winning_ticket.winner = Pubkey::default(); // Winner not set yet
    winning_ticket.winning_ticket_number = winning_ticket_number;
    winning_ticket.draw_time = current_time;

    raffle_state.is_finalized = true;

    emit!(WinnerDrawn {
        raffle_id: raffle_state.raffle_id,
        winning_ticket_number,
    });

    Ok(())
}