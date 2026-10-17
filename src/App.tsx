import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthProvider } from '@/features/auth/AuthContext';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { AdminPage } from '@/pages/AdminPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ListingDetailPage } from '@/pages/ListingDetailPage';
import { ListingsPage } from '@/pages/ListingsPage';
import { LoginPage } from '@/pages/LoginPage';
import { PipelinePage } from '@/pages/PipelinePage';
import { ProfilePage } from '@/pages/ProfilePage';
import { RemindersPage } from '@/pages/RemindersPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/listings', element: <ListingsPage kind="PUBLIC" /> },
          { path: '/listings/:id', element: <ListingDetailPage /> },
          { path: '/private', element: <ListingsPage kind="PRIVATE" /> },
          { path: '/pipeline', element: <PipelinePage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/reminders', element: <RemindersPage /> },
          {
            element: <ProtectedRoute roles={['ADMIN']} />,
            children: [{ path: '/admin', element: <AdminPage /> }],
          },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
