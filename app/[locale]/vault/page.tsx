"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, TrendingUp, Loader, CheckCircle, AlertCircle, Info, PiggyBank } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import {
  getVaultBalance,
  getVaultShares,
  getVaultAPY,
  buildVaultDepositTx,
  buildVaultWithdrawTx,
  getCompoundedSimulatedBalance,
} from "@/lib/vault";

type Tab = "deposit" | "withdraw";
type TxStatus = "idle" | "building" | "sending" | "done" | "error";

export default function VaultPage() {
  const router = useRouter();
  const { address, balances, walletType, refreshBalances, signAndSubmitXdr } = useStellarWallet();

  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  
  const [vaultBalance, setVaultBalance] = useState(0);
  const [vaultShares, setVaultShares] = useState(0);
  const [apy, setApy] = useState(5.25);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txMsg, setTxMsg] = useState("");
  const [txError, setTxError] = useState<string | null>(null);

  // 1. Fetch vault state
  const loadVaultData = useCallback(async () => {
    if (!address) return;
    setIsLoadingData(true);
    try {
      const isEphem = walletType === "ephemeral";
      const [bal, shares, activeApy] = await Promise.all([
        getVaultBalance(address, isEphem),
        getVaultShares(address, isEphem),
        getVaultAPY(),
      ]);
      setVaultBalance(bal);
      setVaultShares(shares);
      setApy(activeApy);
    } catch (err) {
      console.error("Error loading vault data:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [address, walletType]);

  useEffect(() => {
    loadVaultData();
  }, [loadVaultData]);

  // Live yield compounding micro-ticks (for maximum visual wow factor!)
  useEffect(() => {
    if (!address || vaultShares === 0 || txStatus !== "idle") return;
    
    // Set up a 100ms ticker to show compounding yield live on screen
    const interval = setInterval(() => {
      const isEphem = walletType === "ephemeral";
      if (isEphem) {
        const compounded = getCompoundedSimulatedBalance(address);
        setVaultBalance(compounded.total);
      } else {
        // For non-ephemeral, we also tick the UI based on local time + APY for visual wow
        setVaultBalance((prev) => {
          const ratePerSecond = (apy / 100) / 31_536_000;
          return prev * Math.exp(ratePerSecond * 0.1);
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [address, vaultShares, walletType, apy, txStatus]);

  const usdcBal = balances.find((b) => b.symbol === "USDC");
  const usdcHuman = usdcBal?.human ?? 0;

  const amountNum = parseFloat(amount) || 0;
  const canDeposit = tab === "deposit" && amountNum > 0 && amountNum <= usdcHuman && txStatus === "idle";
  const canWithdraw = tab === "withdraw" && amountNum > 0 && amountNum <= vaultBalance && txStatus === "idle";

  async function handleDeposit() {
    if (!address || !canDeposit) return;
    setTxError(null);
    setTxStatus("building");
    setTxMsg("Formulating Soroban deposit transaction…");

    try {
      const isEphem = walletType === "ephemeral";
      const xdr = await buildVaultDepositTx(address, amountNum, isEphem);
      
      setTxStatus("sending");
      setTxMsg("Depositing USDC to Yield Savings Vault…");
      
      if (xdr !== "MOCK_TRANSACTION_XDR_SUCCESS") {
        await signAndSubmitXdr(xdr);
      } else {
        // Simulated block confirmation wait
        await new Promise((r) => setTimeout(r, 1500));
      }

      await Promise.all([refreshBalances(), loadVaultData()]);
      setAmount("");
      setTxStatus("done");
      setTxMsg(`Successfully deposited $${amountNum.toFixed(2)} USDC!`);
    } catch (err: any) {
      setTxStatus("error");
      setTxError(err?.message ?? "Transaction failed — please try again");
    }
  }

  async function handleWithdraw() {
    if (!address || !canWithdraw) return;
    setTxError(null);
    setTxStatus("building");
    setTxMsg("Formulating Soroban withdrawal transaction…");

    try {
      const isEphem = walletType === "ephemeral";
      const xdr = await buildVaultWithdrawTx(address, amountNum, isEphem);

      setTxStatus("sending");
      setTxMsg("Withdrawing USDC from Yield Savings Vault…");

      if (xdr !== "MOCK_TRANSACTION_XDR_SUCCESS") {
        await signAndSubmitXdr(xdr);
      } else {
        await new Promise((r) => setTimeout(r, 1500));
      }

      await Promise.all([refreshBalances(), loadVaultData()]);
      setAmount("");
      setTxStatus("done");
      setTxMsg(`Successfully withdrawn $${amountNum.toFixed(2)} USDC!`);
    } catch (err: any) {
      setTxStatus("error");
      setTxError(err?.message ?? "Transaction failed — please try again");
    }
  }

  function resetTx() {
    setTxStatus("idle");
    setTxMsg("");
    setTxError(null);
  }

  const isBusy = txStatus === "building" || txStatus === "sending";

  return (
    <>
      <header className="app-header">
        <button
          onClick={() => router.push("/")}
          className="btn btn--ghost"
          style={{ width: 40, height: 40, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Savings Vault</h1>
        <div style={{ width: 40 }} />
      </header>

      <main className="page" style={{ paddingTop: 8, paddingBottom: 120 }}>
        {/* Total balance card */}
        <div className="card card--glass" style={{ marginBottom: 20, background: "linear-gradient(135deg, rgba(39,117,202,0.15) 0%, rgba(38,161,123,0.15) 100%)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <PiggyBank size={20} color="var(--green)" />
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, fontWeight: 600 }}>Soroban Yield Savings</p>
          </div>
          <p style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1, margin: "10px 0" }}>
            ${isLoadingData ? "0.00" : vaultBalance.toFixed(5)}
          </p>

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <div style={{
              background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "8px 12px",
              display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 95,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>APY (Auto-compounding)</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "var(--green)" }}>
                {apy.toFixed(2)}% APY
              </span>
            </div>
            <div style={{
              background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "8px 12px",
              display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 95,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Vault Shares</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>
                {vaultShares.toFixed(2)} pUSDC
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: 12, padding: 4, marginBottom: 20 }}>
          {(["deposit", "withdraw"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); resetTx(); setAmount(""); }}
              style={{
                flex: 1, padding: "10px", borderRadius: 9, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 14,
                background: tab === t ? "var(--green)" : "transparent",
                color: tab === t ? "#000" : "var(--text-secondary)",
                transition: "all 0.15s",
              }}
            >
              {t === "deposit" ? "Deposit" : "Withdraw"}
            </button>
          ))}
        </div>

        {/* Dynamic Token Badge */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            disabled
            style={{
              flex: 1, padding: "10px 12px", borderRadius: 10, border: "2px solid #2775CA",
              background: "rgba(39,117,202,0.08)", color: "#2775CA",
              fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2775CA" }} />
            USDC (Circle USD Stablecoin)
          </button>
        </div>

        {tab === "deposit" && (
          <>
            {/* Wallet balance */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label className="input-label" style={{ margin: 0 }}>Amount</label>
              <button
                onClick={() => setAmount(usdcHuman.toFixed(4))}
                style={{ fontSize: 12, color: "var(--green)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Max: ${usdcHuman.toFixed(2)} USDC
              </button>
            </div>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <input
                className="input-field"
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isBusy}
                style={{ paddingRight: 60, fontSize: 20, fontWeight: 700 }}
              />
              <span style={{
                position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                fontSize: 13, fontWeight: 700, color: "var(--text-secondary)",
              }}>
                USDC
              </span>
            </div>

            {/* APY info */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
              background: "rgba(38,161,123,0.08)", borderRadius: 10,
              border: "1px solid rgba(38,161,123,0.2)", marginBottom: 20,
            }}>
              <TrendingUp size={18} color="var(--green)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--green)", margin: 0 }}>
                  {apy.toFixed(2)}% APY (Auto-compounding)
                </p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0", lineHeight: 1.4 }}>
                  Yield accrues natively ledger-by-ledger directly on Stellar. Powered by the PasaPadala Soroban Yield Vault contract.
                </p>
              </div>
            </div>
          </>
        )}

        {tab === "withdraw" && (
          <>
            {/* Vault balance */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label className="input-label" style={{ margin: 0 }}>Amount</label>
              <button
                onClick={() => setAmount(vaultBalance.toFixed(4))}
                style={{ fontSize: 12, color: "var(--green)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Max: ${vaultBalance.toFixed(2)} USDC
              </button>
            </div>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <input
                className="input-field"
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isBusy}
                style={{ paddingRight: 60, fontSize: 20, fontWeight: 700 }}
              />
              <span style={{
                position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                fontSize: 13, fontWeight: 700, color: "var(--text-secondary)",
              }}>
                USDC
              </span>
            </div>

            {vaultBalance === 0 && !isLoadingData && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                background: "rgba(255,179,0,0.08)", borderRadius: 10,
                border: "1px solid rgba(255,179,0,0.2)", marginBottom: 16,
              }}>
                <Info size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: "var(--warning)", margin: 0 }}>
                  No USDC deposited yet. Switch to the Deposit tab to start saving.
                </p>
              </div>
            )}
          </>
        )}

        {/* Transaction status */}
        {txStatus === "done" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
            background: "rgba(0,200,83,0.08)", borderRadius: 10,
            border: "1px solid rgba(0,200,83,0.2)", marginBottom: 16,
          }}>
            <CheckCircle size={18} color="var(--green)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: "var(--green)", margin: 0, fontWeight: 600 }}>{txMsg}</p>
          </div>
        )}

        {txStatus === "error" && txError && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px",
            background: "rgba(255,82,82,0.08)", borderRadius: 10,
            border: "1px solid rgba(255,82,82,0.2)", marginBottom: 16,
          }}>
            <AlertCircle size={18} color="var(--error)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, color: "var(--error)", margin: 0, fontWeight: 600 }}>Transaction failed</p>
              <p style={{ fontSize: 12, color: "var(--error)", margin: "2px 0 0", opacity: 0.8, lineHeight: 1.4 }}>{txError}</p>
            </div>
          </div>
        )}

        {/* Multi-step progress */}
        {isBusy && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
            background: "var(--surface-raised)", borderRadius: 10, marginBottom: 16,
          }}>
            <Loader size={18} color="var(--green)" style={{ flexShrink: 0, animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 13, margin: 0, fontWeight: 600 }}>{txMsg}</p>
          </div>
        )}

        {/* Action button */}
        {tab === "deposit" ? (
          <button
            className="btn btn--primary"
            disabled={!canDeposit || isBusy}
            onClick={txStatus === "done" ? resetTx : handleDeposit}
            style={{
              background: "var(--green)",
              color: "#000",
            }}
          >
            {txStatus === "done"
              ? "Deposit More"
              : txStatus === "building"
              ? <><span className="spinner" /> Preparing…</>
              : txStatus === "sending"
              ? <><span className="spinner" /> Awaiting Signature…</>
              : "Deposit"}
          </button>
        ) : (
          <button
            className="btn btn--primary"
            disabled={!canWithdraw || isBusy}
            onClick={txStatus === "done" ? resetTx : handleWithdraw}
            style={{
              background: "var(--green)",
              color: "#000",
            }}
          >
            {txStatus === "done"
              ? "Withdraw More"
              : txStatus === "building"
              ? <><span className="spinner" /> Preparing…</>
              : txStatus === "sending"
              ? <><span className="spinner" /> Awaiting Signature…</>
              : "Withdraw"}
          </button>
        )}

        {/* Disclaimer */}
        <p style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center", marginTop: 20, lineHeight: 1.6, padding: "0 8px" }}>
          Funds are deposited into the PasaPadala Soroban Yield Vault contract on Stellar. Yield accrues natively every block. Not financial advice.
        </p>
      </main>
    </>
  );
}
