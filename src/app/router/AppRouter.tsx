import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RouteFallback } from '../../components/ui/RouteFallback'
import { HomeRedirect } from '../../features/auth/HomeRedirect'
import { LoginPage } from '../../features/auth/LoginPage'
import { ProtectedRoute } from '../../features/auth/ProtectedRoute'
import { RoleRoute } from '../../features/auth/RoleRoute'

// Lazy-loaded routes. Each page becomes its own chunk so the initial download
// only contains the auth shell + the user's first destination. Named exports
// are wrapped via `.then` since `lazy` expects a default export.
const AcceptInvitePage = lazy(() =>
  import('../../features/auth/AcceptInvitePage').then((m) => ({ default: m.AcceptInvitePage })),
)
const ForgotPasswordPage = lazy(() =>
  import('../../features/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
)

const CompaniesListPage = lazy(() =>
  import('../../features/super/companies/CompaniesListPage').then((m) => ({
    default: m.CompaniesListPage,
  })),
)
const NewCompanyPage = lazy(() =>
  import('../../features/super/companies/NewCompanyPage').then((m) => ({
    default: m.NewCompanyPage,
  })),
)
const CompanyDetailPage = lazy(() =>
  import('../../features/super/companies/CompanyDetailPage').then((m) => ({
    default: m.CompanyDetailPage,
  })),
)

const AdminDashboardPage = lazy(() =>
  import('../../features/admin/dashboard/AdminDashboardPage').then((m) => ({
    default: m.AdminDashboardPage,
  })),
)
const AdminInvoiceRequestsPage = lazy(() =>
  import('../../features/admin/invoice-requests/AdminInvoiceRequestsPage').then((m) => ({
    default: m.AdminInvoiceRequestsPage,
  })),
)
const AdminInvoiceDetailPage = lazy(() =>
  import('../../features/admin/invoices/AdminInvoiceDetailPage').then((m) => ({
    default: m.AdminInvoiceDetailPage,
  })),
)
const AdminInvoicesListPage = lazy(() =>
  import('../../features/admin/invoices/AdminInvoicesListPage').then((m) => ({
    default: m.AdminInvoicesListPage,
  })),
)
const AdminNumberChangeRequestsPage = lazy(() =>
  import('../../features/admin/invoice-number-requests/AdminNumberChangeRequestsPage').then(
    (m) => ({ default: m.AdminNumberChangeRequestsPage }),
  ),
)
const AssignMemberPage = lazy(() =>
  import('../../features/admin/projects/AssignMemberPage').then((m) => ({
    default: m.AssignMemberPage,
  })),
)
const EditAssignmentPage = lazy(() =>
  import('../../features/admin/projects/EditAssignmentPage').then((m) => ({
    default: m.EditAssignmentPage,
  })),
)
const NewProjectPage = lazy(() =>
  import('../../features/admin/projects/NewProjectPage').then((m) => ({
    default: m.NewProjectPage,
  })),
)
const ProjectDetailPage = lazy(() =>
  import('../../features/admin/projects/ProjectDetailPage').then((m) => ({
    default: m.ProjectDetailPage,
  })),
)
const ProjectMembersPage = lazy(() =>
  import('../../features/admin/projects/ProjectMembersPage').then((m) => ({
    default: m.ProjectMembersPage,
  })),
)
const ProjectsListPage = lazy(() =>
  import('../../features/admin/projects/ProjectsListPage').then((m) => ({
    default: m.ProjectsListPage,
  })),
)
const InviteUserPage = lazy(() =>
  import('../../features/admin/users/InviteUserPage').then((m) => ({
    default: m.InviteUserPage,
  })),
)
const UserDetailPage = lazy(() =>
  import('../../features/admin/users/UserDetailPage').then((m) => ({
    default: m.UserDetailPage,
  })),
)
const UsersListPage = lazy(() =>
  import('../../features/admin/users/UsersListPage').then((m) => ({
    default: m.UsersListPage,
  })),
)

const BillingProfilePage = lazy(() =>
  import('../../features/user/billing-profile/BillingProfilePage').then((m) => ({
    default: m.BillingProfilePage,
  })),
)
const UserDashboardPage = lazy(() =>
  import('../../features/user/dashboard/UserDashboardPage').then((m) => ({
    default: m.UserDashboardPage,
  })),
)
const ReviewInboxPage = lazy(() =>
  import('../../features/review/ReviewInboxPage').then((m) => ({
    default: m.ReviewInboxPage,
  })),
)
const NotificationsPage = lazy(() =>
  import('../../features/notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
)
const MyNumberChangeRequestsPage = lazy(() =>
  import('../../features/user/invoice-number-requests/MyNumberChangeRequestsPage').then((m) => ({
    default: m.MyNumberChangeRequestsPage,
  })),
)
const InvoiceDetailPage = lazy(() =>
  import('../../features/user/invoices/InvoiceDetailPage').then((m) => ({
    default: m.InvoiceDetailPage,
  })),
)
const InvoicesListPage = lazy(() =>
  import('../../features/user/invoices/InvoicesListPage').then((m) => ({
    default: m.InvoicesListPage,
  })),
)
const NewInvoicePage = lazy(() =>
  import('../../features/user/invoices/NewInvoicePage').then((m) => ({
    default: m.NewInvoicePage,
  })),
)
const NewTaskPage = lazy(() =>
  import('../../features/user/tasks/NewTaskPage').then((m) => ({ default: m.NewTaskPage })),
)
const TaskDetailPage = lazy(() =>
  import('../../features/user/tasks/TaskDetailPage').then((m) => ({ default: m.TaskDetailPage })),
)
const TasksListPage = lazy(() =>
  import('../../features/user/tasks/TasksListPage').then((m) => ({ default: m.TasksListPage })),
)

function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <RoleRoute role="admin">{children}</RoleRoute>
    </ProtectedRoute>
  )
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <RoleRoute role="super_admin">{children}</RoleRoute>
    </ProtectedRoute>
  )
}

function UserRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <RoleRoute role="user">{children}</RoleRoute>
    </ProtectedRoute>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Legacy URL — landing now lives at "/" for SEO. */}
          <Route path="/landing" element={<Navigate to="/" replace />} />

          {/* Public auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />

          {/* Root — redirects by session/role/platform (HomeRedirect handles unauth too) */}
          <Route path="/" element={<HomeRedirect />} />

          {/* Admin area */}
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UsersListPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users/new"
            element={
              <AdminRoute>
                <InviteUserPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users/:id"
            element={
              <AdminRoute>
                <UserDetailPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/projects"
            element={
              <AdminRoute>
                <ProjectsListPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/projects/new"
            element={
              <AdminRoute>
                <NewProjectPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/projects/:id"
            element={
              <AdminRoute>
                <ProjectDetailPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/projects/:id/members"
            element={
              <AdminRoute>
                <ProjectMembersPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/projects/:id/members/new"
            element={
              <AdminRoute>
                <AssignMemberPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/projects/:id/members/:userId"
            element={
              <AdminRoute>
                <EditAssignmentPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/invoices"
            element={
              <AdminRoute>
                <AdminInvoicesListPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/invoices/:id"
            element={
              <AdminRoute>
                <AdminInvoiceDetailPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/invoice-requests"
            element={
              <AdminRoute>
                <AdminInvoiceRequestsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/invoice-number-requests"
            element={
              <AdminRoute>
                <AdminNumberChangeRequestsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/review"
            element={
              <AdminRoute>
                <ReviewInboxPage isAdmin />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/notifications"
            element={
              <AdminRoute>
                <NotificationsPage />
              </AdminRoute>
            }
          />

          {/* Super admin area */}
          <Route
            path="/super/companies"
            element={
              <SuperAdminRoute>
                <CompaniesListPage />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/companies/new"
            element={
              <SuperAdminRoute>
                <NewCompanyPage />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/super/companies/:id"
            element={
              <SuperAdminRoute>
                <CompanyDetailPage />
              </SuperAdminRoute>
            }
          />

          {/* User area */}
          <Route
            path="/app/dashboard"
            element={
              <UserRoute>
                <UserDashboardPage />
              </UserRoute>
            }
          />
          <Route
            path="/app/billing-profile"
            element={
              <UserRoute>
                <BillingProfilePage />
              </UserRoute>
            }
          />
          <Route
            path="/app/review"
            element={
              <UserRoute>
                <ReviewInboxPage isAdmin={false} />
              </UserRoute>
            }
          />
          <Route
            path="/app/tasks"
            element={
              <UserRoute>
                <TasksListPage />
              </UserRoute>
            }
          />
          <Route
            path="/app/tasks/new"
            element={
              <UserRoute>
                <NewTaskPage />
              </UserRoute>
            }
          />
          <Route
            path="/app/tasks/:id"
            element={
              <UserRoute>
                <TaskDetailPage />
              </UserRoute>
            }
          />
          <Route
            path="/app/invoices"
            element={
              <UserRoute>
                <InvoicesListPage />
              </UserRoute>
            }
          />
          <Route
            path="/app/invoices/new"
            element={
              <UserRoute>
                <NewInvoicePage />
              </UserRoute>
            }
          />
          <Route
            path="/app/invoices/:id"
            element={
              <UserRoute>
                <InvoiceDetailPage />
              </UserRoute>
            }
          />
          <Route
            path="/app/invoice-number-requests"
            element={
              <UserRoute>
                <MyNumberChangeRequestsPage />
              </UserRoute>
            }
          />
          <Route
            path="/app/notifications"
            element={
              <UserRoute>
                <NotificationsPage />
              </UserRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
