import React, { useEffect, useRef, useState, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { api } from '../api';

const API_BASE = import.meta.env.VITE_API_URL || '';

/** Unauthenticated POST so a stale admin token cannot affect the request. */
async function postFailedLoginReport(payload) {
  const res = await fetch(`${API_BASE}/api/auth/failed-login-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error || res.statusText || 'Report failed');
    e.status = res.status;
    throw e;
  }
  return res.json();
}

function captureFrameFromVideo(videoEl) {
  if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return null;
  const canvas = document.createElement('canvas');
  const maxW = 640;
  let w = videoEl.videoWidth;
  let h = videoEl.videoHeight;
  if (w > maxW) {
    h = Math.round((h * maxW) / w);
    w = maxW;
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try {
    ctx.drawImage(videoEl, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.68);
    return dataUrl && dataUrl.length > 200 ? dataUrl : null;
  } catch {
    return null;
  }
}

async function waitForFrame(videoEl, timeoutMs = 2500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      /* camera denied/unavailable: report still continues without photo */
    }
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const reportFailedAttempt = async (attemptedUsername) => {
    let snapshot;
    if (!streamRef.current?.active) {
      await startCamera();
    }
    await waitForFrame(videoRef.current);
    snapshot = captureFrameFromVideo(videoRef.current);
    stopCamera();
    try {
      await postFailedLoginReport({
        attempted_username: attemptedUsername,
        snapshot: snapshot || undefined,
      });
    } catch {
      try {
        await postFailedLoginReport({
          attempted_username: attemptedUsername,
        });
      } catch {
        /* best effort */
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const u = username;
    const p = password;
    api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: u, password: p }),
    })
      .then((data) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.user);
      })
      .catch(async (err) => {
        setError(err.message);
        if (err.status === 401 || /credential/i.test(err.message || '')) {
          await reportFailedAttempt(u);
        }
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar />
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className="fixed top-0 left-[-2000px] h-60 w-80 opacity-0 pointer-events-none"
        aria-hidden
      />
      <div className="flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-md p-6 bg-school-surface rounded-xl shadow-lg border border-school-blue-light/40 border-t-4 border-t-school-red">
        <h2 className="mt-0 text-center text-school-blue text-xl font-bold">
          Admin sign in
          <span className="block mx-auto mt-2 h-1 w-16 rounded-full bg-school-red" />
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="text-school-blue font-medium">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue focus:border-school-blue outline-none"
              required
            />
          </label>
          <label className="text-school-blue font-medium">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="block w-full mt-1 px-3 py-2 border border-school-blue-light rounded-lg focus:ring-2 focus:ring-school-blue focus:border-school-blue outline-none"
              required
            />
          </label>
          {error && <p className="text-school-red text-sm m-0">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="py-3 px-5 rounded-lg bg-school-blue text-school-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 shadow-[0_0_0_2px_rgba(242,211,53,0.25)]"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
