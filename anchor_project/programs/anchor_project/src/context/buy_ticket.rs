use anchor_lang::prelude::*;
use anchor_spl::token::{ Token, TokenAccount, Transfer, transfer};
use crate::states::*;
use crate::errors::*;
use crate::events::*;
use crate::constants::*;



#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct BuyTicketParams {
    pub ticket_quantity: u64,
}


#[derive(Accounts)]
pub struct BuyTicket<'info> {
    #[account(mut)]
    pub raffle_state: Account<'info, RaffleState>,
    #[account(
        init_if_needed,
        payer = participant,
        space = 8 + std::mem::size_of::<ParticipantTickets>(),
        seeds = [b"participant-tickets", raffle_state.key().as_ref(), participant.key().as_ref()],
        bump
    )]
    pub participant_tickets: Account<'info, ParticipantTickets>,
    #[account(mut)]
    pub participant: Signer<'info>,
    #[account(mut)]
    pub participant_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub proceeds_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}


pub fn buy_ticket(ctx: Context<BuyTicket>, params: BuyTicketParams) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    let raffle_state = &mut ctx.accounts.raffle_state;

    require!(
        current_time >= raffle_state.start_time && current_time <= raffle_state.end_time,
        RaffleError::RaffleNotActive
    );

    let total_new_tickets = raffle_state
        .total_tickets_sold
        .checked_add(params.ticket_quantity)
        .ok_or(RaffleError::TicketPurchaseExceedsLimit)?;

    require!(
        total_new_tickets <= raffle_state.max_tickets,
        RaffleError::MaxTicketsExceeded
    );

    let participant_tickets = &mut ctx.accounts.participant_tickets;
    if participant_tickets.tickets_bought == 0 {
        participant_tickets.participant = ctx.accounts.participant.key();
        participant_tickets.first_purchase_time = current_time;
    }

    participant_tickets.tickets_bought = participant_tickets
        .tickets_bought
        .checked_add(params.ticket_quantity)
        .ok_or(RaffleError::TicketPurchaseOverflow)?;

    raffle_state.total_tickets_sold = total_new_tickets;

    let total_ticket_price = raffle_state
        .ticket_price
        .checked_mul(params.ticket_quantity)
        .ok_or(RaffleError::TicketPriceCalculationError)?;

    let platform_fee = total_ticket_price * PLATFORM_FEE_PERCENTAGE / 100;
    let raffle_proceeds = total_ticket_price - platform_fee;

    // Transfer ticket price to proceeds account
    let cpi_accounts = Transfer {
        from: ctx.accounts.participant_token_account.to_account_info(),
        to: ctx.accounts.proceeds_token_account.to_account_info(),
        authority: ctx.accounts.participant.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    transfer(cpi_ctx, raffle_proceeds)?;

    emit!(TicketsBought {
        participant: ctx.accounts.participant.key(),
        ticket_quantity: params.ticket_quantity,
    });

    Ok(())
}