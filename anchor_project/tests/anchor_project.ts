// File: tests/anchor-project.spec.ts
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorProject } from "../target/types/anchor_project";
import { assert } from "chai";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint, 
  getOrCreateAssociatedTokenAccount 
} from "@solana/spl-token";

describe("Anchor Raffle Program", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorProject as Program<AnchorProject>;
  
  // Test wallets and accounts
  const authority = provider.wallet.publicKey;
  const participant = Keypair.generate();
  const winner = Keypair.generate();

  // Raffle parameters
  const RAFFLE_ID = new anchor.BN(1);
  const TICKET_PRICE = new anchor.BN(1_000_000); // 0.001 SOL
  const MAX_TICKETS = new anchor.BN(100);
  const DURATION_SECONDS = new anchor.BN(24 * 60 * 60); // 1 day

  let rafflePda: PublicKey;
  let ticketMint: PublicKey;
  let proceedsTokenAccount: PublicKey;

  before(async () => {
    // Airdrop SOL to participant and winner
    await provider.connection.requestAirdrop(participant.publicKey, 10_000_000_000);
    await provider.connection.requestAirdrop(winner.publicKey, 10_000_000_000);

    // Create ticket mint
    ticketMint = await createMint(
      provider.connection, 
      provider.wallet.payer, 
      authority, 
      null, 
      0
    );
  });

  it("Initializes Raffle", async () => {
    // Derive the PDA for raffle state
    [rafflePda] = await PublicKey.findProgramAddressSync(
      [Buffer.from("raffle")],
      program.programId
    );

    // Create proceeds token account
    proceedsTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      ticketMint,
      authority
    );

    // Initialize raffle
    await program.methods
      .initializeRaffles({
        raffleId: RAFFLE_ID,
        ticketPrice: TICKET_PRICE,
        maxTickets: MAX_TICKETS,
        durationSeconds: DURATION_SECONDS,
        prizeMint: null
      })
      .accounts({
        authority: authority,
        raffleState: rafflePda,
        ticketMint: ticketMint,
        proceedsTokenAccount: proceedsTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    // Verify raffle state
    const raffleState = await program.account.raffleState.fetch(rafflePda);
    assert.isTrue(raffleState.raffleId.eq(RAFFLE_ID));
    assert.isTrue(raffleState.ticketPrice.eq(TICKET_PRICE));
  });

  it("Buys Tickets - Happy Path", async () => {
    // Create participant's token account
    const participantTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      participant,
      ticketMint,
      participant.publicKey
    );

    // Derive participant tickets PDA
    const [participantTicketsPda] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("participant-tickets"),
        rafflePda.toBuffer(),
        participant.publicKey.toBuffer()
      ],
      program.programId
    );

    // Buy tickets
    await program.methods
      .buyTickets({
        ticketQuantity: new anchor.BN(5)
      })
      .accounts({
        raffleState: rafflePda,
        participantTickets: participantTicketsPda,
        participant: participant.publicKey,
        participantTokenAccount: participantTokenAccount.address,
        proceedsTokenAccount: proceedsTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .signers([participant])
      .rpc();

    // Verify ticket purchase
    const participantTickets = await program.account.participantTickets.fetch(participantTicketsPda);
    assert.isTrue(participantTickets.ticketsBought.eq(new anchor.BN(5)));
  });

  it("Buys Tickets - Unhappy Path (Exceeding Max Tickets)", async () => {
    // Attempt to buy more tickets than allowed
    try {
      await program.methods
        .buyTickets({
          ticketQuantity: MAX_TICKETS.add(new anchor.BN(1))
        })
        .accounts({
          raffleState: rafflePda,
          participantTickets: await PublicKey.findProgramAddressSync(
            [
              Buffer.from("participant-tickets"),
              rafflePda.toBuffer(),
              participant.publicKey.toBuffer()
            ],
            program.programId
          )[0],
          participant: participant.publicKey,
          participantTokenAccount: await getOrCreateAssociatedTokenAccount(
            provider.connection,
            participant,
            ticketMint,
            participant.publicKey
          ),
          proceedsTokenAccount: proceedsTokenAccount.address,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId
        })
        .signers([participant])
        .rpc();
      
      assert.fail("Should have thrown an error");
    } catch (error) {
      assert.include(
        error.message, 
        "MaxTicketsExceeded", 
        "Expected MaxTicketsExceeded error"
      );
    }
  });

  it("Draws Winner - Happy Path", async () => {
    // Wait to simulate raffle end (in actual test, manipulate blockchain time)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Derive winning ticket PDA
    const [winningTicketPda] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("winning-ticket"),
        rafflePda.toBuffer()
      ],
      program.programId
    );

    // Draw winner
    await program.methods
      .drawWinners()
      .accounts({
        raffleState: rafflePda,
        winningTicket: winningTicketPda,
        authority: authority,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    // Verify winning ticket created
    const winningTicket = await program.account.winningTicket.fetch(winningTicketPda);
    assert.isNotNull(winningTicket.winningTicketNumber);
  });

  it("Claims Prize - Happy Path", async () => {
    // Derive winning ticket PDA
    const [winningTicketPda] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("winning-ticket"),
        rafflePda.toBuffer()
      ],
      program.programId
    );

    // Create winner's token account
    const winnerTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      winner,
      ticketMint,
      winner.publicKey
    );

    // Claim prize
    await program.methods
      .claimPrizes()
      .accounts({
        raffleState: rafflePda,
        winningTicket: winningTicketPda,
        winner: winner.publicKey,
        proceedsTokenAccount: proceedsTokenAccount.address,
        winnerTokenAccount: winnerTokenAccount.address,
        authority: authority,
        tokenProgram: TOKEN_PROGRAM_ID
      })
      .signers([winner])
      .rpc();

    // Additional verifications can be added here
  });

  it("Closes Raffle - Happy Path", async () => {
    // Close raffle
    await program.methods
      .closeRaffles()
      .accounts({
        raffleState: rafflePda
      })
      .rpc();

    // Verify raffle state
    const raffleState = await program.account.raffleState.fetch(rafflePda);
    assert.isTrue(raffleState.isFinalized);
  });

  // Unhappy Path Tests
  it("Tries to Initialize Raffle with Invalid Duration", async () => {
    const newRaffleId = RAFFLE_ID.add(new anchor.BN(1));
    const [newRafflePda] = await PublicKey.findProgramAddressSync(
      [Buffer.from("raffle")],
      program.programId
    );

    try {
      await program.methods
        .initializeRaffles({
          raffleId: newRaffleId,
          ticketPrice: TICKET_PRICE,
          maxTickets: MAX_TICKETS,
          durationSeconds: new anchor.BN(0), // Invalid duration
          prizeMint: null
        })
        .accounts({
          authority: authority,
          raffleState: newRafflePda,
          ticketMint: ticketMint,
          proceedsTokenAccount: proceedsTokenAccount.address,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId
        })
        .rpc();
      
      assert.fail("Should have thrown an error");
    } catch (error) {
      assert.include(
        error.message, 
        "InvalidDuration", 
        "Expected InvalidDuration error"
      );
    }
  });

  it("Tries to Claim Prize Unauthorized", async () => {
    // Derive winning ticket PDA
    const [winningTicketPda] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("winning-ticket"),
        rafflePda.toBuffer()
      ],
      program.programId
    );

    try {
      await program.methods
        .claimPrizes()
        .accounts({
          raffleState: rafflePda,
          winningTicket: winningTicketPda,
          winner: Keypair.generate().publicKey,
          proceedsTokenAccount: proceedsTokenAccount.address,
          winnerTokenAccount: await getOrCreateAssociatedTokenAccount(
            provider.connection,
            Keypair.generate(),
            ticketMint,
            Keypair.generate().publicKey
          ),
          authority: authority,
          tokenProgram: TOKEN_PROGRAM_ID
        })
        .rpc();
      
      assert.fail("Should have thrown an error");
    } catch (error) {
      assert.include(
        error.message, 
        "UnauthorizedPrizeClaim", 
        "Expected UnauthorizedPrizeClaim error"
      );
    }
  });
});