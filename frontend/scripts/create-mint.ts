// scripts/create-mint.ts
import { Keypair, Connection, clusterApiUrl } from '@solana/web3.js';
import { createMint } from '@solana/spl-token';

async function createTokenMint() {
  // Connect to devnet
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

  // Generate a new keypair for the mint
  const mintAuthority = Keypair.generate();

  console.log('Requesting airdrop for mint authority...');
  const airdropSignature = await connection.requestAirdrop(
    mintAuthority.publicKey,
    2e9 // 2 SOL
  );
  await connection.confirmTransaction(airdropSignature);

  console.log('Creating mint...');
  const mint = await createMint(
    connection,
    mintAuthority, // payer
    mintAuthority.publicKey, // mint authority
    mintAuthority.publicKey, // freeze authority
    9 // decimals
  );

  console.log('Mint created successfully. Save these values:');
  console.log('Mint address:', mint.toBase58());
  console.log('Mint authority private key:', Buffer.from(mintAuthority.secretKey).toString('base64'));
}

createTokenMint().catch(console.error);
