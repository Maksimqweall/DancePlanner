import { notify } from "./wsManager";
import { sendPushToUsers } from "./push";

// Best-effort real-time + push nudge for sync-invite events (sent/accepted/
// declined). Separate from logActivity() because PARTNER invites happen
// before any Couple exists, so there's no activity feed to post into yet.
export async function notifyInvite(userId: string, body: string): Promise<void> {
  try {
    notify(userId, { type: "sync", resource: "invites" });
    await sendPushToUsers([userId], {
      title: "Dance Planner",
      body,
      data: { type: "invite" },
    });
  } catch {
    // best-effort
  }
}
