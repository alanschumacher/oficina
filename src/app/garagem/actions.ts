"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const vehicleSchema = z.object({
  plate: z.string().min(7).max(10).transform((s) => s.toUpperCase().trim()),
  brand: z.string().min(2),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1950).max(2035),
  engine: z.string().optional(),
  current_km: z.coerce.number().int().min(0),
});

export async function addVehicle(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const parsed = vehicleSchema.parse({
    plate: formData.get("plate"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    year: formData.get("year"),
    engine: formData.get("engine") || undefined,
    current_km: formData.get("current_km"),
  });

  const { error } = await supabase.from("vehicles").insert({
    owner_id: user.id,
    ...parsed,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/garagem");
  revalidatePath("/agendar");
  revalidatePath("/loja");
}
