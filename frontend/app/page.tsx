'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Connection } from '@solana/web3.js';
import { AnchorProvider, Program, Idl } from '@project-serum/anchor';
import { useState } from 'react';
import idl from '../idl.json'; // Save your IDL here.

const programID = new PublicKey(idl.address);
const connection = new Connection('https://api.mainnet-beta.solana.com');

export default function Home() {
  const { publicKey, wallet } = useWallet();
  const [output, setOutput] = useState('');

  const handleInteraction = async (method: string,) => {
    if (!wallet || !publicKey) {
      setOutput('Please connect your wallet.');
      return;
    }

    const provider = new AnchorProvider(connection, wallet, {});
    const program = new Program(idl as Idl, programID, provider);

    try {
      let response;
      if (method === 'initialize') {
        response = await program.methods
          .initializeRaffles({
            raffleId: 1,
            ticketPrice: 1_000_000, // in lamports
            maxTickets: 100,
            durationSeconds: 3600,
            prizeMint: null,
          })
          .accounts({
            authority: publicKey,
          })
          .rpc();
      }
      setOutput(`Success: ${response}`);
    } catch (err: {any}) {
      console.error(err);
      if (err?.message) {

        setOutput(`Error: ${err.message}`);
      }
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <WalletMultiButton />
      <div className="mt-8 space-y-4">
        <button
          onClick={() => handleInteraction('initialize', {})}
          className="btn btn-primary"
        >
          Initialize Raffle
        </button>
        <button
          onClick={() => handleInteraction('buy_tickets', {})}
          className="btn btn-secondary"
        >
          Buy Tickets
        </button>
      </div>
      <div className="mt-4">
        <pre>{output}</pre>
      </div>
    </main>
  );
}
