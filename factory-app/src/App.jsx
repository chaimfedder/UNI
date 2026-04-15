import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './hooks/useAuth';
import LoginPage       from './components/Auth/LoginPage';
import Navbar          from './components/Layout/Navbar';
import NewOrdersTab    from './components/NewOrders/NewOrdersTab';
import PackingTab      from './components/Packing/PackingTab';
import PackingListsTab from './components/PackingLists/PackingListsTab';
import OrderTrackingTab from './components/OrderTracking/OrderTrackingTab';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-500 text-lg">Loading…</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { i18n } = useTranslation();

  // Set html dir attribute for RTL/LTR support
  useEffect(() => {
    const dir = i18n.language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', i18n.language);
  }, [i18n.language]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FAF8F3' }}>
              <Navbar />
              <main className="flex-1 p-3 sm:p-4 max-w-screen-2xl mx-auto w-full">
                <Routes>
                  <Route path="/"               element={<Navigate to="/orders" replace />} />
                  <Route path="/orders"          element={<NewOrdersTab />} />
                  <Route path="/packing"         element={<PackingTab />} />
                  <Route path="/packing-lists"   element={<PackingListsTab />} />
                  <Route path="/tracking"        element={<OrderTrackingTab />} />
                </Routes>
              </main>
            </div>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
