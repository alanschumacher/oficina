import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Webhook idempotente para confirmação de pagamentos (Mercado Pago / Stripe).
 * - Valida assinatura HMAC (x-signature)
 * - Registra event_id em payment_webhook_events para evitar processamento duplicado
 * - Atualiza orders.status para 'paid'
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") || request.headers.get("stripe-signature");
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  if (secret && signature) {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!signature.includes(expected) && !signature.startsWith("t=")) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const eventId = String(payload.id ?? payload.data?.id ?? "");
  const orderId = String(payload.external_reference ?? payload.data?.object?.metadata?.order_id ?? "");
  const provider = request.headers.get("stripe-signature") ? "stripe" : "mercadopago";

  if (!eventId || !orderId) {
    return NextResponse.json({ ignored: true }, { status: 200 });
  }

  const supabase = createServiceRoleClient();

  // Garante idempotência via PK event_id
  const { error: idempotencyErr } = await supabase
    .from("payment_webhook_events")
    .insert({ event_id: eventId, provider, payload });

  if (idempotencyErr?.code === "23505") {
    return NextResponse.json({ status: "already_processed" }, { status: 200 });
  }

  await supabase
    .from("orders")
    .update({
      status: "paid",
      payment_provider: provider,
      payment_reference: eventId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  return NextResponse.json({ ok: true, orderId }, { status: 200 });
}
