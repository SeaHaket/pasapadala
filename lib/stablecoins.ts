import {
  getStellarBalances,
  type StellarBalance,
} from "./stellar";
import {
  DECAF_DEPOSIT_DEEPLINK,
  DECAF_WEB_FALLBACK,
} from "./constants";

export type StablecoinBalance = StellarBalance;

/**
 * Fetch all Stellar asset balances (XLM, USDC, EURC) for a given address
 */
export async function getAllBalances(userAddress: string): Promise<StablecoinBalance[]> {
  if (!userAddress) return [];
  return getStellarBalances(userAddress);
}

/**
 * Return the stablecoin with the highest balance (for dashboard preferences)
 */
export async function getPreferredStablecoin(userAddress: string): Promise<StablecoinBalance | null> {
  const balances = await getAllBalances(userAddress);
  const withFunds = balances.filter((b) => b.raw > 0n);
  if (withFunds.length === 0) {
    const usdc = balances.find(b => b.symbol === "USDC");
    return usdc || balances[0] || null;
  }
  // Sort by USD-comparable value
  withFunds.sort((a, b) => {
    if (a.symbol === "XLM") return 1; // Put XLM last for preferred transactions
    if (b.symbol === "XLM") return -1;
    return b.human - a.human;
  });
  return withFunds[0];
}

/**
 * Total USD value across stablecoins (excluding native XLM fee reserve)
 */
export function totalUsdBalance(balances: StablecoinBalance[]): number {
  return balances.reduce((sum, b) => {
    if (b.symbol === "XLM") return sum;
    return sum + b.human;
  }, 0);
}

/**
 * Redirect to Decaf USD virtual account deposit screen
 */
export function redirectToDeposit(): void {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = DECAF_DEPOSIT_DEEPLINK;
    setTimeout(() => {
      window.open(DECAF_WEB_FALLBACK, "_blank");
    }, 1500);
  } else {
    window.open(DECAF_WEB_FALLBACK, "_blank");
  }
}
