import React from 'react';

export const Logo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#a855f7' }} /> {/* purple-500 */}
        <stop offset="100%" style={{ stopColor: '#6366f1' }} /> {/* indigo-500 */}
      </linearGradient>
    </defs>
    {/* The main 'J' shape, styled like an upward trending chart */}
    <path
      d="M14 38 C14 28, 22 24, 28 24 C34 24, 42 28, 42 38"
      fill="none"
      stroke="url(#logoGradient)"
      strokeWidth="6"
      strokeLinecap="round"
    />
    {/* The AI 'spark' or 'node', representing the "spot" */}
    <circle cx="14" cy="14" r="7" fill="#2dd4bf" /> {/* teal-400 */}
    <circle cx="14" cy="14" r="3" fill="white" />
  </svg>
);
