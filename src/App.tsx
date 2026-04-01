import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/navigation/AppLayout";
import LoginPage from "./pages/LoginPage";
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
import FacilityPage from "./pages/FacilityPage";
import ReportsPage from "./pages/ReportsPage";
import CampaignsPage from "./pages/CampaignsPage";
import ClinicPage from "./pages/ClinicPage";
import CustomerProfilePage from "./pages/CustomerProfilePage";
import StaffPage from "./pages/StaffPage";
import DogProfilePage from "./pages/DogProfilePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/dogs" element={<DogsPage />} />
                <Route path="/requests" element={<RequestsPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/notices" element={<NoticesPage />} />
                <Route path="/facility" element={<FacilityPage />} />
                <Route path="/report-cards" element={<ReportCardsPage />} />
                <Route path="/packages" element={<PackagesPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/campaigns" element={<CampaignsPage />} />
                <Route path="/clinic" element={<ClinicPage />} />
                <Route path="/customers/:id" element={<CustomerProfilePage />} />
                <Route path="/dogs/:id" element={<DogProfilePage />} />
                <Route path="/staff" element={<StaffPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
