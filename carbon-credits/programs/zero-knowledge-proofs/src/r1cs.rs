use crate::field::FieldElement;
use num_bigint::BigInt;
use serde::{Serialize, Deserialize};
use std::fs::File;
use std::io::{Write};
use num_traits::Zero;
use crate::proof::Proof;
use crate::qap::QAP;

#[derive(Clone, Serialize, Deserialize)]
pub struct Variable {
    pub index: usize,
    pub value: FieldElement,
}

#[derive(Serialize, Deserialize)]
pub enum Operation {
    Add,
    Mul,
    Hash,
}

#[derive(Serialize, Deserialize)]
pub struct Constraint {
    pub left: Vec<(Variable, BigInt)>,
    pub right: Vec<(Variable, BigInt)>,
    pub output: Vec<(Variable, BigInt)>,
    pub operation: Operation,
}

#[derive(Serialize, Deserialize)]
pub struct R1CS {
    pub variables: Vec<Variable>,
    pub constraints: Vec<Constraint>,
    pub qap: QAP,
}

impl R1CS {
    pub fn new() -> Self {
        R1CS {
            variables: Vec::new(),
            constraints: Vec::new(),
            qap: QAP::new(), // Initialize QAP
        }
    }

    pub fn add_constraint(&mut self, left_coeffs: &[(usize, FieldElement)], right_coeffs: &[(usize, FieldElement)], output_coeffs: &[(usize, FieldElement)], modulus: &BigInt) {
        self.qap.add_constraint(left_coeffs, right_coeffs, output_coeffs, modulus);
    }

    /// Generates a witness based on the variable values.
    pub fn generate_witness(&self) -> Vec<FieldElement> {
        self.variables.iter().map(|var| {
            var.value.clone() 
        }).collect()
    }


    pub fn generate_proof(&self, witness: &Vec<FieldElement>) -> Proof {
        Proof::generate_proof(self, witness) 
    }


    pub fn evaluate_qap(&self) -> BigInt {
        let witness = self.generate_witness(); 
        let result = self.qap.evaluate(&witness); 
        result.get_value() 
    }


    pub fn add_variable(&mut self, value: FieldElement) -> usize {
        let index = self.variables.len();
        self.variables.push(Variable { index, value });
        index
    }


    pub fn save_to_binary(&self, filename: &str) {
        let mut file = File::create(filename).expect("Could not create proof file");
        let encoded: Vec<u8> = bincode::serialize(&self).expect("Failed to serialize proof");
        file.write_all(&encoded).expect("Failed to write proof to file");
    }


    pub fn load_from_binary(filename: &str) -> Self {
        let file = File::open(filename).expect("Could not open file");
        let r1cs: R1CS = bincode::deserialize_from(file).expect("Failed to deserialize R1CS");
        r1cs
    }

    pub fn verify_witness(&self, witness: &[FieldElement]) -> bool {
        for constraint in &self.constraints {
            let mut left_eval = FieldElement::new(BigInt::zero());
            let mut right_eval = FieldElement::new(BigInt::zero());

            for (var_index, coeff) in &constraint.left {
                let var_value = &witness[var_index.index];
                left_eval = left_eval + (var_value.clone() * coeff);
            }

            for (var_index, coeff) in &constraint.right {
                let var_value = &witness[var_index.index]; 
                right_eval = right_eval + (var_value.clone() * coeff); 
            }

            let mut output_eval = FieldElement::new(BigInt::zero());
            for (var_index, coeff) in &constraint.output {
                let var_value = &witness[var_index.index]; 
                output_eval = output_eval + (var_value.clone() * coeff);
            }


            if left_eval != right_eval || right_eval != output_eval {
                return false; 
            }
        }
        true
    }
}
