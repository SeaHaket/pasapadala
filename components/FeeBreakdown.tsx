"use client";

import { useTranslations } from "next-intl";

type Props = {
  toLocalFiat: (usd: number) => string;
  isLoading?: boolean;
};

export default function FeeBreakdown({ toLocalFiat, isLoading }: Props) {
  const t = useTranslations("send");
  const tc = useTranslations("common");

  if (isLoading) {
    return (
      <div className="card" style={{ padding: "14px 16px" }}>
        <div className="flex items-center gap-8" style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          <span className="spinner" style={{ width: 14, height: 14 }} />
          <span>{t("gettingRoute")}</span>
        </div>
      </div>
    );
  }

  // Stellar native transactions have negligible fees and sub-5-second finality.
  const networkFeeUsd = "0.000002";
  const serviceFeeUsd = "0.00";
  const totalFeeUsd = "0.000002";
  const estimatedDuration = "3 - 5 seconds";

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div className="fee-row">
        <span className="fee-row__label">{tc("networkFee")} (Stellar Gas)</span>
        <span className="fee-row__value" style={{ color: "var(--green)", fontWeight: 700 }}>
          ≈ ${networkFeeUsd}
        </span>
      </div>
      
      <div className="fee-row">
        <span className="fee-row__label">PasaPadala Service Fee</span>
        <span className="fee-row__value">
          ${serviceFeeUsd} (Free)
        </span>
      </div>
      
      <div className="fee-row fee-row--total">
        <span className="fee-row__label">{t("totalFee")}</span>
        <span className="fee-row__value">${totalFeeUsd}</span>
      </div>
      
      <div className="fee-row">
        <span className="fee-row__label">{t("estimatedTime")}</span>
        <span className="fee-row__value" style={{ color: "var(--green)", fontWeight: 700 }}>
          {estimatedDuration}
        </span>
      </div>
      
      <div className="divider" style={{ margin: "10px 0", borderTop: "1px solid var(--border)" }} />
      
      <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>
        Stellar settles payments atomically. Transactions are final once added to the ledger in a few seconds.
      </div>
    </div>
  );
}
