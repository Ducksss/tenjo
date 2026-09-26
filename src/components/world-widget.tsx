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
export function WorldWidget<
  T = { code: string; tickets?: number; collected?: boolean },
>({
  challenge,
  dropId,
  purpose,
  endpoint,
  headers,
  onOpenChange,
  onVerified,
  onError,
}: {
  challenge: Challenge;
  dropId: string;
  purpose: "enter" | "collect";
  /** Paid drops send the same proof to /permit instead of /enter. */
  endpoint?: string;
  headers?: Record<string, string>;
  onOpenChange: (open: boolean) => void;
  onVerified: (receipt: T) => void;
  /** Called with the refusal itself, so a screen can tell a repeat entry from a failure. */
  onError: (error: Error) => void;
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
          const receipt = await api<T>(
            endpoint ?? `/api/drops/${dropId}/${purpose}`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-tenjo-challenge": challenge.id,
                ...headers,
              },
              body: JSON.stringify(result),
            },
          );
          onVerified(receipt);
        } catch (error) {
          // Tenjō's own refusal (such as Already entered) says more than IDKit's
          // generic "declined" screen, so close the modal and show ours.
          onError(error as Error);
          onOpenChange(false);
          throw error;
        }
      }}
      onSuccess={() => onOpenChange(false)}
      onError={(code) => {
        // Host refusals were already reported from handleVerify.
        if (code === "failed_by_host_app") return;
        onError(
          new Error(
            code === "user_presence_failed"
              ? "Pickup refused. The live presence check failed."
              : `Verification was not completed (${code}). Nothing was entered. Try again.`,
          ),
        );
      }}
    />
  );
}
