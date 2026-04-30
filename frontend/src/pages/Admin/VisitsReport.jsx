import React, { useState, useEffect } from 'react';
import { api } from '../../api';

export default function VisitsReport() {
  const [offices, setOffices] = useState([]);
  const [visits, setVisits] = useState([]);
  const [filters, setFilters] = useState({ office_id: '', from_date: '', to_date: '', status: '' });
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    api('/api/offices').then(setOffices).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.office_id) params.set('office_id', filters.office_id);
    if (filters.from_date) params.set('from_date', filters.from_date);
    if (filters.to_date) params.set('to_date', filters.to_date);
    if (filters.status) params.set('status', filters.status);
    params.set('limit', '200');
    api(`/api/visits?${params}`).then(setVisits).catch(console.error).finally(() => setLoading(false));
  }, [filters.office_id, filters.from_date, filters.to_date, filters.status]);

  const exportCsv = () => {
    const headers = ['ID', 'Visitor', 'Contact', 'From', 'Purpose', 'Office', 'Entry', 'Exit', 'Status', 'Photo'];
    const rows = visits.map((v) => [
      v.id,
      v.visitor_name,
      v.visitor_contact || '',
      v.visitor_from || '',
      v.purpose,
      v.office_name,
      v.entry_time,
      v.exit_time || '',
      v.status,
      v.visitor_photo ? 'Yes' : 'No',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `visits-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {photoPreview && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 border-0 cursor-default"
          onClick={() => setPhotoPreview(null)}
          aria-label="Close photo"
        >
          <span className="sr-only">Close</span>
          <img
            src={photoPreview.src}
            alt=""
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
        </button>
      )}
      <h2 className="text-school-blue text-xl font-bold mb-4">Visit records</h2>
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <label className="block">
          <span className="text-school-blue font-medium text-sm">Office</span>
          <select
            value={filters.office_id}
            onChange={(e) => setFilters((f) => ({ ...f, office_id: e.target.value }))}
            className="block mt-1 px-3 py-2 min-w-[160px] border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue outline-none"
          >
            <option value="">All</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-school-blue font-medium text-sm">From date</span>
          <input
            type="date"
            value={filters.from_date}
            onChange={(e) => setFilters((f) => ({ ...f, from_date: e.target.value }))}
            className="block mt-1 px-3 py-2 border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue outline-none"
          />
        </label>
        <label className="block">
          <span className="text-school-blue font-medium text-sm">To date</span>
          <input
            type="date"
            value={filters.to_date}
            onChange={(e) => setFilters((f) => ({ ...f, to_date: e.target.value }))}
            className="block mt-1 px-3 py-2 border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue outline-none"
          />
        </label>
        <label className="block">
          <span className="text-school-blue font-medium text-sm">Status</span>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="block mt-1 px-3 py-2 border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue outline-none"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <button
          type="button"
          onClick={exportCsv}
          className="py-2 px-4 rounded-lg bg-school-red text-school-white font-medium hover:opacity-90 transition-opacity"
        >
          Export CSV
        </button>
      </div>
      {loading ? (
        <p className="text-school-blue-light">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-school-blue-light/30 shadow-sm">
          <table className="w-full border-collapse bg-school-surface">
            <thead>
              <tr className="bg-school-blue text-school-white">
                <th className="text-left p-3 font-semibold">Visitor</th>
                <th className="text-left p-3 font-semibold">Photo</th>
                <th className="text-left p-3 font-semibold">Contact</th>
                <th className="text-left p-3 font-semibold">From</th>
                <th className="text-left p-3 font-semibold">Purpose</th>
                <th className="text-left p-3 font-semibold">Office</th>
                <th className="text-left p-3 font-semibold">Entry</th>
                <th className="text-left p-3 font-semibold">Exit</th>
                <th className="text-left p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-b border-school-blue-light/30 hover:bg-school-white/50">
                  <td className="p-3 text-school-blue font-medium">{v.visitor_name}</td>
                  <td className="p-3">
                    {v.visitor_photo ? (
                      <button
                        type="button"
                        onClick={() => setPhotoPreview({ src: v.visitor_photo })}
                        className="p-0 border-0 bg-transparent rounded cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-school-blue"
                      >
                        <img
                          src={v.visitor_photo}
                          alt=""
                          className="w-14 h-14 object-cover rounded border border-school-blue-light/40"
                        />
                      </button>
                    ) : (
                      <span className="text-school-blue-light">–</span>
                    )}
                  </td>
                  <td className="p-3 text-school-blue-light">{v.visitor_contact || '–'}</td>
                  <td className="p-3">{v.visitor_from || '–'}</td>
                  <td className="p-3">{v.purpose}</td>
                  <td className="p-3">{v.office_name}</td>
                  <td className="p-3">{v.entry_time}</td>
                  <td className="p-3">{v.exit_time || '–'}</td>
                  <td className="p-3">{v.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visits.length === 0 && (
            <p className="p-6 text-school-blue-light text-center">No visits match the filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
