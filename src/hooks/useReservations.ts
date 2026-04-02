import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Reservation, ReservationStatus, ServiceType } from "@/types";

// Raw row returned by Supabase with joined tables
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
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    city: string | null;
    state: string | null;
    balance: number;
  } | null;
  dogs: {
    id: string;
    name: string;
    breed: string;
    weight: number | null;
    gender: string;
    color: string | null;
    behavior_notes: string | null;
    medical_notes: string | null;
  } | null;
  staff_members: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

// Maps a DB row to the frontend Reservation type (for use in existing components)
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
          isActive: true,
          createdAt: new Date(),
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

interface UseReservationsOptions {
  date?: Date; // filter by this calendar date (start_date = same day)
  status?: ReservationStatus | ReservationStatus[];
  autoRefresh?: boolean;
}

export function useReservations(options: UseReservationsOptions = {}) {
  const [rows, setRows] = useState<DbReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("reservations")
      .select(RESERVATION_SELECT)
      .order("start_date", { ascending: true });

    if (options.date) {
      const d = options.date;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
      query = query.gte("start_date", dayStart).lt("start_date", dayEnd);
    }

    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      query = query.in("status", statuses);
    }

    const { data, error } = await query;
    if (error) {
      setError(error.message);
    } else {
      setRows((data ?? []) as DbReservationRow[]);
    }
    setLoading(false);
  }, [options.date?.toDateString(), JSON.stringify(options.status)]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Real-time subscription
  useEffect(() => {
    if (!options.autoRefresh) return;
    const channel = supabase
      .channel("reservations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        fetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetch, options.autoRefresh]);

  const reservations = rows.map(mapDbToReservation);

  // Status update helpers
  const updateStatus = async (id: string, status: ReservationStatus, extra?: Record<string, unknown>) => {
    const { error } = await supabase
      .from("reservations")
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq("id", id);
    if (!error) fetch();
    return { error };
  };

  const checkIn = (id: string) =>
    updateStatus(id, ReservationStatus.CHECKED_IN, { check_in_time: new Date().toISOString() });

  const checkOut = (id: string) =>
    updateStatus(id, ReservationStatus.COMPLETED, { check_out_time: new Date().toISOString() });

  const approve = (id: string) =>
    updateStatus(id, ReservationStatus.SCHEDULED);

  const cancel = (id: string, reason?: string) =>
    updateStatus(id, ReservationStatus.CANCELLED, reason ? { rejection_reason: reason } : {});

  return { reservations, rows, loading, error, refetch: fetch, updateStatus, checkIn, checkOut, approve, cancel };
}

// Fetch all reservations for a date range (used in CalendarPage)
export async function fetchReservationsRange(start: Date, end: Date): Promise<DbReservationRow[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .gte("start_date", start.toISOString())
    .lte("end_date", end.toISOString())
    .order("start_date", { ascending: true });

  if (error) return [];
  return (data ?? []) as DbReservationRow[];
}
