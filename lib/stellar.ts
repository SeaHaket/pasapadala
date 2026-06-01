import {
  Horizon,
  Asset,
  Keypair,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Networks,
} from "@stellar/stellar-sdk";
import {
  HORIZON_URL,
  STELLAR_NETWORK,
  USDC_ASSET_CODE,
  USDC_ISSUER,
  EURC_ASSET_CODE,
  EURC_ISSUER,
  STABLECOINS,
  type StablecoinSymbol,
} from "./constants";

// Initialize Horizon Client
export const getHorizonServer = () => {
  return new Horizon.Server(HORIZON_URL);
};

export type StellarBalance = {
  symbol: StablecoinSymbol;
  name: string;
  assetCode: string;
  issuer: string;
  decimals: number;
  color: string;
  raw: bigint; // Stroops or micro-units
  human: number; // Decimal unit format
  formatted: string;
  isNative: boolean;
};

/**
 * Fetch all asset balances (XLM, USDC, EURC) for a given Stellar public key
 */
export async function getStellarBalances(publicKey: string): Promise<StellarBalance[]> {
  try {
    const server = getHorizonServer();
    const accountInfo = await server.loadAccount(publicKey);
    
    return STABLECOINS.map((token) => {
      let rawBalanceStr = "0";
      
      if (token.isNative) {
        // Find XLM balance
        const nativeBal = accountInfo.balances.find((b) => b.asset_type === "native");
        if (nativeBal) rawBalanceStr = nativeBal.balance;
      } else {
        // Find issued asset balance (USDC or EURC)
        const assetBal = accountInfo.balances.find(
          (b) =>
            b.asset_type !== "native" &&
            b.asset_type !== "liquidity_pool_shares" &&
            (b as any).asset_code === token.assetCode &&
            (b as any).asset_issuer === token.issuer
        );
        if (assetBal) rawBalanceStr = assetBal.balance;
      }

      const human = parseFloat(rawBalanceStr);
      // Raw represents stroops (Stellar native unit is 7 decimals)
      const raw = BigInt(Math.round(human * 10_000_000));
      
      return {
        symbol: token.symbol,
        name: token.name,
        assetCode: token.assetCode,
        issuer: token.issuer,
        decimals: token.decimals,
        color: token.color,
        raw,
        human,
        formatted: human.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
        isNative: token.isNative,
      };
    });
  } catch (error: any) {
    // If account doesn't exist on Horizon, return zero balances
    if (error?.response?.status === 404) {
      return STABLECOINS.map((token) => ({
        symbol: token.symbol,
        name: token.name,
        assetCode: token.assetCode,
        issuer: token.issuer,
        decimals: token.decimals,
        color: token.color,
        raw: 0n,
        human: 0,
        formatted: "0.00",
        isNative: token.isNative,
      }));
    }
    console.error("Error loading Stellar balances:", error);
    throw error;
  }
}

/**
 * Check if the account has established a trustline for a specific asset
 */
export async function hasTrustline(publicKey: string, assetCode: string, issuer: string): Promise<boolean> {
  try {
    const server = getHorizonServer();
    const accountInfo = await server.loadAccount(publicKey);
    return accountInfo.balances.some(
      (b) =>
        b.asset_type !== "native" &&
        b.asset_type !== "liquidity_pool_shares" &&
        (b as any).asset_code === assetCode &&
        (b as any).asset_issuer === issuer
    );
  } catch (error: any) {
    if (error?.response?.status === 404) return false;
    throw error;
  }
}

/**
 * Generate a new random Stellar keypair (for the Ephemeral Developer Wallet)
 */
export function generateEphemeralKeypair(): Keypair {
  return Keypair.random();
}

/**
 * Activates and funds a Stellar Testnet account with XLM using Friendbot
 */
export async function fundWithFriendbot(publicKey: string): Promise<boolean> {
  try {
    const response = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(publicKey)}`);
    return response.ok;
  } catch (err) {
    console.error("Friendbot funding failed:", err);
    return false;
  }
}

/**
 * Swap XLM to USDC natively on Stellar Testnet using a Path Payment
 * This is used to automatically acquire USDC for the Ephemeral Developer Wallet!
 */
export async function swapXlmToUsdc(secretKey: string, amountUsdc: string): Promise<string> {
  const server = getHorizonServer();
  const sourceKeypair = Keypair.fromSecret(secretKey);
  const sourcePubKey = sourceKeypair.publicKey();
  
  const account = await server.loadAccount(sourcePubKey);
  const usdcAsset = new Asset(USDC_ASSET_CODE, USDC_ISSUER);
  
  // Build a native Stellar Path Payment transaction
  // Swapping native XLM -> USDC using Stellar's built-in orderbooks
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET,
  })
    .addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: Asset.native(),
        sendMax: "100.0", // Spend at most 100 XLM
        destination: sourcePubKey,
        destAsset: usdcAsset,
        destAmount: amountUsdc,
        path: [], // Horizon will automatically find the best path
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(sourceKeypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

/**
 * Creates trustlines for USDC and EURC on-chain for a secret key account
 * Useful for automated ephemeral wallet onboarding!
 */
export async function establishTrustlines(secretKey: string): Promise<string> {
  const server = getHorizonServer();
  const keypair = Keypair.fromSecret(secretKey);
  const pubKey = keypair.publicKey();
  
  const account = await server.loadAccount(pubKey);
  const usdcAsset = new Asset(USDC_ASSET_CODE, USDC_ISSUER);
  const eurcAsset = new Asset(EURC_ASSET_CODE, EURC_ISSUER);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET,
  })
    .addOperation(
      Operation.changeTrust({
        asset: usdcAsset,
        limit: "1000000.0",
      })
    )
    .addOperation(
      Operation.changeTrust({
        asset: eurcAsset,
        limit: "1000000.0",
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}
