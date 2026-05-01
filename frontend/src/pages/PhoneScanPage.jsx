import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { api } from '../api';

const mobileRegex = /Android|iPhone|iPad|iPod|Mobile/i;

export default function PhoneScanPage() {
  const { sessionId: paramSessionId } = useParams();
  const [pairedId, setPairedId] = useState(null);
  const activeId = paramSessionId || pairedId;

  const [pairInput, setPairInput] = useState('');
  const [pairError, setPairError] = useState('');
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState('Ready');
  const [session, setSession] = useState(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const submittingRef = useRef(false);
  const activeIdRef = useRef('');
  const autoCameraTriedRef = useRef(false);

  const isMobile = useMemo(() => mobileRegex.test(navigator.userAgent || ''), []);

  useEffect(() => {
    activeIdRef.current = activeId || '';
  }, [activeId]);

  useEffect(() => {
    setCameraEnabled(false);
    const prev = streamRef.current;
    if (prev) {
      prev.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [activeId]);

  useEffect(() => {
    autoCameraTriedRef.current = false;
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    setStatus('Loading session…');
    api(`/api/scan-sessions/${activeId}`)
      .then((s) => {
        setSession(s);
        setStatus('Ready to scan');
      })
      .catch((e) => setStatus(e.message));
  }, [activeId]);

  const submitBarcode = useCallback(async (barcode) => {
    const id = activeIdRef.current;
    if (!id || !barcode?.trim() || submittingRef.current) return;
    const v = String(barcode).trim();
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await api(`/api/scan-sessions/${id}/scan`, {
        method: 'POST',
        body: JSON.stringify({ barcode: v }),
      });
      setStatus(`Sent ${v} to kiosk.`);
    } catch (e) {
      setStatus(e.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraEnabled(true);
      setStatus('Camera active. Point at barcode.');
    } catch {
      setStatus('Camera unavailable. Use manual barcode entry below.');
    }
  }, []);

  useEffect(() => {
    if (!activeId || !session || session.status !== 'waiting' || !isMobile) return undefined;
    if (autoCameraTriedRef.current) return undefined;
    autoCameraTriedRef.current = true;
    const t = setTimeout(() => {
      startCamera();
    }, 150);
    return () => clearTimeout(t);
  }, [activeId, session?.id, session?.status, isMobile, startCamera]);

  useEffect(() => {
    if (!cameraEnabled || typeof BarcodeDetector === 'undefined' || !videoRef.current || !activeId) {
      return undefined;
    }
    let active = true;
    const detector = new BarcodeDetector({
      formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
    });

    const tick = async () => {
      if (!active || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes?.length && codes[0].rawValue) {
          const found = String(codes[0].rawValue).trim();
          if (found) {
            await submitBarcode(found);
            return;
          }
        }
      } catch (_) {
        /* ignore frame errors */
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      active = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [cameraEnabled, activeId, submitBarcode]);

  useEffect(() => {
    if (!cameraEnabled || !videoRef.current || typeof BarcodeDetector !== 'undefined' || !activeId) {
      return undefined;
    }
    const reader = new BrowserMultiFormatReader();
    let stopped = false;
    reader
      .decodeFromVideoElement(videoRef.current, (result, _err) => {
        if (stopped || !result || submittingRef.current) return;
        stopped = true;
        reader.reset();
        submitBarcode(result.getText());
      })
      .catch(() => {});

    return () => {
      stopped = true;
      reader.reset();
    };
  }, [cameraEnabled, activeId, submitBarcode]);

  useEffect(
    () => () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    },
    [],
  );

  const resolvePair = async () => {
    setPairError('');
    const code = pairInput.replace(/\D/g, '');
    if (code.length !== 6) {
      setPairError('Enter all 6 digits.');
      return;
    }
    try {
      const s = await api(`/api/scan-sessions/by-pair/${code}`);
      setPairedId(s.id);
    } catch (e) {
      setPairError(e.message || 'Session not found');
    }
  };

  if (!isMobile) {
    return (
      <div className="min-h-screen p-6 bg-transparent text-school-blue">
        <h2 className="text-xl font-bold">Phone scanner only</h2>
        <p>Open this page from a phone to use the camera scanner.</p>
      </div>
    );
  }

  if (!activeId) {
    return (
      <div className="min-h-screen p-4 bg-transparent">
        <h2 className="text-school-blue text-xl font-bold">Pair with gate screen</h2>
        <p className="text-school-blue-light text-sm mt-1">
          Enter the 6-digit code shown on the computer (or scan the QR code there).
        </p>
        <label className="block mt-4 text-school-blue font-medium">
          Code
          <input
            value={pairInput}
            onChange={(e) => setPairInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="mt-1 block w-full max-w-xs px-3 py-3 text-center text-2xl font-mono tracking-[0.4em] border border-school-blue-light rounded-lg"
          />
        </label>
        {pairError ? <p className="mt-2 text-school-red text-sm">{pairError}</p> : null}
        <button
          type="button"
          onClick={resolvePair}
          className="mt-4 py-2 px-4 rounded-lg bg-school-blue text-school-white font-semibold"
        >
          Connect
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-transparent">
      <h2 className="text-school-blue text-xl font-bold">Phone Barcode Scanner</h2>
      <p className="text-school-blue-light text-sm">Session: {session?.mode || 'loading…'}</p>
      <p className="text-school-blue text-sm">{status}</p>
      {session?.status === 'waiting' && !cameraEnabled ? (
        <button
          type="button"
          onClick={startCamera}
          className="mt-2 mb-3 py-2 px-4 rounded-lg bg-school-blue text-school-white font-semibold"
        >
          Start camera
        </button>
      ) : null}
      <video
        ref={videoRef}
        className="w-full max-w-md rounded-lg border border-school-blue-light/30 bg-black"
        muted
        playsInline
      />
      <div className="mt-4">
        <label className="block text-school-blue font-medium">
          Manual barcode input
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            className="mt-1 block w-full max-w-md px-3 py-2 border border-school-blue-light rounded-lg"
          />
        </label>
        <button
          type="button"
          disabled={submitting}
          onClick={() => submitBarcode(manual.trim())}
          className="mt-2 py-2 px-4 rounded-lg bg-school-red text-school-white font-semibold disabled:opacity-60"
        >
          Send barcode
        </button>
      </div>
    </div>
  );
}
