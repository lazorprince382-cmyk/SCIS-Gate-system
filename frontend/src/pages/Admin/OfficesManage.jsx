import React, { useState, useEffect } from 'react';
import { api } from '../../api';

export default function OfficesManage() {
  const [offices, setOffices] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', notification_email: '', email_notifications_enabled: false });
  const [message, setMessage] = useState('');

  const load = () => api('/api/offices').then(setOffices).catch(console.error);

  useEffect(() => { load(); }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    setMessage('');
    api('/api/offices', {
      method: 'POST',
      body: JSON.stringify({
        name: form.name.trim(),
        notification_email: form.notification_email.trim() || null,
        email_notifications_enabled: form.email_notifications_enabled,
      }),
    })
      .then(() => { setForm({ name: '', notification_email: '', email_notifications_enabled: false }); load(); setMessage('Office created.'); })
      .catch((e) => setMessage(e.message));
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    if (!editing) return;
    setMessage('');
    api(`/api/offices/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: form.name.trim(),
        notification_email: form.notification_email.trim() || null,
        email_notifications_enabled: form.email_notifications_enabled,
      }),
    })
      .then(() => { setEditing(null); setForm({ name: '', notification_email: '', email_notifications_enabled: false }); load(); setMessage('Office updated.'); })
      .catch((e) => setMessage(e.message));
  };

  const startEdit = (o) => {
    setEditing(o);
    setForm({
      name: o.name,
      notification_email: o.notification_email || '',
      email_notifications_enabled: !!o.email_notifications_enabled,
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-school-blue text-xl font-bold mb-4">Offices</h2>
      {message && (
        <p className="p-3 bg-green-50 text-school-blue rounded-lg mb-4 border border-green-200">{message}</p>
      )}
      <form
        onSubmit={editing ? handleUpdate : handleCreate}
        className="flex flex-wrap gap-3 items-end mb-6"
      >
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Office name"
          required
          className="px-3 py-2 min-w-[160px] border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue focus:border-school-blue outline-none"
        />
        <input
          value={form.notification_email}
          onChange={(e) => setForm((f) => ({ ...f, notification_email: e.target.value }))}
          placeholder="Notification email"
          type="email"
          className="px-3 py-2 min-w-[200px] border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue focus:border-school-blue outline-none"
        />
        <label className="flex items-center gap-2 text-school-blue font-medium">
          <input
            type="checkbox"
            checked={form.email_notifications_enabled}
            onChange={(e) => setForm((f) => ({ ...f, email_notifications_enabled: e.target.checked }))}
            className="rounded border-school-blue-light"
          />
          Email notifications
        </label>
        <button
          type="submit"
          className="py-2 px-4 rounded-lg bg-school-blue text-school-white font-medium hover:opacity-90 transition-opacity"
        >
          {editing ? 'Update' : 'Add office'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => { setEditing(null); setForm({ name: '', notification_email: '', email_notifications_enabled: false }); }}
            className="py-2 px-4 rounded-lg bg-school-red text-school-white font-medium hover:opacity-90 transition-opacity"
          >
            Cancel
          </button>
        )}
      </form>
      <ul className="list-none p-0 m-0 space-y-2">
        {offices.map((o) => (
          <li
            key={o.id}
            className="p-4 bg-school-surface rounded-lg shadow-sm flex justify-between items-center border border-school-blue-light/30"
          >
            <span className="text-school-blue font-medium">
              {o.name}
              {o.notification_email && <span className="text-school-blue-light text-sm ml-1">({o.notification_email})</span>}
              {o.email_notifications_enabled && ' – email on'}
            </span>
            <button
              type="button"
              onClick={() => startEdit(o)}
              className="py-1.5 px-3 rounded-md bg-school-blue text-school-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Edit
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
