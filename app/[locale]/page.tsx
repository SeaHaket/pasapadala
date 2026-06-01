"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Home, Send, Clock, Smartphone, Gift, Users, PiggyBank, CreditCard, Key, ShieldCheck, HelpCircle, Loader } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import BalanceCard from "@/components/BalanceCard";
import AppHeader from "@/components/AppHeader";
import dynamic from "next/dynamic";

const QuickSend = dynamic(() => import("@/components/QuickSend"), { ssr: false });
import { getCountryConfig } from "@/config/countries";
import { loadHistory, getQuickContacts, type HistoryEntry, type QuickContact } from "@/lib/history";

export default function HomePage() {
  const t = useTranslations("home");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  
  // Connect to our new Stellar wallet hook
  const {
    address,
    walletType,
    isConnected,
    isLoading,
    isSandbox,
    balances,
    preferred,
    totalUsd,
    connectWallet,
    disconnectWallet,
    fundEphemeralAccount,
    redirectToDeposit,
  } = useStellarWallet();
  
  const [countryId, setCountryId] = useState("PH");
  const [isFunding, setIsFunding] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pp_country");
    if (saved) setCountryId(saved);
  }, []);

  const country = getCountryConfig(countryId);
  const { toLocalFiat } = useExchangeRate(country.currencyCode);

  const [recentTxs, setRecentTxs] = useState<HistoryEntry[]>([]);
  const [quickContacts, setQuickContacts] = useState<QuickContact[]>([]);
  
  useEffect(() => {
    setRecentTxs(loadHistory().slice(0, 3));
    setQuickContacts(getQuickContacts(5));
  }, []);

  // 1. Connection Dashboard (If not connected yet)
  if (!isLoading && !isConnected) {
    return (
      <div className="not-minipay" style={{ padding: "32px 24px", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 430, margin: "0 auto" }}>
        <div className="not-minipay__icon" style={{ background: "rgba(39,117,202,0.1)", color: "#2775CA", marginBottom: 16 }}>
          <Smartphone size={44} strokeWidth={1.5} />
        </div>
        <h1 className="not-minipay__title" style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>PasaPadala</h1>
        <p className="not-minipay__desc" style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 28, lineHeight: 1.6 }}>
          Global cross-border remittances and yield savings vault, powered by the **Stellar Network** and **Decaf Wallet**.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
          <button
            onClick={() => connectWallet("ephemeral")}
            className="btn btn--primary"
            style={{ padding: "14px", fontWeight: 700, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            <Key size={18} />
            Connect Ephemeral Developer Wallet
          </button>
          
          <button
            onClick={() => connectWallet("albedo")}
            className="btn btn--secondary"
            style={{ padding: "14px", fontWeight: 700, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            <Smartphone size={18} />
            Connect via Albedo (Mobile/Web)
          </button>
          
          <button
            onClick={() => connectWallet("freighter")}
            className="btn btn--ghost"
            style={{ padding: "14px", fontWeight: 700, borderRadius: 12, border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            <ShieldCheck size={18} />
            Connect Freighter Extension
          </button>
        </div>

        <p style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center", marginTop: 24, lineHeight: 1.4 }}>
          Choose **Ephemeral Wallet** for an instant browser preview. It automatically generates and activates a Stellar Testnet keypair in seconds.
        </p>
      </div>
    );
  }

  const triggerFriendbot = async () => {
    setIsFunding(true);
    try {
      await fundEphemeralAccount();
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <>
      <AppHeader />
      <main className="page page-padded" style={{ paddingBottom: 120 }}>
        {/* Stellar Balance Display Card */}
        <BalanceCard
          balances={balances}
          preferred={preferred}
          totalUsd={totalUsd}
          toLocalFiat={(usd) => toLocalFiat(usd, country.currencySymbol)}
          isLoading={isLoading}
        />

        <div className="action-row" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 16 }}>
          <Link href="/send" className="action-btn action-btn--primary">
            <div className="action-btn__icon"><Send size={20} /></div>
            <span className="action-btn__label">{t("send")}</span>
          </Link>
          <Link href="/allocator" className="action-btn">
            <div className="action-btn__icon"><Users size={20} /></div>
            <span className="action-btn__label">Allocator</span>
          </Link>
          <Link href="/history" className="action-btn">
            <div className="action-btn__icon"><Clock size={20} /></div>
            <span className="action-btn__label">{t("history")}</span>
          </Link>
        </div>

        {/* Ephemeral Developer Funding Console */}
        {walletType === "ephemeral" && (
          <div className="card card--glass" style={{ marginTop: 24, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(39,117,202,0.06)" }}>
            {isSandbox && (
              <div style={{ padding: "10px 12px", background: "rgba(252,209,22,0.1)", borderRadius: 10, border: "1px solid rgba(252,209,22,0.25)", marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--ph-gold)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  ⚠️ Sandbox Mode Active
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  Stellar Testnet Friendbot is congested or offline. Operating with mock assets for frictionless sandbox testing.
                </p>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <ShieldCheck size={18} color={isSandbox ? "var(--ph-gold)" : "var(--green)"} />
              <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>
                {isSandbox ? "Stellar Sandbox Active" : "Stellar Testnet Account Active"}
              </p>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4, margin: "0 0 12px" }}>
              Public Key: <span style={{ fontFamily: "monospace", color: "var(--text)" }}>{address?.slice(0, 8)}...{address?.slice(-8)}</span>
            </p>
            <button
              onClick={triggerFriendbot}
              disabled={isFunding}
              className="btn btn--primary"
              style={{ padding: "10px 14px", fontSize: 13, borderRadius: 10, background: isSandbox ? "var(--ph-gold)" : "var(--green)", color: "#000", width: "100%" }}
            >
              {isFunding ? (
                <><Loader size={14} className="spinner" style={{ marginRight: 6 }} /> Funding via Friendbot…</>
              ) : (
                isSandbox ? "Retry Friendbot Funding" : "Fund with Friendbot (+10k XLM & +1k USDC)"
              )}
            </button>
          </div>
        )}

        {/* Decaf Virtual Bank Account Onramp */}
        <div
          className="card card--glass"
          style={{ margin: "20px 0", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", padding: "16px", border: "1px solid rgba(252,209,22,0.2)" }}
          onClick={redirectToDeposit}
        >
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(252, 209, 22, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ph-gold)", flexShrink: 0 }}>
            <CreditCard size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 2 }}>USD Bank Onramp (Decaf)</p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>Top up your USDC balance directly via ACH/Wire deposits.</p>
          </div>
        </div>

        {quickContacts.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <QuickSend contacts={quickContacts} address={address ?? undefined} />
          </div>
        )}

        <p className="section-title" style={{ marginTop: 24 }}>{t("recentActivity")}</p>
        {recentTxs.length === 0 ? (
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{t("noTransactions")}</p>
          </div>
        ) : (
          <>
            {recentTxs.map(tx => (
              <div key={tx.id} className="card" style={{ padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>${tx.amount} <span style={{ fontWeight: 400, color: "var(--text-secondary)", fontSize: 13 }}>{tx.tokenSymbol}</span></p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>→ {tx.recipientDisplay}</p>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", flexShrink: 0 }}>{new Date(tx.timestamp).toLocaleDateString()}</p>
              </div>
            ))}
            <Link href="/history" style={{ display: "block", textAlign: "center", color: "var(--text-secondary)", fontSize: 13, padding: "8px 0" }}>
              View all history →
            </Link>
          </>
        )}
        
        {isConnected && (
          <button
            onClick={disconnectWallet}
            className="btn btn--ghost"
            style={{ marginTop: 32, fontSize: 13, textDecoration: "underline", color: "var(--text-secondary)" }}
          >
            Disconnect Wallet
          </button>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <Link href="/" className="bottom-nav__item bottom-nav__item--active">
          <span className="bottom-nav__icon"><Home size={22} /></span>
          <span>{tc("home")}</span>
        </Link>
        <Link href="/send" className="bottom-nav__item">
          <span className="bottom-nav__icon"><Send size={22} /></span>
          <span>{t("send")}</span>
        </Link>
        <Link href="/vault" className="bottom-nav__item">
          <span className="bottom-nav__icon"><PiggyBank size={22} /></span>
          <span>Vault</span>
        </Link>
        <Link href="/history" className="bottom-nav__item">
          <span className="bottom-nav__icon"><Clock size={22} /></span>
          <span>{t("history")}</span>
        </Link>
      </nav>
    </>
  );
}
