"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { STELLAR_NETWORK } from "@/lib/constants";

type Props = { txHash: string };

export default function BlockchainReceipt({ txHash }: Props) {
  const t = useTranslations("status");
  const [copied, setCopied] = useState(false);
  
  const url = STELLAR_NETWORK === "PUBLIC"
    ? `https://stellar.expert/explorer/public/tx/${txHash}`
    : `https://stellar.expert/explorer/testnet/tx/${txHash}`;

  async function copy() {
    await navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="receipt-box">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
          Stellar Expert Receipt
        </span>
        <button onClick={copy} className="btn btn--ghost" style={{ width: "auto", padding: "2px 8px", fontSize: 12 }}>
          {copied ? "✅ Copied!" : "Copy"}
        </button>
      </div>
      <p className="receipt-hash">{txHash}</p>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="btn btn--secondary mt-8" style={{ marginTop: 12, fontSize: 14 }}>
        🔍 {t("viewReceipt")} ↗
      </a>
    </div>
  );
}
