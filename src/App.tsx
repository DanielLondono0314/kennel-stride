import { lazy, Suspense, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { createQueryClient } from "@/lib/query-client";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { OrgGuard } from "@/components/auth/OrgGuard";
import { WorkerRoute, AdminOnlyRoute } from "@/components/auth/WorkerRoute";
import { RoleHome } from "@/components/auth/RoleHome";
import { WorkerLayout } from "@/components/worker/WorkerLayout";
import { AppLayout } from "@/components/navigation/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

const LandingPage          = lazy(() => import("./pages/LandingPage"));
const LoginPage            = lazy(() => import("./pages/LoginPage"));
const RegisterPage         = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage   = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage    = lazy(() => import("./pages/ResetPasswordPage"));
const JoinPage             = lazy(() => import("./pages/JoinPage"));
const TermsPage            = lazy(() => import("./pages/legal/TermsPage"));
const PrivacyPage          = lazy(() => import("./pages/legal/PrivacyPage"));
const OnboardingPage   = lazy(() => import("./pages/OnboardingPage"));
const BillingPage      = lazy(() => import("./pages/BillingPage"));

const Dashboard            = lazy(() => import("./pages/Dashboard"));
const CustomersPage        = lazy(() => import("./pages/CustomersPage"));
const DogsPage             = lazy(() => import("./pages/DogsPage"));
const RequestsPage         = lazy(() => import("./pages/RequestsPage"));
const CalendarPage         = lazy(() => import("./pages/CalendarPage"));
const SettingsPage         = lazy(() => import("./pages/SettingsPage"));
const ReportCardsPage      = lazy(() => import("./pages/ReportCardsPage"));
const TasksPage            = lazy(() => import("./pages/TasksPage"));
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

const MyDayPage            = lazy(() => import("./pages/worker/MyDayPage"));
const MySchedulePage       = lazy(() => import("./pages/worker/MySchedulePage"));
const WorkerTaskDetailPage = lazy(() => import("./pages/worker/WorkerTaskDetailPage"));
const WorkerNoticesPage    = lazy(() => import("./pages/worker/WorkerNoticesPage"));
const WorkerProfilePage    = lazy(() => import("./pages/worker/WorkerProfilePage"));

const App = () => {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner position="top-right" />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
                  <Route path="/terminos" element={<TermsPage />} />
                  <Route path="/privacidad" element={<PrivacyPage />} />

                  {/* Auth required, no org needed */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/billing" element={<BillingPage />} />
                  </Route>

                  {/* Auth + org + subscription required */}
                  <Route path="/:orgSlug" element={<OrgGuard />}>
                    {/* Role-based landing */}
                    <Route index element={<RoleHome />} />

                    {/* Worker view */}
                    <Route path="worker" element={<WorkerRoute />}>
                      <Route element={<WorkerLayout />}>
                        <Route index element={<MyDayPage />} />
                        <Route path="schedule" element={<MySchedulePage />} />
                        <Route path="reservation/:id" element={<WorkerTaskDetailPage />} />
                        <Route path="task/:id" element={<WorkerTaskDetailPage />} />
                        <Route path="notices" element={<WorkerNoticesPage />} />
                        <Route path="profile" element={<WorkerProfilePage />} />
                      </Route>
                    </Route>

                    {/* Admin view (blocked for workers) */}
                    <Route element={<AdminOnlyRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="dashboard"        element={<Dashboard />} />
                      <Route path="customers"        element={<CustomersPage />} />
                      <Route path="customers/:id"    element={<CustomerProfilePage />} />
                      <Route path="dogs"             element={<DogsPage />} />
                      <Route path="dogs/:id"         element={<DogProfilePage />} />
                      <Route path="requests"         element={<RequestsPage />} />
                      <Route path="calendar"         element={<CalendarPage />} />
                      <Route path="tasks"            element={<TasksPage />} />
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
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};

export default App;
