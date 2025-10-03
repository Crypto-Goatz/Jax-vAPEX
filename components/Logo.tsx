import React from 'react';

export const Logo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <linearGradient id="lime-grad-stroke" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stopColor="#a3e635" /> {/* lime-400 */}
        <stop offset="100%" stopColor="#4ade80" /> {/* green-400 */}
      </linearGradient>
    </defs>
    
    {/* Main container */}
    <rect width="100" height="100" rx="20" fill="#f3f4f6" /> {/* gray-100 */}
    
    {/* Chart path */}
    <path 
      d="M 20 70 L 35 55 L 50 60 L 65 40 L 80 50" 
      fill="none" 
      stroke="url(#lime-grad-stroke)" 
      strokeWidth="8" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
  </svg>
);