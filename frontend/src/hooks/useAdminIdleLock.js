import { useEffect, useRef, useCallback } from 'react';
import { appPath } from '../appPath';

const LOCK_FLAG = 'admin_locked_inactivity';
const DEFAULT_IDLE_MINUTES = 10;

function idleMs() {
  const raw = Number(import.meta.env.VITE_ADMIN_IDLE_MINUTES);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_IDLE_MINUTES;
  return minutes * 60 * 1000;
}

export function clearAdminSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function lockAdminForInactivity() {
  sessionStorage.setItem(LOCK_FLAG, '1');
  clearAdminSession();
  window.location.replace(appPath('/login'));
}

export function consumeInactivityLockNotice() {
  if (sessionStorage.getItem(LOCK_FLAG) !== '1') return null;
  sessionStorage.removeItem(LOCK_FLAG);
  const minutes = Number(import.meta.env.VITE_ADMIN_IDLE_MINUTES) || DEFAULT_IDLE_MINUTES;
  return `Admin panel locked after ${minutes} minutes of inactivity. Please sign in again.`;
}

export function useAdminIdleLock(enabled = true) {
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef(null);

  const scheduleLock = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lockAdminForInactivity();
    }, idleMs());
  }, []);

  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    scheduleLock();
  }, [scheduleLock]);

  const checkIdle = useCallback(() => {
    if (Date.now() - lastActivityRef.current >= idleMs()) {
      lockAdminForInactivity();
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((name) => window.addEventListener(name, bumpActivity, { passive: true }));

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkIdle();
    };
    document.addEventListener('visibilitychange', onVisibility);

    bumpActivity();

    return () => {
      events.forEach((name) => window.removeEventListener(name, bumpActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, bumpActivity, checkIdle]);
}
