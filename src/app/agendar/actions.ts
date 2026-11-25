"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bookingSchema = z.object({
  vehicle_id: z.string().uuid(),
  service_id: z.string().uuid(),
  bay_id: z.string().uuid(),
  technician_id: z.string().uuid(),
  type: z.enum(["preventive", "corrective", "installation"]),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  symptom_notes: z.string().max(1000).optional(),
});

export async function createAppointment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = bookingSchema.parse({
    vehicle_id: formData.get("vehicle_id"),
    service_id: formData.get("service_id"),
    bay_id: formData.get("bay_id"),
    technician_id: formData.get("technician_id"),
    type: formData.get("type"),
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at"),
    symptom_notes: formData.get("symptom_notes") || undefined,
  });

  // Upload opcional de foto do sintoma para o bucket privado service-evidences
  let evidencePath: string | null = null;
  const file = formData.get("evidence_file") as File | null;
  if (file && file.size > 0) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("service-evidences")
      .upload(path, file, { upsert: false });
    if (!uploadErr) evidencePath = path;
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      owner_id: user.id,
      ...parsed,
      evidence_path: evidencePath,
      status: "confirmed",
    })
    .select("id, vehicle_id, technician_id")
    .single();

  if (error) {
    // Código 23P01 = violação da constraint GiST (outro cliente reservou no mesmo milissegundo)
    const msg =
      error.code === "23P01"
        ? "Este horário acabou de ser reservado. Escolha outro slot disponível."
        : error.message;
    redirect(`/agendar?error=${encodeURIComponent(msg)}`);
  }

  // Abre automaticamente a Ordem de Serviço vinculada
  await supabase.from("service_orders").insert({
    appointment_id: appointment.id,
    owner_id: user.id,
    vehicle_id: appointment.vehicle_id,
    technician_id: appointment.technician_id,
    status: "open",
  });

  revalidatePath("/garagem");
  revalidatePath("/admin");
  redirect("/garagem");
}
