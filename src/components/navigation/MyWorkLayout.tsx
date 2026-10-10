import { Outlet } from "react-router-dom";

/** Secciones de "Mi trabajo": diseñadas para celular, centradas en escritorio. */
export function MyWorkLayout() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Outlet />
    </div>
  );
}
