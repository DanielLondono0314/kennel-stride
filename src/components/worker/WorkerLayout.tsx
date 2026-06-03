import { Outlet } from "react-router-dom";
import { WorkerBottomNav } from "./WorkerBottomNav";

export function WorkerLayout() {
  return (
    <div className="min-h-screen bg-background pb-16">
      <main className="mx-auto max-w-md px-4 pt-4">
        <Outlet />
      </main>
      <WorkerBottomNav />
    </div>
  );
}
