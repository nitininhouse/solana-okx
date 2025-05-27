import { 
  useCurrentAccount, 
  useSignAndExecuteTransaction, 
  useSuiClientQuery,
  useSuiClient
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { 
   
   
  
  Text, 
 
  Badge,
  Box,
  
  Dialog,
  AlertDialog,
  
} from "@radix-ui/themes";
import { useState, useEffect } from "react";
import { format } from 'date-fns';

// Replace with your actual package IDs
const ORGANIZATION_HANDLER_ID = "0x3e93f9c3174505789f34825c4833e59adeb9b3f68adb8bfd53ecdcf0b61b75db";
const CLAIM_HANDLER_ID = "0x9dfc31fa670a2722a806be47eef3fd02b98db35d8c6910a2ef9a2868793a6225";
const PACKAGE_ID = "0x0514cb5817179ac60a31c8b552c252928745a35048e189e0a857ea2a8487000a";
const CLOCK_OBJECT_ID = "0x6"; // Standard Sui Clock

type ClaimView = {
  claim_id: string;
  organisation_wallet_address: string;
  longitude: number;
  latitude: number;
  requested_carbon_credits: number;
  status: number;
  ipfs_hash: string;
  description: string;
  time_of_issue: number;
  yes_votes: number;
  no_votes: number;
  total_votes: number;
  voting_period: number;
};

export function ClaimsList() {
  const account = useCurrentAccount();
  const [claims, setClaims] = useState<ClaimView[]>([]); // Initialize as empty array
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedClaim, setSelectedClaim] = useState<ClaimView | null>(null);
  const [voteDialogOpen, setVoteDialogOpen] = useState(false);
  const [voteType, setVoteType] = useState<"yes" | "no">("yes");
  const [voteProcessing, setVoteProcessing] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  // Use Sui client query to get the ClaimHandler object
  const { data: claimsData } = useSuiClientQuery(
    "getObject",
    {
      id: CLAIM_HANDLER_ID,
      options: {
        showContent: true,
        showOwner: true,
        showType: true,
      },
    },
    {
      enabled: !!account,
    }
  );

  // Debug function to log claim data
  const debugClaim = (claim: ClaimView) => {
    console.log("=== CLAIM DEBUG ===");
    console.log("Claim ID:", claim.claim_id);
    console.log("Status:", claim.status);
    console.log("Time of issue:", claim.time_of_issue);
    console.log("Voting period:", claim.voting_period);
    console.log("Current time:", Date.now());
    
    // Convert timestamps properly
    const timeInMs = claim.time_of_issue > 1000000000000 ? claim.time_of_issue : claim.time_of_issue * 1000;
    const periodInMs = claim.voting_period > 1000000000 ? claim.voting_period : claim.voting_period * 1000;
    const votingEndTime = timeInMs + periodInMs;
    
    console.log("Time in MS:", timeInMs);
    console.log("Period in MS:", periodInMs);
    console.log("Voting end time:", votingEndTime);
    console.log("Voting end date:", new Date(votingEndTime));
    console.log("Is voting active?", Date.now() <= votingEndTime);
    console.log("==================");
  };

  // Parse claims from the ClaimHandler object
  useEffect(() => {
    if (claimsData?.data?.content && 'fields' in claimsData.data.content) {
      try {
        const fields = claimsData.data.content.fields as any;
        
        // Extract claims from the ClaimHandler's claims field
        if (fields.claims && fields.claims.fields) {
          // For VecMap structure
          if (fields.claims.fields.contents) {
            const claimsArray: ClaimView[] = [];
            const contents = fields.claims.fields.contents;
            
            // VecMap stores key-value pairs
            if (Array.isArray(contents)) {
              contents.forEach((entry: any) => {
                if (entry.fields && entry.fields.value && entry.fields.value.fields) {
                  const claimFields = entry.fields.value.fields;
                  const claim: ClaimView = {
                    claim_id: entry.fields.key,
                    organisation_wallet_address: claimFields.organisation_wallet_address,
                    longitude: parseFloat(claimFields.longitude),
                    latitude: parseFloat(claimFields.latitude),
                    requested_carbon_credits: parseInt(claimFields.requested_carbon_credits),
                    status: parseInt(claimFields.status),
                    ipfs_hash: claimFields.ipfs_hash,
                    description: claimFields.description,
                    time_of_issue: parseInt(claimFields.time_of_issue),
                    yes_votes: parseInt(claimFields.yes_votes),
                    no_votes: parseInt(claimFields.no_votes),
                    total_votes: parseInt(claimFields.total_votes),
                    voting_period: parseInt(claimFields.voting_period)
                  };
                  
                  // Debug each claim
                  debugClaim(claim);
                  claimsArray.push(claim);
                }
              });
            }
            setClaims(claimsArray);
          }
        }
        // If it's a different structure, you might need to adjust accordingly
        else if (Array.isArray(fields.claims)) {
          // Direct array of claims
          setClaims(fields.claims);
        }
        
        setHasInitialLoad(true);
      } catch (err) {
        console.error("Error parsing claims data:", err);
        setError("Failed to parse claims data from object query");
        setClaims([]); // Ensure it's always an array
      }
    } else {
      // If no data is available from the object query, ensure claims is an empty array
      setClaims([]);
    }
  }, [claimsData]);

  // Fetch claims using the Move function (this is the reliable method)
  const fetchClaimsWithTransaction = async () => {
    if (!account) return;

    setLoading(true);
    setError("");

    try {
      const tx = new Transaction();
      
      tx.moveCall({
        target: `${PACKAGE_ID}::carbon_marketplace::get_all_claims`,
        arguments: [
          tx.object(ORGANIZATION_HANDLER_ID),
          tx.object(CLAIM_HANDLER_ID),
          tx.object(CLOCK_OBJECT_ID),
        ],
      });

      signAndExecute(
        { 
          transaction: tx
        },
        {
          onSuccess: async (txResponse) => {
            const txResult = await suiClient.waitForTransaction({ 
              digest: txResponse.digest,
              options: { 
                showEvents: true,
                showEffects: true 
              }
            });
            
            const events = txResult.events || [];
            const claimsEvent = events.find(e => 
              e.type.endsWith("::carbon_marketplace::getAllClaimsEvent") ||
              e.type.endsWith("::carbon_marketplace::AllClaimsEvent")
            );
            
            if (claimsEvent && claimsEvent.parsedJson) {
              const eventData = claimsEvent.parsedJson as { claims: ClaimView[] };
              if (Array.isArray(eventData.claims)) {
                // Debug each claim from transaction
                eventData.claims.forEach(debugClaim);
                setClaims(eventData.claims);
                setHasInitialLoad(true);
              } else {
                setClaims([]);
                setError("Received invalid claims data format");
              }
            } else {
              setClaims([]);
              setError("No claims event found in transaction result");
            }
            setLoading(false);
          },
          onError: (error) => {
            setError(error.message || "Failed to fetch claims");
            setClaims([]); // Ensure it's always an array
            setLoading(false);
          }
        }
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
      setClaims([]); // Ensure it's always an array
      setLoading(false);
    }
  };

  // Submit vote using the new vote_on_a_claim function
  const submitVote = async () => {
    if (!account || !selectedClaim) return;
    
    // Double-check voting is still active before submitting
    if (!isVotingActive(selectedClaim)) {
      setError("Voting period has expired for this claim");
      setVoteDialogOpen(false);
      return;
    }

    setVoteProcessing(true);
    setError("");

    try {
      const tx = new Transaction();
      
      // Convert vote type to number: 1 for yes, 0 for no
      const voteValue = voteType === "yes" ? 1 : 0;
      
      tx.moveCall({
        target: `${PACKAGE_ID}::carbon_marketplace::vote_on_a_claim`,
        arguments: [
          tx.object(CLAIM_HANDLER_ID),
          tx.object(CLOCK_OBJECT_ID),
          tx.object(selectedClaim.claim_id),
          tx.pure.u64(voteValue),
        ],
      });

      signAndExecute(
        { 
          transaction: tx,
        },
        {
          onSuccess: async (txResponse) => {
            const txResult = await suiClient.waitForTransaction({ 
              digest: txResponse.digest,
              options: { 
                showEvents: true,
                showEffects: true 
              }
            });
            
            const events = txResult.events || [];
            const voteEvent = events.find(e => 
              e.type.endsWith("::carbon_marketplace::ClaimVoted")
            );
            
            if (voteEvent && voteEvent.parsedJson) {
              console.log("Vote recorded:", voteEvent.parsedJson);
            }
            
            setVoteDialogOpen(false);
            setSelectedClaim(null);
            
            // Refresh claims after voting
            await fetchClaimsWithTransaction();
            setVoteProcessing(false);
          },
          onError: (error) => {
            let errorMessage = error.message || "Vote failed";
            
            // Parse common Move abort codes for better user feedback
            if (errorMessage.includes("MoveAbort") && errorMessage.includes(", 1)")) {
              errorMessage = "Voting period has expired for this claim";
            } else if (errorMessage.includes("MoveAbort") && errorMessage.includes(", 2)")) {
              errorMessage = "You have already voted on this claim";
            } else if (errorMessage.includes("MoveAbort") && errorMessage.includes(", 0)")) {
              errorMessage = "Claim not found or invalid";
            }
            
            setError(errorMessage);
            setVoteProcessing(false);
          }
        }
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
      setVoteProcessing(false);
    }
  };

  // FIXED: Helper functions with better timestamp handling
  const getVotingEndTime = (claim: ClaimView) => {
    try {
      // More robust timestamp conversion
      let timeInMs: number;
      let periodInMs: number;
      
      // Handle different timestamp formats
      if (claim.time_of_issue > 1000000000000) {
        // Already in milliseconds
        timeInMs = claim.time_of_issue;
      } else if (claim.time_of_issue > 1000000000) {
        // In seconds, convert to milliseconds
        timeInMs = claim.time_of_issue;
      } else {
        // Might be in nanoseconds or other format, handle carefully
        timeInMs = claim.time_of_issue;
      }
      
      // Handle voting period similarly
      if (claim.voting_period > 1000000000) {
        // Likely in milliseconds or seconds
        periodInMs = claim.voting_period > 1000000000000 ? claim.voting_period : claim.voting_period * 1000;
      } else {
        // Small number, likely in days or hours, convert appropriately
        // Assuming it's in days if it's a small number
        periodInMs = claim.voting_period * 24 * 60 * 60 * 1000; // Convert days to milliseconds
      }
      
      const endTime = new Date(timeInMs + periodInMs);
      
      // Check if the date is valid
      if (isNaN(endTime.getTime())) {
        return "Invalid date";
      }
      
      return format(endTime, 'MMM dd, yyyy HH:mm');
    } catch (error) {
      console.error("Error formatting voting end time:", error);
      return "Error calculating end time";
    }
  };
  
  const isVotingActive = (claim: ClaimView) => {
    try {
      // First check if status is 0 (pending)
      if (claim.status !== 0) {
        return false;
      }
      
      const now = Date.now();
      
      // More robust timestamp conversion
      let timeInMs: number;
      let periodInMs: number;
      
      // Handle different timestamp formats
      if (claim.time_of_issue > 1000000000000) {
        // Already in milliseconds
        timeInMs = claim.time_of_issue;
      } else if (claim.time_of_issue > 1000000000) {
        // In seconds, convert to milliseconds
        timeInMs = claim.time_of_issue ;
      } else {
        // Might be in nanoseconds or other format, handle carefully
        timeInMs = claim.time_of_issue;
      }
      
      // Handle voting period similarly
      if (claim.voting_period > 1000000000) {
        // Likely in milliseconds or seconds
        periodInMs = claim.voting_period > 1000000000000 ? claim.voting_period : claim.voting_period * 1000;
      } else {
        // Small number, likely in days or hours, convert appropriately
        // Assuming it's in days if it's a small number
        periodInMs = claim.voting_period * 24 * 60 * 60 * 1000; // Convert days to milliseconds
      }
      
      const votingEndTime = timeInMs + periodInMs;
      const isActive = now <= votingEndTime;
      
      console.log(`Voting check for claim ${claim.claim_id}:`, {
        now,
        timeInMs,
        periodInMs,
        votingEndTime,
        isActive,
        status: claim.status
      });
      
      return isActive;
    } catch (error) {
      console.error("Error checking voting status:", error);
      return false;
    }
  };

  const canVote = (claim: ClaimView) => {
    if (!account) return false;
    if (claim.organisation_wallet_address === account.address) return false;
    if (claim.status !== 0) return false;
    return isVotingActive(claim);
  };

  // FIXED: Better status display logic
  const getStatusDisplay = (claim: ClaimView) => {
    console.log(`Status check for claim ${claim.claim_id}: status=${claim.status}`);
    
    if (claim.status === 0) {
      // Status is pending, check if voting is active
      const votingActive = isVotingActive(claim);
      return (
        <Box>
          <Text size="1">
            {getVotingEndTime(claim)}
          </Text>
          <br />
          <Badge color={votingActive ? "green" : "red"} size="1">
            {votingActive ? "Active" : "Expired"}
          </Badge>
        </Box>
      );
    } else {
      // Status is not pending
      return (
        <Text size="1" color="gray">
          {claim.status === 1 ? "Approved" : "Rejected"}
        </Text>
      );
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      {/* 3D Background */}
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 0,
        background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 50%, #000000 100%)'
      }} />
      
      {/* Gradient Overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
        zIndex: 1
      }} />
      
      {/* Main Content */}
      <div style={{ 
        position: 'relative', 
        zIndex: 2, 
        minHeight: '100vh', 
        padding: '2rem',
        color: 'white'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '1rem',
          padding: '1.5rem',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          backdropFilter: 'blur(10px)'
        }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #10b981, #34d399, #6ee7b7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            Carbon Credit Claims
          </h1>
          <button 
            onClick={fetchClaimsWithTransaction} 
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              background: loading ? 'rgba(255, 255, 255, 0.05)' : 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              borderRadius: '0.5rem',
              color: loading ? 'rgba(187, 247, 208, 0.5)' : 'white',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(16, 185, 129, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.3)';
              }
            }}
          >
            Refresh Claims
          </button>
        </div>
  
        {/* Error Message */}
        {error && (
          <div style={{
            background: 'rgba(220, 53, 69, 0.1)',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '2rem',
            border: '1px solid rgba(220, 53, 69, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
              Error: {error}
            </div>
          </div>
        )}
  
        {/* Content Area */}
        {!account ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            padding: '3rem',
            textAlign: 'center',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ color: 'rgba(187, 247, 208, 0.8)', fontSize: '1.2rem' }}>
              Please connect your wallet to view claims
            </div>
          </div>
        ) : loading ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            padding: '3rem',
            textAlign: 'center',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ color: 'rgba(187, 247, 208, 0.8)', fontSize: '1.2rem' }}>
              Loading claims...
            </div>
          </div>
        ) : !Array.isArray(claims) || claims.length === 0 ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            padding: '3rem',
            textAlign: 'center',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ color: 'rgba(187, 247, 208, 0.8)', fontSize: '1.2rem', marginBottom: '1rem' }}>
              No claims found
            </div>
            {!hasInitialLoad && (
              <button 
                onClick={fetchClaimsWithTransaction} 
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
                }}
              >
                Load Claims
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Claims Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
              gap: '1.5rem'
            }}>
              {claims.map((claim) => (
                <div 
                  key={claim.claim_id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                  }}
                >
                  {/* Claim Header */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
                      {claim.description}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'rgba(187, 247, 208, 0.6)', marginBottom: '0.25rem' }}>
                      IPFS: {claim.ipfs_hash}
                    </div>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: claim.status === 0 ? '#fbbf24' : claim.status === 1 ? '#10b981' : '#ef4444',
                      fontWeight: '600'
                    }}>
                      Status Code: {claim.status}
                    </div>
                  </div>
  
                  {/* Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: 'rgba(187, 247, 208, 0.7)', marginBottom: '0.25rem' }}>
                        Location
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'white' }}>
                        {claim.latitude}, {claim.longitude}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: 'rgba(187, 247, 208, 0.7)', marginBottom: '0.25rem' }}>
                        Credits Requested
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>
                        {claim.requested_carbon_credits}
                      </div>
                    </div>
                  </div>
  
                  {/* Voting Stats */}
                  <div style={{ 
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ fontSize: '0.875rem', color: 'rgba(187, 247, 208, 0.7)', marginBottom: '0.5rem' }}>
                      Votes
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ {claim.yes_votes}</span>
                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}>✗ {claim.no_votes}</span>
                      </div>
                      <div style={{ fontSize: '0.875rem' }}>
                        {getStatusDisplay(claim)}
                      </div>
                    </div>
                  </div>
  
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    {canVote(claim) ? (
                      <>
                        <button 
                          onClick={() => {
                            setSelectedClaim(claim);
                            setVoteType("yes");
                            setVoteDialogOpen(true);
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            borderRadius: '0.5rem',
                            color: 'white',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          Vote Yes
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedClaim(claim);
                            setVoteType("no");
                            setVoteDialogOpen(true);
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                            border: 'none',
                            borderRadius: '0.5rem',
                            color: 'white',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          Vote No
                        </button>
                      </>
                    ) : account && claim.organisation_wallet_address === account.address ? (
                      <div style={{ fontSize: '0.875rem', color: 'rgba(187, 247, 208, 0.6)' }}>Your claim</div>
                    ) : !isVotingActive(claim) ? (
                      <div style={{ fontSize: '0.875rem', color: '#fbbf24' }}>Voting expired</div>
                    ) : claim.status !== 0 ? (
                      <div style={{ fontSize: '0.875rem', color: 'rgba(187, 247, 208, 0.6)' }}>
                        {claim.status === 1 ? "Approved" : "Rejected"}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.875rem', color: 'rgba(187, 247, 208, 0.6)' }}>Voting closed</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
  
        {/* Claim Details Modal */}
        <Dialog.Root open={!!selectedClaim && !voteDialogOpen} onOpenChange={(open) => !open && setSelectedClaim(null)}>
          <Dialog.Content style={{ 
            maxWidth: 600,
            background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 50%, #000000 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '1rem',
            color: 'white'
          }}>
            {selectedClaim && (
              <>
                <Dialog.Title style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                  Claim Details
                </Dialog.Title>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontWeight: 'bold', color: '#34d399', marginBottom: '0.5rem' }}>Description:</div>
                  <div style={{ color: 'rgba(187, 247, 208, 0.8)' }}>{selectedClaim.description}</div>
                </div>
  
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '1rem', 
                  marginBottom: '1.5rem'
                }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#34d399', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      Location:
                    </div>
                    <div style={{ color: 'white', fontSize: '0.875rem' }}>
                      Latitude: {selectedClaim.latitude}
                      <br />
                      Longitude: {selectedClaim.longitude}
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#34d399', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      Credits:
                    </div>
                    <div style={{ color: '#10b981', fontSize: '1.25rem', fontWeight: 'bold' }}>
                      {selectedClaim.requested_carbon_credits}
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    gridColumn: 'span 2'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#34d399', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      Voting Status:
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: 'white' }}>{getVotingEndTime(selectedClaim)}</span>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        background: isVotingActive(selectedClaim) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: isVotingActive(selectedClaim) ? '#10b981' : '#ef4444'
                      }}>
                        {isVotingActive(selectedClaim) ? "Active" : "Expired"}
                      </span>
                    </div>
                  </div>
                </div>
  
                <div style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ fontWeight: 'bold', color: '#34d399', marginBottom: '0.5rem' }}>Current Votes:</div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                      ✓ Yes: {selectedClaim.yes_votes}
                    </span>
                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                      ✗ No: {selectedClaim.no_votes}
                    </span>
                    <span style={{ color: 'rgba(187, 247, 208, 0.7)' }}>
                      Total: {selectedClaim.total_votes}
                    </span>
                  </div>
                </div>
  
                {selectedClaim.status !== 0 && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#34d399', marginBottom: '0.5rem' }}>Final Result:</div>
                    <div style={{ color: 'white' }}>
                      {selectedClaim.status === 1 ? "✅ Approved" : "❌ Rejected"} with{' '}
                      {selectedClaim.yes_votes} Yes and {selectedClaim.no_votes} No votes
                    </div>
                  </div>
                )}
  
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <Dialog.Close>
                    <button style={{
                      padding: '0.75rem 1.5rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '0.5rem',
                      color: '#34d399',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                      e.currentTarget.style.borderColor = '#10b981';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                    }}>
                      Close
                    </button>
                  </Dialog.Close>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Root>
  
        {/* Vote Confirmation Dialog */}
        <AlertDialog.Root open={voteDialogOpen} onOpenChange={setVoteDialogOpen}>
          <AlertDialog.Content style={{ 
            maxWidth: 500,
            background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 50%, #000000 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '1rem',
            color: 'white'
          }}>
            <AlertDialog.Title style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Confirm Your Vote
            </AlertDialog.Title>
            <AlertDialog.Description>
              <div style={{ marginBottom: '1rem' }}>
                You are about to vote <strong style={{ color: voteType === "yes" ? '#10b981' : '#ef4444' }}>
                  {voteType === "yes" ? "YES" : "NO"}
                </strong> on this claim:
              </div>
              {selectedClaim && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  marginBottom: '1rem',
                  border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  <div style={{ fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
                    "{selectedClaim.description}"
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'rgba(187, 247, 208, 0.7)', marginBottom: '0.25rem' }}>
                    {selectedClaim.requested_carbon_credits} carbon credits requested
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'rgba(187, 247, 208, 0.7)' }}>
                    Location: {selectedClaim.latitude}, {selectedClaim.longitude}
                  </div>
                </div>
              )}
              <div style={{ color: '#fbbf24', fontSize: '0.875rem' }}>
                This action cannot be undone.
              </div>
            </AlertDialog.Description>
  
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <AlertDialog.Cancel>
                <button 
                  disabled={voteProcessing}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '0.5rem',
                    color: voteProcessing ? 'rgba(187, 247, 208, 0.5)' : '#34d399',
                    cursor: voteProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action>
                <button 
                  onClick={submitVote}
                  disabled={voteProcessing}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: voteProcessing ? 'rgba(255, 255, 255, 0.05)' : 
                      voteType === "yes" ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: voteProcessing ? 'rgba(187, 247, 208, 0.5)' : 'white',
                    cursor: voteProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {voteProcessing ? "Processing..." : `Vote ${voteType === "yes" ? "Yes" : "No"}`}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </div>
    </div>
  );
}