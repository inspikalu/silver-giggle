import { FC, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, BN, Idl } from '@project-serum/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import idl from "../idl.json";

// Types
interface RaffleState {
  raffleId: BN;
  authority: PublicKey;
  ticketMint: PublicKey;
  proceedsTokenAccount: PublicKey;
  ticketPrice: BN;
  maxTickets: BN;
  startTime: BN;
  endTime: BN;
  totalTicketsSold: BN;
  isFinalized: boolean;
  prizeMint: PublicKey | null;
}

interface ParticipantInfo {
  participant: PublicKey;
  ticketsBought: BN;
  firstPurchaseTime: BN;
}

interface InitParams {
  ticketPrice: number;
  maxTickets: number;
  durationSeconds: number;
}


const TICKET_MINT = new PublicKey(process.env.NEXT_PUBLIC_TICKET_MINT || '');

const RaffleApp: FC = () => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [program, setProgram] = useState<Program | null>(null);
  const [raffleState, setRaffleState] = useState<RaffleState | null>(null);
  const [participantInfo, setParticipantInfo] = useState<ParticipantInfo | null>(null);
  const [ticketQuantity, setTicketQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [initParams, setInitParams] = useState<InitParams>({
    ticketPrice: 1,
    maxTickets: 100,
    durationSeconds: 86400,
  });
  const { toast } = useToast();

  useEffect(() => {
    const initializeProgram = async () => {
      if (publicKey && window.solana) {
        try {
          const provider = new AnchorProvider(
            connection,
            window.solana,
            { commitment: 'confirmed' }
          );
          const programId = new PublicKey('7qxSTmvtX1ixzXcCgQ322UfaQkbmPvfokXRwKFs8TYh3');
          const program = new Program(idl as unknown as Idl, programId, provider);
          setProgram(program);
          await fetchRaffleState(program);
        } catch (err) {
          console.error('Program initialization error:', err);
          showError('Failed to initialize program');
        }
      }
    };

    initializeProgram();
  }, [publicKey, connection]);

  const fetchRaffleState = async (programInstance: Program) => {
    try {
      const [rafflePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('raffle')],
        programInstance.programId
      );

      const state = await programInstance.account.raffleState.fetch(rafflePda);
      setRaffleState(state as unknown as RaffleState);

      if (publicKey) {
        await fetchParticipantInfo(programInstance, rafflePda);
      }
    } catch (err) {
      console.error('Error fetching raffle state:', err);
    }
  };

  const fetchParticipantInfo = async (programInstance: Program, rafflePda: PublicKey) => {
    try {
      const [participantPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('participant-tickets'),
          rafflePda.toBuffer(),
          publicKey!.toBuffer(),
        ],
        programInstance.programId
      );

      const participantData = await programInstance.account.participantTickets.fetch(participantPda);
      setParticipantInfo(participantData as unknown as ParticipantInfo);
    } catch (err) {
      console.error('Error fetching participant info:', err);
    }
  };

  const showSuccess = (message: string) => {
    toast({
      title: 'Success',
      description: message,
      variant: 'default',
    });
  };

  const showError = (message: string) => {
    toast({
      title: 'Error',
      description: message,
      variant: 'destructive',
    });
  };

  const initializeRaffle = async () => {
    try {
      setLoading(true);
      if (!program || !publicKey) return;

      const [rafflePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('raffle')],
        program.programId
      );

      const proceedsAccount = await getAssociatedTokenAddress(
        TICKET_MINT,
        publicKey
      );

      const params = {
        raffleId: new BN(Date.now()),
        ticketPrice: new BN(initParams.ticketPrice * 1e9),
        maxTickets: new BN(initParams.maxTickets),
        durationSeconds: new BN(initParams.durationSeconds),
        prizeMint: null,
      };

      const tx = await program.methods
        .initializeRaffles(params)
        .accounts({
          authority: publicKey,
          raffleState: rafflePda,
          ticketMint: TICKET_MINT,
          proceedsTokenAccount: proceedsAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await connection.confirmTransaction(tx);
      await fetchRaffleState(program);
      showSuccess('Raffle initialized successfully!');
    } catch (err) {
      console.error('Initialize raffle error:', err);
      showError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const buyTickets = async () => {
    try {
      setLoading(true);
      if (!program || !publicKey || !raffleState) return;

      const [rafflePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('raffle')],
        program.programId
      );

      const [participantPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('participant-tickets'),
          rafflePda.toBuffer(),
          publicKey.toBuffer(),
        ],
        program.programId
      );

      const participantTokenAccount = await getAssociatedTokenAddress(
        TICKET_MINT,
        publicKey
      );

      const tx = await program.methods
        .buyTickets({
          ticketQuantity: new BN(ticketQuantity),
        })
        .accounts({
          raffleState: rafflePda,
          participantTickets: participantPda,
          participant: publicKey,
          participantTokenAccount: participantTokenAccount,
          proceedsTokenAccount: raffleState.proceedsTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await connection.confirmTransaction(tx);
      await fetchRaffleState(program);
      showSuccess(`Successfully purchased ${ticketQuantity} tickets!`);
    } catch (err) {
      console.error('Buy tickets error:', err);
      showError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const drawWinner = async () => {
    try {
      setLoading(true);
      if (!program || !publicKey || !raffleState) return;

      const [rafflePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('raffle')],
        program.programId
      );

      const [winningTicketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('winning-ticket'), rafflePda.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .drawWinners()
        .accounts({
          raffleState: rafflePda,
          winningTicket: winningTicketPda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await connection.confirmTransaction(tx);
      await fetchRaffleState(program);
      showSuccess('Winner drawn successfully!');
    } catch (err) {
      console.error('Draw winner error:', err);
      showError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Solana Raffle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!publicKey ? (
            <Alert>
              <AlertDescription>
                Please connect your wallet to interact with the raffle
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {raffleState && (
                <Card className="bg-gray-50">
                  <CardHeader>
                    <CardTitle>Current Raffle Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p>Raffle ID: {raffleState.raffleId.toString()}</p>
                    <p>Ticket Price: {raffleState.ticketPrice.toString()} lamports</p>
                    <p>Total Tickets Sold: {raffleState.totalTicketsSold.toString()}</p>
                    <p>Max Tickets: {raffleState.maxTickets.toString()}</p>
                    <p>Start Time: {formatTimestamp(raffleState.startTime.toNumber())}</p>
                    <p>End Time: {formatTimestamp(raffleState.endTime.toNumber())}</p>
                    <p>Status: {raffleState.isFinalized ? 'Finalized' : 'Active'}</p>
                  </CardContent>
                </Card>
              )}

              {participantInfo && (
                <Card className="bg-gray-50">
                  <CardHeader>
                    <CardTitle>Your Participation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>Tickets Bought: {participantInfo.ticketsBought.toString()}</p>
                    <p>First Purchase: {formatTimestamp(participantInfo.firstPurchaseTime.toNumber())}</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Initialize New Raffle</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    type="number"
                    placeholder="Ticket Price (SOL)"
                    value={initParams.ticketPrice}
                    onChange={(e) => setInitParams(prev => ({
                      ...prev,
                      ticketPrice: Number(e.target.value)
                    }))}
                  />
                  <Input
                    type="number"
                    placeholder="Max Tickets"
                    value={initParams.maxTickets}
                    onChange={(e) => setInitParams(prev => ({
                      ...prev,
                      maxTickets: Number(e.target.value)
                    }))}
                  />
                  <Input
                    type="number"
                    placeholder="Duration (seconds)"
                    value={initParams.durationSeconds}
                    onChange={(e) => setInitParams(prev => ({
                      ...prev,
                      durationSeconds: Number(e.target.value)
                    }))}
                  />
                  <Button 
                    onClick={initializeRaffle} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : 'Initialize New Raffle'}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Buy Tickets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    type="number"
                    value={ticketQuantity}
                    onChange={(e) => setTicketQuantity(Number(e.target.value))}
                    min="1"
                    placeholder="Number of tickets"
                  />
                  <Button 
                    onClick={buyTickets} 
                    disabled={loading || !raffleState || raffleState.isFinalized}
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : 'Buy Tickets'}
                  </Button>
                </CardContent>
              </Card>

              <Button 
                onClick={drawWinner} 
                disabled={loading || !raffleState || !raffleState.isFinalized}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : 'Draw Winner'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RaffleApp;