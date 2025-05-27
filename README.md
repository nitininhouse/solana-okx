## **Decentralized Carbon Credit Marketplace**

### **ZK-Proofs & Blockchain Infrastructure for Climate Action**

<img width="844" alt="image" src="https://github.com/user-attachments/assets/d5d269c5-118b-4e9f-a0d3-d8b7c1f527b8" />


---

## **Executive Summary**

Our platform is a foundational leap in climate finance: a **fully decentralized carbon credit marketplace** built for **trust, privacy, and efficiency**. It enables the **generation, validation, trading, and offsetting** of carbon credits using **blockchain**, **zero-knowledge proofs**, and **automated smart contracts**. Unlike traditional systems reliant on opaque intermediaries and manual verification, our solution delivers a **transparent, verifiable, and privacy-preserving** ecosystem for scaling global carbon markets with integrity.

---

## **The Climate Crisis Requires Urgent Innovation**

* Global CO₂ emissions reached an all-time high of 36.8 billion tonnes in 2023 (IEA Report, 2024)
* The IPCC warns we have less than 7 years to reduce emissions significantly to limit global warming to 1.5°C (IPCC Sixth Assessment Report)
* Carbon markets are projected to surpass \$100 billion by 2030, yet trust, transparency, and efficiency are still severely lacking (McKinsey, 2023)

---

## **Problems in Current Carbon Markets**

* **Credibility Breakdown**: Up to 90% of rainforest carbon offsets from major certifiers are essentially worthless (The Guardian, Jan 2023)
* **Transparency Gaps**: Huge variance in carbon credit quality and limited mechanisms for real-time verification (Berkeley Carbon Trading Project, 2023)
* **Market Fragmentation**: Siloed registries prevent interoperability, liquidity, and standardized pricing
* **Privacy Concerns**: Organizations often hesitate to disclose emissions data due to competitive or reputational risks

---

## **Our Vision**

We aim to redefine how climate impact is quantified, verified, and transacted—by building the **core infrastructure** for the future of environmental finance. Our platform is designed to:

* Eliminate the need for centralized intermediaries
* Prevent greenwashing through cryptographic verification
* Accelerate climate action via programmable automation
* Make carbon trading both **trustworthy** and **accessible** to all
* Facilitate over **\$50 billion** in carbon finance transactions by 2030

---

## **Core System Architecture**

* **Green Organizations**: Submit carbon claims with geospatial and project metadata
* **Smart Contract Infrastructure**: Modular contracts handle submissions, evidence validation, credit minting, and trading
* **ZK-Proof Layer**: Privacy-preserving circuits validate eligibility and project data without exposing sensitive inputs

---

## **Technical Stack**

* **Smart Contracts**: Written in Rust using the Anchor framework
* **Blockchain Layer**: Deployed on Solana Devnet for scalability and low fees
* **Frontend**: Built using Vite + React for rapid user interaction
* **Storage**: IPFS for decentralized and tamper-proof evidence storage
* **Zero-Knowledge Proofs**: Custom zk-SNARKs using R1CS constraints; sample circuits and proofs provided in the `generated_proofs` directory

---

<img width="804" alt="image" src="https://github.com/user-attachments/assets/9ab5339b-1ce8-4bef-855a-70767b588712" />


## **DeFi Integration: Carbon Finance Layer**

To further boost liquidity and usability, our marketplace integrates DeFi protocols tailored for carbon credits:

* **Carbon Credit Borrowing**: Organizations can borrow against verified future offset commitments
* **Lending Pools**: Entities with surplus credits can lend them at fair market rates
* **Tokenized Carbon Assets**: Projects are fractionalized into tokens, allowing broader participation
* **Reputation-Based Credit Scoring**: ZK-powered scoring system to determine creditworthiness without revealing data
* **Automated Repayments**: Smart contracts enforce repayment conditions tied to emissions performance
* **Cross-Chain Liquidity (Planned)**: Integration with other DeFi ecosystems to enable inter-blockchain flow of carbon assets

---

DEPLOYED ON DEVNET: 2n6YixtTujppTmx7MeZRh48WyQ3kxcpE7dvBv46m1hAHN3kYfydBCedBBRQcso6ZamicuBi981tAJ1shUBKt73dy (transaction ID)
DEMO VIDEO: https://youtu.be/LnpEwBpYcoU?si=vmOt2BDCkbESeyam
PITCH DECK: https://drive.google.com/file/d/11jXVbPLX3nHghIAq__xPmcobVJ8kjtM8/view?usp=sharing  

<img width="836" alt="image" src="https://github.com/user-attachments/assets/560848b4-655d-43dc-8e19-42f0ca8cacf4" />

<img width="836" alt="image" src="https://github.com/user-attachments/assets/035044ac-9997-4da5-bd3b-0def302f189f" />

<img width="837" alt="image" src="https://github.com/user-attachments/assets/c3099bc5-4ffd-40a7-8e20-2d20b31aadd2" />

<img width="838" alt="image" src="https://github.com/user-attachments/assets/226756cc-a9b9-455b-bb81-c109e9b08949" />

<img width="835" alt="image" src="https://github.com/user-attachments/assets/350d61f8-0270-4a6e-8b4c-22579d29b244" />

<img width="836" alt="image" src="https://github.com/user-attachments/assets/3a084900-dafc-45ac-b2c2-fb4d7998e98a" />

## **Zero-Knowledge Proof System**

Our ZK system ensures that carbon credit validation is both private and compliant:

* **Private Inputs**: Emissions data, debt ratios, credit histories, and token balances
* **Circuit Architecture**: Converts inputs into field elements and constraints using R1CS
* **Proof Generation**: Generates zk-SNARKs preserving zero-knowledge guarantees
* **On-Chain Verifier**: Verifies compliance without revealing any underlying sensitive data
* **Sample Proofs**: Available in the `generated_proofs` directory for testing and demonstration

---

## **Regulatory Landscape**

Our platform aligns with the shifting global regulatory climate:

* **EU Carbon Border Adjustment Mechanism (CBAM)**: Enforcing cross-border emissions tariffs (2023–2026 rollout)
* **SEC Climate Disclosure Rules**: Public companies mandated to report climate risks (effective 2024)
* **Corporate Net-Zero Commitments**: Over 1,500 companies with a combined \$11.4 trillion in revenue have pledged net-zero goals (UN Climate Change, 2023)

---

## **Market Opportunity**

* **Voluntary carbon market** is expected to grow 15x to over \$50 billion by 2030 (TSVCM, 2023)
* **Compliance carbon markets** could exceed \$250 billion by the same year
* **91% of companies** plan to increase spending on carbon offsets (S\&P Global, 2023)
* **Over \$1 trillion** in corporate climate investment projected by 2030

---

## **Competitive Edge**

* **Decentralized Verification**: Proof-based validation eliminates reliance on central auditors
* **Privacy by Design**: ZK-proofs ensure compliance without compromising sensitive emissions or financial data
* **Interoperability**: Designed to integrate with both voluntary and compliance market systems
* **Trustless Architecture**: Validation and transactions occur on-chain, backed by cryptographic guarantees
* **Full DeFi Suite**: Enables real-time lending, borrowing, automated settlements, and cross-chain liquidity for carbon assets

---

## **Team**

* **Founders**: Experts in blockchain infrastructure and climate finance with prior experience building scalable decentralized applications
* **Developers**: Skilled in smart contracts, Rust, ZK systems, and decentralized storage
* **Advisors**: Environmental economists, legal experts on carbon markets, and sustainability consultants
* **Partners**: Ongoing collaborations with climate-focused NGOs, university researchers, and sustainability-forward enterprises

---

## **Contact**

* Aaryan Jain: [aaryanjain888@gmail.com](mailto:aaryanjain888@gmail.com)
* Nitin Goyal: [nitin\_g@me.iitr.ac.in](mailto:nitin_g@me.iitr.ac.in)

---

## **Closing Statement**

The climate crisis cannot be solved with the systems that created it.
**We are building new rails for global climate finance—transparent, decentralized, and future-proof.**
Let’s bring real trust to the carbon economy.



