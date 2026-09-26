// npm run world:staging-window [-- --close] — opens (or closes) World's 24-hour staging
// verification window for WORLD_APP_ID through the Developer Portal MCP and writes the token to
// .env.local as WORLD_STAGING_VERIFICATION_TOKEN. Asks for a team API key (api_…) without
// echoing it, or reads it from stdin when piped. Never prints the key or the token.
import { readFileSync, writeFileSync } from "node:fs";

const appId = process.env.WORLD_APP_ID?.trim();
if (!appId) throw new Error("Set WORLD_APP_ID in .env.local first.");
const close = process.argv.includes("--close");

function readSecret(prompt: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY)
    return new Promise((resolve) => {
      let piped = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => (piped += chunk));
      stdin.on("end", () => resolve(piped.split("\n")[0]));
    });
  process.stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();
  return new Promise((resolve, reject) => {
    let typed = "";
    const done = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return (done(), resolve(typed));
        if (ch === "\u0003") return (done(), reject(new Error("Cancelled.")));
        if (ch === "\u007f" || ch === "\b") typed = typed.slice(0, -1);
        else typed += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const key = (
  await readSecret("World Developer Portal API key (api_…, hidden): ")
).trim();
if (!key.startsWith("api_"))
  throw new Error("That is not a Developer Portal API key (they start api_).");

type ToolResult = {
  isError?: boolean;
  content?: { type: string; text?: string }[];
  structuredContent?: unknown;
};
const response = await fetch("https://developer.world.org/api/mcp", {
  method: "POST",
  headers: {
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "set_world_id_staging_verification",
      arguments: { app_id: appId, enabled: !close },
    },
  }),
  signal: AbortSignal.timeout(30000),
});
const body = await response.text();
// Streamable HTTP may answer as server-sent events; the last data line holds the reply.
const reply = JSON.parse(
  response.headers.get("content-type")?.includes("text/event-stream")
    ? body
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .pop()!
        .slice(5)
    : body,
) as { error?: { message: string }; result?: ToolResult };
if (reply.error) throw new Error(`World refused: ${reply.error.message}`);
const result = reply.result ?? {};
const texts = (result.content ?? []).flatMap((c) => (c.text ? [c.text] : []));
if (result.isError) throw new Error(`World refused: ${texts.join(" ")}`);

// Find the one-time token and the expiry wherever the tool put them.
const found: { token?: string; expires?: string } = {};
const visit = (value: unknown, name = "") => {
  if (typeof value === "string") {
    if (/token/i.test(name) && !/hash/i.test(name)) found.token ??= value;
    if (/expir/i.test(name)) found.expires ??= value;
  } else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) visit(v, k);
};
visit(result.structuredContent);
for (const text of texts)
  try {
    visit(JSON.parse(text));
  } catch {
    // Plain-text content; the structured result carries the fields.
  }

const name = "WORLD_STAGING_VERIFICATION_TOKEN";
const line = new RegExp(`^${name}=.*$`, "m");
let env = readFileSync(".env.local", "utf8");
const write = (value: string) => {
  env = line.test(env)
    ? env.replace(line, `${name}=${value}`)
    : `${env.replace(/\n?$/, "\n")}${name}=${value}\n`;
  writeFileSync(".env.local", env);
};
if (close) {
  write("");
  console.log(`Closed the staging window for ${appId} and cleared ${name}.`);
} else if (found.token) {
  write(found.token);
  console.log(
    `Opened World's staging verification window for ${appId}${found.expires ? ` until ${found.expires}` : " for 24 hours"}.`,
  );
  console.log(
    `Wrote ${name} to .env.local (${found.token.length} characters).`,
  );
  console.log(
    "Next: restart npm run dev if it runs elsewhere, and on Vercel replace the variable and redeploy.",
  );
} else {
  // No token found: describe the reply's shape without printing any values.
  const shape = (value: unknown): unknown =>
    typeof value === "string"
      ? `<${value.length} chars>`
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, shape(v)]),
          )
        : value;
  console.log(
    "World answered without a recognisable token. Reply shape:",
    JSON.stringify(shape(result)),
  );
  process.exitCode = 1;
}
