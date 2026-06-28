/**
 * One-off maintenance script: delete ALL user accounts and every record that
 * belongs to them. Global caches that are NOT account data (WdsfRankingSnapshot)
 * are left intact. Run with:  npx tsx prisma/wipe-accounts.ts
 */
import { prisma } from "../src/prisma";

async function main() {
  // Delete in dependency order (children first) so foreign keys don't block us.
  const steps: [string, () => Promise<{ count: number }>][] = [
    ["messageReads", () => prisma.messageRead.deleteMany()],
    ["messages", () => prisma.message.deleteMany()],
    ["pushTokens", () => prisma.pushToken.deleteMany()],
    ["proposals", () => prisma.proposal.deleteMany()],
    ["attachments", () => prisma.attachment.deleteMany()],
    ["checklistItems", () => prisma.checklistItem.deleteMany()],
    ["expenses", () => prisma.expense.deleteMany()],
    ["scheduleEntries", () => prisma.scheduleEntry.deleteMany()],
    ["budgets", () => prisma.monthlyBudget.deleteMany()],
    ["couples", () => prisma.couple.deleteMany()],
    ["events", () => prisma.event.deleteMany()],
    ["users", () => prisma.user.deleteMany()],
  ];

  for (const [name, run] of steps) {
    const { count } = await run();
    console.log(`deleted ${count} ${name}`);
  }

  console.log("✓ All accounts and account data removed.");
}

main()
  .catch((err) => {
    console.error("wipe-accounts failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
