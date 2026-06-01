"use client";

import { useState, useCallback } from "react";
import {
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
  Networks,
  Memo,
} from "@stellar/stellar-sdk";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import {
  getHorizonServer,
} from "@/lib/stellar";
import {
  STELLAR_NETWORK,
  USDC_ASSET_CODE,
  USDC_ISSUER,
} from "@/lib/constants";

export type BatchSendStatus = "idle" | "checking" | "sending" | "success" | "error";

export function useBatchSend() {
  const { address, signAndSubmitXdr } = useStellarWallet();
  const [status, setStatus] = useState<BatchSendStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const sendBatch = useCallback(
    async (
      recipients: string[],
      amounts: string[], // Amounts in human units (e.g. "50.50" USDC)
      onProgressStep?: (step: string) => void
    ): Promise<string> => {
      if (!address) {
        const errMsg = "Wallet not connected";
        setError(errMsg);
        setStatus("error");
        throw new Error(errMsg);
      }

      if (recipients.length === 0) {
        const errMsg = "Empty batch";
        setError(errMsg);
        setStatus("error");
        throw new Error(errMsg);
      }

      if (recipients.length !== amounts.length) {
        const errMsg = "Recipients and amounts length mismatch";
        setError(errMsg);
        setStatus("error");
        throw new Error(errMsg);
      }

      setStatus("checking");
      setError(null);
      onProgressStep?.("Preparing Stellar transaction…");

      try {
        const server = getHorizonServer();
        const networkPassphrase = STELLAR_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
        const usdcAsset = new Asset(USDC_ASSET_CODE, USDC_ISSUER);

        // 1. Load active account details to retrieve sequence number
        const sourceAccount = await server.loadAccount(address);

        // 2. Build multi-operation transaction natively
        // Stellar supports up to 100 operations per transaction.
        // Each recipient payment is loaded as a separate Operation.payment.
        const txBuilder = new TransactionBuilder(sourceAccount, {
          fee: (BigInt(BASE_FEE) * BigInt(recipients.length)).toString(), // Scaling fee per operation
          networkPassphrase,
        });

        for (let i = 0; i < recipients.length; i++) {
          const dest = recipients[i];
          const amount = parseFloat(amounts[i]).toFixed(7); // Stellar native assets support up to 7 decimal precision

          if (!dest || dest.length < 56 || !dest.startsWith("G")) {
            throw new Error(`Invalid Stellar recipient address at index ${i}: ${dest}`);
          }

          txBuilder.addOperation(
            Operation.payment({
              destination: dest,
              asset: usdcAsset,
              amount: amount,
            })
          );
        }

        // Add a nice memo to identify batch payment
        txBuilder.addMemo(Memo.text("PasaPay Batch"));

        // Optional memo annotation
        const tx = txBuilder.setTimeout(60).build();
        const xdr = tx.toXDR();

        // 3. Send transaction to wallet interface to sign and submit
        setStatus("sending");
        onProgressStep?.("Awaiting wallet confirmation…");

        const txHash = await signAndSubmitXdr(xdr);

        setStatus("success");
        onProgressStep?.("");
        return txHash;
      } catch (err: any) {
        console.error("Stellar batch send error:", err);
        const errMsg = err?.response?.data?.extras?.result_codes?.transaction || err?.message || "Batch send transaction failed";
        setError(errMsg);
        setStatus("error");
        onProgressStep?.("");
        throw new Error(errMsg);
      }
    },
    [address, signAndSubmitXdr]
  );

  return { sendBatch, status, error, setStatus, setError };
}
