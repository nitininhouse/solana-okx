import { 
    useCurrentAccount, 
    useSignAndExecuteTransaction, 
    useSuiClient
  } from "@mysten/dapp-kit";
  import { Transaction } from "@mysten/sui/transactions";
  import { 
    Container, 
    Flex, 
    Heading, 
    Text, 
    Badge,
  } from "@radix-ui/themes";
  import { useState, useEffect } from "react";
  
  const ORGANIZATION_HANDLER_ID = "0x3e93f9c3174505789f34825c4833e59adeb9b3f68adb8bfd53ecdcf0b61b75db";
  const LEND_REQUEST_HANDLER_ID = "0x74b52a993916d235e68de2033b67529c9f0ea8c73fc5341ccaa24b37afd95b96";
  const PACKAGE_ID = "0x0514cb5817179ac60a31c8b552c252928745a35048e189e0a857ea2a8487000a";
  const CLOCK_OBJECT_ID = "0x6";
  
  type Organization = {
    organisation_id: string;
    name: string;
    carbon_credits: number;
    reputation_score: number;
    owner: string;
  };
  
  export function LendRequestPage() {
    const account = useCurrentAccount();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
    const [requestAmount, setRequestAmount] = useState("");
    const [duration, setDuration] = useState("604800");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const suiClient = useSuiClient();
  
    // Fetch all organizations using devInspect (read-only, no wallet popup)
    const fetchOrganizations = async () => {
      if (!account) return;
  
      setLoading(true);
      setError("");
  
      try {
        const tx = new Transaction();
        
        tx.moveCall({
          target: `${PACKAGE_ID}::carbon_marketplace::get_all_organisation_ids`,
          arguments: [
            tx.object(ORGANIZATION_HANDLER_ID),
          ],
        });
  
        // Use devInspectTransactionBlock for read-only operations
        const result = await suiClient.devInspectTransactionBlock({
          transactionBlock: tx,
          sender: account.address,
        });
  
        if (result.events && result.events.length > 0) {
          const idsEvent = result.events.find(e => 
            e.type.endsWith("::carbon_marketplace::OrganisationIDsEvent")
          );
          
          if (idsEvent && idsEvent.parsedJson) {
            interface OrganisationIDsEvent {
              ids: string[];
            }
            const orgIds = (idsEvent.parsedJson as OrganisationIDsEvent).ids;
            await fetchOrganizationDetails(orgIds);
          } else {
            setOrganizations([]);
          }
        } else {
          setOrganizations([]);
        }
      } catch (error) {
        console.error("Error fetching organizations:", error);
        setError(error instanceof Error ? error.message : "Failed to fetch organizations");
      } finally {
        setLoading(false);
      }
    };
  
    // Fetch details for each organization using devInspect
    const fetchOrganizationDetails = async (orgIds: string[]) => {
      if (!account || orgIds.length === 0) {
        setLoading(false);
        return;
      }
  
      try {
        const orgDetails: Organization[] = [];
  
        for (const orgId of orgIds) {
          try {
            const tx = new Transaction();
            
            tx.moveCall({
              target: `${PACKAGE_ID}::carbon_marketplace::get_organisation_details`,
              arguments: [
                tx.object(ORGANIZATION_HANDLER_ID),
                tx.pure.id(orgId),
              ],
            });
  
            // Use devInspect for read-only operations
            const result = await suiClient.devInspectTransactionBlock({
              transactionBlock: tx,
              sender: account.address,
            });
            
            if (result.events && result.events.length > 0) {
              const detailsEvent = result.events.find(e => 
                e.type.endsWith("::carbon_marketplace::OrganisationDetailsEvent")
              );
              
              if (detailsEvent && detailsEvent.parsedJson) {
                const parsed = detailsEvent.parsedJson as Organization;
              
                orgDetails.push({
                  organisation_id: parsed.organisation_id,
                  name: parsed.name,
                  carbon_credits: parsed.carbon_credits,
                  reputation_score: parsed.reputation_score,
                  owner: parsed.owner,
                });
              }
            }
          } catch (orgError) {
            console.error(`Error fetching details for org ${orgId}:`, orgError);
            // Continue with other organizations even if one fails
          }
        }
  
        setOrganizations(orgDetails);
      } catch (error) {
        console.error("Error fetching organization details:", error);
        setError(error instanceof Error ? error.message : "Failed to fetch organization details");
      }
    };
  
    // Submit lend request (this one uses signAndExecute because it's a write operation)
    const submitLendRequest = async () => {
      if (!account || !selectedOrg || !requestAmount) return;
  
      // Validate inputs
      const amount = Number(requestAmount);
      if (amount <= 0 || !Number.isInteger(amount)) {
        setError("Please enter a valid positive whole number for the amount");
        return;
      }
  
      setIsSubmitting(true);
      setError("");
  
      try {
        const tx = new Transaction();
        
        // Log the values being sent for debugging
        console.log("Submitting lend request with:", {
          orgId: selectedOrg.organisation_id,
          amount: requestAmount,
          duration: duration,
          lender: account.address,
          borrower: selectedOrg.owner
        });
        
        tx.moveCall({
          target: `${PACKAGE_ID}::carbon_marketplace::create_lend_request`,
          arguments: [
            tx.object(ORGANIZATION_HANDLER_ID),
            tx.object(CLOCK_OBJECT_ID),
            tx.object(LEND_REQUEST_HANDLER_ID),
            tx.pure.id(selectedOrg.organisation_id),
            tx.pure.u64(BigInt(requestAmount)),
            tx.pure.u64(BigInt(Math.floor(Date.now() / 1000))),
            tx.pure.u64(BigInt(duration)),
          ],
        });
  
        signAndExecute(
          { 
            transaction: tx
          },
          {
            onSuccess: async (txResponse) => {
              try {
                const txResult = await suiClient.waitForTransaction({ 
                  digest: txResponse.digest,
                  options: { 
                    showEvents: true,
                    showEffects: true 
                  }
                });
                
                const events = txResult.events || [];
                const requestEvent = events.find(e => 
                  e.type.endsWith("::carbon_marketplace::LendRequestCreated")
                );
                
                if (requestEvent) {
                  setSelectedOrg(null);
                  setRequestAmount("");
                  setDuration("604800");
                  // Refresh organizations list
                  await fetchOrganizations();
                }
              } catch (waitError) {
                console.error("Error waiting for transaction:", waitError);
                setError("Transaction submitted but confirmation failed");
              }
            },
            onError: (error) => {
              console.error("Transaction error:", error);
              setError(error.message || "Failed to create lend request");
            },
            onSettled: () => {
              setIsSubmitting(false);
            }
          }
        );
      } catch (error) {
        console.error("Submit error:", error);
        setError(error instanceof Error ? error.message : "Unknown error occurred");
        setIsSubmitting(false);
      }
    };
  
    // Auto-refresh on account change
    useEffect(() => {
      if (account) {
        fetchOrganizations();
      } else {
        setOrganizations([]);
        setError("");
      }
    }, [account]);
  
    // Helper functions
    const getReputationBadge = (score: number) => {
      if (score >= 80) return <Badge color="green">Excellent</Badge>;
      if (score >= 50) return <Badge color="yellow">Good</Badge>;
      return <Badge color="red">Needs Improvement</Badge>;
    };
  
    const formatDuration = (seconds: number) => {
      const days = Math.floor(seconds / 86400);
      return `${days} day${days !== 1 ? 's' : ''}`;
    };
  
    if (!account) {
      return (
        <Container size="3" my="4">
          <Flex justify="center" align="center" direction="column" gap="4" style={{ minHeight: "200px" }}>
            <Heading size="4">Lend Carbon Credits</Heading>
            <Text color="gray">Please connect your wallet to lend credits</Text>
          </Flex>
        </Container>
      );
    }
  
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
          padding: '2rem'
        }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '3rem',
            maxWidth: '1200px',
            margin: '0 auto 3rem auto'
          }}>
            <h1 style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #10b981, #34d399, #6ee7b7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0
            }}>
              Lend Carbon Credits
            </h1>
            <button 
              onClick={fetchOrganizations} 
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? 'rgba(255, 255, 255, 0.1)' : 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                borderRadius: '9999px',
                color: loading ? 'rgba(255, 255, 255, 0.5)' : 'white',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(16, 185, 129, 0.3)'
              }}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
    
          {/* Error Message */}
          {error && (
            <div style={{
              maxWidth: '1200px',
              margin: '0 auto 2rem auto',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '1rem',
              padding: '1rem',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ color: '#f87171', fontWeight: '600' }}>
                Error: {error}
              </div>
            </div>
          )}
    
          {/* Content Area */}
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {loading ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '400px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '1rem',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <div style={{ color: 'rgba(187, 247, 208, 0.8)', fontSize: '1.2rem' }}>
                  Loading organizations...
                </div>
              </div>
            ) : organizations.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '400px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '1rem',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                backdropFilter: 'blur(10px)',
                textAlign: 'center',
                gap: '1rem'
              }}>
                <div style={{ color: 'rgba(187, 247, 208, 0.8)', fontSize: '1.5rem', fontWeight: '600' }}>
                  No organizations available for lending
                </div>
                <div style={{ color: 'rgba(187, 247, 208, 0.5)', fontSize: '1rem' }}>
                  Try refreshing or check back later
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '1rem',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                backdropFilter: 'blur(10px)',
                overflow: 'hidden'
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <th style={{
                          padding: '1.5rem 1rem',
                          textAlign: 'left',
                          color: '#10b981',
                          fontWeight: '600',
                          fontSize: '1rem'
                        }}>
                          Organization
                        </th>
                        <th style={{
                          padding: '1.5rem 1rem',
                          textAlign: 'left',
                          color: '#10b981',
                          fontWeight: '600',
                          fontSize: '1rem'
                        }}>
                          Credits
                        </th>
                        <th style={{
                          padding: '1.5rem 1rem',
                          textAlign: 'left',
                          color: '#10b981',
                          fontWeight: '600',
                          fontSize: '1rem'
                        }}>
                          Reputation
                        </th>
                        <th style={{
                          padding: '1.5rem 1rem',
                          textAlign: 'center',
                          color: '#10b981',
                          fontWeight: '600',
                          fontSize: '1rem'
                        }}>
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {organizations.map((org) => (
                        <tr 
                          key={org.organisation_id}
                          style={{ 
                            borderBottom: '1px solid rgba(16, 185, 129, 0.1)',
                            transition: 'background-color 0.2s ease' 
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <td style={{ padding: '1.5rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #10b981, #34d399)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '1.1rem'
                              }}>
                                {org.name.charAt(0)}
                              </div>
                              <div>
                                <div style={{ 
                                  color: 'rgba(255, 255, 255, 0.9)', 
                                  fontWeight: '600',
                                  fontSize: '1rem',
                                  marginBottom: '0.25rem'
                                }}>
                                  {org.name}
                                </div>
                                <div style={{ 
                                  color: 'rgba(187, 247, 208, 0.6)', 
                                  fontSize: '0.85rem',
                                  fontFamily: 'monospace'
                                }}>
                                  {org.owner.slice(0, 6)}...{org.owner.slice(-4)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '1.5rem 1rem' }}>
                            <div style={{ 
                              color: 'rgba(255, 255, 255, 0.9)', 
                              fontWeight: '700',
                              fontSize: '1.1rem'
                            }}>
                              {org.carbon_credits.toLocaleString()}
                            </div>
                          </td>
                          <td style={{ padding: '1.5rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {getReputationBadge(org.reputation_score)}
                              <span style={{ 
                                color: 'rgba(187, 247, 208, 0.7)', 
                                fontSize: '0.9rem' 
                              }}>
                                ({org.reputation_score})
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
                            <button
                              onClick={() => setSelectedOrg(org)}
                              disabled={org.owner === account.address || loading}
                              style={{
                                padding: '0.5rem 1.25rem',
                                background: org.owner === account.address 
                                  ? 'rgba(255, 255, 255, 0.1)' 
                                  : 'linear-gradient(135deg, #10b981, #059669)',
                                border: org.owner === account.address 
                                  ? '1px solid rgba(16, 185, 129, 0.3)' 
                                  : 'none',
                                borderRadius: '9999px',
                                color: org.owner === account.address 
                                  ? 'rgba(255, 255, 255, 0.6)' 
                                  : 'white',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: org.owner === account.address || loading 
                                  ? 'not-allowed' 
                                  : 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: org.owner === account.address 
                                  ? 'none' 
                                  : '0 2px 10px rgba(16, 185, 129, 0.3)'
                              }}
                              onMouseEnter={(e) => {
                                if (org.owner !== account.address && !loading) {
                                  e.currentTarget.style.transform = 'scale(1.05)';
                                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (org.owner !== account.address && !loading) {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.boxShadow = '0 2px 10px rgba(16, 185, 129, 0.3)';
                                }
                              }}
                            >
                              {org.owner === account.address ? "Your Organization" : "Lend Credits"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
    
        {/* Lend Request Dialog */}
        {selectedOrg && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(6, 78, 59, 0.95))',
              borderRadius: '1.5rem',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              backdropFilter: 'blur(20px)',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              {/* Dialog Header */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981, #34d399)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1.1rem'
                }}>
                  {selectedOrg.name.charAt(0)}
                </div>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: 'rgba(255, 255, 255, 0.9)',
                  margin: 0
                }}>
                  Lend to {selectedOrg.name}
                </h2>
              </div>
              
              {/* Organization Details */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ 
                  color: '#10b981', 
                  fontSize: '1.1rem', 
                  fontWeight: '600',
                  marginBottom: '1rem'
                }}>
                  Organization Details:
                </h3>
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span style={{ color: 'rgba(187, 247, 208, 0.7)', fontSize: '0.9rem' }}>
                      Available Credits: 
                    </span>
                    <span style={{ 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      fontWeight: '700',
                      fontSize: '1rem',
                      marginLeft: '0.5rem'
                    }}>
                      {selectedOrg.carbon_credits.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'rgba(187, 247, 208, 0.7)', fontSize: '0.9rem' }}>
                      Reputation: 
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
                      {getReputationBadge(selectedOrg.reputation_score)}
                      <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem' }}>
                        {selectedOrg.reputation_score}/100
                      </span>
                    </span>
                  </div>
                </div>
              </div>
    
              {/* Amount Input */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  color: '#10b981', 
                  fontSize: '1rem', 
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Amount to Lend:
                </label>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '0.5rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '1rem',
                    backdropFilter: 'blur(10px)'
                  }}
                />
              </div>
    
              {/* Duration Selection */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  color: '#10b981', 
                  fontSize: '1rem', 
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Lending Duration:
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '0.5rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '1rem',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <option value="86400">1 Day</option>
                  <option value="259200">3 Days</option>
                  <option value="604800">7 Days</option>
                  <option value="1209600">14 Days</option>
                  <option value="2592000">30 Days</option>
                </select>
              </div>
    
              <div style={{ 
                color: 'rgba(187, 247, 208, 0.7)', 
                fontSize: '0.9rem',
                marginBottom: '2rem',
                fontStyle: 'italic'
              }}>
                Lending period: {formatDuration(Number(duration))}
              </div>
    
              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', 
                gap: '1rem', 
                justifyContent: 'flex-end' 
              }}>
                <button
                  onClick={() => setSelectedOrg(null)}
                  disabled={isSubmitting}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '9999px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitLendRequest}
                  disabled={!requestAmount || isSubmitting || Number(requestAmount) <= 0}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: (!requestAmount || isSubmitting || Number(requestAmount) <= 0)
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    borderRadius: '9999px',
                    color: (!requestAmount || isSubmitting || Number(requestAmount) <= 0)
                      ? 'rgba(255, 255, 255, 0.5)'
                      : 'white',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: (!requestAmount || isSubmitting || Number(requestAmount) <= 0)
                      ? 'not-allowed'
                      : 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: (!requestAmount || isSubmitting || Number(requestAmount) <= 0)
                      ? 'none'
                      : '0 4px 20px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {isSubmitting ? "Submitting..." : "Submit Lend Request"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }