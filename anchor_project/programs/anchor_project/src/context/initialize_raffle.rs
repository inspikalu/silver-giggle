use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token};
use crate::states::*;
use crate::errors::*;
use crate::events::*;


#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InitializeRaffleParams {
    pub raffle_id: u64,
    pub ticket_price: u64,
    pub max_tickets: u64,
    pub duration_seconds: u64,
    pub prize_mint: Option<Pubkey>,
}

#[derive(Accounts)]
pub struct InitializeRaffle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init, 
        payer = authority, 
        space = 8 + std::mem::size_of::<RaffleState>(),
        seeds = [b"raffle"],
        bump
    )]
    pub raffle_state: Account<'info, RaffleState>,
    #[account(mut)]
    pub ticket_mint: Account<'info, Mint>,
    /// CHECK: We are using it to receive fees
    #[account(
        mut
    )]
    pub proceeds_token_account: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_raffle(ctx: Context<InitializeRaffle>, params: InitializeRaffleParams) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    let end_time = current_time.checked_add(params.duration_seconds as i64)
        .ok_or(RaffleError::InvalidDuration)?;

    let raffle_state = &mut ctx.accounts.raffle_state;
    raffle_state.raffle_id = params.raffle_id;
    raffle_state.authority = ctx.accounts.authority.key();
    raffle_state.ticket_mint = ctx.accounts.ticket_mint.key();
    raffle_state.proceeds_token_account = ctx.accounts.proceeds_token_account.key();
    raffle_state.ticket_price = params.ticket_price;
    raffle_state.max_tickets = params.max_tickets;
    raffle_state.start_time = current_time;
    raffle_state.end_time = end_time;
    raffle_state.total_tickets_sold = 0;
    raffle_state.is_finalized = false;
    raffle_state.prize_mint = params.prize_mint;

    emit!(RaffleInitialized {
        raffle_id: params.raffle_id,
        authority: ctx.accounts.authority.key(),
    });

    Ok(())
}
