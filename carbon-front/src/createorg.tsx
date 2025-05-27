import { 
  useCurrentAccount, 
  useSignAndExecuteTransaction, 
  useSuiClientQuery,
  useSuiClient
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState, useEffect, useCallback } from "react";

// Replace with your actual package ID and handler object ID
const ORGANIZATION_HANDLER_ID = "0x3e93f9c3174505789f34825c4833e59adeb9b3f68adb8bfd53ecdcf0b61b75db";
const PACKAGE_ID = "0x0514cb5817179ac60a31c8b552c252928745a35048e189e0a857ea2a8487000a";

export function OrganisationProfile() {
  const account = useCurrentAccount();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [orgDetails, setOrgDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  // Error boundary to prevent page crashes
  const handleError = useCallback((error: any, context: string) => {
    console.error(`Error in ${context}:`, error);
    setError(`${context}: ${error?.message || error?.toString() || 'Unknown error'}`);
    setLoading(false);
  }, []);

  // Check if organization exists for current wallet
  const { data: handlerObject, refetch: refetchHandler } = useSuiClientQuery("getObject", {
    id: ORGANIZATION_HANDLER_ID,
    options: { showContent: true }
  });

  // Extract organization details from the handler object
  const extractOrgDetailsFromHandler = useCallback((handlerData: any, walletAddress: string) => {
    try {
      if (handlerData?.data?.content?.dataType === "moveObject") {
        const handlerFields = handlerData.data.content.fields as any;
        const orgMap = handlerFields.wallet_addressToOrg?.fields?.contents || [];
        const orgCollection = handlerFields.organisations?.fields?.contents || [];
        
        // Find the org ID for this wallet
        const walletOrgEntry = orgMap.find((item: any) => 
          item.fields.key === walletAddress
        );
        
        if (walletOrgEntry) {
          const orgId = walletOrgEntry.fields.value;
          
          // Find the organization details
          const orgEntry = orgCollection.find((item: any) => 
            item.fields.key === orgId
          );
          
          if (orgEntry) {
            const org = orgEntry.fields.value.fields;
            return {
              organisation_id: orgId,
              name: org.name,
              description: org.description,
              owner: org.owner,
              carbon_credits: org.carbon_credits,
              times_lent: org.times_lent,
              total_lent: org.total_lent,
              times_borrowed: org.times_borrowed,
              total_borrowed: org.total_borrowed,
              total_returned: org.total_returned,
              times_returned: org.times_returned,
              emissions: org.emissions,
              reputation_score: org.reputation_score
            };
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Error extracting org details:", error);
      return null;
    }
  }, []);

  // Check registration status and fetch details on load
  useEffect(() => {
    try {
      if (account && handlerObject?.data?.content?.dataType === "moveObject") {
        const handlerFields = handlerObject.data.content.fields as any;
        const orgMap = handlerFields.wallet_addressToOrg?.fields?.contents || [];
        const isRegistered = orgMap.some((item: any) => 
          item.fields.key === account.address
        );
        
        setIsRegistered(isRegistered);
        
        if (isRegistered) {
          // Extract organization details directly from the handler object
          const details = extractOrgDetailsFromHandler(handlerObject, account.address);
          if (details) {
            setOrgDetails(details);
          }
        }
      }
    } catch (error) {
      handleError(error, "Checking registration status");
    }
  }, [account, handlerObject, handleError, extractOrgDetailsFromHandler]);

  // Register new organization
  const registerOrganization = useCallback(async () => {
    try {
      if (!account) {
        setError("No account connected");
        return;
      }

      if (!name.trim() || !description.trim()) {
        setError("Please fill in both name and description");
        return;
      }

      console.log("Starting registration process...");
      console.log("Account:", account.address);
      console.log("Name:", name);
      console.log("Description:", description);

      setLoading(true);
      setError("");
      setSuccess("");

      const tx = new Transaction();
      
      tx.moveCall({
        target: `${PACKAGE_ID}::carbon_marketplace::register_organisation`,
        arguments: [
          tx.object(ORGANIZATION_HANDLER_ID),
          tx.pure.string(name.trim()),
          tx.pure.string(description.trim()),
        ],
      });

      console.log("Transaction created, attempting to sign...");

      // Wrap signAndExecute in a Promise to handle it safely
      const executeTransaction = () => {
        return new Promise((resolve, reject) => {
          signAndExecute(
            { transaction: tx },
            {
              onSuccess: (result) => {
                console.log("Transaction successful:", result);
                resolve(result);
              },
              onError: (error) => {
                console.error("Transaction failed:", error);
                reject(error);
              }
            }
          );
        });
      };

      const result = await executeTransaction() as any;
      
      // Wait for transaction with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction timeout')), 30000)
      );
      
      const txPromise = suiClient.waitForTransaction({ 
        digest: result.digest,
        options: { 
          showEvents: true,
          showEffects: true 
        }
      });

      const txResponse = await Promise.race([txPromise, timeoutPromise]);
      console.log("Transaction confirmed:", txResponse);
      
      const events = (txResponse as any).events || [];
      const orgEvent = events.find((e: any) => 
        e.type.endsWith("::carbon_marketplace::OrganisationCreated")
      );
      
      if (orgEvent) {
        console.log("Organization created event found:", orgEvent);
        setSuccess("Organization registered successfully!");
        setName("");
        setDescription("");
        
        // Refetch the handler object to get updated data
        setTimeout(async () => {
          try {
            const refetchedData = await refetchHandler();
            if (refetchedData.data) {
              setIsRegistered(true);
              // Extract details from the refetched data
              const details = extractOrgDetailsFromHandler(refetchedData, account.address);
              if (details) {
                setOrgDetails(details);
                console.log("Organization details automatically loaded:", details);
              } else {
                console.log("Details not found in refetched data, will try again");
                // Try one more time after a short delay
                setTimeout(async () => {
                  const secondRefetch = await refetchHandler();
                  const secondDetails = extractOrgDetailsFromHandler(secondRefetch, account.address);
                  if (secondDetails) {
                    setOrgDetails(secondDetails);
                  }
                }, 2000);
              }
            }
          } catch (error) {
            console.error("Error refetching organization data:", error);
          }
        }, 3000);
      } else {
        console.log("No organization created event found");
        console.log("All events:", events);
        setSuccess("Transaction completed - refreshing data...");
        
        // Even without the event, try to refetch
        setTimeout(async () => {
          setIsRegistered(true);
        }, 3000);
      }
    } catch (error) {
      handleError(error, "Registration");
    } finally {
      setLoading(false);
    }
  }, [account, name, description, signAndExecute, suiClient, handleError, refetchHandler, extractOrgDetailsFromHandler]);

  // Manual fetch organization details (fallback)
  const fetchOrganizationDetails = useCallback(async () => {
    if (!account) return;

    try {
      console.log("Manually fetching organization details...");
      setError("");

      const tx = new Transaction();
      
      tx.moveCall({
        target: `${PACKAGE_ID}::carbon_marketplace::get_my_organisation_details`,
        arguments: [
          tx.object(ORGANIZATION_HANDLER_ID),
        ],
      });

      // Wrap in Promise like registration
      const executeTransaction = () => {
        return new Promise((resolve, reject) => {
          signAndExecute(
            { transaction: tx },
            {
              onSuccess: (result) => resolve(result),
              onError: (error) => reject(error)
            }
          );
        });
      };

      const result = await executeTransaction() as any;
      
      const txResponse = await suiClient.waitForTransaction({ 
        digest: result.digest,
        options: { 
          showEvents: true,
          showEffects: true 
        }
      });
      
      const events = txResponse.events || [];
      const detailsEvent = events.find((e: any) => 
        e.type.endsWith("::carbon_marketplace::OrganisationDetailsEvent")
      );
      
      if (detailsEvent) {
        console.log("Organization details:", detailsEvent.parsedJson);
        setOrgDetails(detailsEvent.parsedJson);
      } else {
        console.log("No details event found");
        setError("Organization details not found");
      }
    } catch (error) {
      handleError(error, "Fetching details");
    }
  }, [account, signAndExecute, suiClient, handleError]);

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
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem', paddingTop: '2rem' }}>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 4rem)',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #10b981, #34d399, #6ee7b7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '1rem',
            lineHeight: '1.1'
          }}>
            My Organization
          </h1>
        </div>
  
        {/* Debug button */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
         
         
        </div>
  
        {/* Error Message */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '2rem',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ color: '#fca5a5', marginBottom: '1rem' }}>Error: {error}</div>
            <button 
              onClick={() => setError("")}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '0.5rem',
                color: '#fca5a5',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              Dismiss
            </button>
          </div>
        )}
  
        {/* Success Message */}
        {success && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '2rem',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ color: '#6ee7b7', marginBottom: '1rem' }}>✓ {success}</div>
            <button 
              onClick={() => setSuccess("")}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                borderRadius: '0.5rem',
                color: '#6ee7b7',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              Dismiss
            </button>
          </div>
        )}
  
        {/* Main Content Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '2rem',
          padding: '3rem',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
          {!account ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{
                fontSize: '1.5rem',
                color: 'rgba(187, 247, 208, 0.8)',
                marginBottom: '2rem'
              }}>
                Please connect your wallet to view or register your organization
              </div>
            </div>
          ) : isRegistered ? (
            <div>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '600',
                color: '#10b981',
                marginBottom: '2rem',
                textAlign: 'center'
              }}>
                
              </h2>
              
              {orgDetails ? (
                <div style={{
                  display: 'grid',
                  gap: '1rem',
                  maxWidth: '800px',
                  margin: '0 auto'
                }}>
                  {[
                    { label: 'Name', value: orgDetails.name },
                    { label: 'Description', value: orgDetails.description },
                    { label: 'Carbon Credits', value: orgDetails.carbon_credits },
                    { label: 'Reputation Score', value: orgDetails.reputation_score },
                    { label: 'Times Lent', value: orgDetails.times_lent },
                    { label: 'Total Lent', value: orgDetails.total_lent },
                    { label: 'Times Borrowed', value: orgDetails.times_borrowed },
                    { label: 'Total Borrowed', value: orgDetails.total_borrowed }
                  ].map((item, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem 1.5rem',
                      background: 'rgba(16, 185, 129, 0.05)',
                      borderRadius: '1rem',
                      border: '1px solid rgba(16, 185, 129, 0.1)'
                    }}>
                      <div style={{ 
                        color: 'rgba(187, 247, 208, 0.7)',
                        fontWeight: '500'
                      }}>
                        {item.label}
                      </div>
                      <div style={{ 
                        color: '#6ee7b7',
                        fontWeight: '600'
                      }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    color: 'rgba(187, 247, 208, 0.8)', 
                    marginBottom: '2rem',
                    fontSize: '1.1rem'
                  }}>
                    Loading organization details...
                  </div>
                  <button 
                    onClick={fetchOrganizationDetails}
                    disabled={loading}
                    style={{
                      padding: '1rem 2rem',
                      background: loading ? 'rgba(107, 114, 128, 0.3)' : 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      borderRadius: '9999px',
                      color: 'white',
                      fontSize: '1.1rem',
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
                    {loading ? "Loading..." : "Refresh Details"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{
                fontSize: '1.5rem',
                color: 'rgba(187, 247, 208, 0.8)',
                marginBottom: '2rem',
                textAlign: 'center'
              }}>
                Register your organization:
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <input
                  type="text"
                  placeholder="Organization name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    padding: '1rem 1.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '1rem',
                    color: '#6ee7b7',
                    fontSize: '1rem',
                    backdropFilter: 'blur(10px)',
                    outline: 'none',
                    transition: 'all 0.3s ease'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#10b981';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                
                <textarea 
                  placeholder="Description" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  style={{
                    padding: '1rem 1.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '1rem',
                    color: '#6ee7b7',
                    fontSize: '1rem',
                    backdropFilter: 'blur(10px)',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    resize: 'vertical',
                    minHeight: '100px'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#10b981';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                
                <button 
                  onClick={registerOrganization}
                  disabled={!name.trim() || !description.trim() || loading}
                  style={{
                    padding: '1rem 2rem',
                    background: (!name.trim() || !description.trim() || loading) 
                      ? 'rgba(107, 114, 128, 0.3)' 
                      : 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    borderRadius: '9999px',
                    color: 'white',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    cursor: (!name.trim() || !description.trim() || loading) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: (!name.trim() || !description.trim() || loading) 
                      ? 'none' 
                      : '0 4px 20px rgba(16, 185, 129, 0.3)',
                    marginTop: '1rem'
                  }}
                  onMouseEnter={(e) => {
                    if (name.trim() && description.trim() && !loading) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (name.trim() && description.trim() && !loading) {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.3)';
                    }
                  }}
                >
                  {loading ? "Registering..." : "Register Organization"}
                </button>
  
                {/* Loading state info */}
                {loading && (
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '1rem',
                    padding: '1rem',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <div style={{ 
                      color: '#93c5fd', 
                      fontSize: '0.9rem',
                      textAlign: 'center'
                    }}>
                      Please check your wallet for transaction approval. 
                      This process may take a few moments...
                    </div>
                  </div>
                )}
  
                {/* Display current values for debugging */}
                <div style={{
                  background: 'rgba(107, 114, 128, 0.1)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  borderRadius: '1rem',
                  padding: '1rem',
                  backdropFilter: 'blur(10px)'
                }}>
                  <div style={{ 
                    color: 'rgba(156, 163, 175, 0.8)', 
                    fontSize: '0.85rem',
                    textAlign: 'center'
                  }}>
                    Debug: Name="{name}" | Description="{description}" | 
                    Account={account?.address?.slice(0, 6)}...
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}