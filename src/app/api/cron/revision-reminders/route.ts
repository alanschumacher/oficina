import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Executado diariamente via Vercel Cron (vercel.json) para identificar veículos
 * com revisão preventiva prevista nos próximos 14 dias.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const limitDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  const { data: dueVehicles, error } = await supabase
    .from("vehicles")
    .select("id, plate, brand, model, next_revision_date, profiles(full_name, phone)")
    .lte("next_revision_date", limitDate);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    remindersQueued: dueVehicles?.length ?? 0,
  });
}
