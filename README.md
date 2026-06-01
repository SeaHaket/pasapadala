# PasaPadala — Global Cross-Border Remittance & Savings on Stellar

PasaPadala is a fast, low-cost remittance and savings application built exclusively for the **Stellar Network** and **Decaf Wallet** ecosystem.

It allows users to send stablecoins (USDC, EURC) instantly, cash out directly to local bank accounts, e-wallets, or mobile money — and earn yield on their savings via a Soroban smart contract Yield Savings Vault.

---

## The Money Flow (Use Case)

PasaPadala is designed for global workers and seafarers who receive salaries via payroll cards or standard bank accounts.

1. **USD Bank Onramp (Decaf):** Senders can link their USD bank routing/account numbers natively via Decaf's USD Virtual Account deep links. Deposits are automatically converted and credited as Stellar USDC in their wallet.
2. **Smart Allocation:** Senders open PasaPadala and use the **Allocator** to batch-send to multiple family members atomically in a single multi-operation Stellar transaction.
3. **Local Cash-out:** Recipients receive funds instantly via local Stellar-native offramps (such as Coins.ph in the Philippines) or mobile money networks (Fonbnk).
4. **Savings Vault:** Senders can deposit idle funds into the Soroban Yield Savings Vault contract, accruing yield ledger-by-ledger natively on-chain.

**The PasaPadala Advantage:** Traditional remittance rails take days and charge high hidden fees through poor FX spreads. With PasaPadala, transactions execute in 3-5 seconds with near-zero network fees, and idle funds compound in real time.

---

## Key Features

- **Multi-Wallet Support** — Connect seamlessly with **Freighter**, **Albedo**, or use the **Ephemeral Developer Wallet** for instant browser previews.
- **Atomic Batch Remittances** — Remit to up to 100 people in a single, atomic Stellar transaction with zero prior token approval requirements.
- **Soroban Yield Savings Vault** — Earn competitive APY paid natively ledger-by-ledger on Stellar via our compounding vault contract, complete with a live-ticking ticker animation in the dashboard.
- **Resilient Sandbox Mode** — Automated offline simulator mode when the Stellar Testnet Friendbot is congested or offline, allowing flawless sandbox testing under any network conditions.
- **Dynamic Offramp Routing** — Offramp options adjust automatically based on the recipient's country (Fonbnk mobile money, local exchanges).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Styling | Vanilla CSS — mobile-first, 430px max-width |
| Blockchain | Stellar Network, Horizon RPC |
| Smart Contracts | Soroban Rust Smart Contract Platform |
| Localization | `next-intl` (English + Filipino) |
| Offramp | Coins.ph, Fonbnk Mobile Money |
| Wallet | Freighter, Albedo, Decaf Deep Links |

---

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_PASAPAY_FEE_ADDRESS` | Treasury wallet to receive Fonbnk app fees | disabled (unset) |

---

## Stellar Compliance & UX

- Near-zero gas fees (~$0.000002 USD equivalent) paid directly in XLM or abstracted stablecoins.
- Native multi-operation transfers execute atomically.
- Max viewport: 430px, optimized for mobile browsers and MiniApps.
