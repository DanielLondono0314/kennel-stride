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
import { PlatformAdminGuard } from "@/components/auth/PlatformAdminGuard";
import { FeatureRoute } from "@/components/auth/FeatureRoute";
import { RoleHome } from "@/components/auth/RoleHome";
import { WorkerLayout } from "@/components/worker/WorkerLayout";
import { AppLayout } from "@/components/navigation/AppLayout";
import { PlatformAdminLayout } from "@/components/platform-admin/PlatformAdminLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

const LandingPage          = lazy(() => import("./pages/LandingPage"));
const LoginPage            = lazy(() => import("./pages/LoginPage"));
const RegisterPage         = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage   = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage    = lazy(() => import("./pages/ResetPasswordPage"));
const JoinPage             = lazy(() => import("./pages/JoinPage"));
const TermsPage            = lazy(() => import("./pages/legal/TermsPage"));
const PrivacyPage          = lazy(() => import("./pages/legal/PrivacyPage"));
const DataProcessingPage   = lazy(() => import("./pages/legal/DataProcessingPage"));
const CookiesPage          = lazy(() => import("./pages/legal/CookiesPage"));
const CustomerAuthorizationPage = lazy(() => import("./pages/legal/CustomerAuthorizationPage"));
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
const ContractsPage        = lazy(() => import("./pages/ContractsPage"));
const NewContractPage      = lazy(() => import("./pages/NewContractPage"));
const SignContractPage     = lazy(() => import("./pages/SignContractPage"));
const NoticesPage          = lazy(() => import("./pages/NoticesPage"));
const FacilityPage         = lazy(() => import("./pages/FacilityPage"));
const ReportsPage          = lazy(() => import("./pages/ReportsPage"));
const CampaignsPage        = lazy(() => import("./pages/CampaignsPage"));
const RoutesPage           = lazy(() => import("./pages/RoutesPage"));
const ClinicPage           = lazy(() => import("./pages/ClinicPage"));
const CustomerProfilePage  = lazy(() => import("./pages/CustomerProfilePage"));
const StaffPage            = lazy(() => import("./pages/StaffPage"));
const DogProfilePage       = lazy(() => import("./pages/DogProfilePage"));
const ReservationDetailPage = lazy(() => import("./pages/ReservationDetailPage"));
const DogDashboardPage     = lazy(() => import("./pages/DogDashboardPage"));
const NotFound             = lazy(() => import("./pages/NotFound"));

const PlatformAdminOverviewPage      = lazy(() => import("./pages/platform-admin/PlatformAdminOverviewPage"));
const PlatformAdminOrganizationsPage = lazy(() => import("./pages/platform-admin/PlatformAdminOrganizationsPage"));
const PlatformAdminOrgDetailPage     = lazy(() => import("./pages/platform-admin/PlatformAdminOrgDetailPage"));
const PlatformAdminUsersPage         = lazy(() => import("./pages/platform-admin/PlatformAdminUsersPage"));
const PlatformAdminUsagePage         = lazy(() => import("./pages/platform-admin/PlatformAdminUsagePage"));
const PlatformAdminInfraPage         = lazy(() => import("./pages/platform-admin/PlatformAdminInfraPage"));
const PlatformAdminAuditLogPage      = lazy(() => import("./pages/platform-admin/PlatformAdminAuditLogPage"));

const MyDayPage            = lazy(() => import("./pages/worker/MyDayPage"));
const MyRoutePage          = lazy(() => import("./pages/worker/MyRoutePage"));
const MySchedulePage       = lazy(() => import("./pages/worker/MySchedulePage"));
const WorkerTaskDetailPage = lazy(() => import("./pages/worker/WorkerTaskDetailPage"));
const WorkerNoticesPage    = lazy(() => import("./pages/worker/WorkerNoticesPage"));
const WorkerProfilePage    = lazy(() => import("./pages/worker/WorkerProfilePage"));
const WorkerDogsPage       = lazy(() => import("./pages/worker/WorkerDogsPage"));
const WorkerDogPage        = lazy(() => import("./pages/worker/WorkerDogPage"));
const WorkerKennelsPage    = lazy(() => import("./pages/worker/WorkerKennelsPage"));

// Precarga el código de la página de la URL actual EN PARALELO con la carga de
// la organización: antes la ruta pedía su chunk recién cuando OrgGuard
// terminaba (~1 s después) — QA E-19. import() del mismo archivo reutiliza el
// mismo módulo que usa lazy(), así que no se descarga dos veces.
const ORG_ROUTE_PRELOAD: Record<string, () => Promise<unknown>> = {
  dashboard: () => import("./pages/Dashboard"),
  customers: () => import("./pages/CustomersPage"),
  dogs: () => import("./pages/DogsPage"),
  reservations: () => import("./pages/ReservationDetailPage"),
  "dog-panel": () => import("./pages/DogDashboardPage"),
  requests: () => import("./pages/RequestsPage"),
  calendar: () => import("./pages/CalendarPage"),
  tasks: () => import("./pages/TasksPage"),
  notices: () => import("./pages/NoticesPage"),
  facility: () => import("./pages/FacilityPage"),
  "report-cards": () => import("./pages/ReportCardsPage"),
  packages: () => import("./pages/PackagesPage"),
  invoices: () => import("./pages/InvoicesPage"),
  contracts: () => import("./pages/ContractsPage"),
  reports: () => import("./pages/ReportsPage"),
  campaigns: () => import("./pages/CampaignsPage"),
  routes: () => import("./pages/RoutesPage"),
  clinic: () => import("./pages/ClinicPage"),
  staff: () => import("./pages/StaffPage"),
  settings: () => import("./pages/SettingsPage"),
};

if (typeof window !== "undefined") {
  const [, , section, sub] = window.location.pathname.split("/");
  const preload =
    section === "dogs" && sub ? () => import("./pages/DogProfilePage")
    : section === "customers" && sub ? () => import("./pages/CustomerProfilePage")
    : ORG_ROUTE_PRELOAD[section ?? ""];
  preload?.().catch(() => {}); // si falla, lazy() lo reintenta al renderizar
}

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
                  {/* Firma electrónica de contratos: la abre el cliente, sin cuenta */}
                  <Route path="/firmar/:token" element={<SignContractPage />} />
                  <Route path="/terminos" element={<TermsPage />} />
                  <Route path="/privacidad" element={<PrivacyPage />} />
                  <Route path="/transmision-datos" element={<DataProcessingPage />} />
                  <Route path="/cookies" element={<CookiesPage />} />
                  <Route path="/autorizacion-clientes" element={<CustomerAuthorizationPage />} />

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
                        <Route path="route" element={<MyRoutePage />} />
                        <Route path="reservation/:id" element={<WorkerTaskDetailPage />} />
                        <Route path="task/:id" element={<WorkerTaskDetailPage />} />
                        <Route path="dogs" element={<WorkerDogsPage />} />
                        <Route path="dog/:id" element={<WorkerDogPage />} />
                        <Route element={<FeatureRoute feature="facility" />}>
                          <Route path="kennels" element={<WorkerKennelsPage />} />
                        </Route>
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
                      <Route path="reservations/:id" element={<ReservationDetailPage />} />
                      <Route path="dog-panel"        element={<DogDashboardPage />} />
                      <Route element={<FeatureRoute feature="requests" />}>
                        <Route path="requests" element={<RequestsPage />} />
                      </Route>
                      <Route path="calendar"         element={<CalendarPage />} />
                      <Route path="tasks"            element={<TasksPage />} />
                      <Route element={<FeatureRoute feature="notices" />}>
                        <Route path="notices" element={<NoticesPage />} />
                      </Route>
                      <Route element={<FeatureRoute feature="facility" />}>
                        <Route path="facility" element={<FacilityPage />} />
                      </Route>
                      <Route element={<FeatureRoute feature="report_cards" />}>
                        <Route path="report-cards" element={<ReportCardsPage />} />
                      </Route>
                      <Route path="packages"         element={<PackagesPage />} />
                      <Route path="invoices"         element={<InvoicesPage />} />
                      <Route path="contracts"        element={<ContractsPage />} />
                      <Route path="contracts/new"    element={<NewContractPage />} />
                      <Route path="reports"          element={<ReportsPage />} />
                      <Route element={<FeatureRoute feature="campaigns" />}>
                        <Route path="campaigns" element={<CampaignsPage />} />
                      </Route>
                      <Route path="routes"           element={<RoutesPage />} />
                      <Route element={<FeatureRoute feature="clinic" />}>
                        <Route path="clinic" element={<ClinicPage />} />
                      </Route>
                      <Route path="staff"            element={<StaffPage />} />
                      <Route path="settings"         element={<SettingsPage />} />
                    </Route>
                    </Route>
                  </Route>

                  {/* Panel interno de plataforma (equipo KennelStride, no un kennel) */}
                  <Route path="/platform-admin" element={<PlatformAdminGuard />}>
                    <Route element={<PlatformAdminLayout />}>
                      <Route index element={<PlatformAdminOverviewPage />} />
                      <Route path="organizations" element={<PlatformAdminOrganizationsPage />} />
                      <Route path="organizations/:orgId" element={<PlatformAdminOrgDetailPage />} />
                      <Route path="users" element={<PlatformAdminUsersPage />} />
                      <Route path="usage" element={<PlatformAdminUsagePage />} />
                      <Route path="infra" element={<PlatformAdminInfraPage />} />
                      <Route path="audit-log" element={<PlatformAdminAuditLogPage />} />
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
