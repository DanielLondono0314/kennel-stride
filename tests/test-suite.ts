/**
 * KennelOps – Test Suite
 * Framework: Vitest + @testing-library/react
 * Run: npm test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";
import {
  VaccinationType, DocumentType, DocumentStatus,
  FlagType, FlagSeverity, ReservationStatus, ServiceType,
  type Dog, type Customer, type Service, type Reservation,
} from "@/types";
import type { DbReservationRow } from "@/hooks/useReservations";

// ---------------------------------------------------------------------------
// Helpers & utilities extracted from source files for isolated testing
// ---------------------------------------------------------------------------

/** Copied from OnboardingPage – converts a display name into a URL slug */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Minimal DbReservationRow shape for mapper tests */
function makeDbRow(overrides: Partial<DbReservationRow> = {}): DbReservationRow {
  return {
    id: "res-1",
    customer_id: "cust-1",
    dog_id: "dog-1",
    staff_id: null,
    location_id: null,
    service_type: "boarding",
    service_name: "Hospedaje",
    status: "scheduled",
    start_date: "2026-04-01T10:00:00Z",
    end_date: "2026-04-03T10:00:00Z",
    check_in_time: null,
    check_out_time: null,
    total_price: 800,
    notes: null,
    rejection_reason: null,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    customers: {
      id: "cust-1", first_name: "Ana", last_name: "García",
      phone: "5551234567", email: "ana@example.com", city: "CDMX",
      state: "México", balance: 0,
    },
    dogs: {
      id: "dog-1", name: "Max", breed: "Labrador", weight: 30,
      gender: "male", color: "yellow", behavior_notes: null, medical_notes: null,
    },
    staff_members: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. FUNCTIONAL TESTS
// ---------------------------------------------------------------------------

describe("Functional – toSlug", () => {
  it("converts name to lowercase hyphenated slug", () => {
    expect(toSlug("Mi Centro Canino")).toBe("mi-centro-canino");
  });

  it("strips accents (NFD normalization)", () => {
    expect(toSlug("Adiestramiento Máximo")).toBe("adiestramiento-maximo");
    expect(toSlug("Ñoño")).toBe("nono");
    expect(toSlug("Björk")).toBe("bjork");
  });

  it("collapses multiple spaces and special chars into single hyphen", () => {
    expect(toSlug("Centro   Canino!!! México")).toBe("centro-canino-mexico");
  });

  it("trims leading and trailing hyphens", () => {
    expect(toSlug("!Centro Canino!")).toBe("centro-canino");
  });

  it("caps slug at 40 characters", () => {
    const long = "A".repeat(60);
    expect(toSlug(long).length).toBeLessThanOrEqual(40);
  });

  it("preserves numbers", () => {
    expect(toSlug("Centro K9 2025")).toBe("centro-k9-2025");
  });
});

describe("Functional – Reservation mapper", () => {
  it("maps DB row to Reservation shape correctly", async () => {
    // Dynamically import to keep Supabase mock self-contained
    const { mapDbToReservation } = await import("@/hooks/useReservations");
    const row = makeDbRow();
    const res = mapDbToReservation(row);

    expect(res.id).toBe("res-1");
    expect(res.customer.firstName).toBe("Ana");
    expect(res.dog.name).toBe("Max");
    expect(res.service.type).toBe("boarding");
    expect(res.totalPrice).toBe(800);
    expect(res.status).toBe("scheduled");
    expect(res.startDate).toBeInstanceOf(Date);
  });

  it("uses fallback values when nested objects are null", async () => {
    const { mapDbToReservation } = await import("@/hooks/useReservations");
    const row = makeDbRow({ customers: null, dogs: null, staff_members: null });
    const res = mapDbToReservation(row);

    expect(res.customer.firstName).toBe("");
    expect(res.dog.name).toBe("");
    expect(res.staff).toBeUndefined();
  });

  it("maps check-in time when present", async () => {
    const { mapDbToReservation } = await import("@/hooks/useReservations");
    const row = makeDbRow({ check_in_time: "2026-04-01T12:00:00Z" });
    const res = mapDbToReservation(row);
    expect(res.checkInTime).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// 2. UI TESTS – Component rendering
// ---------------------------------------------------------------------------

// Mock heavy dependencies so components render in jsdom
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }),
    rpc: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({ session: null, user: null, loading: false }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: vi.fn().mockReturnValue({ organization: null, loading: false }),
  OrganizationProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("UI – LoginPage renders correctly", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function renderLogin() {
    const { default: LoginPage } = await import("@/pages/LoginPage");
    return render(
      React.createElement(MemoryRouter, { initialEntries: ["/login"] },
        React.createElement(Routes, null,
          React.createElement(Route, { path: "/login", element: React.createElement(LoginPage) })
        )
      )
    );
  }

  it("renders email and password inputs", async () => {
    await renderLogin();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it("renders the submit button", async () => {
    await renderLogin();
    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("renders link to register page", async () => {
    await renderLogin();
    expect(screen.getByRole("link", { name: /crear cuenta/i })).toBeInTheDocument();
  });

  it("renders Google sign-in button", async () => {
    await renderLogin();
    expect(screen.getByRole("button", { name: /continuar con google/i })).toBeInTheDocument();
  });
});

describe("UI – RegisterPage renders correctly", () => {
  async function renderRegister() {
    const { default: RegisterPage } = await import("@/pages/RegisterPage");
    return render(
      React.createElement(MemoryRouter, { initialEntries: ["/register"] },
        React.createElement(Routes, null,
          React.createElement(Route, { path: "/register", element: React.createElement(RegisterPage) })
        )
      )
    );
  }

  it("renders all form fields", async () => {
    await renderRegister();
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
  });

  it("submit button is present", async () => {
    await renderRegister();
    expect(screen.getByRole("button", { name: /crear cuenta/i })).toBeInTheDocument();
  });

  it("shows link back to login", async () => {
    await renderRegister();
    expect(screen.getByRole("link", { name: /iniciar sesión/i })).toBeInTheDocument();
  });
});

describe("UI – OnboardingPage renders correctly", () => {
  async function renderOnboarding() {
    const { default: OnboardingPage } = await import("@/pages/OnboardingPage");
    return render(
      React.createElement(MemoryRouter, { initialEntries: ["/onboarding"] },
        React.createElement(Routes, null,
          React.createElement(Route, { path: "/onboarding", element: React.createElement(OnboardingPage) })
        )
      )
    );
  }

  it("renders center name and slug inputs", async () => {
    await renderOnboarding();
    expect(screen.getByLabelText(/nombre del centro/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url de acceso/i)).toBeInTheDocument();
  });

  it("slug field auto-fills from center name", async () => {
    await renderOnboarding();
    const nameInput = screen.getByLabelText(/nombre del centro/i);
    fireEvent.change(nameInput, { target: { value: "Centro Canino" } });
    await waitFor(() => {
      const slugInput = screen.getByLabelText(/url de acceso/i) as HTMLInputElement;
      expect(slugInput.value).toBe("centro-canino");
    });
  });
});

// ---------------------------------------------------------------------------
// 3. EDGE CASES
// ---------------------------------------------------------------------------

describe("Edge cases – toSlug", () => {
  it("returns empty string for empty input", () => {
    expect(toSlug("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(toSlug("   ")).toBe("");
  });

  it("handles all special characters", () => {
    expect(toSlug("@#$%^&*()")).toBe("");
  });

  it("handles single character", () => {
    expect(toSlug("A")).toBe("a");
  });

  it("handles mixed emojis and text (strips emojis)", () => {
    expect(toSlug("Centro 🐕 Canino")).toBe("centro-canino");
  });

  it("handles Chinese/Japanese characters (strips them)", () => {
    expect(toSlug("犬訓練センター")).toBe("");
  });

  it("handles already valid slug", () => {
    expect(toSlug("mi-centro")).toBe("mi-centro");
  });

  it("handles numbers only", () => {
    expect(toSlug("12345")).toBe("12345");
  });

  it("handles very long name – exactly 40 chars", () => {
    const slug = toSlug("a".repeat(100));
    expect(slug.length).toBe(40);
  });

  it("handles name with multiple consecutive hyphens", () => {
    expect(toSlug("Centro--Canino")).toBe("centro-canino");
  });
});

describe("Edge cases – Reservation mapper", () => {
  it("handles missing weight (null) without crash", async () => {
    const { mapDbToReservation } = await import("@/hooks/useReservations");
    const row = makeDbRow({ dogs: { id: "d1", name: "Rex", breed: "Mix", weight: null, gender: "male", color: null, behavior_notes: null, medical_notes: null } });
    const res = mapDbToReservation(row);
    expect(res.dog.weight).toBe(0);
  });

  it("handles zero total_price", async () => {
    const { mapDbToReservation } = await import("@/hooks/useReservations");
    const row = makeDbRow({ total_price: 0 });
    const res = mapDbToReservation(row);
    expect(res.totalPrice).toBe(0);
  });

  it("handles very large total_price", async () => {
    const { mapDbToReservation } = await import("@/hooks/useReservations");
    const row = makeDbRow({ total_price: 999999999 });
    const res = mapDbToReservation(row);
    expect(res.totalPrice).toBe(999999999);
  });

  it("handles female dog gender", async () => {
    const { mapDbToReservation } = await import("@/hooks/useReservations");
    const row = makeDbRow({ dogs: { id: "d1", name: "Luna", breed: "Poodle", weight: 10, gender: "female", color: null, behavior_notes: null, medical_notes: null } });
    const res = mapDbToReservation(row);
    expect(res.dog.gender).toBe("female");
  });
});

describe("Edge cases – Login form validation", () => {
  it("submit button is disabled while loading after submit", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // never resolves → loading stays true
    );

    const { default: LoginPage } = await import("@/pages/LoginPage");
    render(
      React.createElement(MemoryRouter, { initialEntries: ["/login"] },
        React.createElement(Routes, null,
          React.createElement(Route, { path: "/login", element: React.createElement(LoginPage) })
        )
      )
    );

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeDisabled();
    });
  });
});

// ---------------------------------------------------------------------------
// 4. PERFORMANCE TESTS
// ---------------------------------------------------------------------------

describe("Performance – toSlug", () => {
  it("processes 10 000 slugs in under 100ms", () => {
    const names = Array.from({ length: 10_000 }, (_, i) => `Centro Canino Número ${i} México`);
    const start = performance.now();
    names.forEach(toSlug);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it("single slug generation is under 1ms", () => {
    const start = performance.now();
    toSlug("Centro Canino Huellitas de México S.A. de C.V.");
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1);
  });
});

describe("Performance – Reservation mapper", () => {
  it("maps 1 000 rows in under 50ms", async () => {
    const { mapDbToReservation } = await import("@/hooks/useReservations");
    const rows = Array.from({ length: 1_000 }, (_, i) =>
      makeDbRow({ id: `res-${i}`, total_price: i * 100 })
    );

    const start = performance.now();
    rows.forEach(mapDbToReservation);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// 5. VALIDATION LOGIC — validateCheckIn / validateCheckOut
// ---------------------------------------------------------------------------

// ── Factories ────────────────────────────────────────────────────────────────

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1", firstName: "Ana", lastName: "García",
    email: "ana@example.com", phone: "555-1234", balance: 0,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function makeDog(overrides: Partial<Dog> = {}): Dog {
  return {
    id: "dog-1", customerId: "cust-1", name: "Max", breed: "Labrador",
    gender: "male", isNeutered: false, flags: [], vaccinations: [], documents: [],
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: "svc-1", name: "Hospedaje", type: ServiceType.BOARD_AND_TRAIN,
    duration: 1440, price: 500, isActive: true,
    requiredVaccinations: [], requiredDocuments: [],
    ...overrides,
  };
}

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: "res-1", customerId: "cust-1", dogId: "dog-1", serviceId: "svc-1",
    status: ReservationStatus.SCHEDULED,
    startDate: new Date(), endDate: new Date(),
    totalPrice: 500, usePackageCredits: false,
    createdAt: new Date(), updatedAt: new Date(),
    customer: makeCustomer(), dog: makeDog(),
    ...overrides,
  };
}

function makeVaccination(type: VaccinationType, opts: { expired?: boolean; verified?: boolean } = {}) {
  const past = new Date(); past.setFullYear(past.getFullYear() - 2);
  const future = new Date(); future.setFullYear(future.getFullYear() + 1);
  return {
    id: `vax-${type}`, dogId: "dog-1", name: type, type,
    administeredAt: past,
    expiresAt: opts.expired ? past : future,
    verified: opts.verified !== false,
  };
}

// ── validateCheckIn ──────────────────────────────────────────────────────────

describe("validateCheckIn – vaccinations", () => {
  it("passes when no vaccinations are required", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const result = validateCheckIn(makeReservation(), makeDog(), makeCustomer(), makeService());
    expect(result.isValid).toBe(true);
    expect(result.alerts).toHaveLength(0);
  });

  it("blocks when a required vaccination is missing", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const service = makeService({ requiredVaccinations: [VaccinationType.RABIES] });
    const dog = makeDog({ vaccinations: [] });
    const result = validateCheckIn(makeReservation(), dog, makeCustomer(), service);
    expect(result.isValid).toBe(false);
    expect(result.canOverride).toBe(false);
    expect(result.alerts.some(a => a.blocksOperation && a.type === "vaccination")).toBe(true);
  });

  it("blocks when a required vaccination is expired", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const service = makeService({ requiredVaccinations: [VaccinationType.RABIES] });
    const dog = makeDog({ vaccinations: [makeVaccination(VaccinationType.RABIES, { expired: true })] });
    const result = validateCheckIn(makeReservation(), dog, makeCustomer(), service);
    expect(result.isValid).toBe(false);
    expect(result.canOverride).toBe(false);
  });

  it("warns but does not block when required vaccination is unverified but valid", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const service = makeService({ requiredVaccinations: [VaccinationType.RABIES] });
    const dog = makeDog({ vaccinations: [makeVaccination(VaccinationType.RABIES, { verified: false })] });
    const result = validateCheckIn(makeReservation(), dog, makeCustomer(), service);
    expect(result.isValid).toBe(true);
    expect(result.alerts.some(a => a.type === "vaccination" && !a.blocksOperation)).toBe(true);
  });

  it("passes when all required vaccinations are valid and verified", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const service = makeService({ requiredVaccinations: [VaccinationType.RABIES, VaccinationType.DHPP] });
    const dog = makeDog({
      vaccinations: [
        makeVaccination(VaccinationType.RABIES),
        makeVaccination(VaccinationType.DHPP),
      ],
    });
    const result = validateCheckIn(makeReservation(), dog, makeCustomer(), service);
    expect(result.isValid).toBe(true);
  });
});

describe("validateCheckIn – documents", () => {
  it("blocks when liability waiver is missing", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const service = makeService({ requiredDocuments: [DocumentType.LIABILITY_WAIVER] });
    const result = validateCheckIn(makeReservation(), makeDog({ documents: [] }), makeCustomer(), service);
    expect(result.isValid).toBe(false);
    expect(result.alerts.some(a => a.type === "document" && a.blocksOperation)).toBe(true);
  });

  it("warns but does not block when non-waiver document is missing", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const service = makeService({ requiredDocuments: [DocumentType.VACCINATION_RECORD] });
    const result = validateCheckIn(makeReservation(), makeDog({ documents: [] }), makeCustomer(), service);
    expect(result.isValid).toBe(true);
    expect(result.alerts.some(a => a.type === "document" && !a.blocksOperation)).toBe(true);
  });
});

describe("validateCheckIn – balance", () => {
  it("does not alert when balance is zero", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const result = validateCheckIn(makeReservation(), makeDog(), makeCustomer({ balance: 0 }), makeService());
    expect(result.alerts.filter(a => a.type === "payment")).toHaveLength(0);
  });

  it("warns (non-blocking) when balance is between 0 and -200", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const result = validateCheckIn(makeReservation(), makeDog(), makeCustomer({ balance: -100 }), makeService());
    const paymentAlert = result.alerts.find(a => a.type === "payment");
    expect(paymentAlert).toBeDefined();
    expect(paymentAlert?.blocksOperation).toBe(false);
    expect(paymentAlert?.severity).toBe(FlagSeverity.WARNING);
  });

  it("shows CRITICAL severity when balance is between -200 and -500", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const result = validateCheckIn(makeReservation(), makeDog(), makeCustomer({ balance: -300 }), makeService());
    const paymentAlert = result.alerts.find(a => a.type === "payment");
    expect(paymentAlert?.severity).toBe(FlagSeverity.CRITICAL);
    expect(result.isValid).toBe(true);
  });

  it("blocks check-in when balance is below -500", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const result = validateCheckIn(makeReservation(), makeDog(), makeCustomer({ balance: -600 }), makeService());
    expect(result.isValid).toBe(false);
    expect(result.canOverride).toBe(true);
  });
});

describe("validateCheckIn – combined alerts", () => {
  it("canOverride=false when expired vaccination blocks alongside payment block", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const service = makeService({ requiredVaccinations: [VaccinationType.RABIES] });
    const dog = makeDog({ vaccinations: [makeVaccination(VaccinationType.RABIES, { expired: true })] });
    const customer = makeCustomer({ balance: -600 });
    const result = validateCheckIn(makeReservation(), dog, customer, service);
    expect(result.isValid).toBe(false);
    expect(result.canOverride).toBe(false);
  });

  it("canOverride=true when only a payment block is present", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const result = validateCheckIn(makeReservation(), makeDog(), makeCustomer({ balance: -600 }), makeService());
    expect(result.isValid).toBe(false);
    expect(result.canOverride).toBe(true);
  });
});

// ── validateCheckOut ─────────────────────────────────────────────────────────

describe("validateCheckOut", () => {
  it("passes when the reservation has a check-in time", async () => {
    const { validateCheckOut } = await import("@/lib/validations");
    const reservation = makeReservation({ checkInTime: new Date() });
    const result = validateCheckOut(reservation, makeCustomer());
    expect(result.isValid).toBe(true);
    expect(result.alerts).toHaveLength(0);
  });

  it("blocks when the reservation has no check-in time", async () => {
    const { validateCheckOut } = await import("@/lib/validations");
    const reservation = makeReservation({ checkInTime: undefined });
    const result = validateCheckOut(reservation, makeCustomer());
    expect(result.isValid).toBe(false);
    expect(result.alerts.some(a => a.blocksOperation)).toBe(true);
  });

  it("canOverride is always false for check-out blocks", async () => {
    const { validateCheckOut } = await import("@/lib/validations");
    const reservation = makeReservation({ checkInTime: undefined });
    const result = validateCheckOut(reservation, makeCustomer());
    expect(result.canOverride).toBe(false);
  });
});

describe("validateCheckIn – document status branches", () => {
  it("warns when a required document is present but PENDING", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const service = makeService({ requiredDocuments: [DocumentType.LIABILITY_WAIVER] });
    const dog = makeDog({
      documents: [{
        id: "doc-1", dogId: "dog-1", customerId: "cust-1",
        type: DocumentType.LIABILITY_WAIVER,
        status: DocumentStatus.PENDING,
        name: "Waiver",
        createdAt: new Date(), updatedAt: new Date(),
      }],
    });
    const result = validateCheckIn(makeReservation(), dog, makeCustomer(), service);
    expect(result.alerts.some(a => a.type === "document")).toBe(true);
  });

  it("warns when a required document is EXPIRED", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const service = makeService({ requiredDocuments: [DocumentType.LIABILITY_WAIVER] });
    const dog = makeDog({
      documents: [{
        id: "doc-1", dogId: "dog-1", customerId: "cust-1",
        type: DocumentType.LIABILITY_WAIVER,
        status: DocumentStatus.EXPIRED,
        name: "Waiver",
        createdAt: new Date(), updatedAt: new Date(),
      }],
    });
    const result = validateCheckIn(makeReservation(), dog, makeCustomer(), service);
    expect(result.alerts.some(a => a.type === "document")).toBe(true);
  });
});

describe("validateCheckIn – dog flags", () => {
  it("adds a flag alert for an unresolved BEHAVIOR_ALERT flag", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const dog = makeDog({
      flags: [{
        id: "flag-1", dogId: "dog-1",
        type: FlagType.BEHAVIOR_ALERT,
        severity: FlagSeverity.WARNING,
        message: "Agresividad leve",
        createdAt: new Date(),
      }],
    });
    const result = validateCheckIn(makeReservation(), dog, makeCustomer(), makeService());
    expect(result.alerts.some(a => a.type === "flag")).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it("skips resolved flags", async () => {
    const { validateCheckIn } = await import("@/lib/validations");
    const dog = makeDog({
      flags: [{
        id: "flag-1", dogId: "dog-1",
        type: FlagType.BEHAVIOR_ALERT,
        severity: FlagSeverity.WARNING,
        message: "Resuelto",
        resolvedAt: new Date(),
        createdAt: new Date(),
      }],
    });
    const result = validateCheckIn(makeReservation(), dog, makeCustomer(), makeService());
    expect(result.alerts.filter(a => a.type === "flag")).toHaveLength(0);
  });
});
