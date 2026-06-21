import { prisma } from "../prisma";
import { notify } from "./wsManager";

export async function notifyPartner(userId: string, resource: string) {
  try {
    const couple = await prisma.couple.findFirst({
      where: { isActive: true, OR: [{ leadId: userId }, { followId: userId }] },
    });
    if (!couple) return;
    const partnerId = couple.leadId === userId ? couple.followId : couple.leadId;
    notify(partnerId, { type: "sync", resource });
  } catch {
    // Best-effort — never let notification failure break the response
  }
}
