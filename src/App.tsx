import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/navigation/AppLayout";
import Dashboard from "./pages/Dashboard";
import CustomersPage from "./pages/CustomersPage";
import DogsPage from "./pages/DogsPage";
import RequestsPage from "./pages/RequestsPage";
import CalendarPage from "./pages/CalendarPage";
import SettingsPage from "./pages/SettingsPage";
import ReportCardsPage from "./pages/ReportCardsPage";
import PackagesPage from "./pages/PackagesPage";
import InvoicesPage from "./pages/InvoicesPage";
import NoticesPage from "./pages/NoticesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/dogs" element={<DogsPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/notices" element={<NoticesPage />} />
            <Route path="/report-cards" element={<ReportCardsPage />} />
            <Route path="/packages" element={<PackagesPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/reports" element={<ComingSoon title="Reportes" />} />
            <Route path="/campaigns" element={<ComingSoon title="Campañas" />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

// Placeholder component for pages not yet implemented
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-16 h-16 mb-4 rounded-2xl bg-muted flex items-center justify-center">
        <span className="text-2xl">🚧</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground max-w-md">
        Este módulo está en desarrollo. Próximamente podrás gestionar {title.toLowerCase()} desde aquí.
      </p>
    </div>
  );
}

export default App;
