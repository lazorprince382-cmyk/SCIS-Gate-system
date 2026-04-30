import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../../components/Navbar';

export default function AdminLayout() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (user.role && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-transparent">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <p className="text-school-blue font-medium">Access denied. Admin only.</p>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            className="mt-4 py-2 px-4 rounded-lg bg-school-blue text-school-white font-medium hover:opacity-90 transition-opacity"
          >
            Go to Gate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar variant="admin" username={user.username} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <p className="m-0 text-school-blue text-sm sm:text-base font-semibold">
          Welcome, <span className="text-school-blue-light">{user.username || 'Admin'}</span>
        </p>
      </div>
      <Outlet />
    </div>
  );
}
