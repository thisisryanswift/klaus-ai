
import React from 'react';

export const UploadIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={2.5} // Bolder for comic style
    stroke="currentColor" 
    className={className}
    aria-hidden="true"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" 
    />
  </svg>
);

export const GamepadIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
 <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={2} // Bolder for comic style
    stroke="currentColor" 
    className={className}
    aria-hidden="true"
  >
  {/* Simplified a bit for comic feel, can be adjusted */}
  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15H6a1.5 1.5 0 01-1.5-1.5V9A1.5 1.5 0 016 7.5h1.5m0 0V6A1.5 1.5 0 019 4.5h6A1.5 1.5 0 0116.5 6v1.5m0 0h1.5a1.5 1.5 0 011.5 1.5v4.5a1.5 1.5 0 01-1.5 1.5H16.5m-9 0h9m-4.5 3L12 15m0 0l-2.25 3H14.25L12 15z" />
  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V9A2.25 2.25 0 014.5 6.75h15A2.25 2.25 0 0121.75 9v3.75m-19.5 0V15A2.25 2.25 0 004.5 17.25h15a2.25 2.25 0 002.25-2.25v-3.75m-19.5 0h19.5" />
 </svg>
);

export const ChevronDownIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={3} // Bolder for comic style
    stroke="currentColor" 
    className={className}
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

export const ArrowLeftIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={3} 
    stroke="currentColor" 
    className={className}
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

export const BookIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={2.5} // Bolder for comic style
    stroke="currentColor" 
    className={className}
    aria-hidden="true"
  >
    {/* Simplified Book Icon */}
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3.75h19.5M2.25 3.75v16.5M2.25 3.75L12 2.25m9.75 1.5L12 2.25m0 0V7.5m0 12.75v-5.25c0-.966-.39-1.846-1.03-2.5A3.742 3.742 0 0012 9.75c-1.123 0-2.143.468-2.876 1.234A3.754 3.754 0 008.25 15v5.25m3.75-5.25H8.25m3.75 0H15.75m-3.75 0V9.75M21.75 20.25v-5.25c0-.966-.39-1.846-1.03-2.5A3.742 3.742 0 0019.5 9.75c-1.123 0-2.143.468-2.876 1.234A3.754 3.754 0 0015.75 15v5.25m-3.75-5.25h3.75" />
  </svg>
);


// Pop Art Style Icons
export const PopArtDiceIcon: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg 
    className={className}
    viewBox="0 0 100 100" 
    fill="currentColor" // Use text color for fill
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="5" y="5" width="90" height="90" rx="15" stroke="#000000" strokeWidth="5" />
    <circle cx="30" cy="30" r="8" fill="#000000" />
    <circle cx="70" cy="30" r="8" fill="#000000" />
    <circle cx="30" cy="70" r="8" fill="#000000" />
    <circle cx="70" cy="70" r="8" fill="#000000" />
    <circle cx="50" cy="50" r="8" fill="#000000" />
  </svg>
);

export const PopArtPawnIcon: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg 
    className={className}
    viewBox="0 0 100 100" 
    fill="currentColor" // Use text color for fill
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path 
      d="M50 10C36.1929 10 25 21.1929 25 35C25 40.3368 27.2478 45.1543 30.8685 48.7017C20.5206 53.7995 15 64.6538 15 76.5V85H85V76.5C85 64.6538 79.4794 53.7995 69.1315 48.7017C72.7522 45.1543 75 40.3368 75 35C75 21.1929 63.8071 10 50 10Z" 
      stroke="#000000" 
      strokeWidth="5" 
      strokeLinejoin="round"
    />
    <rect x="10" y="85" width="80" height="10" rx="3" stroke="#000000" strokeWidth="5" />
  </svg>
);

export const PopArtStarIcon: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg 
    className={className}
    viewBox="0 0 100 100" 
    fill="currentColor" // Use text color for fill
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path 
      d="M50 5L61.2257 38.7743L95 42.3607L70.1869 64.2257L78.5317 97.6393L50 78.7743L21.4683 97.6393L29.8131 64.2257L5 42.3607L38.7743 38.7743L50 5Z" 
      stroke="#000000" 
      strokeWidth="5" 
      strokeLinejoin="round"
    />
  </svg>
);

export const PopArtCardsIcon: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg
    className={className}
    viewBox="0 0 100 100"
    fill="currentColor" // Use text color for fill
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <g stroke="#000000" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
      {/* Card 1 (Back) */}
      <rect x="20" y="30" width="40" height="55" rx="5" transform="rotate(-15 40 57.5)" />
      {/* Card 2 (Middle) */}
      <rect x="30" y="25" width="40" height="55" rx="5" />
      {/* Card 3 (Front) */}
      <rect x="40" y="30" width="40" height="55" rx="5" transform="rotate(15 60 57.5)" />
    </g>
  </svg>
);
