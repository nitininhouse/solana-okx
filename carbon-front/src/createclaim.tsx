import {
    useCurrentAccount,
    useSignAndExecuteTransaction,
    useSuiClient
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";

// Replace with your actual package ID and handler object ID
const CLAIM_HANDLER_ID = "0x9dfc31fa670a2722a806be47eef3fd02b98db35d8c6910a2ef9a2868793a6225";
const PACKAGE_ID = "0x0514cb5817179ac60a31c8b552c252928745a35048e189e0a857ea2a8487000a";
const CLOCK_OBJECT_ID = "0x6"; // Standard Sui Clock object

export function CreateClaim() {
    const account = useCurrentAccount();
    const [formData, setFormData] = useState({
        longitude: "",
        latitude: "",
        credits: "",
        ipfsHash: "",
        description: "",
        votingEndDate: "",
        votingEndTime: "23:59" // Default to end of day
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const suiClient = useSuiClient();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const calculateVotingPeriodSeconds = (): number => {
        if (!formData.votingEndDate) {
            throw new Error("Voting end date is required");
        }

        const now = new Date();
        const endDateTime = new Date(`${formData.votingEndDate}T${formData.votingEndTime}`);
        
        if (endDateTime <= now) {
            throw new Error("Voting end date must be in the future");
        }

        const diffInMs = endDateTime.getTime() - now.getTime();
        const diffInSeconds = Math.floor(diffInMs / 1000);
        
        return diffInSeconds;
    };

    const resetForm = () => {
        setFormData({
            longitude: "",
            latitude: "",
            credits: "",
            ipfsHash: "",
            description: "",
            votingEndDate: "",
            votingEndTime: "23:59"
        });
        setError("");
        setSuccess("");
    };

    const handleSubmit = async () => {
        console.log("HandleSubmit called");
        
        if (!account) {
            setError("Wallet not connected");
            return;
        }

        // Validate inputs
        if (!formData.longitude || !formData.latitude || !formData.credits ||
            !formData.ipfsHash || !formData.description || !formData.votingEndDate) {
            setError("All fields are required");
            return;
        }

        // Validate longitude and latitude ranges
        const lng = parseFloat(formData.longitude);
        const lat = parseFloat(formData.latitude);
        
        if (lng < -180 || lng > 180) {
            setError("Longitude must be between -180 and 180");
            return;
        }
        
        if (lat < -90 || lat > 90) {
            setError("Latitude must be between -90 and 90");
            return;
        }

        // Validate credits is positive
        const credits = parseFloat(formData.credits);
        if (credits <= 0) {
            setError("Carbon credits must be a positive number");
            return;
        }

        console.log("Starting transaction...");
        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const votingPeriodSeconds = calculateVotingPeriodSeconds();
            
            const tx = new Transaction();

            // Convert coordinates to u64 (multiply by 1000000 to preserve 6 decimal places)
            const longitudeU64 = Math.round(lng * 1);
            const latitudeU64 = Math.round(lat * 1);
            const creditsU64 = Math.round(credits * 1 ); // Assuming 6 decimal places for credits too

            tx.moveCall({
                target: `${PACKAGE_ID}::carbon_marketplace::create_claim`,
                arguments: [
                    tx.object(CLAIM_HANDLER_ID),
                    tx.object(CLOCK_OBJECT_ID), // Clock object
                    tx.pure.u64(BigInt(longitudeU64)),
                    tx.pure.u64(BigInt(latitudeU64)),
                    tx.pure.u64(BigInt(creditsU64)),
                    tx.pure.u64(BigInt(1)), // Status: 1 = Pending (always starts as pending)
                    tx.pure.string(formData.ipfsHash),
                    tx.pure.string(formData.description),
                    tx.pure.u64(BigInt(votingPeriodSeconds)),
                ],
            });

            console.log("Transaction created, signing...");
            console.log("Voting period (seconds):", votingPeriodSeconds);

            signAndExecute(
                {
                    transaction: tx,
                },
                {
                    onSuccess: async (txResponse) => {
                        console.log("Transaction success:", txResponse);
                        
                        try {
                            const txResult = await suiClient.waitForTransaction({
                                digest: txResponse.digest,
                                options: {
                                    showEvents: true,
                                    showEffects: true
                                }
                            });

                            console.log("Transaction result:", txResult);

                            const events = txResult.events || [];
                            const claimEvent = events.find(e =>
                                e.type.endsWith("::carbon_marketplace::ClaimCreated")
                            );

                            if (claimEvent) {
                                const parsedJson = claimEvent.parsedJson as { claim_id: string };
                                setSuccess(`Claim created successfully! Claim ID: ${parsedJson.claim_id}`);
                            } else {
                                setSuccess("Claim created successfully!");
                            }
                            
                            // Reset form after 3 seconds
                            setTimeout(() => {
                                console.log("Auto-resetting form...");
                                resetForm();
                            }, 3000);
                            
                        } catch (waitError) {
                            console.error("Error waiting for transaction:", waitError);
                            setSuccess("Transaction submitted successfully!");
                            setTimeout(() => {
                                resetForm();
                            }, 3000);
                        } finally {
                            setLoading(false);
                        }
                    },
                    onError: (error) => {
                        console.error("Transaction error:", error);
                        setError(error.message || "Transaction failed");
                        setLoading(false);
                    },
                }
            );
        } catch (error) {
            console.error("Submit error:", error);
            setError(error instanceof Error ? error.message : "Unknown error");
            setLoading(false);
        }
    };

    // Calculate and display voting period info
    const getVotingPeriodInfo = () => {
        if (!formData.votingEndDate) return null;
        
        try {
            const seconds = calculateVotingPeriodSeconds();
            const hours = Math.floor(seconds / 3600);
            const days = Math.floor(hours / 24);
            const remainingHours = hours % 24;
            
            let timeString = "";
            if (days > 0) {
                timeString = `${days} day${days > 1 ? 's' : ''}`;
                if (remainingHours > 0) {
                    timeString += ` and ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
                }
            } else {
                timeString = `${hours} hour${hours > 1 ? 's' : ''}`;
            }
            
            return `Voting period: ${timeString} (${seconds} seconds)`;
        } catch (e) {
            return `Error: ${e instanceof Error ? e.message : 'Invalid date'}`;
        }
    };

    return (
        <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
            {/* Background */}
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
            
            {/* Floating particles */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 1 }}>
                {[...Array(15)].map((_, i) => (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            width: '4px',
                            height: '4px',
                            background: 'rgba(16, 185, 129, 0.3)',
                            borderRadius: '50%',
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animation: `pulse ${3 + Math.random() * 2}s infinite`,
                            animationDelay: `${Math.random() * 3}s`
                        }}
                    />
                ))}
            </div>
            
            {/* Main Content */}
            <div style={{ 
                position: 'relative', 
                zIndex: 2, 
                minHeight: '100vh', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{
                        fontSize: 'clamp(2rem, 5vw, 3rem)',
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #10b981, #34d399, #6ee7b7)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '0.5rem'
                    }}>
                        Create Carbon Credit Claim
                    </h1>
                    <p style={{
                        color: 'rgba(187, 247, 208, 0.8)',
                        fontSize: '1.1rem'
                    }}>
                        Submit your carbon credit claim for community verification
                    </p>
                </div>
    
                {/* Form Container */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '1.5rem',
                    padding: '2rem',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    backdropFilter: 'blur(20px)',
                    maxWidth: '800px',
                    width: '100%',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
                }}>
                    {!account ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <div style={{ 
                                color: 'rgba(187, 247, 208, 0.7)', 
                                fontSize: '1.1rem' 
                            }}>
                                Please connect your wallet to create a claim
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Location Fields */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ 
                                        display: 'block', 
                                        color: '#6ee7b7', 
                                        fontSize: '0.9rem', 
                                        fontWeight: '500',
                                        marginBottom: '0.5rem'
                                    }}>Longitude</label>
                                    <input
                                        name="longitude"
                                        placeholder="Longitude (e.g., -122.4194)"
                                        value={formData.longitude}
                                        onChange={handleChange}
                                        disabled={loading}
                                        type="number"
                                        step="any"
                                        min="-180"
                                        max="180"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                            borderRadius: '0.75rem',
                                            color: 'white',
                                            fontSize: '1rem',
                                            backdropFilter: 'blur(10px)',
                                            transition: 'all 0.3s ease'
                                        }}
                                    />
                                </div>
                                
                                <div>
                                    <label style={{ 
                                        display: 'block', 
                                        color: '#6ee7b7', 
                                        fontSize: '0.9rem', 
                                        fontWeight: '500',
                                        marginBottom: '0.5rem'
                                    }}>Latitude</label>
                                    <input
                                        name="latitude"
                                        placeholder="Latitude (e.g., 37.7749)"
                                        value={formData.latitude}
                                        onChange={handleChange}
                                        disabled={loading}
                                        type="number"
                                        step="any"
                                        min="-90"
                                        max="90"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                            borderRadius: '0.75rem',
                                            color: 'white',
                                            fontSize: '1rem',
                                            backdropFilter: 'blur(10px)',
                                            transition: 'all 0.3s ease'
                                        }}
                                    />
                                </div>
                            </div>
    
                            {/* Credits Field */}
                            <div>
                                <label style={{ 
                                    display: 'block', 
                                    color: '#6ee7b7', 
                                    fontSize: '0.9rem', 
                                    fontWeight: '500',
                                    marginBottom: '0.5rem'
                                }}>Requested Carbon Credits</label>
                                <input
                                    name="credits"
                                    placeholder="Requested Carbon Credits"
                                    value={formData.credits}
                                    onChange={handleChange}
                                    type="number"
                                    step="any"
                                    min="0.000001"
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        borderRadius: '0.75rem',
                                        color: 'white',
                                        fontSize: '1rem',
                                        backdropFilter: 'blur(10px)',
                                        transition: 'all 0.3s ease'
                                    }}
                                />
                            </div>
    
                            {/* IPFS Hash Field */}
                            <div>
                                <label style={{ 
                                    display: 'block', 
                                    color: '#6ee7b7', 
                                    fontSize: '0.9rem', 
                                    fontWeight: '500',
                                    marginBottom: '0.5rem'
                                }}>IPFS Hash for Supporting Documents</label>
                                <input
                                    name="ipfsHash"
                                    placeholder="IPFS Hash for supporting documents"
                                    value={formData.ipfsHash}
                                    onChange={handleChange}
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        borderRadius: '0.75rem',
                                        color: 'white',
                                        fontSize: '1rem',
                                        backdropFilter: 'blur(10px)',
                                        transition: 'all 0.3s ease'
                                    }}
                                />
                            </div>
    
                            {/* Description Field */}
                            <div>
                                <label style={{ 
                                    display: 'block', 
                                    color: '#6ee7b7', 
                                    fontSize: '0.9rem', 
                                    fontWeight: '500',
                                    marginBottom: '0.5rem'
                                }}>Description</label>
                                <textarea
                                    name="description"
                                    placeholder="Detailed description of the carbon credit claim"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows={4}
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        borderRadius: '0.75rem',
                                        color: 'white',
                                        fontSize: '1rem',
                                        backdropFilter: 'blur(10px)',
                                        transition: 'all 0.3s ease',
                                        resize: 'vertical',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>
    
                            {/* Voting Period */}
                            <div>
                                <label style={{ 
                                    display: 'block', 
                                    color: '#6ee7b7', 
                                    fontSize: '0.9rem', 
                                    fontWeight: '500',
                                    marginBottom: '0.5rem'
                                }}>Voting Period End</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <input
                                        name="votingEndDate"
                                        type="date"
                                        value={formData.votingEndDate}
                                        onChange={handleChange}
                                        disabled={loading}
                                        min={new Date().toISOString().split('T')[0]}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                            borderRadius: '0.75rem',
                                            color: 'white',
                                            fontSize: '1rem',
                                            backdropFilter: 'blur(10px)',
                                            transition: 'all 0.3s ease'
                                        }}
                                    />
                                    
                                    <input
                                        name="votingEndTime"
                                        type="time"
                                        value={formData.votingEndTime}
                                        onChange={handleChange}
                                        disabled={loading}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                            borderRadius: '0.75rem',
                                            color: 'white',
                                            fontSize: '1rem',
                                            backdropFilter: 'blur(10px)',
                                            transition: 'all 0.3s ease'
                                        }}
                                    />
                                </div>
                                
                                {formData.votingEndDate && (
                                    <div style={{ 
                                        marginTop: '0.5rem', 
                                        color: 'rgba(187, 247, 208, 0.7)', 
                                        fontSize: '0.9rem' 
                                    }}>
                                        {getVotingPeriodInfo()}
                                    </div>
                                )}
                            </div>
    
                            {/* Info Card */}
                            <div style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                borderRadius: '0.75rem',
                                padding: '1rem',
                                border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                                <div style={{ color: 'rgba(187, 247, 208, 0.9)', fontSize: '0.9rem' }}>
                                    <strong>Note:</strong> All claims start with "Pending" status and will be processed through the voting system. 
                                    Status will be automatically updated based on voting results after the voting period ends.
                                </div>
                            </div>
    
                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    style={{
                                        flex: 1,
                                        padding: '1rem 2rem',
                                        background: loading ? 
                                            'rgba(16, 185, 129, 0.5)' : 
                                            'linear-gradient(135deg, #10b981, #059669)',
                                        border: 'none',
                                        borderRadius: '0.75rem',
                                        color: 'white',
                                        fontSize: '1.1rem',
                                        fontWeight: '600',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
                                    }}
                                >
                                    {loading ? "Processing..." : "Submit Claim"}
                                </button>
                                
                                {(success || error) && (
                                    <button
                                        onClick={resetForm}
                                        disabled={loading}
                                        style={{
                                            padding: '1rem 1.5rem',
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            border: '2px solid rgba(16, 185, 129, 0.5)',
                                            borderRadius: '0.75rem',
                                            color: '#6ee7b7',
                                            fontSize: '1rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            backdropFilter: 'blur(10px)'
                                        }}
                                    >
                                        Create Another
                                    </button>
                                )}
                            </div>
    
                            {/* Error Message */}
                            {error && (
                                <div style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    borderRadius: '0.75rem',
                                    padding: '1rem',
                                    border: '1px solid rgba(239, 68, 68, 0.3)'
                                }}>
                                    <div style={{ color: '#fca5a5' }}>
                                        <strong>Error:</strong> {error}
                                    </div>
                                </div>
                            )}
    
                            {/* Success Message */}
                            {success && (
                                <div style={{
                                    background: 'rgba(34, 197, 94, 0.1)',
                                    borderRadius: '0.75rem',
                                    padding: '1rem',
                                    border: '1px solid rgba(34, 197, 94, 0.3)'
                                }}>
                                    <div style={{ color: '#86efac', marginBottom: '0.5rem' }}>
                                        <strong>Success!</strong> {success}
                                    </div>
                                    <div style={{ color: 'rgba(187, 247, 208, 0.7)', fontSize: '0.9rem' }}>
                                        Form will reset automatically in 3 seconds, or click "Create Another" to reset now.
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.2); }
                }
                
                input::placeholder, textarea::placeholder {
                    color: rgba(187, 247, 208, 0.5);
                }
                
                input:focus, textarea:focus {
                    outline: none;
                    border-color: #10b981 !important;
                    background: rgba(16, 185, 129, 0.1) !important;
                }
                
                input[type="date"]::-webkit-calendar-picker-indicator,
                input[type="time"]::-webkit-calendar-picker-indicator {
                    filter: invert(1);
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
}