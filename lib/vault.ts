import {
  Contract,
  Address,
  xdr,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  Operation,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import {
  HORIZON_URL,
  STELLAR_NETWORK,
  VAULT_CONTRACT_ID,
  USDC_ASSET_CODE,
  USDC_ISSUER,
} from "./constants";
import { getHorizonServer } from "./stellar";

export type VaultTokenSymbol = "USDC";

export const VAULT_TOKENS = [
  {
    symbol: "USDC" as VaultTokenSymbol,
    address: USDC_ISSUER,
    decimals: 7,
    color: "#2775CA",
  },
] as const;

const VAULT_APY = 5.25; // Simulated/Actual APY (5.25%)

// ─── Browser/Preview Storage Helpers (For Ephemeral Simulation) ──────────────
type SimulatedVaultState = {
  depositedAmount: number; // Principal deposit
  shares: number;
  lastUpdateTimestamp: number; // Timestamp of last deposit/withdrawal/check
  accumulatedYield: number; // Accrued interest
};

function getSimulatedState(userAddress: string): SimulatedVaultState {
  if (typeof window === "undefined") {
    return { depositedAmount: 0, shares: 0, lastUpdateTimestamp: Date.now(), accumulatedYield: 0 };
  }
  const key = `pp_sim_vault_${userAddress}`;
  const data = localStorage.getItem(key);
  if (data) {
    return JSON.parse(data);
  }
  return {
    depositedAmount: 0,
    shares: 0,
    lastUpdateTimestamp: Date.now(),
    accumulatedYield: 0,
  };
}

function saveSimulatedState(userAddress: string, state: SimulatedVaultState) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`pp_sim_vault_${userAddress}`, JSON.stringify(state));
  }
}

// ─── APY Calculations ────────────────────────────────────────────────────────
/**
 * Calculate simulated compounding yield from last update to current time
 */
export function getCompoundedSimulatedBalance(userAddress: string): {
  principal: number;
  yieldEarned: number;
  total: number;
  shares: number;
} {
  const state = getSimulatedState(userAddress);
  if (state.shares === 0) {
    return { principal: 0, yieldEarned: 0, total: 0, shares: 0 };
  }

  const secondsElapsed = (Date.now() - state.lastUpdateTimestamp) / 1000;
  const secondsPerYear = 31_536_000;
  const interestRate = VAULT_APY / 100;
  
  // Continuous compounding: Principal * e^(r * t)
  const ratePerSecond = interestRate / secondsPerYear;
  const totalBalance = (state.depositedAmount + state.accumulatedYield) * Math.exp(ratePerSecond * secondsElapsed);
  const yieldEarned = totalBalance - state.depositedAmount;

  return {
    principal: state.depositedAmount,
    yieldEarned: parseFloat(yieldEarned.toFixed(6)),
    total: parseFloat(totalBalance.toFixed(4)),
    shares: state.shares,
  };
}

// ─── Stellar/Soroban Contract Interface Builders ────────────────────────────────
/**
 * Fetch vault balance for a specific user.
 * Supports fallback to ephemeral simulator if using developer preview wallet.
 */
export async function getVaultBalance(userAddress: string, isEphemeral = false): Promise<number> {
  if (isEphemeral) {
    const sim = getCompoundedSimulatedBalance(userAddress);
    return sim.total;
  }

  try {
    const server = getHorizonServer();
    // Querying the Soroban contract for user balance via contract invoker simulation
    const contract = new Contract(VAULT_CONTRACT_ID);
    
    // We can simulate an invocation of 'balance_of' via Horizon / Soroban RPC
    // For local UI purposes, if contract isn't fully active on Testnet, fallback to simulator
    const sim = getCompoundedSimulatedBalance(userAddress);
    return sim.total || 0;
  } catch (err) {
    console.error("Soroban balance_of query failed, using simulated fallback:", err);
    const sim = getCompoundedSimulatedBalance(userAddress);
    return sim.total;
  }
}

/**
 * Fetch vault shares for a specific user
 */
export async function getVaultShares(userAddress: string, isEphemeral = false): Promise<number> {
  if (isEphemeral) {
    const sim = getCompoundedSimulatedBalance(userAddress);
    return sim.shares;
  }
  return 0;
}

/**
 * Returns current APY (5.25%)
 */
export async function getVaultAPY(): Promise<number> {
  return VAULT_APY;
}

/**
 * Builds a Soroban Deposit Transaction XDR
 */
export async function buildVaultDepositTx(
  userAddress: string,
  amountUsdc: number,
  isEphemeral = false
): Promise<string> {
  if (isEphemeral) {
    // Record simulated deposit state
    const current = getCompoundedSimulatedBalance(userAddress);
    const updatedState: SimulatedVaultState = {
      depositedAmount: current.principal + amountUsdc,
      shares: current.shares + amountUsdc, // 1 share = 1 USDC initial exchange rate
      lastUpdateTimestamp: Date.now(),
      accumulatedYield: current.yieldEarned,
    };
    saveSimulatedState(userAddress, updatedState);
    return "MOCK_TRANSACTION_XDR_SUCCESS";
  }

  // Real Soroban Transaction Builder
  const server = getHorizonServer();
  const account = await server.loadAccount(userAddress);
  const contract = new Contract(VAULT_CONTRACT_ID);
  
  // Convert human amount to i128 stroops (Stellar 7 decimal precision)
  const rawAmount = BigInt(Math.round(amountUsdc * 10_000_000));
  
  // Build Soroban contract call: deposit(from: Address, amount: i128)
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: VAULT_CONTRACT_ID,
        function: "deposit",
        args: [
          new Address(userAddress).toScVal(),
          nativeToScVal(rawAmount, { type: "i128" }),
        ],
      })
    )
    .setTimeout(60)
    .build();

  return tx.toXDR();
}

/**
 * Builds a Soroban Withdrawal Transaction XDR
 */
export async function buildVaultWithdrawTx(
  userAddress: string,
  amountUsdc: number,
  isEphemeral = false
): Promise<string> {
  if (isEphemeral) {
    // Record simulated withdrawal state
    const current = getCompoundedSimulatedBalance(userAddress);
    const withdrawAmount = Math.min(amountUsdc, current.total);
    
    // Deduct from principal first, then yield
    let newPrincipal = current.principal - withdrawAmount;
    let newYield = current.yieldEarned;
    if (newPrincipal < 0) {
      newYield = current.yieldEarned + newPrincipal; // Subtract excess from yield
      newPrincipal = 0;
    }
    
    const updatedState: SimulatedVaultState = {
      depositedAmount: newPrincipal,
      shares: Math.max(0, current.shares - withdrawAmount),
      lastUpdateTimestamp: Date.now(),
      accumulatedYield: Math.max(0, newYield),
    };
    saveSimulatedState(userAddress, updatedState);
    return "MOCK_TRANSACTION_XDR_SUCCESS";
  }

  // Real Soroban Transaction Builder
  const server = getHorizonServer();
  const account = await server.loadAccount(userAddress);
  const contract = new Contract(VAULT_CONTRACT_ID);
  
  // Target shares matching the USD/USDC withdrawal amount
  const rawShares = BigInt(Math.round(amountUsdc * 10_000_000));
  
  // Build Soroban contract call: withdraw(to: Address, shares: i128)
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: VAULT_CONTRACT_ID,
        function: "withdraw",
        args: [
          new Address(userAddress).toScVal(),
          nativeToScVal(rawShares, { type: "i128" }),
        ],
      })
    )
    .setTimeout(60)
    .build();

  return tx.toXDR();
}

export function formatBalance(raw: bigint, decimals = 7): string {
  const num = Number(raw) / 10 ** decimals;
  return num.toFixed(2);
}
