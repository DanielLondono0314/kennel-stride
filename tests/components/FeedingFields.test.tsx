import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeedingFields } from "@/components/dogs/FeedingFields";
import { emptyFeeding } from "@/types/dogClinical";

describe("FeedingFields", () => {
  it("renderiza el campo de nº de comidas y propaga cambios", () => {
    const onChange = vi.fn();
    render(<FeedingFields value={emptyFeeding()} onChange={onChange} />);
    const meals = screen.getByLabelText(/comidas al día/i);
    fireEvent.change(meals, { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ meals_per_day: 3 }));
  });
});
