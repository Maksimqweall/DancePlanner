import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/prisma";

async function main() {
  const email = "dev@danceplanner.test";
  const passwordHash = await bcrypt.hash("password123", 10);

  // Idempotent dev user.
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, firstName: "Dev", lastName: "Dancer" },
  });

  // Start clean for this user so the seed is repeatable.
  await prisma.expense.deleteMany({ where: { userId: user.id } });
  await prisma.event.deleteMany({ where: { ownerId: user.id } });

  const now = new Date();
  const thisMonth = (day: number) => new Date(now.getFullYear(), now.getMonth(), day);
  const inMonths = (n: number, day: number) =>
    new Date(now.getFullYear(), now.getMonth() + n, day);

  // --- Some PAID expenses for the current month (dashboard "spent so far") ---
  await prisma.expense.createMany({
    data: [
      { userId: user.id, title: "Coach lesson", category: "INDIVIDUAL", amount: 70, date: thisMonth(3), status: "PAID" },
      { userId: user.id, title: "Group class", category: "GROUP", amount: 25, date: thisMonth(5), status: "PAID" },
      { userId: user.id, title: "Hall rent", category: "HALL_RENT", amount: 40, date: thisMonth(8), status: "PAID" },
      { userId: user.id, title: "New dress fitting", category: "COSTUME", amount: 180, date: thisMonth(10), status: "PAID" },
    ],
  });

  // --- Upcoming TOURNAMENT project (2 months ahead) with budget + checklist ---
  const tournament = await prisma.event.create({
    data: {
      ownerId: user.id,
      title: "Vienna Open Championship",
      type: "TOURNAMENT",
      date: inMonths(2, 12),
      endDate: inMonths(2, 14),
      location: "Vienna, Austria",
      budget: 1200,
      hotelName: "Hotel Wien Mitte",
      hotelAddress: "Landstrasser Hauptstrasse 1, Vienna",
      checkIn: inMonths(2, 11),
      checkOut: inMonths(2, 14),
      checklist: {
        create: [
          { text: "Book flights", isDone: true },
          { text: "Pay start fee", isDone: false },
          { text: "Pack competition shoes", isDone: false },
          { text: "Print hotel booking", isDone: false },
        ],
      },
      expenses: {
        create: [
          { userId: user.id, title: "Flights", category: "FLIGHT", amount: 320, date: inMonths(2, 11), status: "PLANNED" },
          { userId: user.id, title: "Start fee", category: "START_FEE", amount: 90, date: inMonths(2, 12), status: "PLANNED" },
        ],
      },
    },
  });

  // --- Upcoming CAMP project in the SAME month with budget 600 ---
  await prisma.event.create({
    data: {
      ownerId: user.id,
      title: "Spring Training Camp",
      type: "CAMP",
      date: inMonths(2, 20),
      endDate: inMonths(2, 23),
      location: "Munich, Germany",
      budget: 600,
      checklist: {
        create: [
          { text: "Confirm coach availability", isDone: false },
          { text: "Arrange transport", isDone: false },
        ],
      },
    },
  });

  console.log("Seed complete.");
  console.log(`  Dev user: ${email} / password123`);
  console.log(`  Tournament project id: ${tournament.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
