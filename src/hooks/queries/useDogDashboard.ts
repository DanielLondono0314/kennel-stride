import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getAge, parseDateOnly } from "@/lib/age";
import { analyzeWeight, type WeightAnalysis, type WeightPoint, type WeightSettings } from "@/lib/weightTrend";
import {
  parseDogDashboardConfig, type DogDashboardConfig,
} from "@/lib/dogDashboardConfig";
import type { Json } from "@/integrations/supabase/types";

// ── Tipos del panel ──────────────────────────────────────────────────────────

export type PlanState = "active" | "expiring" | "none";
export type StayState = "in_center" | "upcoming" | "none";

export interface DashboardDog {
  id: string;
  name: string;
  breed: string;
  age: string;
  gender: string;
  isNeutered: boolean;
  photoUrl: string | null;
  owner: { id: string; name: string; phone: string | null } | null;
  flags: { aggressive: boolean; allergies: boolean; medication: boolean };
  aggression: { severity: string | null; requiresMuzzle: boolean; noOtherDogs: boolean; handling: string | null } | null;
  behaviorNotes: string | null;
  feeding: {
    foodType: string | null;
    brand: string | null;
    mealsPerDay: number | null;
    portion: string | null;
    instructions: string | null;
  } | null;
  weight: WeightAnalysis;
  plan: {
    state: PlanState;
    name: string | null;
    serviceType: string | null;
    remaining: number;
    total: number;
    expiresAt: string | null;
    daysLeft: number | null;
    /** Otros bonos activos del mismo dueño, además del mostrado. */
    extraCount: number;
  };
  stay: { state: StayState; serviceName: string | null; startDate: string | null; endDate: string | null };
  kennel: string | null;
  allergies: { allergen: string; severity: string | null; type: string }[];
  medications: { name: string; dose: string | null; frequency: string | null; withFood: boolean }[];
  vaccines: { overdue: string[]; dueSoon: string[]; nextDate: string | null };
  lastReport: { date: string; energy: number; appetite: number; overall: number } | null;
}

export interface DashboardData {
  dogs: DashboardDog[];
  /** Pesadas por semana (últimas 12), para la gráfica de actividad de pesaje. */
  weighInsByWeek: { weekStart: string; count: number; dogs: number }[];
  generatedAt: string;
}

// ── Utilidades ───────────────────────────────────────────────────────────────

const PAGE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** PostgREST corta en 1000 filas: pagina hasta traerlas todas. */
async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

const toNum = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const toStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r); else m.set(k, [r]);
  }
  return m;
}

// ── Query ────────────────────────────────────────────────────────────────────

/** Historial que se trae para calcular tendencias y sparklines. */
const WEIGHT_HISTORY_DAYS = 365;

export function useDogDashboard(weightSettings: WeightSettings) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ["dog-dashboard", orgId, weightSettings],
    enabled: !!orgId,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<DashboardData> => {
      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");
      const since = format(subDays(today, WEIGHT_HISTORY_DAYS), "yyyy-MM-dd");
      const horizon = addDays(today, 30).toISOString();

      const [
        dogs, logs, medical, packages, reservations, units, allergies, meds, vaccines, reports,
      ] = await Promise.all([
        fetchAll((f, t) => supabase.from("dogs")
          .select("id, name, breed, birth_date, gender, is_neutered, photo_url, feeding, aggression_details, behavior_notes, is_aggressive, has_allergies, on_medication, customer_id, customers(id, first_name, last_name, phone)")
          .eq("organization_id", orgId!).eq("is_active", true).order("name").range(f, t)),
        fetchAll((f, t) => supabase.from("dog_weight_logs")
          .select("dog_id, recorded_at, weight")
          .eq("organization_id", orgId!).gte("recorded_at", since).order("recorded_at").range(f, t)),
        fetchAll((f, t) => supabase.from("medical_history")
          .select("dog_id, record_date, weight")
          .eq("organization_id", orgId!).not("weight", "is", null).gte("record_date", since).range(f, t)),
        fetchAll((f, t) => supabase.from("packages")
          .select("customer_id, name, service_type, remaining_credits, total_credits, expires_at, status")
          .eq("organization_id", orgId!).eq("status", "active").gt("remaining_credits", 0)
          .gte("expires_at", todayStr).order("expires_at").range(f, t)),
        fetchAll((f, t) => supabase.from("reservations")
          .select("dog_id, status, service_name, start_date, end_date")
          .eq("organization_id", orgId!)
          .or(`status.eq.checked_in,and(status.in.(scheduled,requested),start_date.lte.${horizon},end_date.gte.${today.toISOString()})`)
          .order("start_date").range(f, t)),
        fetchAll((f, t) => supabase.from("facility_units")
          .select("assigned_dog_id, name").eq("organization_id", orgId!).not("assigned_dog_id", "is", null).range(f, t)),
        fetchAll((f, t) => supabase.from("dog_allergies")
          .select("dog_id, allergen, severity, type").eq("organization_id", orgId!).range(f, t)),
        fetchAll((f, t) => supabase.from("dog_medications")
          .select("dog_id, name, dose, frequency, with_food, end_date").eq("organization_id", orgId!).range(f, t)),
        fetchAll((f, t) => supabase.from("vaccination_schedule")
          .select("dog_id, vaccine_name, date_administered, next_dose_date").eq("organization_id", orgId!).range(f, t)),
        fetchAll((f, t) => supabase.from("report_cards")
          .select("dog_id, session_date, energy_level, appetite, overall_score")
          .eq("organization_id", orgId!).gte("session_date", format(subDays(today, 90), "yyyy-MM-dd"))
          .order("session_date", { ascending: false }).range(f, t)),
      ]);

      // Pesos: dog_weight_logs + medical_history, igual que la hoja de pesos.
      const pointsByDog = groupBy<WeightPoint & { dogId: string }>(
        [
          ...logs.map((l) => ({ dogId: l.dog_id, date: l.recorded_at, weight: Number(l.weight) })),
          ...medical.map((m) => ({ dogId: m.dog_id, date: m.record_date, weight: Number(m.weight) })),
        ],
        (p) => p.dogId,
      );
      const pkgsByCustomer = groupBy(packages, (p) => p.customer_id);
      const resByDog = groupBy(reservations, (r) => r.dog_id);
      const unitByDog = new Map(units.map((u) => [u.assigned_dog_id as string, u.name]));
      const allergiesByDog = groupBy(allergies, (a) => a.dog_id);
      const medsByDog = groupBy(
        meds.filter((m) => !m.end_date || m.end_date >= todayStr),
        (m) => m.dog_id,
      );
      const vaxByDog = groupBy(vaccines, (v) => v.dog_id);
      const reportByDog = new Map<string, (typeof reports)[number]>();
      for (const r of reports) if (!reportByDog.has(r.dog_id)) reportByDog.set(r.dog_id, r);

      const result: DashboardDog[] = dogs.map((d) => {
        const feedingRaw = (d.feeding ?? null) as Record<string, unknown> | null;
        const aggr = (d.aggression_details ?? null) as Record<string, unknown> | null;
        const customer = d.customers as { id: string; first_name: string; last_name: string; phone: string | null } | null;

        // Plan activo: el bono vigente que vence primero.
        const pkgs = pkgsByCustomer.get(d.customer_id) ?? [];
        const pkg = pkgs[0];
        const daysLeft = pkg ? differenceInCalendarDays(new Date(pkg.expires_at), today) : null;
        const planState: PlanState = !pkg
          ? "none"
          : (daysLeft !== null && daysLeft <= 7) || pkg.remaining_credits <= 2 ? "expiring" : "active";

        // Estancia: en el centro ahora, o próxima en 30 días.
        const res = resByDog.get(d.id) ?? [];
        const current = res.find((r) => r.status === "checked_in");
        const upcoming = res.find((r) => r.status !== "checked_in");
        const stayRes = current ?? upcoming;

        // Vacunas: la aplicación más reciente de cada vacuna define su próxima dosis.
        const latestByVaccine = new Map<string, (typeof vaccines)[number]>();
        for (const v of vaxByDog.get(d.id) ?? []) {
          const prev = latestByVaccine.get(v.vaccine_name);
          if (!prev || v.date_administered > prev.date_administered) latestByVaccine.set(v.vaccine_name, v);
        }
        const overdue: string[] = [];
        const dueSoon: string[] = [];
        let nextDate: string | null = null;
        for (const v of latestByVaccine.values()) {
          if (!v.next_dose_date) continue;
          const days = differenceInCalendarDays(parseDateOnly(v.next_dose_date), today);
          if (days < 0) overdue.push(v.vaccine_name);
          else {
            if (days <= 30) dueSoon.push(v.vaccine_name);
            if (!nextDate || v.next_dose_date < nextDate) nextDate = v.next_dose_date;
          }
        }

        const rc = reportByDog.get(d.id);
        const portionAmount = toNum(feedingRaw?.portion_amount);

        return {
          id: d.id,
          name: d.name,
          breed: d.breed,
          age: getAge(d.birth_date),
          gender: d.gender,
          isNeutered: d.is_neutered,
          photoUrl: d.photo_url,
          owner: customer
            ? { id: customer.id, name: `${customer.first_name} ${customer.last_name}`.trim(), phone: customer.phone }
            : null,
          flags: { aggressive: d.is_aggressive, allergies: d.has_allergies, medication: d.on_medication },
          aggression: d.is_aggressive && aggr
            ? {
                severity: toStr(aggr.severity),
                requiresMuzzle: aggr.requires_muzzle === true,
                noOtherDogs: aggr.no_other_dogs === true,
                handling: toStr(aggr.handling),
              }
            : null,
          behaviorNotes: d.behavior_notes,
          feeding: feedingRaw
            ? {
                foodType: toStr(feedingRaw.food_type),
                brand: toStr(feedingRaw.brand),
                mealsPerDay: toNum(feedingRaw.meals_per_day),
                portion: portionAmount !== null ? `${portionAmount} ${toStr(feedingRaw.portion_unit) ?? ""}`.trim() : null,
                instructions: toStr(feedingRaw.instructions),
              }
            : null,
          weight: analyzeWeight(pointsByDog.get(d.id) ?? [], weightSettings, today),
          plan: {
            state: planState,
            name: pkg?.name ?? null,
            serviceType: pkg?.service_type ?? null,
            remaining: pkg?.remaining_credits ?? 0,
            total: pkg?.total_credits ?? 0,
            expiresAt: pkg?.expires_at ?? null,
            daysLeft,
            extraCount: Math.max(0, pkgs.length - 1),
          },
          stay: {
            state: current ? "in_center" : upcoming ? "upcoming" : "none",
            serviceName: stayRes?.service_name ?? null,
            startDate: stayRes?.start_date ?? null,
            endDate: stayRes?.end_date ?? null,
          },
          kennel: unitByDog.get(d.id) ?? null,
          allergies: (allergiesByDog.get(d.id) ?? []).map((a) => ({ allergen: a.allergen, severity: a.severity, type: a.type })),
          medications: (medsByDog.get(d.id) ?? []).map((m) => ({ name: m.name, dose: m.dose, frequency: m.frequency, withFood: m.with_food })),
          vaccines: { overdue, dueSoon, nextDate },
          lastReport: rc
            ? { date: rc.session_date, energy: rc.energy_level, appetite: rc.appetite, overall: rc.overall_score }
            : null,
        };
      });

      // Actividad de pesaje: últimas 12 semanas (lunes a domingo), solo perros activos.
      const activeIds = new Set(result.map((d) => d.id));
      const weeks: DashboardData["weighInsByWeek"] = [];
      const monday = subDays(today, (today.getDay() + 6) % 7);
      for (let i = 11; i >= 0; i--) {
        const start = subDays(monday, i * 7);
        weeks.push({ weekStart: format(start, "yyyy-MM-dd"), count: 0, dogs: 0 });
      }
      const dogsPerWeek = weeks.map(() => new Set<string>());
      for (const l of logs) {
        if (!activeIds.has(l.dog_id)) continue;
        const idx = Math.floor(differenceInCalendarDays(parseDateOnly(l.recorded_at), parseDateOnly(weeks[0].weekStart)) / 7);
        if (idx < 0 || idx >= weeks.length) continue;
        weeks[idx].count++;
        dogsPerWeek[idx].add(l.dog_id);
      }
      weeks.forEach((w, i) => { w.dogs = dogsPerWeek[i].size; });

      return { dogs: result, weighInsByWeek: weeks, generatedAt: today.toISOString() };
    },
  });
}

// ── Configuración por organización ───────────────────────────────────────────

export function useDogDashboardConfig() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ["dog-dashboard-config", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DogDashboardConfig> => {
      const { data, error } = await supabase
        .from("organizations").select("dog_dashboard_config").eq("id", orgId!).single();
      if (error) throw error;
      return parseDogDashboardConfig(data?.dog_dashboard_config);
    },
  });
}

export function useSaveDogDashboardConfig() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (config: DogDashboardConfig) => {
      const { error } = await supabase
        .from("organizations")
        .update({ dog_dashboard_config: config as unknown as Json })
        .eq("id", organization!.id);
      if (error) throw error;
    },
    onSuccess: (_, config) => {
      queryClient.setQueryData(["dog-dashboard-config", organization?.id], config);
    },
  });
}
