import { prisma } from "../prisma";

export const MEMBER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

type CoupleIds = { leadId: string; followId: string; coachId: string | null };

/** Active couple a user belongs to as lead, follow, OR coach. */
export async function findCoupleForUser(userId: string) {
  return prisma.couple.findFirst({
    where: {
      isActive: true,
      OR: [{ leadId: userId }, { followId: userId }, { coachId: userId }],
    },
    include: {
      lead: { select: MEMBER_SELECT },
      follow: { select: MEMBER_SELECT },
      coach: { select: MEMBER_SELECT },
    },
  });
}

/** Lightweight lookup (no relations) — used by activity/notification helpers. */
export async function findCoupleIdsForUser(userId: string) {
  return prisma.couple.findFirst({
    where: {
      isActive: true,
      OR: [{ leadId: userId }, { followId: userId }, { coachId: userId }],
    },
  });
}

/** All member user ids of a couple: lead, follow, and coach (if set). */
export function coupleMemberIds(couple: CoupleIds): string[] {
  const ids = [couple.leadId, couple.followId];
  if (couple.coachId) ids.push(couple.coachId);
  return ids;
}

/** Members other than the actor (recipients of a notification). */
export function otherMemberIds(couple: CoupleIds, actorId: string): string[] {
  return coupleMemberIds(couple).filter((id) => id !== actorId);
}

export function isCoupleMember(couple: CoupleIds, userId: string): boolean {
  return coupleMemberIds(couple).includes(userId);
}
