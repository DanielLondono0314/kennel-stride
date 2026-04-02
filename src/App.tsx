import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/navigation/AppLayout";
import LoginPage from "./pages/LoginPage";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const DogsPage = lazy(() => import("./pages/DogsPage"));
const RequestsPage = lazy(() => import("./pages/RequestsPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ReportCardsPage = lazy(() => import("./pages/ReportCardsPage"));
const PackagesPage = lazy(() => import("./pages/PackagesPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const NoticesPage = lazy(() => import("./pages/NoticesPage"));
const FacilityPage = lazy(() => import("./pages/FacilityPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const CampaignsPage = lazy(() => import("./pages/CampaignsPage"));
const ClinicPage = lazy(() => import("./pages/ClinicPage"));
const CustomerProfilePage = lazy(() => import("./pages/CustomerProfilePage"));
const StaffPage = lazy(() => import("./pages/StaffPage"));
const DogProfilePage = lazy(() => import("./pages/DogProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
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
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
