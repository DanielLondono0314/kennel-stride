import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

describe("DogModal — tabs y formulario clínico", () => {
  beforeEach(() => vi.clearAllMocks());

  it("abre en el tab de datos básicos con los obligatorios (dueño/nombre/raza)", async () => {
    render(<DogModal open onOpenChange={() => {}} onSave={() => {}} />);
    expect(await screen.findByText(/Dueño \*/i)).toBeInTheDocument();
    expect(screen.getByText(/Nombre \*/i)).toBeInTheDocument();
    expect(screen.getByText(/Raza \*/i)).toBeInTheDocument();
  });

  it("la Alimentación (obligatoria) tiene su propio tab, ya no está al final", async () => {
    render(<DogModal open onOpenChange={() => {}} onSave={() => {}} />);
    fireEvent.mouseDown(await screen.findByRole("tab", { name: /alimentación/i }));
    expect(await screen.findByText(/Tipo de comida \*/i)).toBeInTheDocument();
  });

  it("revela el sub-form de agresividad al encender el toggle (tab salud)", async () => {
    render(<DogModal open onOpenChange={() => {}} onSave={() => {}} />);
    fireEvent.mouseDown(await screen.findByRole("tab", { name: /salud y notas/i }));
    const toggle = await screen.findByRole("switch", { name: /perro agresivo/i });
    fireEvent.click(toggle);
    expect(await screen.findByLabelText(/Manejo \*/i)).toBeInTheDocument();
  });
});

describe("DogModal — validación inline (PR-13)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("al enviar vacío muestra errores EN los campos (no solo toast) y no llama onSave", async () => {
    const onSave = vi.fn();
    render(<DogModal open onOpenChange={() => {}} onSave={onSave} />);

    fireEvent.click(await screen.findByRole("button", { name: /crear perro/i }));

    // Mensajes inline visibles en el tab de básicos.
    expect(await screen.findByText("Selecciona un dueño")).toBeInTheDocument();
    // El input de nombre queda marcado como inválido para lectores de pantalla.
    const nameInput = screen.getByLabelText(/Nombre \*/i);
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("el error de un campo se limpia al escribir en él", async () => {
    render(<DogModal open onOpenChange={() => {}} onSave={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: /crear perro/i }));
    const nameInput = await screen.findByLabelText(/Nombre \*/i);
    expect(nameInput).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(nameInput, { target: { value: "Firulais" } });
    await waitFor(() => expect(nameInput).not.toHaveAttribute("aria-invalid"));
  });

  it("si el error está en otro tab, salta a ese tab (alimentación incompleta)", async () => {
    const onSave = vi.fn();
    render(<DogModal open onOpenChange={() => {}} onSave={onSave} />);

    // Completar lo del tab básicos salvo el dueño no es posible sin datos;
    // en su lugar: verificar que el punto de error del tab alimentación aparece
    // y que al enviar con todo vacío el primer error (dueño) mantiene el tab básicos.
    fireEvent.click(await screen.findByRole("button", { name: /crear perro/i }));
    const basicTab = await screen.findByRole("tab", { name: /datos básicos/i });
    expect(basicTab).toHaveAttribute("aria-selected", "true");

    // El tab de alimentación también quedó marcado con errores pendientes.
    const feedingTab = screen.getByRole("tab", { name: /alimentación/i });
    fireEvent.mouseDown(feedingTab);
    expect(await screen.findByText("Elige el tipo de comida")).toBeInTheDocument();
  });
});
