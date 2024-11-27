
pub fn generate_pseudo_random_winner(total_tickets: u64, seed: i64) -> u64 {
    let hash = anchor_lang::solana_program::hash::hash(&seed.to_le_bytes()).to_bytes();
    u64::from_le_bytes(hash[..8].try_into().unwrap()) % total_tickets
}