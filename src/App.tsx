import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { OrgGuard } from "@/components/auth/OrgGuard";
import { AppLayout } from "@/components/navigation/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

const LandingPage          = lazy(() => import("./pages/LandingPage"));
const LoginPage            = lazy(() => import("./pages/LoginPage"));
const RegisterPage         = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage   = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage    = lazy(() => import("./pages/ResetPasswordPage"));
const JoinPage             = lazy(() => import("./pages/JoinPage"));
const OnboardingPage   = lazy(() => import("./pages/OnboardingPage"));
const BillingPage      = lazy(() => import("./pages/BillingPage"));

const Dashboard            = lazy(() => import("./pages/Dashboard"));
const CustomersPage        = lazy(() => import("./pages/CustomersPage"));
const DogsPage             = lazy(() => import("./pages/DogsPage"));
const RequestsPage         = lazy(() => import("./pages/RequestsPage"));
const CalendarPage         = lazy(() => import("./pages/CalendarPage"));
const SettingsPage         = lazy(() => import("./pages/SettingsPage"));
const ReportCardsPage      = lazy(() => import("./pages/ReportCardsPage"));
const PackagesPage         = lazy(() => import("./pages/PackagesPage"));
const InvoicesPage         = lazy(() => import("./pages/InvoicesPage"));
const NoticesPage          = lazy(() => import("./pages/NoticesPage"));
const FacilityPage         = lazy(() => import("./pages/FacilityPage"));
const ReportsPage          = lazy(() => import("./pages/ReportsPage"));
const CampaignsPage        = lazy(() => import("./pages/CampaignsPage"));
const ClinicPage           = lazy(() => import("./pages/ClinicPage"));
const CustomerProfilePage  = lazy(() => import("./pages/CustomerProfilePage"));
const StaffPage            = lazy(() => import("./pages/StaffPage"));
const DogProfilePage       = lazy(() => import("./pages/DogProfilePage"));
const NotFound             = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
              <Routes>
                {/* Public */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/join" element={<JoinPage />} />

                {/* Auth required, no org needed */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/billing" element={<BillingPage />} />
                </Route>

                {/* Auth + org + subscription required */}
                <Route path="/:orgSlug" element={<OrgGuard />}>
                  <Route element={<AppLayout />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard"        element={<Dashboard />} />
                    <Route path="customers"        element={<CustomersPage />} />
                    <Route path="customers/:id"    element={<CustomerProfilePage />} />
                    <Route path="dogs"             element={<DogsPage />} />
                    <Route path="dogs/:id"         element={<DogProfilePage />} />
                    <Route path="requests"         element={<RequestsPage />} />
                    <Route path="calendar"         element={<CalendarPage />} />
                    <Route path="notices"          element={<NoticesPage />} />
                    <Route path="facility"         element={<FacilityPage />} />
                    <Route path="report-cards"     element={<ReportCardsPage />} />
                    <Route path="packages"         element={<PackagesPage />} />
                    <Route path="invoices"         element={<InvoicesPage />} />
                    <Route path="reports"          element={<ReportsPage />} />
                    <Route path="campaigns"        element={<CampaignsPage />} />
                    <Route path="clinic"           element={<ClinicPage />} />
                    <Route path="staff"            element={<StaffPage />} />
                    <Route path="settings"         element={<SettingsPage />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
