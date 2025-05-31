
import React from 'react';

interface UploadResultViewProps {
  error: string; // Error is now mandatory as this view is only for errors
  onProceed: () => void; // No responseData needed, just navigates back
  fileName?: string | null; // To display the game name if available
}

export const UploadResultView: React.FC<UploadResultViewProps> = ({ error, onProceed, fileName }) => {
  const gameNameForError = fileName ? `'${fileName.replace(/\.[^/.]+$/, "")}'` : "the uploaded file";

  return (
    <div className="min-h-screen bg-pop-white flex flex-col items-center justify-center p-4 sm:p-8 font-sans text-pop-black">
      <div className="bg-pop-yellow p-6 sm:p-8 rounded-lg border-4 border-comic-stroke shadow-comic w-full max-w-2xl">
        {/* This component now only renders if there IS an error */}
        <h1 
          className="font-display text-3xl sm:text-4xl md:text-5xl text-pop-red mb-4 text-center break-words" 
          style={{ WebkitTextStroke: '1.5px black', textShadow: '3px 3px 0 #FFFFFF, 4px 4px 0 #000000' }}
          role="alert"
        >
          UPLOAD FAILED!
        </h1>
        <div className="bg-pop-white p-4 rounded border-2 border-pop-red mb-6 text-pop-red font-semibold break-words max-h-96 overflow-y-auto">
          <p className="font-bold mb-2">POW! There was an issue with {gameNameForError}:</p>
          <p>{error}</p>
        </div>
        <button
          onClick={onProceed} // onProceed is called to go back
          aria-label="Back to games list"
          className="mt-8 w-full text-md sm:text-lg font-bold bg-pop-blue text-pop-white hover:bg-blue-700
                     border-2 border-comic-stroke px-5 py-2.5 sm:px-6 sm:py-3 rounded-md shadow-comic hover:shadow-comic-hover
                     transition-all duration-200 ease-in-out transform hover:scale-105
                     focus:outline-none focus:ring-2 focus:ring-pop-yellow focus:ring-offset-2 focus:ring-offset-pop-white"
        >
          BACK TO GAMES
        </button>
      </div>
      <footer className="text-center py-8 sm:py-10 mt-6 sm:mt-8">
        <p className="text-sm sm:text-md text-pop-black/70 font-semibold">
          &copy; {new Date().getFullYear()} AI Game Coach! Ready to POW?!
        </p>
      </footer>
    </div>
  );
};
