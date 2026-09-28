import { supabase } from "@/integrations/supabase/client";

/**
 * Guarda un perro (crear o editar) junto con sus alergias y medicación en una
 * sola transacción vía el RPC `save_dog` (QA E-20). Recibe lo que entrega
 * `DogModal.onSave`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveDog(data: any, { organizationId, create }: { organizationId: string; create: boolean }) {
  const dog = {
    id: data.id,
    organization_id: organizationId,
    customer_id: data.customer_id,
    name: data.name,
    breed: data.breed,
    birth_date: data.birth_date || null,
    weight: data.weight ? parseFloat(data.weight) : null,
    color: data.color || null,
    gender: data.gender,
    is_neutered: !!data.is_neutered,
    is_aggressive: !!data.is_aggressive,
    has_allergies: !!data.has_allergies,
    on_medication: !!data.on_medication,
    microchip_number: data.microchip_number || null,
    preferred_unit_id: data.preferred_unit_id || null,
    notes: data.notes || "",
    behavior_notes: data.behavior_notes || "",
    medical_notes: data.medical_notes || "",
    photo_url: data.photo_url ?? null,
    aggression_details: data.is_aggressive ? data.aggression_details ?? null : null,
    feeding: data.feeding ?? null,
  };

  const { data: id, error } = await supabase.rpc("save_dog" as never, {
    p_dog: dog,
    p_allergies: data.has_allergies ? data.allergies ?? [] : [],
    p_medications: data.on_medication ? data.medications ?? [] : [],
    p_create: create,
  } as never);
  if (error) throw error;
  return id as unknown as string;
}
