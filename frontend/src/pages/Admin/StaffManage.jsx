import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { api } from '../../api';

const TABS = [
  { id: 'register', label: 'Register staff' },
  { id: 'cards', label: 'Cards generated' },
  { id: 'all', label: 'All staff' },
  { id: 'today', label: "Today's arrival & departure" },
  { id: 'history', label: 'History records' },
  { id: 'excuse', label: 'Excuse of the day' },
];

const navBtn =
  'whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors border';
const navBtnActive =
  'bg-school-blue text-school-white border-school-blue shadow-sm';
const navBtnIdle =
  'bg-school-surface text-school-blue border-school-blue-light/40 hover:bg-school-white';

const emptyForm = () => ({
  full_name: '',
  role: '',
  phone: '',
  monthly_salary: '',
  work_days_per_month: '22',
  hours_per_day: '8',
});

function formatTime(iso) {
  if (!iso) return '–';
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function downloadBarcode(cardId, name) {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, cardId, {
    format: 'CODE128',
    displayValue: true,
    fontSize: 20,
    margin: 12,
    height: 72,
    background: '#ffffff',
    lineColor: '#000000',
  });
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'Staff'}-${cardId}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function LargeStaffCard({ staff }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !staff.card_id) return;
    JsBarcode(ref.current, staff.card_id, {
      format: 'CODE128',
      displayValue: true,
      fontSize: 22,
      margin: 14,
      height: 80,
    });
  }, [staff.card_id]);

  if (!staff.card_id) return null;

  return (
    <div className="p-6 rounded-xl border-2 border-school-blue-light/40 bg-school-white shadow-sm flex flex-col items-center text-center">
      <p className="m-0 text-school-blue font-bold text-lg">{staff.full_name}</p>
      <p className="m-0 mt-1 text-school-blue-light text-sm">{staff.role || 'Staff'}</p>
      <svg ref={ref} className="mt-4 w-full max-w-md bg-white rounded-lg" />
      <p className="m-0 mt-3 font-mono text-xl font-bold text-school-blue tracking-wider">{staff.card_id}</p>
      <button
        type="button"
        onClick={() => downloadBarcode(staff.card_id, staff.full_name)}
        className="mt-4 w-full max-w-xs py-3 px-6 rounded-lg bg-school-blue text-school-white font-semibold hover:opacity-90"
      >
        Download PNG
      </button>
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
  const [tab, setTab] = useState('register');
  const [staff, setStaff] = useState([]);
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyRange, setHistoryRange] = useState({ from: '', to: '' });
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);
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
        if (!historyRange.from) {
          const to = todayData.school_date || new Date().toISOString().slice(0, 10);
          const fromDate = new Date(to);
          fromDate.setDate(fromDate.getDate() - 30);
          setHistoryRange({
            from: fromDate.toISOString().slice(0, 10),
            to,
          });
        }
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  };

  const loadHistory = (from, to) => {
    if (!from || !to) return;
    setHistoryLoading(true);
    api(`/api/staff/attendance/history?from=${from}&to=${to}`)
      .then((data) => setHistory(data.records || []))
      .catch((e) => setMessage(e.message))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab === 'history' && historyRange.from && historyRange.to) {
      loadHistory(historyRange.from, historyRange.to);
    }
  }, [tab, historyRange.from, historyRange.to]);

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
        setForm(emptyForm());
        setMessage(`Staff created. Card ID: ${created.card_id}`);
        setTab('cards');
        load();
      })
      .catch((e) => setMessage(e.message));
  };

  const handleDelete = (row) => {
    if (!window.confirm(`Delete ${row.full_name} and their card?`)) return;
    api(`/api/staff/${row.id}`, { method: 'DELETE' })
      .then(() => {
        setMessage(`${row.full_name} deleted.`);
        load();
      })
      .catch((e) => setMessage(e.message));
  };

  const handleExcuse = (staffId, type) => {
    const note = excuseNote[staffId] || '';
    api(`/api/staff/${staffId}/excuse`, {
      method: 'POST',
      body: JSON.stringify({ excuse_type: type, excuse_note: note }),
    })
      .then(() => {
        setMessage(`Marked as ${type} — no pay deduction for today.`);
        load();
      })
      .catch((e) => setMessage(e.message));
  };

  const handleMarkAbsent = (staffId, staffName, deduction) => {
    if (!window.confirm(`Deduct one day's pay (${Number(deduction).toLocaleString()}) for ${staffName}?`)) return;
    const note = excuseNote[staffId] || '';
    api(`/api/staff/${staffId}/mark-absent`, {
      method: 'POST',
      body: JSON.stringify({ excuse_note: note || 'No reason' }),
    })
      .then(() => {
        setMessage(`Absent recorded for ${staffName} — one day's pay deducted.`);
        load();
      })
      .catch((e) => setMessage(e.message));
  };

  const absentToday = today?.staff?.filter((s) => s.absent_today) || [];

  const statusLabel = (att) => {
    if (!att) return 'No scan';
    if (att.status === 'excused') return `Excused (${att.excuse_type})`;
    if (att.status === 'absent') return 'Absent (deducted)';
    if (att.status === 'late') return `Late (${att.late_minutes} min)`;
    if (att.check_in_at) return 'On time';
    return att.status;
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h2 className="text-school-blue text-xl font-bold m-0 mb-2">Staff &amp; teachers</h2>
      {settings && (
        <p className="text-school-blue-light text-sm m-0 mb-4">
          Arrival deadline: <strong>{settings.report_time}</strong> ({settings.school_tz}).
        </p>
      )}
      {message && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-school-white border border-school-blue-light/30 text-school-blue m-0">
          {message}
        </p>
      )}

      <nav className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`${navBtn} ${tab === t.id ? navBtnActive : navBtnIdle}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {loading && tab !== 'history' ? (
        <p className="text-school-blue-light">Loading...</p>
      ) : null}

      {tab === 'register' && (
        <form
          onSubmit={handleCreate}
          className="p-4 rounded-lg border border-school-blue-light/30 bg-school-surface grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl"
        >
          <h3 className="md:col-span-2 mt-0 mb-1 text-school-blue font-semibold">Register staff member</h3>
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
      )}

      {tab === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {staff.length === 0 ? (
            <p className="text-school-blue-light col-span-2">No staff cards yet. Register staff first.</p>
          ) : (
            staff.map((s) => <LargeStaffCard key={s.id} staff={s} />)
          )}
        </div>
      )}

      {tab === 'all' && !loading && (
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
                <tr key={s.id} className="border-b border-school-blue-light/20">
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {staff.length === 0 && (
            <p className="p-6 text-center text-school-blue-light m-0">No staff yet.</p>
          )}
        </div>
      )}

      {tab === 'today' && today && (
        <div>
          <p className="text-school-blue-light text-sm m-0 mb-3">
            Date: <strong>{today.school_date}</strong> · Deadline {today.report_time}
          </p>
          <div className="overflow-x-auto rounded-lg border border-school-blue-light/30">
            <table className="w-full border-collapse bg-school-surface text-sm">
              <thead>
                <tr className="bg-school-blue text-school-white">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Arrival</th>
                  <th className="text-left p-3">Departure</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Deduction</th>
                </tr>
              </thead>
              <tbody>
                {today.staff.map((s) => {
                  const att = s.attendance;
                  return (
                    <tr key={s.staff_id} className="border-b border-school-blue-light/20">
                      <td className="p-3 font-medium text-school-blue">
                        {s.full_name}
                        {s.role ? <span className="text-school-blue-light font-normal"> — {s.role}</span> : null}
                      </td>
                      <td className="p-3">{formatTime(att?.check_in_at)}</td>
                      <td className="p-3">{formatTime(att?.check_out_at)}</td>
                      <td className="p-3">{statusLabel(att)}</td>
                      <td className="p-3">
                        {att?.deduction_amount > 0
                          ? Number(att.deduction_amount).toLocaleString()
                          : '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div>
          <div className="flex flex-wrap gap-3 items-end mb-4 p-4 rounded-lg bg-school-surface border border-school-blue-light/30">
            <label className="text-school-blue font-medium text-sm">
              From
              <input
                type="date"
                value={historyRange.from}
                onChange={(e) => setHistoryRange((r) => ({ ...r, from: e.target.value }))}
                className="block mt-1 px-3 py-2 border border-school-blue-light rounded-lg"
              />
            </label>
            <label className="text-school-blue font-medium text-sm">
              To
              <input
                type="date"
                value={historyRange.to}
                onChange={(e) => setHistoryRange((r) => ({ ...r, to: e.target.value }))}
                className="block mt-1 px-3 py-2 border border-school-blue-light rounded-lg"
              />
            </label>
            <button
              type="button"
              onClick={() => loadHistory(historyRange.from, historyRange.to)}
              className="py-2 px-4 rounded-lg bg-school-blue text-school-white font-semibold"
            >
              Load
            </button>
          </div>
          {historyLoading ? (
            <p className="text-school-blue-light">Loading history...</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-school-blue-light/30">
              <table className="w-full border-collapse bg-school-surface text-sm">
                <thead>
                  <tr className="bg-school-blue text-school-white">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Arrival</th>
                    <th className="text-left p-3">Departure</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Note</th>
                    <th className="text-left p-3">Deduction</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id} className="border-b border-school-blue-light/20">
                      <td className="p-3 whitespace-nowrap">{r.school_date}</td>
                      <td className="p-3 font-medium text-school-blue">{r.full_name}</td>
                      <td className="p-3">{formatTime(r.check_in_at)}</td>
                      <td className="p-3">{formatTime(r.check_out_at)}</td>
                      <td className="p-3">{statusLabel(r)}</td>
                      <td className="p-3 text-school-blue-light max-w-[12rem] truncate">
                        {r.excuse_note || '–'}
                      </td>
                      <td className="p-3">
                        {r.deduction_amount > 0 ? Number(r.deduction_amount).toLocaleString() : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length === 0 && (
                <p className="p-6 text-center text-school-blue-light m-0">No records in this range.</p>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'excuse' && (
        <section className="p-4 rounded-lg border border-amber-400/50 bg-amber-50/60">
          <h3 className="mt-0 text-amber-900 font-semibold text-lg">Excuse of the day</h3>
          <p className="text-sm text-school-blue-light m-0 mb-4">
            Staff who have not scanned in today. Choose a reason, or <strong>No reason</strong> to deduct one
            day&apos;s pay.
          </p>
          {absentToday.length === 0 ? (
            <p className="text-school-blue m-0">Everyone has scanned in or been processed for today.</p>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-4">
              {absentToday.map((s) => (
                <li
                  key={s.staff_id}
                  className="p-4 rounded-xl bg-school-surface border border-school-blue-light/30 shadow-sm"
                >
                  <p className="m-0 font-bold text-school-blue text-lg">
                    {s.full_name}
                    {s.role ? ` — ${s.role}` : ''}
                  </p>
                  <p className="m-0 mt-1 text-sm text-school-blue-light">
                    One day deduction: <strong>{Number(s.would_deduct_absent).toLocaleString()}</strong>
                  </p>
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={excuseNote[s.staff_id] || ''}
                    onChange={(e) => setExcuseNote((n) => ({ ...n, [s.staff_id]: e.target.value }))}
                    className="mt-3 block w-full px-3 py-2 border border-school-blue-light rounded-lg"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleExcuse(s.staff_id, 'sick')}
                      className="py-2 px-4 text-sm rounded-lg bg-green-700 text-white font-semibold hover:opacity-90"
                    >
                      Sick — no deduction
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcuse(s.staff_id, 'emergency')}
                      className="py-2 px-4 text-sm rounded-lg bg-school-blue text-white font-semibold hover:opacity-90"
                    >
                      Emergency — no deduction
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkAbsent(s.staff_id, s.full_name, s.would_deduct_absent)}
                      className="py-2 px-4 text-sm rounded-lg bg-school-red text-white font-semibold hover:opacity-90"
                    >
                      No reason — deduct pay
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {editing && (
        <EditModal
          staff={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setMessage(`${editing.full_name} updated.`);
            load();
          }}
        />
      )}
    </div>
  );
}
