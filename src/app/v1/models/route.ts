import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const models = await db.model.findMany({
      where: { isActive: true, provider: { isEnabled: true } },
      include: { provider: { select: { slug: true, name: true } } },
      orderBy: { slug: "asc" },
    });
    return NextResponse.json({
      object: "list",
      data: models.map((model) => ({
        id: model.slug,
        object: "model",
        created: Math.floor(model.createdAt.getTime() / 1000),
        owned_by: model.provider.slug,
        name: model.displayName,
        context_length: model.contextLength,
        pricing: {
          input_usd_per_million: Number(model.inputMicrosPerMillion) / 1_000_000,
          output_usd_per_million: Number(model.outputMicrosPerMillion) / 1_000_000,
          cached_input_usd_per_million: model.cachedInputMicrosPerMillion === null ? null : Number(model.cachedInputMicrosPerMillion) / 1_000_000,
        },
      })),
    }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ error: { message: "The model catalog is temporarily unavailable.", type: "api_error", code: "catalog_unavailable" } }, { status: 503 });
  }
}
