// Secret-free view of the Sui deployment for server-rendered pages.
export type SuiStatus = {
  ready: boolean;
  network: string;
  packageId: string | null;
};
export function suiStatus(): SuiStatus {
  const packageId = process.env.SUI_PACKAGE_ID?.trim() || null;
  return {
    // Same rule as suiConfig() in sui.ts: package, organiser cap and organiser key.
    ready:
      !!packageId &&
      !!process.env.SUI_ORGANISER_CAP_ID?.trim() &&
      !!process.env.SUI_SECRET_KEY?.trim(),
    network: process.env.SUI_NETWORK?.trim() || "testnet",
    packageId,
  };
}
export const suiscan = (network: string, kind: "tx" | "object", id: string) =>
  `https://suiscan.xyz/${network}/${kind}/${id}`;
/** Public explorers only index these networks; a localnet ID gets no link. */
export const explorable = (network: string | null | undefined) =>
  network === "mainnet" || network === "testnet" || network === "devnet";
export const shortId = (id: string) =>
  id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
/** "10000000" → "0.01 SUI". MIST amounts arrive as decimal strings. */
export function formatSui(mist: string | number | bigint) {
  const value = BigInt(mist);
  const whole = value / BigInt(1e9);
  const fraction = (value % BigInt(1e9))
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} SUI`;
}
