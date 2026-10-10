import { describe, it, expect } from "vitest";
import { legacyWorkerTarget } from "@/components/auth/WorkerRoute";

describe("enlaces de la antigua app de trabajador", () => {
  it("cada ruta /worker/* lleva a su equivalente del panel", () => {
    expect(legacyWorkerTarget("")).toBe("my-day");
    expect(legacyWorkerTarget("/")).toBe("my-day");
    expect(legacyWorkerTarget("/schedule")).toBe("my-schedule");
    expect(legacyWorkerTarget("/route")).toBe("my-route");
    expect(legacyWorkerTarget("/task/abc")).toBe("my-day/task/abc");
    expect(legacyWorkerTarget("/reservation/r1")).toBe("my-day/reservation/r1");
    expect(legacyWorkerTarget("/dogs")).toBe("my-day/dogs");
    expect(legacyWorkerTarget("/dog/d1")).toBe("my-day/dog/d1");
    expect(legacyWorkerTarget("/kennels")).toBe("facility?vista=perreras");
    expect(legacyWorkerTarget("/health")).toBe("clinic");
    expect(legacyWorkerTarget("/profile")).toBe("profile");
    expect(legacyWorkerTarget("/algo-viejo")).toBe("my-day");
  });
});
