import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Reservation, ReservationStatus, ServiceType } from "@/types";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface DbReservationRow {
  id: string;
  customer_id: string;
  dog_id: string;
  staff_id: string | null;
  location_id: string | null;
  service_type: string;
  service_name: string;
  status: string;
  start_date: string;
  end_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total_price: number;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  customers: {
    id: string; first_name: string; last_name: string;
    phone: string; email: string; city: string | null;
    state: string | null; balance: number;
  } | null;
  dogs: {
    id: string; name: string; breed: string; weight: number | null;
    gender: string; color: string | null;
    behavior_notes: string | null; medical_notes: string | null;
  } | null;
  staff_members: { id: string; first_name: string; last_name: string; } | null;
}

export function mapDbToReservation(row: DbReservationRow): Reservation {
  return {
    id: row.id,
    customer: {
      id: row.customer_id,
      firstName: row.customers?.first_name ?? "",
      lastName: row.customers?.last_name ?? "",
      phone: row.customers?.phone ?? "",
      email: row.customers?.email ?? "",
      address: undefined,
      city: row.customers?.city ?? undefined,
      state: row.customers?.state ?? undefined,
      balance: row.customers?.balance ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    dog: {
      id: row.dog_id,
      customerId: row.customer_id,
      name: row.dogs?.name ?? "",
      breed: row.dogs?.breed ?? "",
      gender: (row.dogs?.gender as "male" | "female") ?? "male",
      weight: row.dogs?.weight ?? 0,
      isNeutered: false,
      flags: [],
      vaccinations: [],
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    service: {
      id: `svc-${row.service_type}`,
      name: row.service_name,
      type: row.service_type as ServiceType,
      description: "",
      price: row.total_price,
      duration: 60,
      isActive: true,
      requiredVaccinations: [],
      requiredDocuments: [],
    },
    location: undefined,
    status: row.status as ReservationStatus,
    startDate: new Date(row.start_date),
    endDate: new Date(row.end_date),
    checkInTime: row.check_in_time ? new Date(row.check_in_time) : undefined,
    checkOutTime: row.check_out_time ? new Date(row.check_out_time) : undefined,
    staffId: row.staff_id ?? undefined,
    customerId: row.customer_id,
    dogId: row.dog_id,
    serviceId: `svc-${row.service_type}`,
    usePackageCredits: false,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    staff: row.staff_members
      ? {
          id: row.staff_members.id,
          firstName: row.staff_members.first_name,
          lastName: row.staff_members.last_name,
          email: "",
          role: "trainer" as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      : undefined,
    notes: row.notes ?? undefined,
    totalPrice: row.total_price,
    addOns: [],
  };
}

const RESERVATION_SELECT = `
  *,
  customers(id, first_name, last_name, phone, email, city, state, balance),
  dogs(id, name, breed, weight, gender, color, behavior_notes, medical_notes),
  staff_members(id, first_name, last_name)
`;

// Default window prevents loading years of history on first render.
// Callers can override with explicit fromDate/toDate when they need a wider range.
const DEFAULT_WINDOW_DAYS = 30;

interface UseReservationsOptions {
  date?: Date;
  status?: ReservationStatus | ReservationStatus[];
  autoRefresh?: boolean;
  /** Override the default ±30-day window. Pass null to fetch all records (use with care). */
  fromDate?: Date | null;
  toDate?: Date | null;
}

export function useReservations(options: UseReservationsOptions = {}) {
  const { organization } = useOrganization();
  const [rows, setRows] = useState<DbReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stabilize option deps so callers passing inline arrays don't trigger refetch loops
  const dateKey = options.date?.toDateString();
  const fromKey = options.fromDate?.toDateString();
  const toKey   = options.toDate?.toDateString();
  const statusKey = useMemo(
    () => (Array.isArray(options.status) ? [...options.status].sort().join(",") : options.status ?? ""),
    [Array.isArray(options.status) ? options.status.join(",") : options.status]
  );

  const fetch = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    let query = supabase
      .from("reservations")
      .select(RESERVATION_SELECT)
      .eq("organization_id", organization.id)
      .order("start_date", { ascending: true });

    if (options.date) {
      // Single-day view
      const d = options.date;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
      query = query.gte("start_date", dayStart).lt("start_date", dayEnd);
    } else if (options.fromDate !== null || options.toDate !== null) {
      // Explicit range provided by caller
      if (options.fromDate) query = query.gte("start_date", options.fromDate.toISOString());
      if (options.toDate)   query = query.lte("start_date", options.toDate.toISOString());
    } else if (options.fromDate !== null && options.toDate !== null) {
      // Default ±30-day window to prevent loading all historical data
      const now = new Date();
      const from = new Date(now); from.setDate(from.getDate() - DEFAULT_WINDOW_DAYS);
      const to   = new Date(now); to.setDate(to.getDate() + DEFAULT_WINDOW_DAYS);
      query = query.gte("start_date", from.toISOString()).lte("start_date", to.toISOString());
    }

    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      query = query.in("status", statuses);
    }

    const { data, error } = await query;
    if (error) setError(error.message);
    else setRows((data ?? []) as DbReservationRow[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, dateKey, fromKey, toKey, statusKey]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!options.autoRefresh || !organization) return;
    const channel = supabase
      .channel(`reservations-${organization.id}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `organization_id=eq.${organization.id}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetch, options.autoRefresh, organization?.id]);

  const reservations = useMemo(() => rows.map(mapDbToReservation), [rows]);

  const updateStatus = async (id: string, status: ReservationStatus, extra?: Record<string, unknown>) => {
    const { error } = await supabase
      .from("reservations")
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq("id", id);
    if (!error) fetch();
    return { error };
  };

  const checkIn  = (id: string) => updateStatus(id, ReservationStatus.CHECKED_IN, { check_in_time: new Date().toISOString() });
  const checkOut = (id: string) => updateStatus(id, ReservationStatus.COMPLETED, { check_out_time: new Date().toISOString() });
  const approve  = (id: string) => updateStatus(id, ReservationStatus.SCHEDULED);
  const cancel   = (id: string, reason?: string) => updateStatus(id, ReservationStatus.CANCELLED, reason ? { rejection_reason: reason } : {});

  return { reservations, rows, loading, error, refetch: fetch, updateStatus, checkIn, checkOut, approve, cancel };
}

export async function fetchReservationsRange(
  start: Date,
  end: Date,
  organizationId: string
): Promise<DbReservationRow[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("organization_id", organizationId)
    .gte("start_date", start.toISOString())
    .lte("end_date", end.toISOString())
    .order("start_date", { ascending: true });

  if (error) return [];
  return (data ?? []) as DbReservationRow[];
}
