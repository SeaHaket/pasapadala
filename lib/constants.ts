// ─── Stellar Network Constants ────────────────────────────────────────────────
export const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "TESTNET"; // "TESTNET" or "PUBLIC"

export const HORIZON_URL = process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || 
  (STELLAR_NETWORK === "PUBLIC" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org");

export const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_STELLAR_SOROBAN_URL || 
  (STELLAR_NETWORK === "PUBLIC" ? "https://soroban-rpc.stellar.org" : "https://soroban-testnet.stellar.org");

// ─── Circle Stablecoin Assets on Stellar ──────────────────────────────────────
// Mainnet vs Testnet issuers
export const USDC_ASSET_CODE = "USDC";
export const USDC_ISSUER = STELLAR_NETWORK === "PUBLIC"
  ? "GBBD47IF6LWK7P7MUGHC2ILISQNQOQJUI7B7V52RI2LIJ57R4I3FZDUC" // Circle Mainnet Issuer
  : "GBBD47IF6LWK7P7MUGHC2ILISQNQOQJUI7B7V52RI2LIJ57R4I3FZDUC"; // Circle Testnet standard (often mirrored on Testnet sandbox)

export const EURC_ASSET_CODE = "EURC";
export const EURC_ISSUER = STELLAR_NETWORK === "PUBLIC"
  ? "GDHU6CH7DZ7AS6JQAATEB42L4J4B4WJ4PWVD7EA2AFSD47OI4KC56M6P" // Circle EURC Mainnet
  : "GDHU6CH7DZ7AS6JQAATEB42L4J4B4WJ4PWVD7EA2AFSD47OI4KC56M6P";

// ─── Soroban Savings Vault Contract ───────────────────────────────────────────
export const VAULT_CONTRACT_ID = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ID || "CD2VAULTXPHILLIPPINESREMITTANCEVAULT5555555555555555555";

// ─── Decaf USD Virtual Account Onramp Deeplinks ────────────────────────────────
export const DECAF_DEPOSIT_DEEPLINK = "decaf://deposit";
export const DECAF_WEB_FALLBACK = "https://wallet.decaf.so";

// ─── Stablecoin Asset definitions ─────────────────────────────────────────────
export const STABLECOINS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    assetCode: USDC_ASSET_CODE,
    issuer: USDC_ISSUER,
    decimals: 7, // Stellar native USDC has 7 decimals
    color: "#2775CA",
    isNative: false,
  },
  {
    symbol: "EURC",
    name: "Euro Coin",
    assetCode: EURC_ASSET_CODE,
    issuer: EURC_ISSUER,
    decimals: 7,
    color: "#0F9D58",
    isNative: false,
  },
  {
    symbol: "XLM",
    name: "Lumen",
    assetCode: "XLM",
    issuer: "",
    decimals: 7,
    color: "#000000",
    isNative: true, // Native Stellar asset
  },
] as const;

export type StablecoinSymbol = "USDC" | "EURC" | "XLM";

// ─── PasaPadala App Fee (Fonbnk) ───────────────────────────────────────────────
export const PASAPADALA_FEE_ADDRESS = process.env.NEXT_PUBLIC_PASAPAY_FEE_ADDRESS || ""; // Stellar destination key
export const FONBNK_APP_FEE = "0.1"; // USD / per transaction
export const FONBNK_POOL_ADDRESS = process.env.NEXT_PUBLIC_FONBNK_POOL_ADDRESS || "GDPOOLADDRESSFONBNKSTELARREMITTANCE5555555555555555";
