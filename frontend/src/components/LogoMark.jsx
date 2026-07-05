import React from 'react';

export default function LogoMark({ className = 'w-10 h-10' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="46" height="46" rx="12" fill="#14171D" stroke="#76B900" strokeWidth="2" />
      {/* Simplified controller silhouette: body + two sticks */}
      <path
        d="M14 20c0-3.3 2.7-6 6-6h8c3.3 0 6 2.7 6 6v2h1.5A3.5 3.5 0 0 1 39 25.5v4A4.5 4.5 0 0 1 34.5 34c-1.7 0-3.2-.9-4-2.3l-1.4-2.4a2 2 0 0 0-1.7-1H20.6a2 2 0 0 0-1.7 1l-1.4 2.4A4.6 4.6 0 0 1 13.5 34 4.5 4.5 0 0 1 9 29.5v-4A3.5 3.5 0 0 1 12.5 22H14v-2z"
        fill="#76B900"
      />
      <circle cx="18.5" cy="27" r="2" fill="#0A0C10" />
      <circle cx="29.5" cy="27" r="2" fill="#0A0C10" />
    </svg>
  );
}
