import { toast } from "sonner"
import { isQuotaError } from "./api"

/**
 * Standard failure toast for any caught API/action error. Quota errors are
 * skipped here — callers that can hit a 402 already render a persistent
 * <UpgradePrompt> inline, which carries the plan/upgrade context a toast
 * can't; toasting it too would just be a redundant, context-free popup.
 */
export function toastApiError(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (isQuotaError(err)) return
  toast.error(err instanceof Error ? err.message : fallback)
}
