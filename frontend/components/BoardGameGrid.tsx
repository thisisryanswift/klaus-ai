import React from 'react';
import { BoardGame } from '../types';
import { BoardGameCard } from './BoardGameCard';
import { UploadGameCard } from './UploadGameCard';

interface BoardGameGridProps {
  games: BoardGame[];
  onFileSelect: (file: File) => void;
  onSelectGame: (game: BoardGame) => void;
}

export const BoardGameGrid: React.FC<BoardGameGridProps> = ({ games, onFileSelect, onSelectGame }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-8 sm:gap-10" role="list">
      <UploadGameCard onFileSelect={onFileSelect} />
      {games.map((game) => (
        <BoardGameCard key={game.id} game={game} onSelectGame={onSelectGame} />
      ))}
       {games.length === 0 && (
         <div className="sm:col-span-2 lg:col-span-3 text-center py-10 bg-pop-white shadow-comic rounded-lg border-4 border-comic-stroke p-8">
            <h2 className="text-3xl font-bold text-pop-red" style={{ WebkitTextStroke: '1px black' }}>GAME LIBRARY EMPTY!</h2>
            <p className="mt-3 text-pop-black font-semibold">No games found! What are ya waiting for?!</p>
            <p className="mt-1 text-pop-black/80 font-medium">Hit that "ADD NEW GAME" card and let the AI magic begin!</p>
          </div>
      )}
    </div>
  );
};