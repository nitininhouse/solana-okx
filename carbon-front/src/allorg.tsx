// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { 
  useCurrentAccount, 
  useSuiClientQuery,
} from "@mysten/dapp-kit";

import { 
  
  Badge,
  
  Dialog,
  
} from "@radix-ui/themes";
import { useState, useEffect } from "react";

// Replace with your actual package ID and handler object ID
const ORGANIZATION_HANDLER_ID = "0x3e93f9c3174505789f34825c4833e59adeb9b3f68adb8bfd53ecdcf0b61b75db";


type Organization = {
  organisation_id: string;
  name: string;
  description: string;
  owner: string;
  carbon_credits: number;
  reputation_score: number;
  times_lent: number;
  total_lent: number;
  times_borrowed: number;
  total_borrowed: number;
  total_returned: number;
  times_returned: number;
  emissions: number;
  wallet_address: string;
};

export function OrganizationDirectory() {
  const account = useCurrentAccount();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const loading = false;
  const [error, setError] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const showDebug = false;

  // Query the handler object to get organization data
  const { data: handlerObject } = useSuiClientQuery("getObject", {
    id: ORGANIZATION_HANDLER_ID,
    options: { 
      showContent: true,
      showOwner: true 
    }
  });

  // Extract organizations from the handler object
  useEffect(() => {
    const loadOrganizations = async () => {
      if (!handlerObject?.data?.content || handlerObject.data.content.dataType !== "moveObject") {
        return;
      }

      try {
        const handlerFields = handlerObject.data.content.fields as any;
        
        // Set debug info to see the actual structure
        setDebugInfo({
          handlerFields: handlerFields,
          fullObject: handlerObject.data
        });
        
        // Extract organizations from the embedded VecMap
        const organizations: Organization[] = [];
        
        if (handlerFields.organisations?.fields?.contents) {
          const orgEntries = handlerFields.organisations.fields.contents;
          
          for (const entry of orgEntries) {
            if (entry.fields?.value?.fields) {
              const orgFields = entry.fields.value.fields;
              
              const org: Organization = {
                organisation_id: orgFields.id?.id || entry.fields.key,
                name: orgFields.name || "Unknown",
                description: orgFields.description || "No description",
                owner: orgFields.owner || "Unknown",
                wallet_address: orgFields.wallet_address || orgFields.owner || "Unknown",
                carbon_credits: parseInt(orgFields.carbon_credits?.toString() || "0"),
                reputation_score: parseInt(orgFields.reputation_score?.toString() || "0"),
                times_lent: parseInt(orgFields.times_lent?.toString() || "0"),
                total_lent: parseInt(orgFields.total_lent?.toString() || "0"),
                times_borrowed: parseInt(orgFields.times_borrowed?.toString() || "0"),
                total_borrowed: parseInt(orgFields.total_borrowed?.toString() || "0"),
                total_returned: parseInt(orgFields.total_returned?.toString() || "0"),
                times_returned: parseInt(orgFields.times_returned?.toString() || "0"),
                emissions: parseInt(orgFields.emissions?.toString() || "0")
              };
              
              organizations.push(org);
            }
          }
        }
        
        console.log("Extracted organizations:", organizations);
        setOrganizations(organizations);
        
        if (organizations.length === 0) {
          setError("No organizations found in handler object");
        }
      } catch (error) {
        console.error("Error processing handler object:", error);
        setError(`Error loading organizations: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    if (account) {
      loadOrganizations();
    }
  }, [account, handlerObject]);


  // Helper functions
  const getReputationBadge = (score: number) => {
    if (score >= 80) return <Badge color="green">Excellent</Badge>;
    if (score >= 50) return <Badge color="yellow">Good</Badge>;
    return <Badge color="red">Needs Improvement</Badge>;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
            Organizations
          </h1>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {/* Add any header buttons here */}
          </div>
        </div>
  
        {/* Debug Information */}
        {showDebug && debugInfo && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1rem',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '1rem', color: '#ffc107' }}>
              Debug Information:
            </div>
            <pre style={{ 
              fontFamily: 'monospace', 
              whiteSpace: 'pre-wrap',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '0.875rem'
            }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
  
        {/* Error Message */}
        {error && (
          <div style={{
            background: 'rgba(220, 53, 69, 0.1)',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1rem',
            border: '1px solid rgba(220, 53, 69, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ color: '#ff6b6b', marginBottom: '1rem' }}>
              Error: {String(error)}
            </div>
            <button 
              onClick={() => setError("")}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid rgba(220, 53, 69, 0.5)',
                borderRadius: '0.5rem',
                color: '#ff6b6b',
                cursor: 'pointer',
                fontSize: '0.875rem',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(220, 53, 69, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Dismiss
            </button>
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
              Please connect your wallet to view organizations
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
              Loading organizations...
            </div>
          </div>
        ) : organizations.length === 0 ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            padding: '3rem',
            textAlign: 'center',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ color: 'rgba(187, 247, 208, 0.8)', fontSize: '1.2rem', marginBottom: '1rem' }}>
              No organizations found
            </div>
            <div style={{ color: 'rgba(187, 247, 208, 0.6)', fontSize: '0.875rem' }}>
              Organizations are loaded directly from the handler object. 
              Check the debug info to see the structure.
            </div>
          </div>
        ) : (
          <>
            {/* Stats Header */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '1rem',
              padding: '1.5rem',
              marginBottom: '2rem',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              backdropFilter: 'blur(10px)',
              textAlign: 'center'
            }}>
              <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold', 
                color: '#10b981',
                marginBottom: '0.5rem'
              }}>
                {organizations.length}
              </div>
              <div style={{ color: 'rgba(187, 247, 208, 0.7)' }}>
                Organization{organizations.length !== 1 ? 's' : ''} Found
              </div>
            </div>
  
            {/* Organizations Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
              gap: '1.5rem'
            }}>
              {organizations.map((org) => (
                <div 
                  key={org.organisation_id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
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
                  onClick={() => setSelectedOrg(org)}
                >
                  {/* Organization Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981, #34d399)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: 'white'
                    }}>
                      {org.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '0.25rem' }}>
                        {org.name}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'rgba(187, 247, 208, 0.6)' }}>
                        {formatAddress(org.owner)}
                      </div>
                    </div>
                  </div>
  
                  {/* Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                        {org.carbon_credits}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'rgba(187, 247, 208, 0.7)' }}>
                        Carbon Credits
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        {getReputationBadge(org.reputation_score)}
                        <span style={{ color: 'white', fontSize: '1.1rem', fontWeight: 'bold' }}>
                          {org.reputation_score}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'rgba(187, 247, 208, 0.7)' }}>
                        Reputation Score
                      </div>
                    </div>
                  </div>
  
                  {/* Activity Stats */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    padding: '1rem',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#34d399', fontWeight: 'bold' }}>{org.times_lent}</div>
                      <div style={{ color: 'rgba(187, 247, 208, 0.6)' }}>Lent</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#34d399', fontWeight: 'bold' }}>{org.times_borrowed}</div>
                      <div style={{ color: 'rgba(187, 247, 208, 0.6)' }}>Borrowed</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
  
        {/* Organization Details Modal */}
        <Dialog.Root open={!!selectedOrg} onOpenChange={(open) => !open && setSelectedOrg(null)}>
          <Dialog.Content style={{ 
            maxWidth: 700,
            background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 50%, #000000 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '1rem',
            color: 'white'
          }}>
            {selectedOrg && (
              <>
                <Dialog.Title>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981, #34d399)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: 'white'
                    }}>
                      {selectedOrg.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                        {selectedOrg.name}
                      </div>
                    </div>
                  </div>
                </Dialog.Title>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontWeight: 'bold', color: '#34d399', marginBottom: '0.5rem' }}>Description:</div>
                  <div style={{ color: 'rgba(187, 247, 208, 0.8)' }}>{selectedOrg.description}</div>
                </div>
  
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '1rem', 
                  marginBottom: '2rem'
                }}>
                  {[
                    { label: 'Owner', value: formatAddress(selectedOrg.owner) },
                    { label: 'Wallet Address', value: formatAddress(selectedOrg.wallet_address) },
                    { label: 'Carbon Credits', value: selectedOrg.carbon_credits },
                    { label: 'Reputation Score', value: `${selectedOrg.reputation_score}/100` },
                    { label: 'Times Lent', value: selectedOrg.times_lent },
                    { label: 'Total Lent', value: selectedOrg.total_lent },
                    { label: 'Total Returned', value: selectedOrg.total_returned },
                    { label: 'Times Borrowed', value: selectedOrg.times_borrowed },
                    { label: 'Total Borrowed', value: selectedOrg.total_borrowed },
                    { label: 'Emissions', value: selectedOrg.emissions }
                  ].map((item, index) => (
                    <div key={index} style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#34d399', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        {item.label}:
                      </div>
                      <div style={{ color: 'white' }}>
                        {item.label === 'Reputation Score' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {getReputationBadge(selectedOrg.reputation_score)}
                            <span>{item.value}</span>
                          </div>
                        ) : (
                          item.value
                        )}
                      </div>
                    </div>
                  ))}
                </div>
  
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
      </div>
    </div>
  );
}