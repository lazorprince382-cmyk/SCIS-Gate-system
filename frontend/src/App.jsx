import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import GateKiosk from './pages/GateKiosk';
import OfficeDashboard from './pages/OfficeDashboard';
import Login from './pages/Login';
import AdminLayout from './pages/Admin/Layout';
import OfficesManage from './pages/Admin/OfficesManage';
import VisitsReport from './pages/Admin/VisitsReport';
import SecurityAlerts from './pages/Admin/SecurityAlerts';
import CardsManage from './pages/Admin/CardsManage';
import StaffManage from './pages/Admin/StaffManage';
import PhoneScanPage from './pages/PhoneScanPage';
import { routerBasename } from './appPath';

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (t && u) {
      setUser(JSON.parse(u));
    }
    setChecking(false);
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-school-blue font-medium">Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter basename={routerBasename()}>
      <Routes>
        <Route path="/" element={<GateKiosk />} />
        <Route path="/office" element={<OfficeDashboard />} />
        <Route path="/phone-scan" element={<PhoneScanPage />} />
        <Route path="/phone-scan/:sessionId" element={<PhoneScanPage />} />
        <Route path="/login" element={user ? <Navigate to="/admin" replace /> : <Login onLogin={setUser} />} />
        <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route index element={<Navigate to="/admin/offices" replace />} />
          <Route path="offices" element={<OfficesManage />} />
          <Route path="cards" element={<CardsManage />} />
          <Route path="visits" element={<VisitsReport />} />
          <Route path="security-alerts" element={<SecurityAlerts />} />
          <Route path="staff" element={<StaffManage />} />
          <Route path="accounts" element={<AdminAccounts />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
