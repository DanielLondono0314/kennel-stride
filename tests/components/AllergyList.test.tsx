import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AllergyList } from "@/components/dogs/AllergyList";
import { emptyAllergy } from "@/types/dogClinical";

describe("AllergyList", () => {
  it("añade una fila al pulsar 'Añadir alergia'", () => {
    const onChange = vi.fn();
    render(<AllergyList value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /añadir alergia/i }));
    expect(onChange).toHaveBeenCalledWith([emptyAllergy()]);
  });

  it("quita la fila indicada", () => {
    const onChange = vi.fn();
    const rows = [{ ...emptyAllergy(), allergen: "pollo" }, { ...emptyAllergy(), allergen: "polvo" }];
    render(<AllergyList value={rows} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("button", { name: /quitar alergia/i })[0]);
    expect(onChange).toHaveBeenCalledWith([rows[1]]);
  });
});
