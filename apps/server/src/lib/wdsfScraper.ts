import { load } from "cheerio";

const WDSF_BASE = "https://www.worlddancesport.org";

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

export interface WdsfCompetition {
  date: string;
  event: string;
  location: string;
  discipline: string;
  category: string;
  place: string | null;
  points: string | null;
}

export interface WdsfPartner {
  name: string;
  nationality: string | null;
  represents: string | null;
  status: "current" | "former";
  since: string | null;
  until: string | null;
  profileUrl: string | null;
}

export interface WdsfProfile {
  uuid: string;
  profileUrl: string;
  // General section — all fields
  firstName: string;
  lastName: string;
  name: string;           // firstName + lastName
  nationality: string;    // personal nationality
  represents: string;     // competing country
  min: string;
  ageGroup: string | null;
  licenseDivision: string | null;
  licenseStatus: string | null;
  licenseExpiry: string | null;
  photoUrl: string;
  // Relations
  competitions: WdsfCompetition[];
  partners: WdsfPartner[];
  fetchedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function extractUuid(url: string): string | null {
  const m = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m?.[1] ?? null;
}

export function buildPhotoUrl(uuid: string): string {
  return `${WDSF_BASE}/api/picture/person/${uuid}?useAlternate=False`;
}

// ─── Main scraper ────────────────────────────────────────────────────────────

export async function scrapeAthleteProfile(profileUrl: string): Promise<WdsfProfile> {
  const uuid = extractUuid(profileUrl);
  if (!uuid) throw new Error("Invalid WDSF profile URL — no UUID found");

  const res = await fetch(profileUrl, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`WDSF fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  const $ = load(html);

  // ── Generic label→value lookup ────────────────────────────────────────────
  // Handles: <th>Label</th><td>Value</td>, <dt>/<dd>, and plain-text "Label: Value"

  function findValue(labels: string[]): string | null {
    const bodyText = $("body").text();
    for (const label of labels) {
      // Pattern 1: th/td or dt/dd
      const cell = $("th, td, dt, strong, b, label, span").filter((_, el) => {
        const t = $(el).text().trim().replace(/[:\s]+$/, "");
        return t.toLowerCase() === label.toLowerCase();
      }).first();

      if (cell.length) {
        // Next sibling td/dd
        const next = cell.next("td, dd");
        if (next.length && next.text().trim()) return next.text().trim();
        // Next sibling in same row
        const rowSib = cell.parent("tr").find("td").not(cell).first();
        if (rowSib.length && rowSib.text().trim()) return rowSib.text().trim();
      }

      // Pattern 2: plain text "Label: Value" (handles colon + whitespace)
      const re = new RegExp(
        label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[:\\(]?\\s*([^\\n]{1,100})",
        "i"
      );
      const m = bodyText.match(re);
      if (m?.[1]?.trim()) return m[1].split(/[\n\r]/)[0].trim();
    }
    return null;
  }

  // ── General section ───────────────────────────────────────────────────────

  const firstName = findValue(["Name", "First name", "Firstname"]) ?? "";
  const lastName  = findValue(["Surname", "Last name", "Lastname"])  ?? "";

  // h1 often has "FirstName LastName"
  const h1Name = $("h1").first().text().trim();
  const name   = h1Name || [firstName, lastName].filter(Boolean).join(" ")
    || $("title").text().replace(/\s*[-|].*$/, "").trim();

  const min           = findValue(["Member Id number", "Member Id Number (MIN)", "MIN", "Member ID"]) ?? "";
  const nationality   = findValue(["Nationality"])           ?? "";
  const represents    = findValue(["Represents", "Country"]) ?? "";
  const ageGroup      = findValue(["Current age group", "Age group", "Age Group"]);
  const licenseDivision = findValue(["Division"]);

  // License status & expiry — WDSF shows them as separate rows under "Licenses"
  // "Status" row and "Expiration date" row
  const licenseStatus = findValue(["Status"]);
  const licenseExpiry = findValue(["Expiration date", "Expiry date", "Expiration", "Valid until"]);

  // ── Competition results ────────────────────────────────────────────────────

  const competitions: WdsfCompetition[] = [];

  $("table").each((_, table) => {
    const $t = $(table);
    const headers = $t.find("thead th, thead td").map((_, el) =>
      $(el).text().trim().toLowerCase()
    ).get();

    const isCompTable = headers.length >= 2 && headers.some(h =>
      h.includes("date") || h.includes("event") || h.includes("competition") || h.includes("rank")
    );
    if (!isCompTable) return;

    $t.find("tbody tr").each((_, row) => {
      const cells = $(row).find("td").map((_, td) => $(td).text().trim()).get();
      if (cells.length < 2) return;

      const idx = (keywords: string[]) =>
        headers.findIndex(h => keywords.some(k => h.includes(k)));

      competitions.push({
        date:       cellAt(cells, idx(["date"]),                    cells[0]),
        event:      cellAt(cells, idx(["event", "competition", "tournament"]), cells[1]),
        location:   cellAt(cells, idx(["location", "city", "venue", "place"]), ""),
        discipline: cellAt(cells, idx(["discipline", "dance", "style"]),       ""),
        category:   cellAt(cells, idx(["category", "age group"]),              ""),
        place:      cells[idx(["rank", "place", "result", "position"])] || null,
        points:     cells[idx(["point", "score"])]                    || null,
      });
    });
  });

  // ── Partners ───────────────────────────────────────────────────────────────
  // Strategy: look for tables where a column header is "partner", "couple", "since", "status".
  // Also collect all /Athletes/ links that are NOT this athlete's own UUID.

  const partners: WdsfPartner[] = [];
  const seenPartnerUuids = new Set<string>();

  $("table").each((_, table) => {
    const $t = $(table);
    const headers = $t.find("thead th, thead td").map((_, el) =>
      $(el).text().trim().toLowerCase()
    ).get();

    // Identify partner table
    const isPartnerTable = headers.some(h =>
      h === "partner" || h === "athlete" || h === "since" ||
      h.includes("partner") || h.includes("couple")
    );
    if (!isPartnerTable) return;

    $t.find("tbody tr").each((_, row) => {
      const $row = $(row);
      const cells = $row.find("td").map((_, td) => $(td).text().trim()).get();
      if (cells.length < 2) return;

      const idx = (keywords: string[]) =>
        headers.findIndex(h => keywords.some(k => h.includes(k)));

      // Partner name — look for the /Athletes/ link in this row that isn't ourselves
      let partnerName = "";
      let partnerHref: string | null = null;
      $row.find('a[href*="/Athletes/"]').each((_, a) => {
        const href = $(a).attr("href") ?? "";
        const pUuid = extractUuid(href);
        if (pUuid && pUuid !== uuid) {
          partnerName = $(a).text().trim();
          partnerHref = href.startsWith("http") ? href : `${WDSF_BASE}${href}`;
        }
      });
      if (!partnerName) partnerName = cells[idx(["partner", "athlete", "name"])] ?? cells[0] ?? "";

      const partnerUuid = partnerHref ? extractUuid(partnerHref) : null;
      if (partnerUuid && seenPartnerUuids.has(partnerUuid)) return; // dedupe
      if (partnerUuid) seenPartnerUuids.add(partnerUuid);

      const nationalityI = idx(["nationality", "nation"]);
      const representsI  = idx(["represent", "country"]);
      const statusI      = idx(["status"]);
      const sinceI       = idx(["since", "from", "start"]);
      const untilI       = idx(["until", "to", "end", "retired"]);

      const statusText = cells[statusI] ?? "";
      const isCurrent  = statusText.toLowerCase().includes("active");

      partners.push({
        name:       partnerName,
        nationality: nationalityI >= 0 ? (cells[nationalityI] || null) : null,
        represents:  representsI  >= 0 ? (cells[representsI]  || null) : null,
        status:     isCurrent ? "current" : "former",
        since:      sinceI >= 0  ? (cells[sinceI]  || null) : null,
        until:      untilI >= 0  ? (cells[untilI]  || null) : null,
        profileUrl: partnerHref,
      });
    });
  });

  // Fallback: scan all /Athletes/ links not belonging to self
  if (partners.length === 0) {
    $('a[href*="/Athletes/"]').each((_, a) => {
      const href = $(a).attr("href") ?? "";
      const pUuid = extractUuid(href);
      if (!pUuid || pUuid === uuid || seenPartnerUuids.has(pUuid)) return;
      seenPartnerUuids.add(pUuid);

      const name = $(a).text().trim();
      if (!name) return;

      // Look for status text near this link
      const parentText = $(a).closest("tr, li, div").text().toLowerCase();
      const isCurrent  = parentText.includes("active") && !parentText.includes("retired");

      const dateMatches = parentText.match(/\d{2}\/\d{2}\/\d{4}/g) ?? [];

      partners.push({
        name,
        nationality: null,
        represents:  null,
        status:      isCurrent ? "current" : "former",
        since:       dateMatches[0] ?? null,
        until:       dateMatches[1] ?? null,
        profileUrl:  href.startsWith("http") ? href : `${WDSF_BASE}${href}`,
      });
    });
  }

  return {
    uuid,
    profileUrl,
    firstName:       firstName || name.split(" ")[0] || "",
    lastName:        lastName  || name.split(" ").slice(1).join(" ") || "",
    name,
    nationality,
    represents,
    min,
    ageGroup:        ageGroup        ?? null,
    licenseDivision: licenseDivision ?? null,
    licenseStatus:   licenseStatus   ?? null,
    licenseExpiry:   licenseExpiry   ?? null,
    photoUrl:        buildPhotoUrl(uuid),
    competitions:    competitions.slice(0, 100),
    partners,
    fetchedAt:       new Date().toISOString(),
  };
}

function cellAt(cells: string[], idx: number, fallback: string): string {
  return idx >= 0 ? (cells[idx] ?? fallback) : fallback;
}

// ─── MIN → UUID via sitemap search ───────────────────────────────────────────

export async function findAthleteUrlByName(
  firstName: string,
  lastName: string
): Promise<string | null> {
  for (let i = 1; i <= 9; i++) {
    try {
      const res = await fetch(`${WDSF_BASE}/sitemapAthlete-${i}.xml`, { headers: FETCH_HEADERS });
      if (!res.ok) continue;
      const xml = await res.text();

      const re = new RegExp(
        `https://www\\.worlddancesport\\.org/Athletes/${escapeRegex(firstName)}-${escapeRegex(lastName)}-([0-9a-f-]{36})`,
        "i"
      );
      const m = xml.match(re);
      if (m) return m[0];
    } catch {
      // skip
    }
  }
  return null;
}

export async function verifyAndScrape(
  profileUrl: string,
  expectedMin: string
): Promise<WdsfProfile> {
  const profile = await scrapeAthleteProfile(profileUrl);
  if (profile.min && profile.min !== expectedMin) {
    throw new Error(
      `MIN mismatch: expected ${expectedMin}, got ${profile.min}.`
    );
  }
  return profile;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
