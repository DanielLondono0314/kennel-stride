import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { TooltipProvider } from "@/components/ui/tooltip";
import { mockNotices, mockReservations } from "@/data/mockData";
import { ReservationStatus } from "@/types";

export function AppLayout() {
  const unreadNotices = mockNotices.filter(n => !n.isRead).length;
  const pendingRequests = mockReservations.filter(
    r => r.status === ReservationStatus.REQUESTED
  ).length;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar noticeCount={unreadNotices} requestCount={pendingRequests} />
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <AppHeader noticeCount={unreadNotices} />
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
