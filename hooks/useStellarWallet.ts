"use client";

import { useEffect, useState, useCallback } from "react";
import { Keypair, TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import {
  getStellarBalances,
  generateEphemeralKeypair,
  fundWithFriendbot,
  establishTrustlines,
  swapXlmToUsdc,
  getHorizonServer,
  type StellarBalance,
} from "@/lib/stellar";
import {
  DECAF_DEPOSIT_DEEPLINK,
  DECAF_WEB_FALLBACK,
  STELLAR_NETWORK,
} from "@/lib/constants";

export type WalletType = "freighter" | "albedo" | "ephemeral";

export type StellarWalletState = {
  address: string | null;
  walletType: WalletType | null;
  isConnected: boolean;
  isLoading: boolean;
  isSandbox: boolean;
  balances: StellarBalance[];
  preferred: StellarBalance | null;
  totalUsd: number;
  connectWallet: (type: WalletType) => Promise<string>;
  disconnectWallet: () => void;
  refreshBalances: () => Promise<void>;
  signAndSubmitXdr: (xdr: string) => Promise<string>;
  fundEphemeralAccount: () => Promise<void>;
  redirectToDeposit: () => void;
};

export function useStellarWallet(): StellarWalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [balances, setBalances] = useState<StellarBalance[]>([]);
  const [preferred, setPreferred] = useState<StellarBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSandbox, setIsSandbox] = useState(false);

  // 1. Refresh balances from Horizon
  const refreshBalances = useCallback(async () => {
    if (!address) return;
    try {
      const sandboxActive = localStorage.getItem("pp_ephemeral_sandbox") === "true";
      if (sandboxActive && walletType === "ephemeral") {
        const mockBalances: StellarBalance[] = [
          {
            symbol: "XLM" as any,
            name: "Stellar Lumens",
            assetCode: "XLM",
            issuer: "",
            decimals: 7,
            color: "#FFFFFF",
            raw: 5000000000n,
            human: 500,
            formatted: "500.00",
            isNative: true,
          },
          {
            symbol: "USDC" as any,
            name: "Circle USDC",
            assetCode: "USDC",
            issuer: "GBBD47IF6LWK7P7MDEVFAJFBMX6BAUB6WIBJG6OMBTPTSECOF6KV4U7E",
            decimals: 7,
            color: "#2775CA",
            raw: 10000000000n,
            human: 1000,
            formatted: "1,000.00",
            isNative: false,
          },
          {
            symbol: "EURC" as any,
            name: "Circle EURC",
            assetCode: "EURC",
            issuer: "GRD252T63255F43F24GRK3E43G65F345GRD345F345GR345F345G",
            decimals: 7,
            color: "#0F9755",
            raw: 5000000000n,
            human: 500,
            formatted: "500.00",
            isNative: false,
          }
        ];
        setBalances(mockBalances);
        setPreferred(mockBalances[1]); // USDC
        return;
      }

      const allBalances = await getStellarBalances(address);
      setBalances(allBalances);
      
      // Preferred balance is the asset with the highest value (standard MiniPay preference)
      const usdc = allBalances.find((b) => b.symbol === "USDC");
      setPreferred(usdc || allBalances[0] || null);
    } catch (err) {
      console.error("Error refreshing Stellar balances:", err);
    }
  }, [address, walletType]);

  // Load saved wallet session on startup
  useEffect(() => {
    async function initSession() {
      try {
        const savedType = localStorage.getItem("pp_wallet_type") as WalletType | null;
        setIsSandbox(localStorage.getItem("pp_ephemeral_sandbox") === "true");
        if (savedType === "ephemeral") {
          const savedSecret = localStorage.getItem("pp_ephemeral_secret");
          if (savedSecret) {
            const keypair = Keypair.fromSecret(savedSecret);
            setAddress(keypair.publicKey());
            setWalletType("ephemeral");
          }
        } else if (savedType === "freighter") {
          // Freighter auto-reconnect if already approved
          const { isConnected, getAddress } = await import("@stellar/freighter-api");
          const hasFreighterObj = await isConnected();
          const hasFreighter = typeof hasFreighterObj === "boolean" ? hasFreighterObj : (hasFreighterObj as any).isConnected;
          if (hasFreighter) {
            const pubKeyRes = await getAddress();
            const pubKey = typeof pubKeyRes === "string" ? pubKeyRes : (pubKeyRes as any)?.address;
            if (pubKey) {
              setAddress(pubKey);
              setWalletType("freighter");
            }
          }
        } else if (savedType === "albedo") {
          const savedPub = localStorage.getItem("pp_albedo_pubkey");
          if (savedPub) {
            setAddress(savedPub);
            setWalletType("albedo");
          }
        }
      } catch (err) {
        console.error("Wallet auto-reconnect error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    // Slight delay to ensure DOM is ready and window is defined
    setTimeout(initSession, 100);
  }, []);

  // Sync balances when address changes
  useEffect(() => {
    if (address) {
      refreshBalances();
    } else {
      setBalances([]);
      setPreferred(null);
    }
  }, [address, refreshBalances]);

  // Connect a specific wallet
  const connectWallet = async (type: WalletType): Promise<string> => {
    setIsLoading(true);
    try {
      let connectedPubKey = "";

      if (type === "ephemeral") {
        let savedSecret = localStorage.getItem("pp_ephemeral_secret");
        let kp: Keypair;
        if (!savedSecret) {
          kp = generateEphemeralKeypair();
          localStorage.setItem("pp_ephemeral_secret", kp.secret());
        } else {
          kp = Keypair.fromSecret(savedSecret);
        }
        connectedPubKey = kp.publicKey();
        
        localStorage.setItem("pp_wallet_type", "ephemeral");
        localStorage.removeItem("pp_ephemeral_sandbox");
        setIsSandbox(false);
        setAddress(connectedPubKey);
        setWalletType("ephemeral");
      } 
      else if (type === "freighter") {
        const { isConnected, requestAccess } = await import("@stellar/freighter-api");
        const hasFreighterObj = await isConnected();
        const hasFreighter = typeof hasFreighterObj === "boolean" ? hasFreighterObj : (hasFreighterObj as any).isConnected;
        if (!hasFreighter) {
          throw new Error("Freighter Extension not installed or disabled");
        }
        const pubKeyRes = await requestAccess();
        const pubKey = typeof pubKeyRes === "string" ? pubKeyRes : (pubKeyRes as any)?.address;
        if (!pubKey) throw new Error("User rejected Freighter connection");
        connectedPubKey = pubKey;
        
        localStorage.setItem("pp_wallet_type", "freighter");
        localStorage.removeItem("pp_ephemeral_sandbox");
        setIsSandbox(false);
        setAddress(connectedPubKey);
        setWalletType("freighter");
      } 
      else if (type === "albedo") {
        // Dynamic load of Albedo for mobile/browser compatibility
        const albedo = (await import("@albedo-link/intent")).default;
        const res = await albedo.publicKey({});
        connectedPubKey = res.pubkey;
        
        localStorage.setItem("pp_wallet_type", "albedo");
        localStorage.setItem("pp_albedo_pubkey", connectedPubKey);
        localStorage.removeItem("pp_ephemeral_sandbox");
        setIsSandbox(false);
        setAddress(connectedPubKey);
        setWalletType("albedo");
      }

      return connectedPubKey;
    } catch (err: any) {
      console.error(`Connection failed for ${type}:`, err);
      throw new Error(err?.message ?? `Failed to connect ${type}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    localStorage.removeItem("pp_wallet_type");
    localStorage.removeItem("pp_albedo_pubkey");
    localStorage.removeItem("pp_ephemeral_sandbox");
    setIsSandbox(false);
    // We keep the ephemeral secret so they don't lose custody if they reconnect later
    setAddress(null);
    setWalletType(null);
  };

  // Automatically fund, activate, trust, and swap XLM for USDC on Testnet (Ephemeral only)
  const fundEphemeralAccount = async () => {
    if (walletType !== "ephemeral" || !address) return;
    setIsLoading(true);
    try {
      console.log("Funding account via Friendbot...");
      const funded = await fundWithFriendbot(address);
      if (!funded) throw new Error("Friendbot funding failed. Testnet might be down.");

      const secret = localStorage.getItem("pp_ephemeral_secret");
      if (secret) {
        console.log("Establishing trustlines...");
        await establishTrustlines(secret);

        console.log("Swapping XLM for 1000 USDC...");
        await swapXlmToUsdc(secret, "1000.0");
      }
      
      localStorage.removeItem("pp_ephemeral_sandbox");
      setIsSandbox(false);
      await refreshBalances();
    } catch (err: any) {
      console.error("Ephemeral wallet activation error, activating Sandbox fallback:", err);
      localStorage.setItem("pp_ephemeral_sandbox", "true");
      setIsSandbox(true);
      alert("Notice: Stellar Testnet Friendbot is currently congested or down. We have automatically activated Sandbox Mode so you can continue testing PasaPay with simulated assets!");
      await refreshBalances();
    } finally {
      setIsLoading(false);
    }
  };

  // Sign and submit a transaction XDR to the network
  const signAndSubmitXdr = async (xdr: string): Promise<string> => {
    if (!address || !walletType) throw new Error("Wallet not connected");

    const sandboxActive = localStorage.getItem("pp_ephemeral_sandbox") === "true";
    if (walletType === "ephemeral" && sandboxActive) {
      console.log("[Sandbox] Simulating transaction signing and submission...");
      await new Promise((resolve) => setTimeout(resolve, 800));
      return "sim_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    const server = getHorizonServer();

    if (walletType === "ephemeral") {
      const secret = localStorage.getItem("pp_ephemeral_secret");
      if (!secret) throw new Error("Ephemeral secret not found in local storage");
      
      const keypair = Keypair.fromSecret(secret);
      const networkPassphrase = STELLAR_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
      
      // Parse transaction, sign it, and submit
      const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
      tx.sign(keypair);
      
      const response = await server.submitTransaction(tx);
      return response.hash;
    } 
    else if (walletType === "freighter") {
      const { signTransaction } = await import("@stellar/freighter-api");
      const networkPassphrase = STELLAR_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
      
      const signedXdrRes = await signTransaction(xdr, { networkPassphrase });
      const signedXdr = typeof signedXdrRes === "string" ? signedXdrRes : (signedXdrRes as any)?.signedTxXdr;
      if (!signedXdr) throw new Error("Failed to sign transaction with Freighter");
      
      const tx = TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET);
      const response = await server.submitTransaction(tx);
      return response.hash;
    } 
    else if (walletType === "albedo") {
      const albedo = (await import("@albedo-link/intent")).default;
      const network = STELLAR_NETWORK === "PUBLIC" ? "public" : "testnet";
      
      const res = await albedo.tx({ xdr, network });
      const tx = TransactionBuilder.fromXDR(res.signed_envelope_xdr, STELLAR_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET);
      const response = await server.submitTransaction(tx);
      return response.hash;
    }

    throw new Error("Unsupported wallet signing type");
  };

  // Deep link to Decaf USD Onramp
  const redirectToDeposit = () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = DECAF_DEPOSIT_DEEPLINK;
      // Web fallback after 1.5 seconds if the app doesn't open
      setTimeout(() => {
        window.open(DECAF_WEB_FALLBACK, "_blank");
      }, 1500);
    } else {
      window.open(DECAF_WEB_FALLBACK, "_blank");
    }
  };

  const totalUsd = balances.reduce((sum, b) => {
    // Treat USDC and EURC roughly equal to 1 USD for display simplicity, or adjust as needed
    if (b.symbol === "XLM") return sum; // don't count native fees in stable USD balance
    return sum + b.human;
  }, 0);

  return {
    address,
    walletType,
    isConnected: !!address,
    isLoading,
    isSandbox,
    balances,
    preferred,
    totalUsd,
    connectWallet,
    disconnectWallet,
    refreshBalances,
    signAndSubmitXdr,
    fundEphemeralAccount,
    redirectToDeposit,
  };
}
