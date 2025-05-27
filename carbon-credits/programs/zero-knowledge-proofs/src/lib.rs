mod circuit;
mod r1cs;
mod merkle;
mod qap;
mod field;
mod proof;
use num_bigint::{ToBigInt};
use circuit::Circuit;
use crate::field::FieldElement;

pub fn eligibility_proof(
    net_emissions: u32,
    total_credits_returned: u32,
    total_borrowed: u32,
    debt: u32,
    carbon_credits: u32,
    reputation: u32,
    org2_carbon_credits: u32,
    org2_debt: u32,
) -> (i32, Vec<u8>) {
    // Convert u32 inputs to FieldElement
    let net_emissions_fe = FieldElement::new(net_emissions.to_bigint().unwrap());
    let total_credits_returned_fe = FieldElement::new(total_credits_returned.to_bigint().unwrap());
    let total_borrowed_fe = FieldElement::new(total_borrowed.to_bigint().unwrap());
    let debt_fe = FieldElement::new(debt.to_bigint().unwrap());
    let carbon_credits_fe = FieldElement::new(carbon_credits.to_bigint().unwrap());
    let reputation_fe = FieldElement::new(reputation.to_bigint().unwrap());
    let org2_carbon_credits_fe = FieldElement::new(org2_carbon_credits.to_bigint().unwrap());
    let org2_debt_fe = FieldElement::new(org2_debt.to_bigint().unwrap());

    // Create a new circuit
    let mut circuit = Circuit::new();

    // Add inputs to the circuit
    let net_emissions_idx = circuit.add_input(net_emissions_fe.clone());
    let total_credits_returned_idx = circuit.add_input(total_credits_returned_fe.clone());
    let total_borrowed_idx = circuit.add_input(total_borrowed_fe.clone());
    let debt_idx = circuit.add_input(debt_fe.clone());
    let carbon_credits_idx = circuit.add_input(carbon_credits_fe.clone());
    let reputation_idx = circuit.add_input(reputation_fe.clone());
    let org2_carbon_credits_idx = circuit.add_input(org2_carbon_credits_fe.clone());
    let org2_debt_idx = circuit.add_input(org2_debt_fe.clone());

    // Step 1: Multiply reputation and carbon_credits
    let reputation_times_credits = circuit.get_input(reputation_idx).unwrap().get_value() * 
                                   circuit.get_input(carbon_credits_idx).unwrap().get_value();
    let multiply_result_idx = circuit.add_input(FieldElement::new(reputation_times_credits.clone()));

    // Add multiplication gate
    circuit.add_gate(circuit::Gate::Mul(reputation_idx, carbon_credits_idx, multiply_result_idx));

    // Step 2: Add total_credits_returned to the multiplication result
    let score_value = circuit.get_input(multiply_result_idx).unwrap() + 
                      circuit.get_input(total_credits_returned_idx).unwrap();
    let final_score_idx = circuit.add_input(score_value.clone());

    // Add addition gate
    circuit.add_gate(circuit::Gate::Add(multiply_result_idx, total_credits_returned_idx, final_score_idx));

    // Set the output to the final score
    circuit.set_output(score_value.clone());

    // Generate and verify the proof
    let proof = circuit.generate_proof("eligibity_proof.bin");
    let is_valid = circuit.verify_proof("eligibity_proof.bin");
    println!("No-op Proof is valid: {}", is_valid);

    // Convert the result to an i32 for the return value
    let eligibility_score = (score_value.get_value() % 1000000i32.to_bigint().unwrap())
                            .to_string()
                            .parse::<i32>()
                            .unwrap_or(1);

    // Read the proof file into a Vec<u8>
    let proof_data = std::fs::read("noop_proof.bin").expect("Failed to read proof file");

    // Return the eligibility score and the proof data
    (if eligibility_score <= 0 { 1 } else { eligibility_score }, proof_data)
}