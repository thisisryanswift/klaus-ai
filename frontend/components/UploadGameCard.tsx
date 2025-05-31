
import React, { useRef } from 'react';
import { UploadIcon } from './icons';

interface UploadGameCardProps {
  onFileSelect: (file: File) => void;
}

export const UploadGameCard: React.FC<UploadGameCardProps> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCardClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
      
      // Reset the file input so the same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload a new game manual"
      onClick={handleCardClick}
      onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(); }}
      className="flex flex-col items-center justify-center h-full p-6 bg-pop-yellow rounded-lg 
                 border-4 border-dashed border-comic-stroke hover:border-pop-red focus:border-pop-red
                 shadow-comic hover:shadow-comic-hover focus-within:shadow-comic-hover
                 transition-all duration-300 ease-in-out cursor-pointer group
                 min-h-[380px] sm:min-h-[420px] text-pop-black focus:outline-none focus:ring-2 focus:ring-pop-blue focus:ring-offset-4 focus:ring-offset-pop-white"
    >
      <input
        type="file"
        accept=".pdf" // Assuming PDF, but can be changed or removed for any file type
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
      <div className="p-3 sm:p-4 bg-pop-white group-hover:bg-pop-red rounded-full border-4 border-comic-stroke transition-colors duration-300">
        <UploadIcon className="w-12 h-12 sm:w-16 sm:h-16 text-comic-stroke group-hover:text-pop-white transition-colors duration-300" />
      </div>
      <h3 
        className="mt-6 text-2xl sm:text-3xl font-bold text-center text-comic-stroke group-hover:text-pop-red transition-colors duration-300"
        // style={{ WebkitTextStroke: '1px black' }}
      >
        ADD NEW GAME!
      </h3>
      <p className="mt-1 text-sm sm:text-base text-center text-pop-black/80 font-semibold group-hover:text-pop-red transition-colors duration-300">
        (Upload PDF Rulebook)
      </p>
    </div>
  );
};
