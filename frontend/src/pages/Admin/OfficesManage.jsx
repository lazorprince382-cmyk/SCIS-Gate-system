import React, { useState, useEffect } from 'react';
import { api } from '../../api';

const emptyForm = () => ({
  name: '',
  notification_email: '',
  email_notifications_enabled: false,
});

export default function OfficesManage() {
  const [offices, setOffices] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const load = () => api('/api/offices').then(setOffices).catch((e) => setMessage(e.message));

  useEffect(() => {
    load();
  }, []);

  const onEmailChange = (value) => {
    setForm((f) => ({
      ...f,
      notification_email: value,
      email_notifications_enabled: value.trim() ? true : f.email_notifications_enabled,
    }));
  };

  const handleCreate = (e) => {
    e.preventDefault();
    setMessage('');
    const email = form.notification_email.trim();
    api('/api/offices', {
      method: 'POST',
      body: JSON.stringify({
        name: form.name.trim(),
        notification_email: email,
        email_notifications_enabled: email ? form.email_notifications_enabled : false,
      }),
    })
      .then(() => {
        setForm(emptyForm());
        load();
        setMessage('Office created.');
      })
      .catch((e) => setMessage(e.message));
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    if (!editing) return;
    setMessage('');
    const email = form.notification_email.trim();
    api(`/api/offices/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: form.name.trim(),
        notification_email: email,
        email_notifications_enabled: email ? form.email_notifications_enabled : false,
      }),
    })
      .then(() => {
        setEditing(null);
        setForm(emptyForm());
        load();
        setMessage('Office updated.');
      })
      .catch((e) => setMessage(e.message));
  };

  const handleDelete = (o) => {
    if (!window.confirm(`Delete office "${o.name}"? This cannot be undone.`)) return;
    setDeletingId(o.id);
    setMessage('');
    api(`/api/offices/${o.id}`, { method: 'DELETE' })
      .then(() => {
        setOffices((prev) => prev.filter((x) => x.id !== o.id));
        if (editing?.id === o.id) {
          setEditing(null);
          setForm(emptyForm());
        }
        setMessage(`Office "${o.name}" deleted.`);
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setDeletingId(null));
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
      <h2 className="text-school-blue text-xl font-bold m-0 mb-2">Offices</h2>
      <p className="text-school-blue-light text-sm m-0 mb-4">
        When a visitor registers for an office, that office receives an email with the visitor&apos;s details
        (if notification email is set and <strong>Email notifications</strong> is on). Configure SMTP in the
        server <code className="text-xs">.env</code> file.
      </p>
      {message && (
        <p className="p-3 bg-green-50 text-school-blue rounded-lg mb-4 border border-green-200 m-0">{message}</p>
      )}
      <form
        onSubmit={editing ? handleUpdate : handleCreate}
        className="p-4 rounded-lg border border-school-blue-light/30 bg-school-surface flex flex-wrap gap-3 items-end mb-6"
      >
        <label className="text-school-blue font-medium text-sm">
          Office name
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Principal Office"
            required
            className="block mt-1 px-3 py-2 min-w-[160px] border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue outline-none"
          />
        </label>
        <label className="text-school-blue font-medium text-sm">
          Notification email
          <input
            value={form.notification_email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="office@school.com"
            type="email"
            className="block mt-1 px-3 py-2 min-w-[220px] border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-school-blue font-medium text-sm pb-2">
          <input
            type="checkbox"
            checked={form.email_notifications_enabled}
            onChange={(e) => setForm((f) => ({ ...f, email_notifications_enabled: e.target.checked }))}
            disabled={!form.notification_email.trim()}
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
            onClick={() => {
              setEditing(null);
              setForm(emptyForm());
            }}
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
            className="p-4 bg-school-surface rounded-lg shadow-sm flex flex-wrap justify-between items-center gap-3 border border-school-blue-light/30"
          >
            <div className="min-w-0">
              <span className="text-school-blue font-medium block">{o.name}</span>
              {o.notification_email ? (
                <span className="text-school-blue-light text-sm block mt-1">{o.notification_email}</span>
              ) : (
                <span className="text-school-blue-light text-sm block mt-1">No notification email</span>
              )}
              {o.email_notifications_enabled && o.notification_email ? (
                <span className="text-green-700 text-xs font-semibold mt-1 inline-block">Email alerts on</span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => startEdit(o)}
                className="py-1.5 px-3 rounded-md bg-school-blue text-school-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(o)}
                disabled={deletingId === o.id}
                className="py-1.5 px-3 rounded-md bg-school-red text-school-white text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {deletingId === o.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {offices.length === 0 && (
        <p className="text-school-blue-light text-center mt-4">No offices yet. Add one above.</p>
      )}
    </div>
  );
}
