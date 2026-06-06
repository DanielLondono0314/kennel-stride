import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DogModal } from "@/components/dogs/DogModal";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

vi.mock("@/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organization: { id: "org-123" } }),
}));

describe("DogModal — formulario clínico", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra la sección de Alimentación (obligatoria) al abrir", async () => {
    render(<DogModal open onOpenChange={() => {}} onSave={() => {}} />);
    expect(await screen.findByText(/Alimentación \*/i)).toBeInTheDocument();
  });

  it("revela el sub-form de agresividad al encender el toggle", async () => {
    render(<DogModal open onOpenChange={() => {}} onSave={() => {}} />);
    const toggle = await screen.findByRole("switch", { name: /perro agresivo/i });
    fireEvent.click(toggle);
    expect(await screen.findByLabelText(/Manejo \*/i)).toBeInTheDocument();
  });
});
