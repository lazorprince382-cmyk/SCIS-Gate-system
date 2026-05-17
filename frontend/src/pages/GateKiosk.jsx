import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { BarcodeInput } from '../components/BarcodeInput';
import Navbar from '../components/Navbar';
import { SCHOOL_BADGE_URL } from '../theme';
import { api } from '../api';
import { absoluteAppUrl, appPath } from '../appPath';

const PURPOSE_PRESET_CUSTOM = '__custom__';

function PhoneScanSessionBox({ phoneSession }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  useEffect(() => {
    if (!phoneSession?.id) {
      setQrDataUrl('');
      return undefined;
    }
    const url = absoluteAppUrl(`phone-scan/${phoneSession.id}`);
    let cancelled = false;
    QRCode.toDataURL(url, { width: 220, margin: 2, errorCorrectionLevel: 'M' })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [phoneSession?.id]);

  const showLocalhostHint = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const pairCode = phoneSession?.pair_code || '------';

  return (
    <div className="p-3 rounded-lg border border-school-blue-light/40 bg-school-surface text-sm text-school-blue">
      <p className="m-0 font-medium">Scan this code with your phone camera — opens the scanner in one tap.</p>
      {qrDataUrl ? (
        <div className="mt-3 flex justify-center">
          <img
            src={qrDataUrl}
            alt="QR code — scan to open phone barcode scanner"
            className="w-44 h-44 rounded-lg border border-school-blue-light/30 bg-school-white"
          />
        </div>
      ) : (
        <p className="m-0 mt-2 text-school-blue-light">Generating QR…</p>
      )}
      <p className="m-0 mt-3">
        Or open{' '}
        <span className="font-mono font-semibold">{absoluteAppUrl('phone-scan')}</span>
        {' '}
        and enter code:
      </p>
      <p className="m-0 mt-1 text-center text-2xl font-mono font-bold tracking-[0.35em] text-school-blue">
        {pairCode}
      </p>
      <p className="m-0 mt-3 text-school-blue-light text-xs">Direct link (fallback):</p>
      <p className="m-0 mt-1 font-mono break-all text-xs">
        {absoluteAppUrl(`phone-scan/${phoneSession.id}`)}
      </p>
      {showLocalhostHint ? (
        <p className="m-0 mt-2 text-school-blue-light text-xs">
          If the phone is on the same Wi‑Fi, replace localhost in the link with this computer&apos;s LAN IP.
        </p>
      ) : null}
    </div>
  );
}

const emptyRegisterForm = () => ({
  visitor_name: '',
  visitor_contact: '',
  visitor_from: '',
  office_id: '',
});

export default function GateKiosk() {
  const [offices, setOffices] = useState([]);
  const [mode, setMode] = useState('menu');
  const [form, setForm] = useState(emptyRegisterForm);
  const [purposePreset, setPurposePreset] = useState('');
  const [purposeCustom, setPurposeCustom] = useState('');
  const [cardLookup, setCardLookup] = useState(null);
  const [scanOutCard, setScanOutCard] = useState('');
  const [phoneSession, setPhoneSession] = useState(null);
  const [phoneHint, setPhoneHint] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [staffSettings, setStaffSettings] = useState(null);
  const videoRef = useRef(null);
  const captureDoneRef = useRef(false);
  const visitorPhotoRef = useRef(null);

  const tryCaptureVisitorPhoto = useCallback(() => {
    if (captureDoneRef.current) return;
    const v = videoRef.current;
    if (!v || v.readyState < 2 || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(v, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
      if (dataUrl && dataUrl.length > 200) {
        visitorPhotoRef.current = dataUrl;
        captureDoneRef.current = true;
      }
    } catch {
      /* canvas may be tainted in edge cases */
    }
  }, []);

  useEffect(() => {
    if (mode !== 'register') return undefined;
    captureDoneRef.current = false;
    visitorPhotoRef.current = null;
    let stream;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          el.play().catch(() => {});
        }
      } catch {
        /* no camera — visit still works without photo */
      }
    };
    start();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [mode]);

  useEffect(() => {
    api('/api/offices').then(setOffices).catch(() => setMessage({ type: 'error', text: 'Failed to load offices' }));
    api('/api/staff/settings').then(setStaffSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!phoneSession?.id) return undefined;
    const timer = setInterval(() => {
      api(`/api/scan-sessions/${phoneSession.id}`)
        .then((session) => {
          if (session.status === 'scanned' && session.barcode) {
            if (session.mode === 'scanOut') handleScanOut(session.barcode);
            else handleBarcodeLookup(session.barcode);
            setPhoneHint(`Received from phone: ${session.barcode}`);
            setPhoneSession(null);
          } else if (session.status === 'rejected') {
            setPhoneHint(`Phone scan rejected: ${session.error}`);
          }
        })
        .catch(() => {});
    }, 1200);
    return () => clearInterval(timer);
  }, [phoneSession]);

  const handleBarcodeLookup = (value) => {
    setMessage({ type: '', text: '' });
    api(`/api/cards/lookup/${encodeURIComponent(value)}`)
      .then((data) => {
        setCardLookup(data);
        if (data.currentVisit) {
          setMessage({ type: 'info', text: `Card in use: ${data.currentVisit.visitor_name} – Scan out at Scan Out screen.` });
        } else {
          setMessage({ type: 'success', text: `Card ${data.card.card_id} ready. Fill form and submit.` });
        }
      })
      .catch((e) => setMessage({ type: 'error', text: e.message }));
  };

  const startPhoneScan = (targetMode) => {
    setPhoneHint('');
    api('/api/scan-sessions', {
      method: 'POST',
      body: JSON.stringify({ mode: targetMode }),
    })
      .then((session) => {
        setPhoneSession(session);
        setPhoneHint('Open this session on phone and scan card barcode.');
      })
      .catch((e) => setMessage({ type: 'error', text: e.message }));
  };

  const handleSubmitVisit = (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    const cardId = cardLookup?.card?.id;
    if (!cardId) {
      setMessage({ type: 'error', text: 'Scan a barcode card first.' });
      return;
    }
    if (!form.visitor_name.trim()) {
      setMessage({ type: 'error', text: 'Visitor name is required.' });
      return;
    }
    if (!purposePreset) {
      setMessage({ type: 'error', text: 'Select a purpose.' });
      return;
    }
    const purpose =
      purposePreset === PURPOSE_PRESET_CUSTOM
        ? purposeCustom.trim()
        : purposePreset;
    if (!purpose) {
      setMessage({ type: 'error', text: 'Please describe your purpose.' });
      return;
    }
    if (!form.office_id) {
      setMessage({ type: 'error', text: 'Select an office.' });
      return;
    }
    setLoading(true);
    api('/api/visits', {
      method: 'POST',
      body: JSON.stringify({
        visitor_name: form.visitor_name.trim(),
        visitor_contact: form.visitor_contact.trim() || undefined,
        visitor_from: form.visitor_from.trim() || undefined,
        visitor_photo: visitorPhotoRef.current || undefined,
        purpose,
        office_id: parseInt(form.office_id, 10),
        barcode_card_id: cardId,
      }),
    })
      .then(() => {
        setMessage({ type: 'success', text: 'Visit registered. Office notified.' });
        setForm(emptyRegisterForm());
        setPurposePreset('');
        setPurposeCustom('');
        setCardLookup(null);
        captureDoneRef.current = false;
        visitorPhotoRef.current = null;
      })
      .catch((e) => setMessage({ type: 'error', text: e.message }))
      .finally(() => setLoading(false));
  };

  const handleScanOut = (value) => {
    setMessage({ type: '', text: '' });
    setScanOutCard(value);
    api('/api/visits/scan-out', { method: 'POST', body: JSON.stringify({ card_id: value }) })
      .then((visit) => {
        setMessage({ type: 'success', text: `${visit.visitor_name} signed out.` });
        setScanOutCard('');
      })
      .catch((e) => setMessage({ type: 'error', text: e.message }));
  };

  const handleStaffScanIn = (value) => {
    setMessage({ type: '', text: '' });
    api('/api/staff/scan-in', { method: 'POST', body: JSON.stringify({ card_id: value }) })
      .then((data) => {
        if (data.on_time) {
          setMessage({
            type: 'success',
            text: `${data.staff_name} — on time. Welcome.`,
          });
        } else {
          setMessage({
            type: 'error',
            text: `${data.staff_name} — LATE by ${data.late_minutes} min. Deduction: ${Number(data.deduction_amount).toLocaleString()}`,
          });
        }
      })
      .catch((e) => setMessage({ type: 'error', text: e.message }));
  };

  const handleStaffScanOut = (value) => {
    setMessage({ type: '', text: '' });
    api('/api/staff/scan-out', { method: 'POST', body: JSON.stringify({ card_id: value }) })
      .then((data) => {
        setMessage({ type: 'success', text: `${data.staff_name} — departure recorded.` });
      })
      .catch((e) => setMessage({ type: 'error', text: e.message }));
  };

  const messageStyles = {
    error: 'bg-red-50 text-school-red border border-school-red/30',
    success: 'bg-green-50 text-green-800 border border-green-200',
    info: 'bg-blue-50 text-school-blue border border-school-blue/30',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9ebff] via-[#d8f5ff] to-[#bfefff]">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {mode === 'menu' ? (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="flex justify-center lg:justify-start">
              <img
                src={SCHOOL_BADGE_URL}
                alt="Shalom Cambridge International School badge"
                className="w-[260px] h-[260px] sm:w-[360px] sm:h-[360px] object-contain drop-shadow-md"
              />
            </div>
            <div className="w-full max-w-md justify-self-center lg:justify-self-end">
              <h2
                className="mt-1 mb-6 text-5xl font-extrabold tracking-[0.16em] leading-[1.15] text-school-red text-center"
                style={{
                  textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                }}
              >
                WELCOME
              </h2>
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="w-full py-4 px-6 rounded-xl bg-school-blue text-school-white text-3xl font-semibold hover:opacity-90 transition-opacity shadow-sm"
                >
                  New visit (register)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('scanOut')}
                  className="w-full py-4 px-6 rounded-xl bg-red-700 text-school-white text-3xl font-semibold hover:opacity-90 transition-opacity shadow-sm"
                >
                  Scan out
                </button>
                <button
                  type="button"
                  onClick={() => setMode('staffIn')}
                  className="w-full py-4 px-6 rounded-xl bg-emerald-700 text-school-white text-2xl font-semibold hover:opacity-90 transition-opacity shadow-sm"
                >
                  Staff arrival
                </button>
                <button
                  type="button"
                  onClick={() => setMode('staffOut')}
                  className="w-full py-4 px-6 rounded-xl bg-amber-700 text-school-white text-2xl font-semibold hover:opacity-90 transition-opacity shadow-sm"
                >
                  Staff departure
                </button>
              </div>
            </div>
          </section>
        ) : null}
        {mode === 'register' && (
          <form onSubmit={handleSubmitVisit} className="relative flex flex-col gap-4 max-w-2xl mx-auto bg-school-white/80 backdrop-blur-sm p-5 rounded-xl border border-school-blue-light/30 shadow-sm">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="fixed left-0 top-0 w-px h-px opacity-0 pointer-events-none"
              aria-hidden
            />
            <p className="text-school-blue-light text-sm">Scan barcode first, then fill the form.</p>
            <label className="block text-school-blue font-medium">
              Barcode (scanner only)
              <BarcodeInput
                onScan={handleBarcodeLookup}
                placeholder="Scan barcode here (scanner only)..."
                disabled={false}
              />
            </label>
            <button
              type="button"
              onClick={() => startPhoneScan('register')}
              className="w-full py-2 px-4 rounded-lg bg-school-surface border border-school-blue-light text-school-blue font-medium"
            >
              Use phone camera as scanner
            </button>
            {phoneSession?.mode === 'register' && <PhoneScanSessionBox phoneSession={phoneSession} />}
            {cardLookup && (
              <p className="m-0 p-3 bg-school-surface rounded-lg border-l-4 border-school-red text-school-blue text-sm">
                Card: {cardLookup.card.card_id} {cardLookup.currentVisit && '(in use – use Scan out)'}
              </p>
            )}
            <label className="block text-school-blue font-medium">
              Visitor name *
              <input
                value={form.visitor_name}
                onChange={(e) => setForm((f) => ({ ...f, visitor_name: e.target.value }))}
                required
                className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue focus:border-school-blue outline-none"
              />
            </label>
            <label className="block text-school-blue font-medium">
              Contact (phone/email)
              <input
                value={form.visitor_contact}
                onChange={(e) => {
                  const visitor_contact = e.target.value;
                  setForm((f) => ({ ...f, visitor_contact }));
                  const digits = visitor_contact.replace(/\D/g, '').length;
                  if (digits >= 4 || visitor_contact.trim().length >= 8) {
                    requestAnimationFrame(() => tryCaptureVisitorPhoto());
                  }
                }}
                onBlur={() => tryCaptureVisitorPhoto()}
                className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue focus:border-school-blue outline-none"
              />
            </label>
            <label className="block text-school-blue font-medium">
              Visitor comes from
              <input
                value={form.visitor_from}
                onChange={(e) => setForm((f) => ({ ...f, visitor_from: e.target.value }))}
                placeholder="School, company, area, or city"
                className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue focus:border-school-blue outline-none"
              />
            </label>
            <label className="block text-school-blue font-medium">
              Purpose *
              <select
                value={purposePreset}
                onChange={(e) => {
                  const v = e.target.value;
                  setPurposePreset(v);
                  if (v !== PURPOSE_PRESET_CUSTOM) setPurposeCustom('');
                }}
                required
                className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue focus:border-school-blue outline-none"
              >
                <option value="">Select purpose</option>
                <option value="Visitor">Visitor</option>
                <option value="Job application">Job application</option>
                <option value="Parent meeting">Parent meeting</option>
                <option value="Delivery">Delivery</option>
                <option value="Official meeting">Official meeting</option>
                <option value="Fee / accounts">Fee / accounts</option>
                <option value={PURPOSE_PRESET_CUSTOM}>Other (type below)</option>
              </select>
            </label>
            {purposePreset === PURPOSE_PRESET_CUSTOM && (
              <label className="block text-school-blue font-medium">
                Describe purpose *
                <input
                  value={purposeCustom}
                  onChange={(e) => setPurposeCustom(e.target.value)}
                  placeholder="Type your purpose"
                  required
                  className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue focus:border-school-blue outline-none"
                />
              </label>
            )}
            <label className="block text-school-blue font-medium">
              Office *
              <select
                value={form.office_id}
                onChange={(e) => setForm((f) => ({ ...f, office_id: e.target.value }))}
                required
                className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue focus:border-school-blue outline-none"
              >
                <option value="">Select office</option>
                {offices.filter((o) => o.active).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-5 rounded-lg bg-school-blue text-school-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {loading ? 'Registering...' : 'Register visit'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('menu');
                  setCardLookup(null);
                  setForm(emptyRegisterForm());
                  setPurposePreset('');
                  setPurposeCustom('');
                  captureDoneRef.current = false;
                  visitorPhotoRef.current = null;
                }}
                className="py-3 px-5 rounded-lg bg-school-red text-school-white font-semibold hover:opacity-90 transition-opacity"
              >
                Back
              </button>
            </div>
          </form>
        )}
        {mode === 'scanOut' && (
          <div className="flex flex-col gap-4 max-w-2xl mx-auto bg-school-white/80 backdrop-blur-sm p-5 rounded-xl border border-school-blue-light/30 shadow-sm">
            <p className="text-school-blue-light text-sm">Scan barcode to sign out.</p>
            <label className="block text-school-blue font-medium">
              Barcode (scanner only)
              <BarcodeInput
                onScan={handleScanOut}
                placeholder="Scan barcode to sign out (scanner only)..."
                disabled={false}
              />
            </label>
            <button
              type="button"
              onClick={() => startPhoneScan('scanOut')}
              className="w-full py-2 px-4 rounded-lg bg-school-surface border border-school-blue-light text-school-blue font-medium"
            >
              Use phone camera as scanner
            </button>
            {phoneSession?.mode === 'scanOut' && <PhoneScanSessionBox phoneSession={phoneSession} />}
            {scanOutCard && <p className="text-school-blue-light text-sm mt-1">Processing card: {scanOutCard}</p>}
            <button
              type="button"
              onClick={() => setMode('menu')}
              className="mt-3 py-3 px-5 rounded-lg bg-school-red text-school-white font-semibold hover:opacity-90 transition-opacity"
            >
              Back
            </button>
          </div>
        )}
        {mode === 'staffIn' && (
          <div className="flex flex-col gap-4 max-w-2xl mx-auto bg-school-white/80 backdrop-blur-sm p-5 rounded-xl border border-emerald-700/40 shadow-sm">
            <h3 className="m-0 text-emerald-800 text-xl font-bold">Staff arrival</h3>
            {staffSettings && (
              <p className="m-0 text-school-blue-light text-sm">
                Must scan by {staffSettings.report_time}. Late minutes reduce monthly pay (pro‑rata).
              </p>
            )}
            <label className="block text-school-blue font-medium">
              Staff card (scanner)
              <BarcodeInput
                onScan={handleStaffScanIn}
                placeholder="Scan staff card for arrival..."
                disabled={false}
              />
            </label>
            <button
              type="button"
              onClick={() => setMode('menu')}
              className="mt-3 py-3 px-5 rounded-lg bg-school-red text-school-white font-semibold hover:opacity-90 transition-opacity"
            >
              Back
            </button>
          </div>
        )}
        {mode === 'staffOut' && (
          <div className="flex flex-col gap-4 max-w-2xl mx-auto bg-school-white/80 backdrop-blur-sm p-5 rounded-xl border border-amber-700/40 shadow-sm">
            <h3 className="m-0 text-amber-900 text-xl font-bold">Staff departure</h3>
            <p className="m-0 text-school-blue-light text-sm">Scan staff card when leaving school.</p>
            <label className="block text-school-blue font-medium">
              Staff card (scanner)
              <BarcodeInput
                onScan={handleStaffScanOut}
                placeholder="Scan staff card for departure..."
                disabled={false}
              />
            </label>
            <button
              type="button"
              onClick={() => setMode('menu')}
              className="mt-3 py-3 px-5 rounded-lg bg-school-red text-school-white font-semibold hover:opacity-90 transition-opacity"
            >
              Back
            </button>
          </div>
        )}
        {message.text && (
          <p className={`mt-4 p-3 rounded-lg ${messageStyles[message.type] || messageStyles.info}`}>
            {message.text}
          </p>
        )}
        {phoneHint && (
          <p className="mt-2 p-3 rounded-lg bg-school-surface border border-school-blue-light/30 text-school-blue text-sm">
            {phoneHint}
          </p>
        )}
      </div>
    </div>
  );
}
