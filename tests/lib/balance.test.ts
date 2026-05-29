/**
 * Stream F (H3) — Customer balance / accounts-receivable blocking rule.
 *
 * These tests pin the contract between the DB-maintained `customers.balance`
 * (see 20260529060000_customer_balance_trigger.sql) and the check-in blocking
 * logic in src/lib/validations.ts.
 *
 * Convention under test: balance is NEGATIVE when the customer owes money
 * (balance = -(SUM of unpaid invoice totals)). Thresholds:
 *   balance >= 0            → no payment alert
 *   -200 < balance < 0      → WARNING, non-blocking
 *   -500 <= balance <= -200 → CRITICAL, non-blocking
 *   balance < -500          → CRITICAL, blocks check-in (overridable)
 */
import { describe, it, expect } from "vitest";
import {
  FlagSeverity,
  ReservationStatus,
  ServiceType,
  type Customer,
  type Dog,
  type Service,
  type Reservation,
} from "@/types";
import { validateCheckIn } from "@/lib/validations";

// ── Factories (local to this file) ───────────────────────────────────────────

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1",
    firstName: "Ana",
    lastName: "García",
    email: "ana@example.com",
    phone: "555-1234",
    balance: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDog(overrides: Partial<Dog> = {}): Dog {
  return {
    id: "dog-1",
    customerId: "cust-1",
    name: "Max",
    breed: "Labrador",
    gender: "male",
    isNeutered: false,
    flags: [],
    vaccinations: [],
    documents: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: "svc-1",
    name: "Hospedaje",
    type: ServiceType.BOARD_AND_TRAIN,
    duration: 1440,
    price: 500,
    isActive: true,
    requiredVaccinations: [],
    requiredDocuments: [],
    ...overrides,
  };
}

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: "res-1",
    customerId: "cust-1",
    dogId: "dog-1",
    serviceId: "svc-1",
    status: ReservationStatus.SCHEDULED,
    startDate: new Date(),
    endDate: new Date(),
    totalPrice: 500,
    usePackageCredits: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: makeCustomer(),
    dog: makeDog(),
    ...overrides,
  };
}

function paymentAlert(balance: number) {
  const result = validateCheckIn(
    makeReservation(),
    makeDog(),
    makeCustomer({ balance }),
    makeService(),
  );
  return { result, alert: result.alerts.find((a) => a.type === "payment") };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("balance blocking rule — negative means the customer owes", () => {
  it("no payment alert when nothing is owed (balance 0)", () => {
    const { result, alert } = paymentAlert(0);
    expect(alert).toBeUndefined();
    expect(result.isValid).toBe(true);
  });

  it("no payment alert for a positive (credit) balance", () => {
    const { alert } = paymentAlert(150);
    expect(alert).toBeUndefined();
  });

  it("small debt warns but does not block (balance -100)", () => {
    const { result, alert } = paymentAlert(-100);
    expect(alert).toBeDefined();
    expect(alert?.severity).toBe(FlagSeverity.WARNING);
    expect(alert?.blocksOperation).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it("debt past the critical threshold is CRITICAL but still non-blocking (balance -300)", () => {
    const { result, alert } = paymentAlert(-300);
    expect(alert?.severity).toBe(FlagSeverity.CRITICAL);
    expect(alert?.blocksOperation).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it("exactly at the block threshold does NOT block (balance -500, strict <)", () => {
    const { result, alert } = paymentAlert(-500);
    expect(alert?.severity).toBe(FlagSeverity.CRITICAL);
    expect(alert?.blocksOperation).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it("debt beyond the block threshold blocks check-in (balance -600)", () => {
    const { result, alert } = paymentAlert(-600);
    expect(alert?.severity).toBe(FlagSeverity.CRITICAL);
    expect(alert?.blocksOperation).toBe(true);
    expect(result.isValid).toBe(false);
    // a pure payment block is overridable by staff
    expect(result.canOverride).toBe(true);
  });

  it("reports the owed amount as a positive figure in the message", () => {
    const { alert } = paymentAlert(-600);
    expect(alert?.message).toContain("600");
    expect(alert?.details?.balance).toBe(-600);
  });
});
