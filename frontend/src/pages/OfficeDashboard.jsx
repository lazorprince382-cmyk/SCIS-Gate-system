import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import { api, getWsUrl } from '../api';

export default function OfficeDashboard() {
  const [offices, setOffices] = useState([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef(null);

  useEffect(() => {
    api('/api/offices').then((list) => {
      setOffices(list.filter((o) => o.active));
      if (list.length && !selectedOfficeId) setSelectedOfficeId(list[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedOfficeId) return;
    setLoading(true);
    api(`/api/visits?office_id=${selectedOfficeId}&active_only=true&omit_photos=true`).then((data) => {
      setVisits(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedOfficeId]);

  useEffect(() => {
    if (!selectedOfficeId) return;
    const url = getWsUrl(selectedOfficeId);
    const ws = new WebSocket(url);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'visit_created' && msg.visit && Number(msg.visit.office_id) === Number(selectedOfficeId)) {
          setVisits((prev) => [msg.visit, ...prev]);
        }
        if (msg.type === 'visit_completed' && msg.visit && Number(msg.visit.office_id) === Number(selectedOfficeId)) {
          setVisits((prev) => prev.filter((v) => v.id !== msg.visit.id));
        }
      } catch (_) {}
    };
    wsRef.current = ws;
    return () => { ws.close(); };
  }, [selectedOfficeId]);

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="mt-0 text-school-blue text-xl font-bold">Office Dashboard</h2>
        <label className="block mb-4">
          <span className="text-school-blue font-medium">Office</span>
          <select
            value={selectedOfficeId ?? ''}
            onChange={(e) => setSelectedOfficeId(Number(e.target.value))}
            className="block mt-1 px-3 py-2 min-w-[200px] border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue focus:border-school-blue outline-none"
          >
            {offices.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>
        <h3 className="text-school-blue font-semibold mb-3">Current visitors</h3>
        {loading ? (
          <p className="text-school-blue-light">Loading...</p>
        ) : (
          <ul className="list-none p-0 m-0 space-y-3">
            {visits.length === 0 && (
              <li className="p-4 bg-school-surface rounded-lg border border-school-blue-light/50 text-school-blue-light">
                No current visitors.
              </li>
            )}
            {visits.map((v) => (
              <li
                key={v.id}
                className="p-4 bg-school-surface rounded-lg shadow-sm border-l-4 border-school-red"
              >
                <strong className="text-school-blue">{v.visitor_name}</strong>
                {v.visitor_contact && <span className="text-school-blue-light ml-2">{v.visitor_contact}</span>}
                {v.visitor_from && (
                  <div className="mt-1 text-sm text-school-blue-light">From: {v.visitor_from}</div>
                )}
                <div className="mt-1 text-school-blue">{v.purpose}</div>
                <div className="mt-1 text-sm text-school-blue-light">Entry: {v.entry_time}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
