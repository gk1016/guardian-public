import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { canManageAdministration } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  try {
    const res = await fetch("https://api.fleetyards.net/v1/models?per_page=240");
    if (!res.ok) {
      return NextResponse.json(
        { error: `Fleetyards API returned ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const ships = data.items ?? [];

    let upserted = 0;
    for (const ship of ships) {
      const crew = ship.crew ?? {};
      const crewMin = crew.min ?? 1;
      const crewMax = crew.max ?? 1;
      const imageUrl =
        ship.media?.angledView?.smallUrl ??
        ship.media?.storeImage?.smallUrl ??
        null;

      await prisma.$executeRaw`
        INSERT INTO "ShipSpec" (
          id, "fleetyardsSlug", "scIdentifier", name, manufacturer,
          classification, focus, "sizeCategory", "crewMin", "crewMax",
          cargo, "imageUrl", "inGame", "rawData", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid()::text, ${ship.slug}, ${ship.scIdentifier ?? null},
          ${ship.name}, ${ship.manufacturer?.name ?? "Unknown"},
          ${ship.classification ?? "unknown"}, ${ship.focus ?? null},
          ${ship.size ?? ship.sizeLabel ?? null},
          ${crewMin}, ${crewMax}, ${ship.cargo ?? 0},
          ${imageUrl}, ${ship.inGame ?? false},
          ${JSON.stringify(ship)}::jsonb,
          NOW(), NOW()
        )
        ON CONFLICT ("fleetyardsSlug") DO UPDATE SET
          "scIdentifier" = EXCLUDED."scIdentifier",
          name = EXCLUDED.name,
          manufacturer = EXCLUDED.manufacturer,
          classification = EXCLUDED.classification,
          focus = EXCLUDED.focus,
          "sizeCategory" = EXCLUDED."sizeCategory",
          "crewMin" = EXCLUDED."crewMin",
          "crewMax" = EXCLUDED."crewMax",
          cargo = EXCLUDED.cargo,
          "imageUrl" = EXCLUDED."imageUrl",
          "inGame" = EXCLUDED."inGame",
          "rawData" = EXCLUDED."rawData",
          "updatedAt" = NOW()
      `;
      upserted++;
    }

    return NextResponse.json({
      ok: true,
      synced: upserted,
      source: "fleetyards.net",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
