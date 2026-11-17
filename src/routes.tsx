import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, RequireRole } from './lib/auth';
import { AppShell } from './ui/AppShell';
import { Toaster } from './ui/toast';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { NewForm } from './pages/NewForm';
import { Fill } from './pages/Fill';
import { SubmissionView } from './pages/SubmissionView';
import { Profile } from './pages/Profile';
import { Review } from './pages/admin/Review';
import { AllSubmissions } from './pages/admin/AllSubmissions';
import { Users } from './pages/admin/Users';
import { Settings } from './pages/admin/Settings';

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
          {
            path: 'new',
            element: (
              <RequireRole role="inspector">
                <NewForm />
              </RequireRole>
            ),
          },
          { path: 'fill/:id', element: <Fill /> },
          { path: 'submissions/:id', element: <SubmissionView /> },
          { path: 'profile', element: <Profile /> },
          {
            path: 'admin',
            element: <RequireRole role="admin" />,
            children: [
              { index: true, element: <Navigate to="/" replace /> },
              { path: 'review/:id', element: <Review /> },
              { path: 'submissions', element: <AllSubmissions /> },
              { path: 'users', element: <Users /> },
              { path: 'settings', element: <Settings /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
