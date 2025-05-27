mod circuit;
mod r1cs;
mod merkle;
mod qap;
mod field;
mod proof;
use zero_knowledge_proofs::eligibility_proof;
use num_bigint::{ToBigInt};
use circuit::Circuit;
use crate::field::FieldElement;

fn addition_proof() {
    let mut circuit = Circuit::new();

    let input1 = circuit.add_input(FieldElement::new(10.to_bigint().unwrap()));
    let input2 = circuit.add_input(FieldElement::new(20.to_bigint().unwrap()));
    let expected_sum = circuit.get_input(input1).expect("Invalid input index") +
        circuit.get_input(input2).expect("Invalid input index");
    let output_index = circuit.add_input(expected_sum.clone());
    circuit.add_gate(circuit::Gate::Add(input1, input2, output_index));
    circuit.set_output(expected_sum);
    println!("Generating Addition Proof...");
    circuit.generate_proof("addition_proof.bin");
    let is_valid = circuit.verify_proof("addition_proof.bin");
    println!("Addition Proof is valid: {}", is_valid);
}
fn merkle_tree_proof() {
    let transactions = vec![
        10.to_bigint().unwrap(),
        20.to_bigint().unwrap(),
        50.to_bigint().unwrap(),
        80.to_bigint().unwrap(),
    ];
    let merkle_tree = merkle::MerkleTree::new(transactions.clone());
    let leaf_index = 2;
    let leaf_value = transactions[leaf_index].clone();
    let merkle_path = merkle_tree.merkle_path(leaf_index);

    let mut circuit = Circuit::new();

    let leaf_index_var = circuit.add_input(FieldElement::new(leaf_value));
    let mut current_hash_index = leaf_index_var;

    for (sibling_hash, is_left) in merkle_path {
        let sibling_index_var = circuit.add_input(FieldElement::new(sibling_hash.clone()));
        let new_hash_value = if is_left {
            merkle_tree.apply_hash(
                circuit.get_input(sibling_index_var).expect("Invalid input index"),
                circuit.get_input(current_hash_index).expect("Invalid input index"),
            )
        } else {
            merkle_tree.apply_hash(
                circuit.get_input(current_hash_index).expect("Invalid input index"),
                circuit.get_input(sibling_index_var).expect("Invalid input index"),
            )
        };

        let new_hash_index = circuit.add_input(new_hash_value.clone());
        circuit.set_output(new_hash_value.clone());
        circuit.add_gate(if is_left {
            circuit::Gate::Add(sibling_index_var, current_hash_index, new_hash_index)
        } else {
            circuit::Gate::Add(current_hash_index, sibling_index_var, new_hash_index)
        });

        current_hash_index = new_hash_index;
    }

    circuit.set_output(FieldElement::new(merkle_tree.root.clone()));

    println!("Expected Merkle root: {}", merkle_tree.root);
    circuit.generate_proof("merkle_proof.bin");
    let is_valid = circuit.verify_proof("merkle_proof.bin");
    println!("Merkle Tree Proof is valid: {}", is_valid);
}

fn multiplication_proof() {
    let mut circuit = Circuit::new();

    let input1 = circuit.add_input(FieldElement::new(3.to_bigint().unwrap())); 
    let input2 = circuit.add_input(FieldElement::new(4.to_bigint().unwrap())); 


    let expected_product = circuit.get_input(input1).unwrap().get_value() * circuit.get_input(input2).unwrap().get_value();

    let output_index = circuit.add_input(FieldElement::new(expected_product.clone())); // `output`
    circuit.add_gate(circuit::Gate::Mul(input1, input2, output_index));
    circuit.set_output(FieldElement::new(expected_product));

    println!("Generating Multiplication Proof...");
    circuit.generate_proof("multiplication_proof.bin");
    let is_valid = circuit.verify_proof("multiplication_proof.bin");
    println!("Multiplication Proof is valid: {}", is_valid);
}
// fn eligibility_proof(
//     circuit: &mut Circuit,
//     net_emissions: FieldElement,
//     total_credits_returned: FieldElement,
//     total_borrowed: FieldElement,
//     debt: FieldElement,
//     carbon_credits: FieldElement,
//     reputation: FieldElement,
//     org2_carbon_credits: FieldElement,
//     org2_debt: FieldElement,
// ) -> (i32, Vec<u8>) {
//     let net_emissions_idx = circuit.add_input(net_emissions.clone());
//     let total_credits_returned_idx = circuit.add_input(total_credits_returned.clone());
//     let total_borrowed_idx = circuit.add_input(total_borrowed.clone());
//     let debt_idx = circuit.add_input(debt.clone());
//     let carbon_credits_idx = circuit.add_input(carbon_credits.clone());
//     let reputation_idx = circuit.add_input(reputation.clone());
//     let org2_carbon_credits_idx = circuit.add_input(org2_carbon_credits.clone());
//     let org2_debt_idx = circuit.add_input(org2_debt.clone());
//     let reputation_times_credits = circuit.get_input(reputation_idx).unwrap().get_value() * 
//                                    circuit.get_input(carbon_credits_idx).unwrap().get_value();
//     let multiply_result_idx = circuit.add_input(FieldElement::new(reputation_times_credits.clone()));
//     circuit.add_gate(circuit::Gate::Mul(reputation_idx, carbon_credits_idx, multiply_result_idx));
//     let score_value = circuit.get_input(multiply_result_idx).unwrap() + 
//                       circuit.get_input(total_credits_returned_idx).unwrap();
//     let final_score_idx = circuit.add_input(score_value.clone());
//     circuit.add_gate(circuit::Gate::Add(multiply_result_idx, total_credits_returned_idx, final_score_idx));
//     circuit.set_output(score_value.clone());
//     let proof = circuit.generate_proof("noop_proof.bin");
//     let is_valid = circuit.verify_proof("noop_proof.bin");
//     println!("No-op Proof is valid: {}", is_valid);
//     let eligibility_score = (score_value.get_value() % 1000000i32.to_bigint().unwrap())
//                             .to_string()
//                             .parse::<i32>()
//                             .unwrap_or(1);
//     let proof_data = std::fs::read("noop_proof.bin").expect("Failed to read proof file");
//     (if eligibility_score <= 0 { 1 } else { eligibility_score }, proof_data)
// }

fn main() {
    let (score, proof) = eligibility_proof(
        100,  // net_emissions
        50,   // total_credits_returned
        30,   // total_borrowed
        20,   // debt
        40,   // carbon_credits
        90,   // reputation
        60,   // org2_carbon_credits
        10,   // org2_debt
    );

    println!("Eligibility Score: {}", score);
    println!("Proof Data: {:?}", proof);
}