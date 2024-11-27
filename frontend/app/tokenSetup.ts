// tokenSetup.ts
import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import { 
  createMint, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccount 
} from '@solana/spl-token';

export async function setupTokenMint(
  connection: Connection,
  payer: Keypair,
  authority: PublicKey
): Promise<{ 
  mint: PublicKey; 
  proceedsAccount: PublicKey;
}> {
  // Create a new mint
  const mint = await createMint(
    connection,
    payer,
    authority, // mint authority
    authority, // freeze authority
    9 // decimals
  );

  // Get the associated token account for proceeds
  const proceedsAccount = await getAssociatedTokenAddress(
    mint,
    authority
  );

  // Create the associated token account if it doesn't exist
  await createAssociatedTokenAccount(
    connection,
    payer,
    mint,
    authority
  );

  return { mint, proceedsAccount };
}

export async function getOrCreateAssociatedTokenAccount(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  owner: PublicKey
) {
  const tokenAccount = await getAssociatedTokenAddress(
    mint,
    owner
  );
  
  return tokenAccount;
}