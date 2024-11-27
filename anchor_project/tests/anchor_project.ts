import { expect } from 'chai';
import { Program, Provider, web3, BN } from '@coral-xyz/anchor';
import { AnchorProject } from '../target/types/anchor_project'; // Adjust the import according to your project structure
import { Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createAccount, getAccount, sendTransaction } from './utils'; // Utility functions for creating accounts

const { SystemProgram } = web3;

describe('raffle', () => {
    const provider = Provider.local();
    const program = new Program<Raffle>(idl, programId, provider);

    // Accounts
    let raffleState: web3.PublicKey;
    let participant: Keypair;
    let participantTokenAccount: web3.PublicKey;
    let proceedsTokenAccount: web3.PublicKey;

    beforeEach(async () => {
        // Setup accounts for testing
        participant = Keypair.generate();
        raffleState = await createAccount(provider, participant);
        participantTokenAccount = await createAccount(provider, participant);
        proceedsTokenAccount = await createAccount(provider, participant);
    });

    describe('initialize_raffle', () => {
        it('should initialize a raffle successfully', async () => {
            const params = {
                raffle_id: new BN(1),
                ticket_price: new BN(1000),
                max_tickets: new BN(100),
                duration_seconds: new BN(3600),
                prize_mint: null,
            };

            const tx = await program.rpc.initializeRaffle(params, {
                accounts: {
                    authority: participant.publicKey,
                    raffleState,
                    ticketMint: participantTokenAccount,
                    proceedsTokenAccount,
                    systemProgram: SystemProgram.programId,
                },
                signers: [participant],
            });

            expect(tx).to.not.be.undefined;
        });

        it('should fail if duration is invalid', async () => {
            const params = {
                raffle_id: new BN(1),
                ticket_price: new BN(1000),
                max_tickets: new BN(100),
                duration_seconds: new BN(0), // Invalid duration
                prize_mint: null,
            };

            await expect(
                program.rpc.initializeRaffle(params, {
                    accounts: {
                        authority: participant.publicKey,
                        raffleState,
                        ticketMint: participantTokenAccount,
                        proceedsTokenAccount,
                        systemProgram: SystemProgram.programId,
                    },
                    signers: [participant],
                })
            ).to.be.rejectedWith('Invalid duration for the raffle.');
        });
    });

    describe('buy_tickets', () => {
        beforeEach(async () => {
            // Initialize a raffle before buying tickets
            const params = {
                raffle_id: new BN(1),
                ticket_price: new BN(1000),
                max_tickets: new BN(100),
                duration_seconds: new BN(3600),
                prize_mint: null,
            };

            await program.rpc.initializeRaffle(params, {
                accounts: {
                    authority: participant.publicKey,
                    raffleState,
                    ticketMint: participantTokenAccount,
                    proceedsTokenAccount,
                    systemProgram: SystemProgram.programId,
                },
                signers: [participant],
            });
        });

        it('should buy tickets successfully', async () => {
            const buyTicketParams = { ticket_quantity: new BN(2) };

            const tx = await program.rpc.buyTickets(buyTicketParams, {
                accounts: {
                    raffleState,
                    participantTickets: participant.publicKey,
                    participant: participant.publicKey,
                    participantTokenAccount,
                    proceedsTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                },
                signers: [participant],
            });

            expect(tx).to.not.be.undefined;
        });

        it('should fail if raffle is not active', async () => {
            // Simulate a condition where the raffle is not active
            const buyTicketParams = { ticket_quantity: new BN(2) };

            await expect(
                program.rpc.buyTickets(buyTicketParams, {
                    accounts: {
                        raffleState,
                        participantTickets: participant.publicKey,
                        participant: participant.publicKey,
                        participantTokenAccount,
                        proceedsTokenAccount,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    },
                    signers: [participant],
                })
            ).to.be.rejectedWith('Raffle is not currently active.');
        });

        it('should fail if buying exceeds max tickets', async () => {
            const buyTicketParams = ```typescript
{ ticket_quantity: new BN(200) }; // Exceeds max tickets

            await expect(
                program.rpc.buyTickets(buyTicketParams, {
                    accounts: {
                        raffleState,
                        participantTickets: participant.publicKey,
                        participant: participant.publicKey,
                        participantTokenAccount,
                        proceedsTokenAccount,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    },
                    signers: [participant],
                })
            ).to.be.rejectedWith('Exceeded maximum tickets for this raffle.');
        });
    });

    describe('claim_prizes', () => {
        beforeEach(async () => {
            // Initialize a raffle and buy tickets before claiming prizes
            const params = {
                raffle_id: new BN(1),
                ticket_price: new BN(1000),
                max_tickets: new BN(100),
                duration_seconds: new BN(3600),
                prize_mint: null,
            };

            await program.rpc.initializeRaffle(params, {
                accounts: {
                    authority: participant.publicKey,
                    raffleState,
                    ticketMint: participantTokenAccount,
                    proceedsTokenAccount,
                    systemProgram: SystemProgram.programId,
                },
                signers: [participant],
            });

            const buyTicketParams = { ticket_quantity: new BN(1) };
            await program.rpc.buyTickets(buyTicketParams, {
                accounts: {
                    raffleState,
                    participantTickets: participant.publicKey,
                    participant: participant.publicKey,
                    participantTokenAccount,
                    proceedsTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                },
                signers: [participant],
            });
        });

        it('should claim prize successfully', async () => {
            // Simulate drawing a winner
            const winningTicket = Keypair.generate();
            await program.rpc.drawWinner({
                accounts: {
                    raffleState,
                    winningTicket: winningTicket.publicKey,
                    authority: participant.publicKey,
                    systemProgram: SystemProgram.programId,
                },
                signers: [participant, winningTicket],
            });

            const tx = await program.rpc.claimPrize({
                accounts: {
                    raffleState,
                    winningTicket: winningTicket.publicKey,
                    winner: participant.publicKey,
                    proceedsTokenAccount,
                    winnerTokenAccount: participantTokenAccount,
                    authority: participant.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
                signers: [participant],
            });

            expect(tx).to.not.be.undefined;
        });

        it('should fail if raffle is not finalized', async () => {
            const winningTicket = Keypair.generate();

            await expect(
                program.rpc.claimPrize({
                    accounts: {
                        raffleState,
                        winningTicket: winningTicket.publicKey,
                        winner: participant.publicKey,
                        proceedsTokenAccount,
                        winnerTokenAccount: participantTokenAccount,
                        authority: participant.publicKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    },
                    signers: [participant],
                })
            ).to.be.rejectedWith('Raffle has not been finalized.');
        });

        it('should fail if unauthorized claim attempt', async () => {
            const winningTicket = Keypair.generate();
            await program.rpc.drawWinner({
                accounts: {
                    raffleState,
                    winningTicket: winningTicket.publicKey,
                    authority: participant.publicKey,
                    systemProgram: SystemProgram.programId,
                },
                signers: [participant, winningTicket],
            });

            const anotherParticipant = Keypair.generate();

            await expect(
                program.rpc.claimPrize({
                    accounts: {
                        raffleState,
                        winningTicket: winningTicket.publicKey,
                        winner: anotherParticipant.publicKey, // Unauthorized
                        proceedsTokenAccount,
                        winnerTokenAccount: participantTokenAccount,
                        authority: participant.publicKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    },
                    signers: [anotherParticipant],
                })
            ).to.be.rejectedWith('Unauthorized claim attempt.');
        });
    });

    describe('close_raffle', () => {
        beforeEach(async () => {
            // Initialize a raffle before closing it
            const params = {
                raffle_id: new BN(1),
                ticket_price: new BN(1000),
                max_tickets: new BN(100),
                duration_seconds: new BN(3600),
                prize_mint: null,
            };

            await program.rpc.initializeRaffle(params, {
                accounts: {
                    authority: participant.publicKey,
                    raffleState,
                    ticketMint: participantTokenAccount,
                    proceedsTokenAccount,
                    systemProgram: SystemProgram.programId,
                },
                signers: [participant],
            });
        });

        it('should close raffle successfully', async () => {
            const tx = await program.rpc.closeRaffle({
                accounts: {
                    raffleState,
                },
                signers: [participant],
            });

            expect(tx).to.not.be.undefined;
 });

        it('should fail if raffle is not finalized', async () => {
            await expect(
                program.rpc.closeRaffle({
                    accounts: {
                        raffleState,
                    },
                    signers: [participant],
                })
            ).to.be.rejectedWith('Raffle has not been finalized.');
        });
    });

    describe('draw_winner', () => {
        beforeEach(async () => {
            // Initialize a raffle before drawing a winner
            const params = {
                raffle_id: new BN(1),
                ticket_price: new BN(1000),
                max_tickets: new BN(100),
                duration_seconds: new BN(3600),
                prize_mint: null,
            };

            await program.rpc.initializeRaffle(params, {
                accounts: {
                    authority: participant.publicKey,
                    raffleState,
                    ticketMint: participantTokenAccount,
                    proceedsTokenAccount,
                    systemProgram: SystemProgram.programId,
                },
                signers: [participant],
            });
        });

        it('should draw a winner successfully', async () => {
            const winningTicket = Keypair.generate();

            const tx = await program.rpc.drawWinner({
                accounts: {
                    raffleState,
                    winningTicket: winningTicket.publicKey,
                    authority: participant.publicKey,
                    systemProgram: SystemProgram.programId,
                },
                signers: [participant, winningTicket],
            });

            expect(tx).to.not.be.undefined;
        });

        it('should fail if raffle is still active', async () => {
            await expect(
                program.rpc.drawWinner({
                    accounts: {
                        raffleState,
                        winningTicket: Keypair.generate().publicKey,
                        authority: participant.publicKey,
                        systemProgram: SystemProgram.programId,
                    },
                    signers: [participant],
                })
            ).to.be.rejectedWith('Raffle is still active.');
        });

        it('should fail if raffle is already finalized', async () => {
            const winningTicket = Keypair.generate();

            await program.rpc.drawWinner({
                accounts: {
                    raffleState,
                    winningTicket: winningTicket.publicKey,
                    authority: participant.publicKey,
                    systemProgram: SystemProgram.programId,
                },
                signers: [participant, winningTicket],
            });

            await expect(
                program.rpc.drawWinner({
                    accounts: {
                        raffleState,
                        winningTicket: Keypair.generate().publicKey,
                        authority: participant.publicKey,
                        systemProgram: SystemProgram.programId,
                    },
                    signers: [participant],
                })
            ).to.be.rejectedWith('Raffle is already finalized.');
        });
    });
});