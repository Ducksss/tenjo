"use client";
import {
  IDKitRequestWidget,
  passport,
  proofOfHuman,
  documentLegacy,
  orbLegacy,
  type RpContext,
} from "@worldcoin/idkit";
import { api } from "@/lib/client-api";
export type Challenge = {
  id: string;
  app_id: `app_${string}`;
  action: string;
  environment: "staging" | "production";
  credential: "passport" | "orb";
  protocol: string;
  signal: string;
  require_user_presence: boolean;
  rp_context: RpContext;
};
export function WorldWidget({
  challenge,
  dropId,
  purpose,
  onOpenChange,
  onVerified,
  onError,
}: {
  challenge: Challenge;
  dropId: string;
  purpose: "enter" | "collect";
  onOpenChange: (open: boolean) => void;
  onVerified: (receipt: {
    code: string;
    tickets?: number;
    collected?: boolean;
  }) => void;
  onError: (error: string) => void;
}) {
  const preset =
    challenge.protocol === "3.0"
      ? challenge.credential === "orb"
        ? orbLegacy
        : documentLegacy
      : challenge.credential === "orb"
        ? proofOfHuman
        : passport;
  return (
    <IDKitRequestWidget
      open
      onOpenChange={onOpenChange}
      app_id={challenge.app_id}
      action={challenge.action}
      rp_context={challenge.rp_context}
      environment={challenge.environment}
      allow_legacy_proofs={challenge.protocol === "3.0"}
      require_user_presence={challenge.require_user_presence}
      preset={preset({ signal: challenge.signal })}
      handleVerify={async (result) => {
        try {
          const receipt = await api<{
            code: string;
            tickets?: number;
            collected?: boolean;
          }>(`/api/drops/${dropId}/${purpose}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-tenjo-challenge": challenge.id,
            },
            body: JSON.stringify(result),
          });
          onVerified(receipt);
        } catch (error) {
          onError((error as Error).message);
          throw error;
        }
      }}
      onSuccess={() => onOpenChange(false)}
      onError={(code) =>
        onError(
          code === "user_presence_failed"
            ? "Pickup refused. The live presence check failed."
            : `Verification was not completed (${code}). Nothing was entered. Try again.`,
        )
      }
    />
  );
}
