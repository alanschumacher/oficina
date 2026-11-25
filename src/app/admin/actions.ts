"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateServiceOrderStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("service_order_id"));
  const status = String(formData.get("status"));
  const diagnosis = String(formData.get("diagnosis_summary") ?? "");

  const { error } = await supabase
    .from("service_orders")
    .update({
      status,
      diagnosis_summary: diagnosis || undefined,
      completed_at: status === "delivered" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/garagem");
}
