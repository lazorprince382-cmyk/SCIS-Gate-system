import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { api } from '../../api';

const emptyForm = () => ({
  full_name: '',
  role: '',
  phone: '',
  monthly_salary: '',
  work_days_per_month: '22',
  hours_per_day: '8',
});

function StaffBarcode({ cardId, name }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !cardId) return;
    JsBarcode(ref.current, cardId, {
      format: 'CODE128',
      displayValue: true,
      fontSize: 14,
      margin: 6,
      height: 44,
    });
  }, [cardId]);
  if (!cardId) return null;
  return (
    <div className="mt-2">
      <svg ref={ref} className="bg-white rounded border border-school-blue-light/30 max-w-full" />
      <p className="m-0 mt-1 text-xs text-school-blue-light">{name} — card {cardId}</p>
    </div>
  );
}

function EditModal({ staff, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: staff.full_name,
    role: staff.role,
    phone: staff.phone,
    monthly_salary: String(staff.monthly_salary),
    work_days_per_month: String(staff.work_days_per_month),
    hours_per_day: String(staff.hours_per_day),
    active: staff.active,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    api(`/api/staff/${staff.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...form,
        monthly_salary: Number(form.monthly_salary),
        work_days_per_month: Number(form.work_days_per_month),
        hours_per_day: Number(form.hours_per_day),
      }),
    })
      .then((updated) => {
        onSaved(updated);
        onClose();
      })
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-school-surface rounded-xl shadow-xl border border-school-blue-light/30 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="mt-0 text-school-blue text-lg font-bold">Edit staff</h3>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <label className="text-school-blue font-medium text-sm">
            Full name
            <input
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              required
              className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg"
            />
          </label>
          <label className="text-school-blue font-medium text-sm">
            Role
            <input
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg"
            />
          </label>
          <label className="text-school-blue font-medium text-sm">
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg"
            />
          </label>
          <label className="text-school-blue font-medium text-sm">
            Monthly salary
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.monthly_salary}
              onChange={(e) => setForm((f) => ({ ...f, monthly_salary: e.target.value }))}
              required
              className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg"
            />
          </label>
          <label className="text-school-blue font-medium text-sm">
            Work days per month
            <input
              type="number"
              min="1"
              max="31"
              value={form.work_days_per_month}
              onChange={(e) => setForm((f) => ({ ...f, work_days_per_month: e.target.value }))}
              className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg"
            />
          </label>
          <label className="text-school-blue font-medium text-sm">
            Hours per day
            <input
              type="number"
              min="1"
              max="24"
              step="0.5"
              value={form.hours_per_day}
              onChange={(e) => setForm((f) => ({ ...f, hours_per_day: e.target.value }))}
              className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg"
            />
          </label>
          <label className="flex items-center gap-2 text-school-blue text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Active
          </label>
          {error && <p className="text-school-red text-sm m-0">{error}</p>}
          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-school-blue text-school-white font-semibold disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-lg border border-school-blue-light text-school-blue"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StaffManage() {
  const [staff, setStaff] = useState([]);
  const [today, setToday] = useState(null);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [excuseNote, setExcuseNote] = useState({});

  const load = () => {
    setLoading(true);
    Promise.all([
      api('/api/staff'),
      api('/api/staff/attendance/today'),
      api('/api/staff/settings'),
    ])
      .then(([list, todayData, cfg]) => {
        setStaff(list);
        setToday(todayData);
        setSettings(cfg);
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    setMessage('');
    api('/api/staff', {
      method: 'POST',
      body: JSON.stringify({
        full_name: form.full_name.trim(),
        role: form.role.trim(),
        phone: form.phone.trim(),
        monthly_salary: Number(form.monthly_salary),
        work_days_per_month: Number(form.work_days_per_month) || 22,
        hours_per_day: Number(form.hours_per_day) || 8,
      }),
    })
      .then((created) => {
        setStaff((prev) => [...prev, created].sort((a, b) => a.full_name.localeCompare(b.full_name)));
        setForm(emptyForm());
        setMessage(`Staff created. Card ID: ${created.card_id}`);
        load();
      })
      .catch((e) => setMessage(e.message));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete ${row.full_name} and their card?`)) return;
    api(`/api/staff/${row.id}`, { method: 'DELETE' })
      .then(() => {
        setStaff((prev) => prev.filter((s) => s.id !== row.id));
        setMessage(`${row.full_name} deleted.`);
        load();
      })
      .catch((e) => setMessage(e.message));
  };

  const handleExcuse = (staffId, type) => {
    const note = excuseNote[staffId] || '';
    api(`/api/staff/${staffId}/excuse`, {
      method: 'POST',
      body: JSON.stringify({
        excuse_type: type,
        excuse_note: note,
      }),
    })
      .then(() => {
        setMessage(`Marked as ${type} — no pay deduction for today.`);
        load();
      })
      .catch((e) => setMessage(e.message));
  };

  const loadSummary = (id) => {
    const month = new Date().toISOString().slice(0, 7);
    api(`/api/staff/${id}/summary?month=${month}`)
      .then(setSummary)
      .catch((e) => setMessage(e.message));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-school-blue text-xl font-bold m-0 mb-2">Staff &amp; teachers</h2>
      {settings && (
        <p className="text-school-blue-light text-sm m-0 mb-4">
          Arrival deadline: <strong>{settings.report_time}</strong> ({settings.school_tz}).
          Late minutes deduct pro‑rata from monthly pay. Unexcused absence deducts one day&apos;s pay.
        </p>
      )}
      {message && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-school-white border border-school-blue-light/30 text-school-blue m-0">
          {message}
        </p>
      )}

      <form
        onSubmit={handleCreate}
        className="mb-6 p-4 rounded-lg border border-school-blue-light/30 bg-school-surface grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <h3 className="md:col-span-2 mt-0 mb-1 text-school-blue font-semibold">Add staff member</h3>
        <label className="text-school-blue font-medium text-sm">
          Full name *
          <input
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            required
            className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg"
          />
        </label>
        <label className="text-school-blue font-medium text-sm">
          Role
          <input
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            placeholder="Teacher, Accountant..."
            className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg"
          />
        </label>
        <label className="text-school-blue font-medium text-sm">
          Phone
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg"
          />
        </label>
        <label className="text-school-blue font-medium text-sm">
          Monthly salary *
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.monthly_salary}
            onChange={(e) => setForm((f) => ({ ...f, monthly_salary: e.target.value }))}
            required
            className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg"
          />
        </label>
        <button
          type="submit"
          className="md:col-span-2 py-2.5 rounded-lg bg-school-blue text-school-white font-semibold hover:opacity-90"
        >
          Create staff &amp; generate card
        </button>
      </form>

      {today && today.staff?.some((s) => s.absent_today) && (
        <section className="mb-6 p-4 rounded-lg border border-school-red/30 bg-red-50/50">
          <h3 className="mt-0 text-school-red font-semibold">No morning scan today</h3>
          <p className="text-sm text-school-blue-light m-0 mb-3">
            These staff have not scanned in. One day&apos;s pay will be deducted unless you excuse them (sick / emergency).
          </p>
          <ul className="list-none p-0 m-0 flex flex-col gap-3">
            {today.staff
              .filter((s) => s.absent_today)
              .map((s) => (
                <li key={s.staff_id} className="p-3 rounded-lg bg-school-surface border border-school-blue-light/20">
                  <p className="m-0 font-medium text-school-blue">
                    {s.full_name}
                    {s.role ? ` — ${s.role}` : ''}
                  </p>
                  <input
                    type="text"
                    placeholder="Reason (optional)"
                    value={excuseNote[s.staff_id] || ''}
                    onChange={(e) => setExcuseNote((n) => ({ ...n, [s.staff_id]: e.target.value }))}
                    className="mt-2 block w-full px-2 py-1.5 text-sm border border-school-blue-light rounded"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleExcuse(s.staff_id, 'sick')}
                      className="py-1.5 px-3 text-sm rounded-lg bg-green-700 text-white font-medium"
                    >
                      Sick — no deduction
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcuse(s.staff_id, 'emergency')}
                      className="py-1.5 px-3 text-sm rounded-lg bg-school-blue text-white font-medium"
                    >
                      Emergency — no deduction
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}

      {loading ? (
        <p className="text-school-blue-light">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-school-blue-light/30">
          <table className="w-full border-collapse bg-school-surface text-sm">
            <thead>
              <tr className="bg-school-blue text-school-white">
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Role</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-left p-3">Monthly salary</th>
                <th className="text-left p-3">Card</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <React.Fragment key={s.id}>
                  <tr className="border-b border-school-blue-light/20">
                    <td className="p-3 font-medium text-school-blue">{s.full_name}</td>
                    <td className="p-3">{s.role || '–'}</td>
                    <td className="p-3">{s.phone || '–'}</td>
                    <td className="p-3">{Number(s.monthly_salary).toLocaleString()}</td>
                    <td className="p-3 font-mono">{s.card_id || '–'}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(s)}
                          className="py-1 px-2 rounded bg-school-blue text-white text-xs font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className="py-1 px-2 rounded bg-school-red text-white text-xs font-semibold"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedId(expandedId === s.id ? null : s.id);
                            if (expandedId !== s.id) loadSummary(s.id);
                          }}
                          className="py-1 px-2 rounded border border-school-blue-light text-school-blue text-xs"
                        >
                          {expandedId === s.id ? 'Hide' : 'Month'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr>
                      <td colSpan={6} className="p-4 bg-school-white/60">
                        <StaffBarcode cardId={s.card_id} name={s.full_name} />
                        {summary?.staff?.id === s.id && (
                          <div className="mt-4 text-school-blue text-sm">
                            <p className="m-0 font-semibold">
                              {summary.month} — total deduction estimate:{' '}
                              {summary.totals.total_deduction.toLocaleString()}
                            </p>
                            <p className="m-0 mt-1 text-school-blue-light">
                              Late: {summary.totals.late_minutes} min (
                              {summary.totals.late_deduction.toLocaleString()}
                              ) · Absent days: {summary.totals.absent_days} (
                              {summary.totals.absent_deduction.toLocaleString()}
                              ) · Excused: {summary.totals.excused_days}
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {staff.length === 0 && (
            <p className="p-6 text-center text-school-blue-light m-0">No staff yet. Add one above.</p>
          )}
        </div>
      )}

      {editing && (
        <EditModal
          staff={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            setMessage(`${updated.full_name} updated.`);
          }}
        />
      )}
    </div>
  );
}
