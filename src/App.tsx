import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { UpdateBanner } from './pwa/UpdateBanner';

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <UpdateBanner />
    </>
  );
}
