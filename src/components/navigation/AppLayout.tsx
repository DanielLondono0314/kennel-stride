import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppCounts } from "@/hooks/useAppCounts";

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { unreadNotices, pendingRequests } = useAppCounts();
  const location = useLocation();

  // Auto-close mobile sidebar on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);


  return (
    <TooltipProvider delayDuration={0}>
      <div className="app-shell flex min-h-screen w-full bg-background">
        <AppSidebar
          className="no-print"
          noticeCount={unreadNotices}
          requestCount={pendingRequests}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        {/* Mobile backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        <div className="app-shell-content flex-1 flex flex-col min-h-screen overflow-hidden">
          <AppHeader
            className="no-print"
            noticeCount={unreadNotices}
            onMenuToggle={() => setMobileMenuOpen((prev) => !prev)}
          />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
