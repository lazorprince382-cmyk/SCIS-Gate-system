import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SCHOOL_NAME, SCHOOL_BADGE_URL } from '../theme';
import { appPath } from '../appPath';

const navLink =
  'text-school-blue hover:text-school-blue-light transition-colors font-semibold text-lg sm:text-xl';
const navLinkActive =
  'text-school-blue font-bold border-b-[3px] border-school-red text-lg sm:text-xl pb-0.5';

const adminMenuLink =
  'block w-full text-left px-4 py-3.5 sm:py-4 text-school-blue no-underline text-base sm:text-lg font-medium transition-colors hover:bg-school-blue/[0.06] rounded-lg mx-1';
const adminMenuLinkActive =
  'block w-full text-left px-4 py-3.5 sm:py-4 text-school-blue no-underline text-base sm:text-lg font-semibold bg-school-blue/[0.08] border-l-[4px] border-school-red rounded-r-lg ml-0 pl-3';

function hardGo(path) {
  window.location.assign(appPath(path));
}

export default function Navbar({ variant = 'default', username }) {
  const location = useLocation();
  const [badgeError, setBadgeError] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef(null);

  const isActive = (path) => {
    if (path === '/') {
      const home = appPath('/').replace(/\/$/, '') || '/';
      return location.pathname === home || location.pathname === `${home}/`;
    }
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    if (!adminMenuOpen) return undefined;
    const onDoc = (e) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target)) {
        setAdminMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setAdminMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [adminMenuOpen]);

  useEffect(() => {
    setAdminMenuOpen(false);
  }, [location.pathname]);

  const logo = (
    <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0">
      {!badgeError ? (
        <img
          src={SCHOOL_BADGE_URL}
          alt=""
          onError={() => setBadgeError(true)}
          className="w-[4.5rem] h-[4.5rem] sm:w-[5.5rem] sm:h-[5.5rem] object-contain"
        />
      ) : (
        <div className="w-[4.5rem] h-[4.5rem] sm:w-[5.5rem] sm:h-[5.5rem] rounded-full bg-school-blue flex items-center justify-center text-school-white text-xl sm:text-2xl font-bold">
          SCIS
        </div>
      )}
      <span className="text-school-blue font-extrabold text-xl sm:text-3xl uppercase tracking-wide leading-tight block">
        {SCHOOL_NAME}
      </span>
    </div>
  );

  if (variant === 'admin') {
    return (
      <nav className="bg-school-surface border-b-2 border-school-red shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center gap-4 min-h-[5.25rem] sm:min-h-[6.25rem] py-3 sm:py-4">
            <a href={appPath('/admin')} className="flex min-w-0 shrink items-center gap-3 no-underline text-inherit">
              {logo}
            </a>
            <div className="relative flex-shrink-0" ref={adminMenuRef}>
              <button
                type="button"
                onClick={() => setAdminMenuOpen((o) => !o)}
                aria-expanded={adminMenuOpen}
                aria-haspopup="true"
                aria-controls="admin-nav-menu"
                className="inline-flex items-center gap-2.5 rounded-xl border border-school-blue-light/50 bg-school-white px-5 py-3 sm:px-6 sm:py-3.5 text-school-blue text-base sm:text-lg font-semibold shadow-sm transition hover:border-school-blue/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-school-blue focus-visible:ring-offset-2"
              >
                Menu
                <svg
                  className={`h-5 w-5 sm:h-6 sm:w-6 text-school-blue-light transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {adminMenuOpen && (
                <div
                  id="admin-nav-menu"
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,20rem)] origin-top-right rounded-xl border border-school-blue-light/25 bg-school-surface py-2 shadow-xl ring-1 ring-black/[0.04]"
                >
                  <div className="px-2 py-1">
                    <Link
                      role="menuitem"
                      to="/admin/offices"
                      className={isActive('/admin/offices') ? adminMenuLinkActive : adminMenuLink}
                      onClick={() => setAdminMenuOpen(false)}
                    >
                      Offices
                    </Link>
                    <Link
                      role="menuitem"
                      to="/admin/cards"
                      className={isActive('/admin/cards') ? adminMenuLinkActive : adminMenuLink}
                      onClick={() => setAdminMenuOpen(false)}
                    >
                      Cards
                    </Link>
                    <Link
                      role="menuitem"
                      to="/admin/visits"
                      className={isActive('/admin/visits') ? adminMenuLinkActive : adminMenuLink}
                      onClick={() => setAdminMenuOpen(false)}
                    >
                      Visit records
                    </Link>
                    <Link
                      role="menuitem"
                      to="/admin/security-alerts"
                      className={isActive('/admin/security-alerts') ? adminMenuLinkActive : adminMenuLink}
                      onClick={() => setAdminMenuOpen(false)}
                    >
                      Sign-in alerts
                    </Link>
                    <Link
                      role="menuitem"
                      to="/admin/staff"
                      className={isActive('/admin/staff') ? adminMenuLinkActive : adminMenuLink}
                      onClick={() => setAdminMenuOpen(false)}
                    >
                      Staff &amp; teachers
                    </Link>
                    <Link
                      role="menuitem"
                      to="/admin/accounts"
                      className={isActive('/admin/accounts') ? adminMenuLinkActive : adminMenuLink}
                      onClick={() => setAdminMenuOpen(false)}
                    >
                      Admin accounts
                    </Link>
                  </div>
                  <div className="mx-3 my-2 border-t border-school-blue-light/20" />
                  {username ? (
                    <p className="px-4 py-2 text-sm text-school-blue-light font-medium truncate" title={username}>
                      Welcome, <span className="text-school-blue">{username}</span>
                    </p>
                  ) : null}
                  <div className="px-2 pb-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAdminMenuOpen(false);
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        window.location.replace(appPath('/login'));
                      }}
                      className="mt-1 w-full rounded-lg bg-school-red px-4 py-3 sm:py-3.5 text-left text-base sm:text-lg font-semibold text-school-white transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-school-red focus-visible:ring-offset-2"
                    >
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-school-surface border-b-2 border-school-red shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center min-h-[5.25rem] sm:min-h-[6.25rem] py-3 sm:py-4">
          <a href={appPath('/')} className="no-underline text-inherit">
            {logo}
          </a>
          <div className="flex items-center gap-8 sm:gap-10">
            <button
              type="button"
              onClick={() => hardGo('/')}
              className={`border-0 bg-transparent cursor-pointer p-0 font-inherit ${isActive('/') && location.pathname !== '/office' ? navLinkActive : navLink}`}
            >
              Gate
            </button>
            <button
              type="button"
              onClick={() => hardGo('/office')}
              className={`border-0 bg-transparent cursor-pointer p-0 font-inherit ${isActive('/office') ? navLinkActive : navLink}`}
            >
              Office
            </button>
            <button
              type="button"
              onClick={() => hardGo('/admin')}
              className={`border-0 bg-transparent cursor-pointer p-0 font-inherit ${location.pathname.startsWith('/admin') ? navLinkActive : navLink}`}
            >
              Admin
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
