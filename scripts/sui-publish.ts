// npm run sui:publish [-- --write-env] — publishes move/tenjo with SUI_SECRET_KEY on SUI_NETWORK
// (default testnet) and prints the package and OrganiserCap IDs; --write-env also sets them in
// .env.local. Never prints keys.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { suiClient } from "../src/lib/sui";
import { suiStatus, suiscan } from "../src/lib/sui-status";

const secret = process.env.SUI_SECRET_KEY?.trim();
if (!secret)
  throw new Error("Set SUI_SECRET_KEY (suiprivkey…) in .env.local first.");
const signer = Ed25519Keypair.fromSecretKey(secret);
const { network, packageId: current } = suiStatus();
if (current)
  console.warn(
    `SUI_PACKAGE_ID is already set (${current}); publishing a new package anyway.`,
  );
const build = JSON.parse(
  execFileSync(
    "sui",
    ["move", "build", "--dump-bytecode-as-base64", "--path", "move/tenjo"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  ),
) as { modules: string[]; dependencies: string[] };
const tx = new Transaction();
const [upgradeCap] = tx.publish(build);
tx.transferObjects([upgradeCap], signer.toSuiAddress());
const client = suiClient();
const result = await client.signAndExecuteTransaction({
  transaction: tx,
  signer,
  include: { effects: true, objectTypes: true },
});
const executed = result.Transaction ?? result.FailedTransaction;
if (!executed.status.success)
  throw new Error(
    `Publish failed: ${executed.status.error.message} (${executed.digest})`,
  );
await client.waitForTransaction({ result });
const created = executed.effects.changedObjects.filter(
  (o) => o.idOperation === "Created",
);
const packageId = created.find(
  (o) => o.outputState === "PackageWrite",
)?.objectId;
const cap = created.find((o) =>
  executed.objectTypes[o.objectId]?.endsWith("::ballot::OrganiserCap"),
);
if (!packageId || !cap)
  throw new Error(`Publish ${executed.digest} created no package or cap.`);
const link = (kind: "tx" | "object", id: string) =>
  network === "localnet" ? "" : `  ${suiscan(network, kind, id)}`;
console.log(`Published on ${network} by ${signer.toSuiAddress()}`);
console.log(`Transaction ${executed.digest}${link("tx", executed.digest)}`);
console.log(
  `\nSUI_NETWORK=${network}\nSUI_PACKAGE_ID=${packageId}\nSUI_ORGANISER_CAP_ID=${cap.objectId}`,
);
if (network !== "localnet")
  console.log(`\nPackage${link("object", packageId)}`);
if (process.argv.includes("--write-env")) {
  let env = readFileSync(".env.local", "utf8");
  for (const [name, value] of [
    ["SUI_PACKAGE_ID", packageId],
    ["SUI_ORGANISER_CAP_ID", cap.objectId],
  ]) {
    const line = new RegExp(`^${name}=.*$`, "m");
    env = line.test(env)
      ? env.replace(line, `${name}=${value}`)
      : `${env.replace(/\n?$/, "\n")}${name}=${value}\n`;
  }
  writeFileSync(".env.local", env);
  console.log("Wrote SUI_PACKAGE_ID and SUI_ORGANISER_CAP_ID to .env.local.");
}
