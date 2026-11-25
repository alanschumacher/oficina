"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const checkoutSchema = z.object({
  part_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(20),
  fulfillment_mode: z.enum(["delivery", "pickup", "install_at_shop"]),
});

export async function quickBuyPart(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/loja");

  const parsed = checkoutSchema.parse({
    part_id: formData.get("part_id"),
    quantity: formData.get("quantity") ?? 1,
    fulfillment_mode: formData.get("fulfillment_mode") ?? "delivery",
  });

  const shippingCents = parsed.fulfillment_mode === "delivery" ? 2990 : 0;

  // Executa reserva atômica de estoque + criação do pedido via RPC transacional
  const { data: orderId, error } = await supabase.rpc("reserve_and_create_order", {
    p_owner_id: user.id,
    p_fulfillment_mode: parsed.fulfillment_mode,
    p_items: [{ part_id: parsed.part_id, quantity: parsed.quantity }],
    p_shipping_cents: shippingCents,
  });

  if (error) {
    redirect(`/loja?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/loja");
  revalidatePath("/garagem");

  if (parsed.fulfillment_mode === "install_at_shop") {
    redirect(`/agendar?order_id=${orderId}`);
  }
  redirect(`/garagem?order_created=${orderId}`);
}
