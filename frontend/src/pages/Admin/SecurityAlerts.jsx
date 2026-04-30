import React, { useState, useEffect, useRef } from 'react';
import { api, getWsUrl } from '../../api';

export default function SecurityAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const wsRef = useRef(null);

  const load = () => {
    setLoading(true);
    setLoadError('');
    api('/api/auth/failed-login-alerts?limit=100')
      .then((data) => {
        setAlerts(data);
      })
      .catch((e) => {
        setLoadError(e.message || 'Could not load alerts');
        setAlerts([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const ws = new WebSocket(getWsUrl());
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'failed_login_alert') load();
        if (msg.type === 'failed_login_alert_deleted' && Number.isFinite(Number(msg.id))) {
          setAlerts((prev) => prev.filter((a) => a.id !== Number(msg.id)));
        }
      } catch (_) {}
    };
    wsRef.current = ws;
    return () => ws.close();
  }, []);

  const handleDelete = (id) => {
    if (!window.confirm('Delete this failed sign-in alert?')) return;
    setDeletingId(id);
    api(`/api/auth/failed-login-alerts/${id}`, { method: 'DELETE' })
      .then(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      })
      .catch((e) => setLoadError(e.message || 'Failed to delete alert'))
      .finally(() => setDeletingId(null));
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-school-blue text-xl font-bold m-0">Failed sign-in alerts</h2>
        <button
          type="button"
          onClick={load}
          className="py-2 px-4 rounded-lg bg-school-blue text-school-white font-medium hover:opacity-90 transition-opacity"
        >
          Refresh
        </button>
      </div>
      <p className="text-school-blue-light text-sm mb-4 m-0">
        Each row shows the username entered, time of attempt, and a snapshot from the device camera when the attempt failed (if the browser allowed camera access).
      </p>
      {loadError && (
        <p className="text-school-red text-sm mb-4 p-3 rounded-lg bg-red-50 border border-school-red/30 m-0" role="alert">
          {loadError}
          {loadError === 'Unauthorized' ? ' — sign out and sign in again, then open this page.' : ''}
        </p>
      )}
      {loading ? (
        <p className="text-school-blue-light">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-school-blue-light/30 shadow-sm">
          <table className="w-full border-collapse bg-school-surface">
            <thead>
              <tr className="bg-school-blue text-school-white">
                <th className="text-left p-3 font-semibold">Time</th>
                <th className="text-left p-3 font-semibold">Photo</th>
                <th className="text-left p-3 font-semibold">Username tried</th>
                <th className="text-left p-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-b border-school-blue-light/30 hover:bg-school-white/50">
                  <td className="p-3 text-school-blue-light whitespace-nowrap">{a.recorded_at}</td>
                  <td className="p-3">
                    {a.snapshot ? (
                      <button
                        type="button"
                        onClick={() => setPhotoPreview({ src: a.snapshot })}
                        className="p-0 border-0 bg-transparent rounded cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-school-blue"
                      >
                        <img
                          src={a.snapshot}
                          alt=""
                          className="w-14 h-14 object-cover rounded border border-school-blue-light/40"
                        />
                      </button>
                    ) : (
                      <span className="text-school-blue-light">–</span>
                    )}
                  </td>
                  <td className="p-3 text-school-blue font-mono text-sm break-all">{a.attempted_username || '–'}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      className="py-1.5 px-3 rounded-lg bg-school-red text-school-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
                    >
                      {deletingId === a.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 && (
            <p className="p-6 text-school-blue-light text-center m-0">No failed sign-in attempts recorded yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
