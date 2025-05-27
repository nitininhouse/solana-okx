use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::UnixTimestamp;
use std::convert::TryFrom;
use std::str::FromStr;
use zero_knowledge_proofs::eligibility_proof;

declare_id!("A5zmaYX8z3vQVh8cf1aByvvURTGqxitoH9jZAHpN7C5n");

#[program]
pub mod carbon_credit {
    use super::*;

    // Query functions
    pub fn get_config(ctx: Context<GetConfig>) -> Result<ConfigResponse> {
        let config = &ctx.accounts.config;
        Ok(ConfigResponse {
            owner: config.owner,
            voting_period: config.voting_period,
            total_carbon_credits: config.total_carbon_credits,
        })
    }

    pub fn get_claim(ctx: Context<GetClaim>) -> Result<ClaimResponse> {
        let claim = &ctx.accounts.claim;
        let clock = Clock::get()?;
        
        let (yes_votes, no_votes) = if clock.unix_timestamp as u64 > claim.voting_end_time {
            (claim.yes_votes, claim.no_votes)
        } else {
            (0, 0)
        };
        
        Ok(ClaimResponse {
            id: claim.id,
            organization: claim.organization,
            longitudes: claim.longitudes.clone(),
            latitudes: claim.latitudes.clone(),
            time_started: claim.time_started,
            time_ended: claim.time_ended,
            demanded_tokens: claim.demanded_tokens,
            ipfs_hashes: claim.ipfs_hashes.clone(),
            status: claim.status.clone(),
            voting_end_time: claim.voting_end_time,
            yes_votes,
            no_votes,
        })
    }

    pub fn get_organization(ctx: Context<GetOrganization>) -> Result<OrganizationResponse> {
        let org_info = &ctx.accounts.organization_info;
        Ok(OrganizationResponse {
            address: ctx.accounts.organization.key(),
            reputation_score: org_info.reputation_score,
            carbon_credits: org_info.carbon_credits,
            debt: org_info.debt,
            times_borrowed: org_info.times_borrowed,
            total_borrowed: org_info.total_borrowed,
            total_returned: org_info.total_returned,
            name: org_info.name.clone(),
            emissions: org_info.emissions,
        })
    }
    pub fn get_total_carbon_credits(ctx: Context<GetTotalCarbonCredits>) -> Result<TotalCarbonCreditsResponse> {
        let config = &ctx.accounts.config;
        Ok(TotalCarbonCreditsResponse {
            total: config.total_carbon_credits,
        })
    }


    pub fn initialize(ctx: Context<Initialize>, voting_period: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.owner = *ctx.accounts.owner.key;
        config.voting_period = voting_period;
        config.total_carbon_credits = 0;
        Ok(())
    }
 
    pub fn finalize_voting(ctx: Context<FinalizeVoting>, claim_id: u64) -> Result<()> {
        let claim = &mut ctx.accounts.claim;
        let clock = Clock::get()?;
        
        if clock.unix_timestamp as u64 <= claim.voting_end_time {
            return Err(ErrorCode::VotingNotEnded.into());
        }
        
        let approved = claim.yes_votes >= claim.no_votes;
        claim.status = if approved { ClaimStatus::Approved } else { ClaimStatus::Rejected };
        
        if approved {
            let mut org_info = &mut ctx.accounts.organization_info;
            org_info.carbon_credits += claim.demanded_tokens;
            
            let config = &mut ctx.accounts.config;
            config.total_carbon_credits += claim.demanded_tokens;
        }
        
        Ok(())
    }

    pub fn create_claim(
        ctx: Context<CreateClaim>,
        longitudes: Vec<String>,
        latitudes: Vec<String>,
        time_started: u64,
        time_ended: u64,
        demanded_tokens: u64,
        ipfs_hashes: Vec<String>,
    ) -> Result<()> {
        let claim = &mut ctx.accounts.claim;
        let config = &ctx.accounts.config;
        
        claim.id = ctx.accounts.claim_counter.count;
        claim.organization = *ctx.accounts.organization.key;
        claim.longitudes = longitudes;
        claim.latitudes = latitudes;
        claim.time_started = time_started;
        claim.time_ended = time_ended;
        claim.demanded_tokens = demanded_tokens;
        claim.ipfs_hashes = ipfs_hashes;
        claim.status = ClaimStatus::Active;
        claim.voting_end_time = Clock::get()?.unix_timestamp as u64 + config.voting_period;
        claim.yes_votes = 0;
        claim.no_votes = 0;
        
        ctx.accounts.claim_counter.count += 1;
        
        Ok(())
    }

    pub fn create_lend_request(
        ctx: Context<CreateLendRequest>,
        amount: u64,
    ) -> Result<()> {
        let lend_request = &mut ctx.accounts.lend_request;
        let clock = Clock::get()?;
        
        lend_request.id = ctx.accounts.lend_request_counter.count;
        lend_request.borrower = *ctx.accounts.borrower.key;
        lend_request.lender = *ctx.accounts.lender.key;
        lend_request.amount = amount;
        lend_request.status = LentStatus::Active;
        lend_request.time = clock.unix_timestamp as u64;
        let borrower_info = &ctx.accounts.borrower_info;
        let lender_info = &ctx.accounts.lender_info;
        let (eligibility_score, proof_data) = eligibility_proof(
            borrower_info.emissions as u32,                
            borrower_info.total_returned as u32,                
            borrower_info.total_borrowed as u32,             
            borrower_info.debt as u32,                 
            borrower_info.carbon_credits as u32,      
            borrower_info.reputation_score as u32,     
            lender_info.carbon_credits as u32,           
            lender_info.debt as u32,                         
        );
        
        // Ensure score is within valid range (0-100)
        let final_score = (eligibility_score.abs() % 101) as u64;
        lend_request.eligibility_score = final_score;
        lend_request.proof_data = format!("zk_proof_len_{}", proof_data.len());
        ctx.accounts.lend_request_counter.count += 1;
        
        Ok(())
    }

    pub fn lend_tokens(ctx: Context<LendTokens>, lend_request_id: u64, response: String) -> Result<()> {
        let lend_request = &mut ctx.accounts.lend_request;
        
        if lend_request.lender != *ctx.accounts.lender.key {
            return Err(ErrorCode::Unauthorized.into());
        }
        
        if lend_request.status != LentStatus::Active {
            return Err(ErrorCode::RequestNotActive.into());
        }
        
        let response_lower = response.to_lowercase();
        if response_lower != "accepted" && response_lower != "denied" {
            return Err(ErrorCode::InvalidResponse.into());
        }
        
        if response_lower == "denied" {
            lend_request.status = LentStatus::Rejected;
            return Ok(());
        }
        
        let mut lender_info = &mut ctx.accounts.lender_info;
        let mut borrower_info = &mut ctx.accounts.borrower_info;
        
        if lender_info.carbon_credits < lend_request.amount {
            return Err(ErrorCode::NotEnoughCredits.into());
        }
        
        lender_info.carbon_credits -= lend_request.amount;
        borrower_info.carbon_credits += lend_request.amount;
        borrower_info.debt += lend_request.amount;
        borrower_info.times_borrowed += 1;
        borrower_info.total_borrowed += lend_request.amount;
        
        lend_request.status = LentStatus::Approved;
        
        Ok(())
    }

    pub fn repay_tokens(ctx: Context<RepayTokens>, amount: u64) -> Result<()> {
        let mut borrower_info = &mut ctx.accounts.borrower_info;
        let mut lender_info = &mut ctx.accounts.lender_info;
        
        if borrower_info.carbon_credits < amount {
            return Err(ErrorCode::NotEnoughCredits.into());
        }
        
        if borrower_info.debt < amount {
            return Err(ErrorCode::NotEnoughCredits.into());
        }
        
        borrower_info.carbon_credits -= amount;
        borrower_info.debt -= amount;
        borrower_info.total_returned += amount;
        lender_info.carbon_credits += amount;
        
        Ok(())
    }

    pub fn update_organization_name(ctx: Context<UpdateOrganizationName>, name: String) -> Result<()> {
        let org_info = &mut ctx.accounts.organization_info;
        org_info.name = name;
        Ok(())
    }

    pub fn add_organization_emission(ctx: Context<AddOrganizationEmission>, emissions: u64) -> Result<()> {
        let org_info = &mut ctx.accounts.organization_info;
        org_info.emissions += emissions;
        Ok(())
    }

   pub fn get_all_claims<'info>(
        ctx: Context<'_, '_, 'info, 'info, GetAllClaims<'info>>
    ) -> Result<AllClaimsResponse> {
        let claims = &ctx.remaining_accounts;
        let mut claim_responses = Vec::new();
        
        for claim_account in claims.iter() {
            if let Ok(claim) = Account::<Claim>::try_from(claim_account) {
                let clock = Clock::get()?;
                let (yes_votes, no_votes) = if clock.unix_timestamp as u64 > claim.voting_end_time {
                    (claim.yes_votes, claim.no_votes)
                } else {
                    (0, 0)
                };
                
                claim_responses.push(ClaimResponse {
                    id: claim.id,
                    organization: claim.organization,
                    longitudes: claim.longitudes.clone(),
                    latitudes: claim.latitudes.clone(),
                    time_started: claim.time_started,
                    time_ended: claim.time_ended,
                    demanded_tokens: claim.demanded_tokens,
                    ipfs_hashes: claim.ipfs_hashes.clone(),
                    status: claim.status.clone(),
                    voting_end_time: claim.voting_end_time,
                    yes_votes,
                    no_votes,
                });
            }
        }
        
        Ok(AllClaimsResponse {
            claims: claim_responses,
        })
    }

}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = owner, space = 8 + Config::LEN)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(init, payer = owner, space = 8 + Counter::LEN)]
    pub claim_counter: Account<'info, Counter>,
    #[account(init, payer = owner, space = 8 + Counter::LEN)]
    pub lend_request_counter: Account<'info, Counter>,
}

#[derive(Accounts)]
pub struct CreateClaim<'info> {
    #[account(mut)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub claim_counter: Account<'info, Counter>,
    #[account(init, payer = organization, space = 8 + Claim::LEN)]
    pub claim: Account<'info, Claim>,
    #[account(mut)]
    pub organization: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(
        init_if_needed,
        payer = organization,
        space = 8 + OrganizationInfo::LEN,
        seeds = [b"organization", organization.key().as_ref()],
        bump
    )]
    pub organization_info: Account<'info, OrganizationInfo>,
}

#[derive(Accounts)]
#[instruction(claim_id: u64)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub claim: Account<'info, Claim>,
    #[account(init, payer = voter, space = 8 + VoteRecord::LEN)]
    pub vote_record: Account<'info, VoteRecord>,
    #[account(mut)]
    pub voter: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(
        init_if_needed,
        payer = voter,
        space = 8 + OrganizationInfo::LEN,
        seeds = [b"organization", voter.key().as_ref()],
        bump
    )]
    pub voter_info: Account<'info, OrganizationInfo>,
}

#[derive(Accounts)]
#[instruction(claim_id: u64)]
pub struct FinalizeVoting<'info> {
    #[account(mut)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub claim: Account<'info, Claim>,
    #[account(mut)]
    pub organization_info: Account<'info, OrganizationInfo>,
}

#[derive(Accounts)]
pub struct CreateLendRequest<'info> {
    #[account(mut)]
    pub lend_request_counter: Account<'info, Counter>,
    #[account(init, payer = borrower, space = 8 + LendRequest::LEN)]
    pub lend_request: Account<'info, LendRequest>,
    #[account(mut)]
    pub borrower: Signer<'info>,
    pub lender: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
    #[account(
        mut,
        seeds = [b"organization", borrower.key().as_ref()],
        bump
    )]
    pub borrower_info: Account<'info, OrganizationInfo>,
    #[account(
        mut,cargo-features = ["edition2024"]
[package]
name = "zero-knowledge-proofs"
version = "0.1.0"
edition = "2024"
cargo-features = ["edition2024"]
[package]
name = "zero-knowledge-proofs"
version = "0.1.0"
edition = "2024"

[lib]
name = "zero_knowledge_proofs"
path = "src/lib.rs"

[dependencies]
num-bigint = { version = "0.4.6", features = ["rand", "serde"] }
num-traits = "0.2.19"
rand = "0.8"
num-integer = "0.1.46"
sha2 = "0.10"
serde = { version = "1.0.214", features = ["derive"] }
serde_json = "1.0.132"
bincode = "1.0.0"
[lib]
name = "zero_knowledge_proofs"
path = "src/lib.rs"

[dependencies]
num-bigint = { version = "0.4.6", features = ["rand", "serde"] }
num-traits = "0.2.19"
rand = "0.8"
num-integer = "0.1.46"
sha2 = "0.10"
serde = { version = "1.0.214", features = ["derive"] }
serde_json = "1.0.132"
bincode = "1.0.0"
        seeds = [b"organization", lender.key().as_ref()],
        bump
    )]
    pub lender_info: Account<'info, OrganizationInfo>,
}

#[derive(Accounts)]
#[instruction(lend_request_id: u64)]
pub struct LendTokens<'info> {
    #[account(mut)]
    pub lend_request: Account<'info, LendRequest>,
    #[account(mut)]
    pub lender: Signer<'info>,
    #[account(mut)]
    pub borrower_info: Account<'info, OrganizationInfo>,
    #[account(mut)]
    pub lender_info: Account<'info, OrganizationInfo>,
}

#[derive(Accounts)]
pub struct RepayTokens<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,
    #[account(mut)]
    pub lender: SystemAccount<'info>,
    #[account(mut)]
    pub borrower_info: Account<'info, OrganizationInfo>,
    /// CHECK: This is the organization's account key
    #[account(mut)]
    pub lender_info: Account<'info, OrganizationInfo>,
}

#[derive(Accounts)]
pub struct UpdateOrganizationName<'info> {
    /// CHECK: This is the organization's account key
    #[account(mut)]
    /// CHECK: This is the organization's account key
    pub organization: Signer<'info>,
    #[account(mut)]
    pub organization_info: Account<'info, OrganizationInfo>,
}

#[derive(Accounts)]
pub struct AddOrganizationEmission<'info> {
    /// CHECK: This is the organization's account key
    #[account(mut)]
    pub organization: Signer<'info>,
    /// CHECK: This is the organization's account key
    #[account(mut)]
    pub organization_info: Account<'info, OrganizationInfo>,
}

#[account]
pub struct Config {
    pub owner: Pubkey,
    pub voting_period: u64,
    pub total_carbon_credits: u64,
}

impl Config {
    pub const LEN: usize = 32 + 8 + 8;
}


#[account]
pub struct Counter {
    pub count: u64,
}

#[derive(Accounts)]
pub struct GetConfig<'info> {
    /// CHECK: This is the organization's account key
    #[account()]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct GetClaim<'info> {
    /// CHECK: This is the organization's account key
    #[account()]
    pub claim: Account<'info, Claim>,
}

#[derive(Accounts)]
pub struct GetOrganization<'info> {
    /// CHECK: This is the organization's account key
    #[account()]
    pub organization: AccountInfo<'info>,
    #[account(
        seeds = [b"organization", organization.key().as_ref()],
        bump
    )]
    pub organization_info: Account<'info, OrganizationInfo>,
}

#[derive(Accounts)]
pub struct GetTotalCarbonCredits<'info> {
    /// CHECK: This is the organization's account key
    #[account()]
    pub config: Account<'info, Config>,
}

// Response structures for queries
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ConfigResponse {
    pub owner: Pubkey,
    pub voting_period: u64,
    pub total_carbon_credits: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ClaimResponse {
    pub id: u64,
    pub organization: Pubkey,
    pub longitudes: Vec<String>,
    pub latitudes: Vec<String>,
    pub time_started: u64,
    pub time_ended: u64,
    pub demanded_tokens: u64,
    pub ipfs_hashes: Vec<String>,
    pub status: ClaimStatus,
    pub voting_end_time: u64,
    pub yes_votes: u64,
    pub no_votes: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct OrganizationResponse {
    pub address: Pubkey,
    pub reputation_score: u64,
    pub carbon_credits: u64,
    pub debt: u64,
    pub times_borrowed: u32,
    pub total_borrowed: u64,
    pub total_returned: u64,
    pub name: String,
    pub emissions: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TotalCarbonCreditsResponse {
    pub total: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct LendRequestResponse {
    pub id: u64,
    pub borrower: Pubkey,
    pub lender: Pubkey,
    pub status: LentStatus,
    pub eligibility_score: u64,
    pub proof_data: String,
    pub time: u64,
    pub amount: u64,
    pub role: String,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UserLendRequestsResponse {
    pub lend_requests: Vec<LendRequestResponse>,
}

impl Counter {
    pub const LEN: usize = 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VoteOption {
    Yes,
    No,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ClaimStatus {
    Active,
    Approved,
    Rejected,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum LentStatus {
    Active,
    Approved,
    Rejected,
}

#[account]
pub struct Claim {
    pub id: u64,
    pub organization: Pubkey,
    pub longitudes: Vec<String>,
    pub latitudes: Vec<String>,
    pub time_started: u64,
    pub time_ended: u64,
    pub demanded_tokens: u64,
    pub ipfs_hashes: Vec<String>,
    pub status: ClaimStatus,
    pub voting_end_time: u64,
    pub yes_votes: u64,
    pub no_votes: u64,
}

impl Claim {
    pub const LEN: usize = 8 +  // id
        32 +                    // organization
        4 + (50 * 4) +          // longitudes (max 50 items)
        4 + (50 * 4) +          // latitudes (max 50 items)
        8 +                     // time_started
        8 +                     // time_ended
        8 +                     // demanded_tokens
        4 + (50 * 4) +          // ipfs_hashes (max 50 items)
        1 +                     // status
        8 +                     // voting_end_time
        8 +                     // yes_votes
        8;                      // no_votes
}

#[account]
pub struct LendRequest {
    pub id: u64,
    pub borrower: Pubkey,
    pub lender: Pubkey,
    pub amount: u64,
    pub eligibility_score: u64,
    pub proof_data: String,
    pub status: LentStatus,
    pub time: u64,
}

impl LendRequest {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 50 + 1 + 8;
}

#[account]
pub struct OrganizationInfo {
    pub reputation_score: u64,
    pub carbon_credits: u64,
    pub debt: u64,
    pub times_borrowed: u32,
    pub total_borrowed: u64,
    pub total_returned: u64,
    pub name: String,
    pub emissions: u64,
}

impl OrganizationInfo {
    pub const LEN: usize = 8 + 8 + 8 + 4 + 8 + 8 + 50 + 8;
}

#[derive(Accounts)]
pub struct GetAllClaims<'info> {
    #[account()]
    pub authority: Signer<'info>,
    /// CHECK: This account is not read or written, just used for validation
    pub system_program: Program<'info, System>,
    // Access remaining_accounts through ctx.remaining_accounts in your instruction
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AllClaimsResponse {
    pub claims: Vec<ClaimResponse>,
}

#[account]
pub struct VoteRecord {
    pub voter: Pubkey,
    pub vote: VoteOption,
    pub timestamp: u64,
}

impl VoteRecord {
    pub const LEN: usize = 32 + 1 + 8;
}

#[error_code]
pub enum ErrorCode {
    #[msg("Voting has already ended")]
    VotingEnded,
    #[msg("Voting has not ended yet")]
    VotingNotEnded,
    #[msg("User has already voted")]
    AlreadyVoted,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Request not active")]
    RequestNotActive,
    #[msg("Invalid response")]
    InvalidResponse,
    #[msg("Not enough credits")]
    NotEnoughCredits,
    #[msg("Borrower not eligible")]
    BorrowerNotEligible,
}