export function openFonbnk(walletAddress: string, currencyCode?: string) {
  const baseUrl = "https://pay.fonbnk.com/offramp";
  const params: Record<string, string> = { walletAddress, network: "stellar" };
  if (currencyCode) params.currency = currencyCode;
  window.location.href = `${baseUrl}?${new URLSearchParams(params).toString()}`;
}
