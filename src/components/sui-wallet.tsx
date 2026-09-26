"use client";
import { useEffect } from "react";
import {
  createDAppKit,
  DAppKitProvider,
  useCurrentAccount,
  useDAppKit,
} from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";

/** What the server signs after World ID: enough to call ballot::enter from the fan's wallet. */
export type EntryPermit = {
  package_id: string;
  drop_object_id: string;
  series_object_id: string;
  coin_type: string;
  price_mist: string;
  code_hex: string;
  signature_hex: string;
};
export type SuiWalletApi = {
  address: string | null;
  enter: (permit: EntryPermit) => Promise<string>;
};

const fullnodes: Record<string, string> = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
  localnet: "http://127.0.0.1:9000",
};
const kits = new Map<string, ReturnType<typeof createDAppKit>>();
function kitFor(network: string) {
  let kit = kits.get(network);
  if (!kit) {
    kit = createDAppKit({
      networks: [network],
      createClient: (name) =>
        new SuiGrpcClient({ network: name, baseUrl: fullnodes[name] }),
    });
    kits.set(network, kit);
  }
  return kit;
}

function Bridge({ onChange }: { onChange: (api: SuiWalletApi) => void }) {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  useEffect(() => {
    onChange({
      address: account?.address ?? null,
      async enter(permit) {
        const tx = new Transaction();
        const deposit = coinWithBalance({
          type: permit.coin_type,
          balance: BigInt(permit.price_mist),
        });
        tx.moveCall({
          target: `${permit.package_id}::ballot::enter`,
          typeArguments: [permit.coin_type],
          arguments: [
            tx.object(permit.drop_object_id),
            tx.object(permit.series_object_id),
            tx.pure.vector("u8", Array.from(fromHex(permit.code_hex))),
            tx.pure.vector("u8", Array.from(fromHex(permit.signature_hex))),
            deposit,
            tx.object.clock(),
          ],
        });
        const result = await dAppKit.signAndExecuteTransaction({
          transaction: tx,
        });
        if (result.FailedTransaction)
          throw new Error(
            `Sui refused the entry (${result.FailedTransaction.status.error?.message ?? "transaction failed"}). Your deposit did not move.`,
          );
        return result.Transaction.digest;
      },
    });
  }, [account, dAppKit, onChange]);
  return null;
}

/** Wallet connection for paid drops. Client-only: wallets are detected in the browser. */
export function SuiWallet({
  network,
  onChange,
}: {
  network: string;
  onChange: (api: SuiWalletApi) => void;
}) {
  return (
    <DAppKitProvider dAppKit={kitFor(network)}>
      <div className="wallet-connect">
        <ConnectButton />
      </div>
      <Bridge onChange={onChange} />
    </DAppKitProvider>
  );
}
