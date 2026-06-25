import { prisma } from "../prisma";
import { notify } from "./wsManager";
import { sendPushToUsers } from "./push";
import { findCoupleIdsForUser, otherMemberIds } from "./coupleMembers";

export type ActivityAction = "added" | "updated" | "deleted" | "approved" | "declined";

export interface ActivityInput {
  resource: "expenses" | "schedule" | "events" | "proposals" | "budgets" | "partner";
  action: ActivityAction;
  summary: string; // human one-liner, e.g. "Hall rent — 40 EUR"
  meta?: Record<string, unknown>;
}

function resourceNoun(resource: string): string {
  switch (resource) {
    case "expenses": return "expense";
    case "schedule": return "session";
    case "events": return "project";
    case "budgets": return "budget";
    case "proposals": return "proposal";
    case "partner": return "couple";
    default: return resource;
  }
}

/**
 * Record a change in the couple's activity feed and notify every OTHER member
 * (partner + coach) in real time (WebSocket) and via push notification.
 * Best-effort — never throws so it can't break the originating request.
 */
export async function logActivity(actorId: string, input: ActivityInput): Promise<void> {
  try {
    const couple = await findCoupleIdsForUser(actorId);
    if (!couple) return;

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { firstName: true },
    });
    const who = actor?.firstName?.trim() || "Partner";
    const body = `${who} ${input.action} ${resourceNoun(input.resource)}: ${input.summary}`;

    const message = await prisma.message.create({
      data: {
        coupleId: couple.id,
        authorId: null,
        kind: "SYSTEM",
        body,
        meta: { ...(input.meta ?? {}), resource: input.resource, action: input.action, actorId } as object,
      },
    });

    const recipients = otherMemberIds(couple, actorId);
    for (const uid of recipients) {
      notify(uid, { type: "message", coupleId: couple.id, messageId: message.id });
      // Keep the existing refetch behaviour so lists stay live.
      notify(uid, { type: "sync", resource: input.resource });
    }
    await sendPushToUsers(recipients, {
      title: "Dance Planner",
      body,
      data: { type: "chat", coupleId: couple.id },
    });
  } catch {
    // best-effort
  }
}
