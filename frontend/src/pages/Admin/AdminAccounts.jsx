import React, { useEffect, useState } from 'react';
import { api } from '../../api';

const emptyForm = { username: '', password: '' };

export default function AdminAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const loadAccounts = () => {
    api('/api/admin/accounts')
      .then(setAccounts)
      .catch((e) => setMessage({ type: 'error', text: e.message || 'Failed to load accounts' }));
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);
    api('/api/admin/accounts', {
      method: 'POST',
      body: JSON.stringify({
        username: form.username.trim(),
        password: form.password,
      }),
    })
      .then((created) => {
        setAccounts((prev) => [...prev, created]);
        setForm(emptyForm);
        setMessage({ type: 'success', text: `Account "${created.username}" created.` });
      })
      .catch((e) => setMessage({ type: 'error', text: e.message || 'Failed to create account' }))
      .finally(() => setLoading(false));
  };

  const msgClass =
    message.type === 'error'
      ? 'bg-red-50 text-school-red border border-school-red/30'
      : 'bg-green-50 text-green-800 border border-green-200';

  const handleToggleActive = (account) => {
    const actionLabel = account.active ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} "${account.username}"?`)) return;
    setActingId(account.id);
    setMessage({ type: '', text: '' });
    api(`/api/admin/accounts/${account.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !account.active }),
    })
      .then((updated) => {
        setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setMessage({ type: 'success', text: `Account "${updated.username}" is now ${updated.active ? 'active' : 'disabled'}.` });
      })
      .catch((e) => setMessage({ type: 'error', text: e.message || 'Failed to update account' }))
      .finally(() => setActingId(null));
  };

  const handleDelete = (account) => {
    if (!window.confirm(`Delete account "${account.username}"? This cannot be undone.`)) return;
    setActingId(account.id);
    setMessage({ type: '', text: '' });
    api(`/api/admin/accounts/${account.id}`, { method: 'DELETE' })
      .then(() => {
        setAccounts((prev) => prev.filter((a) => a.id !== account.id));
        setMessage({ type: 'success', text: `Account "${account.username}" deleted.` });
      })
      .catch((e) => setMessage({ type: 'error', text: e.message || 'Failed to delete account' }))
      .finally(() => setActingId(null));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-school-blue text-xl font-bold mb-4">Admin accounts</h2>

      <form onSubmit={handleCreate} className="bg-school-surface rounded-xl border border-school-blue-light/30 p-4 sm:p-5 shadow-sm">
        <h3 className="m-0 mb-3 text-school-blue font-semibold">Add new account</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-school-blue font-medium">
            Username
            <input
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue outline-none"
              required
              minLength={3}
            />
          </label>
          <label className="block text-school-blue font-medium">
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue outline-none"
              required
              minLength={8}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-4 py-2.5 px-5 rounded-lg bg-school-blue text-school-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {loading ? 'Creating...' : 'Create account'}
        </button>
      </form>

      {message.text ? (
        <p className={`mt-4 p-3 rounded-lg ${msgClass}`}>{message.text}</p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-lg border border-school-blue-light/30 shadow-sm">
        <table className="w-full border-collapse bg-school-white">
          <thead>
            <tr className="bg-school-blue text-school-white">
              <th className="text-left p-3 font-semibold">Username</th>
              <th className="text-left p-3 font-semibold">Role</th>
              <th className="text-left p-3 font-semibold">Status</th>
              <th className="text-left p-3 font-semibold">Created</th>
              <th className="text-left p-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-school-blue-light/30 hover:bg-school-surface/50">
                <td className="p-3 text-school-blue font-medium">
                  {a.username}
                  {currentUser.username === a.username ? (
                    <span className="ml-2 inline-block align-middle px-2 py-0.5 rounded bg-school-blue/10 text-school-blue-light text-xs font-semibold">
                      You
                    </span>
                  ) : null}
                </td>
                <td className="p-3">{a.role}</td>
                <td className="p-3">{a.active ? 'Active' : 'Disabled'}</td>
                <td className="p-3 text-school-blue-light">{a.created_at}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actingId === a.id || currentUser.username === a.username}
                      onClick={() => handleToggleActive(a)}
                      className="py-1.5 px-3 rounded-lg bg-school-blue text-school-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
                    >
                      {actingId === a.id ? 'Saving...' : a.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      disabled={actingId === a.id || currentUser.username === a.username}
                      onClick={() => handleDelete(a)}
                      className="py-1.5 px-3 rounded-lg bg-school-red text-school-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {accounts.length === 0 && (
          <p className="p-5 text-center text-school-blue-light m-0">No admin accounts found.</p>
        )}
      </div>
    </div>
  );
}
