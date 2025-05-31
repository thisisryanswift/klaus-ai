
import React from 'react';

export const LoadingUploadScreen: React.FC = () => (
  <div 
    className="fixed inset-0 bg-pop-blue/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-pop-white p-4"
    role="alert"
    aria-live="assertive"
  >
    <div className="animate-spin rounded-full h-20 w-20 sm:h-24 sm:w-24 border-b-4 border-pop-yellow"></div>
    <p 
      className="mt-8 text-2xl sm:text-3xl font-display tracking-wider text-center" 
      style={{ WebkitTextStroke: '1px black', textShadow: '2px 2px 0 #000000' }}
    >
      UPLOADING RULEBOOK...
    </p>
    <p className="mt-2 text-md sm:text-lg font-semibold text-center">Hold tight, the AI is warming up! KABOOM!</p>
  </div>
);
