import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

const mobileRegex = /Android|iPhone|iPad|iPod|Mobile/i;

export default function PhoneScanPage() {
  const { sessionId } = useParams();
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState('Ready to scan');
  const [session, setSession] = useState(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);

  const isMobile = useMemo(() => mobileRegex.test(navigator.userAgent || ''), []);

  useEffect(() => {
    api(`/api/scan-sessions/${sessionId}`)
      .then(setSession)
      .catch((e) => setStatus(e.message));
  }, [sessionId]);

  const submitBarcode = async (barcode) => {
    if (!barcode || submitting) return;
    setSubmitting(true);
    try {
      await api(`/api/scan-sessions/${sessionId}/scan`, {
        method: 'POST',
        body: JSON.stringify({ barcode }),
      });
      setStatus(`Sent ${barcode} to kiosk.`);
    } catch (e) {
      setStatus(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!cameraEnabled || typeof BarcodeDetector === 'undefined' || !videoRef.current) return undefined;
    let active = true;
    const detector = new BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'] });

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
      } catch (_) {}
      frameRef.current = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      active = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [cameraEnabled, sessionId]);

  const startCamera = async () => {
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
  };

  useEffect(() => () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  }, []);

  if (!isMobile) {
    return (
      <div className="min-h-screen p-6 bg-transparent text-school-blue">
        <h2 className="text-xl font-bold">Phone scanner only</h2>
        <p>Open this page from a phone to use the camera scanner.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-transparent">
      <h2 className="text-school-blue text-xl font-bold">Phone Barcode Scanner</h2>
      <p className="text-school-blue-light text-sm">Session: {session?.mode || 'loading...'}</p>
      <p className="text-school-blue text-sm">{status}</p>
      <button
        type="button"
        onClick={startCamera}
        className="mt-2 mb-3 py-2 px-4 rounded-lg bg-school-blue text-school-white font-semibold"
      >
        Use phone camera
      </button>
      <video ref={videoRef} className="w-full max-w-md rounded-lg border border-school-blue-light/30 bg-black" muted playsInline />
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
          onClick={() => submitBarcode(manual.trim())}
          className="mt-2 py-2 px-4 rounded-lg bg-school-red text-school-white font-semibold"
        >
          Send barcode
        </button>
      </div>
    </div>
  );
}
