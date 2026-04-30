import React, { useState } from 'react';
import { SCHOOL_NAME, SCHOOL_MOTTO, SCHOOL_BADGE_URL } from '../theme';

export default function SchoolHeader({ compact }) {
  const [badgeError, setBadgeError] = useState(false);
  return (
    <header className={`flex items-center ${compact ? 'gap-3 mb-4 pb-3' : 'gap-5 mb-6 pb-5'}`}>
      {!badgeError ? (
        <img
          src={SCHOOL_BADGE_URL}
          alt=""
          onError={() => setBadgeError(true)}
          className={`object-contain flex-shrink-0 ${compact ? 'w-14 h-14' : 'w-20 h-20'}`}
        />
      ) : (
        <div className={`rounded-full bg-school-blue flex items-center justify-center text-school-white font-bold flex-shrink-0 ${compact ? 'w-14 h-14 text-lg' : 'w-20 h-20 text-2xl'}`}>
          OKS
        </div>
      )}
      <div>
        <h1 className={`m-0 font-bold text-school-blue uppercase tracking-wide ${compact ? 'text-lg' : 'text-2xl'}`}>
          {SCHOOL_NAME}
        </h1>
        {!compact && (
          <p className="mt-1 text-sm font-semibold text-school-red tracking-wider">
            {SCHOOL_MOTTO}
          </p>
        )}
      </div>
    </header>
  );
}
