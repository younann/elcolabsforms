import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, RequireRole } from './lib/auth';
import { AppShell } from './ui/AppShell';
import { Toaster } from './ui/toast';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Queue } from './pages/admin/Queue';
import { NewForm } from './pages/NewForm';
import { Fill } from './pages/Fill';

function Root() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster />
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/login', element: <Login /> },
      {
        element: (
          <RequireRole>
            <AppShell />
          </RequireRole>
        ),
        children: [
          { index: true, element: <Home /> },
          { path: 'new', element: <NewForm /> },
          { path: 'fill/:id', element: <Fill /> },
          {
            path: 'admin',
            element: <RequireRole role="admin" />,
            children: [{ index: true, element: <Queue /> }],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
