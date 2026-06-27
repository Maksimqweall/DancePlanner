import { scrapeAthleteProfile } from "./src/lib/wdsfScraper";
import { combinedTypeFor } from "./src/lib/wdsfRanking";

async function main() {
  const uuid = "1250660e-2f22-4508-bc6d-9e1401280706";
  const profile = await scrapeAthleteProfile(`https://www.worlddancesport.org/Athletes/x-${uuid}`);
  console.log(`total competitions: ${profile.competitions.length}`);
  for (const c of profile.competitions.slice(0, 8)) {
    console.log("—".repeat(60));
    console.log(`date='${c.date}' event='${c.event}' location='${c.location}'`);
    console.log(`discipline='${c.discipline}' category='${c.category}' place='${c.place}'`);
    console.log(`url=${c.competitionUrl}`);
    console.log(`combinedTypeFor(cat,disc) = ${combinedTypeFor(c.category, c.discipline)}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
