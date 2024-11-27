use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, transfer};
use crate::states::*;
use crate::errors::*;
use crate::events::*;


#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    pub raffle_state: Account<'info, RaffleState>,
    #[account(mut)]
    pub winning_ticket: Account<'info, WinningTicket>,
    #[account(mut)]
    pub winner: Signer<'info>,
    #[account(mut)]
    pub proceeds_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub winner_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}


pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
    let raffle_state = &ctx.accounts.raffle_state;
    let winning_ticket = &mut ctx.accounts.winning_ticket;

    require!(
        raffle_state.is_finalized,
        RaffleError::RaffleNotFinalized
    );

    if winning_ticket.winner == Pubkey::default() {
        winning_ticket.winner = ctx.accounts.winner.key();
    } else {
        require!(
            winning_ticket.winner == ctx.accounts.winner.key(),
            RaffleError::UnauthorizedPrizeClaim
        );
    }

    if let Some(_prize_mint) = raffle_state.prize_mint {
        let cpi_accounts = Transfer {
            from: ctx.accounts.proceeds_token_account.to_account_info(),
            to: ctx.accounts.winner_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx, 1)?;
    }

    emit!(PrizeClaimed {
        raffle_id: raffle_state.raffle_id,
        winner: ctx.accounts.winner.key(),
    });

    Ok(())
}
