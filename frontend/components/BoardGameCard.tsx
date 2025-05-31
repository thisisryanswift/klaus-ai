
import React, { useState, useEffect } from 'react';
import { BoardGame } from '../types';

interface BoardGameCardProps {
  game: BoardGame;
  onSelectGame: (game: BoardGame) => void;
}

const buttonColorOptions = [
  { base: 'bg-pop-red', hover: 'hover:bg-red-700', text: 'text-pop-white' },
  { base: 'bg-pop-yellow', hover: 'hover:bg-yellow-500', text: 'text-pop-black' },
  { base: 'bg-pop-green', hover: 'hover:bg-green-700', text: 'text-pop-white' },
  { base: 'bg-pop-blue', hover: 'hover:bg-blue-700', text: 'text-pop-white' },
  { base: 'bg-pop-black', hover: 'hover:bg-gray-800', text: 'text-pop-white' },
];


export const BoardGameCard: React.FC<BoardGameCardProps> = ({ game, onSelectGame }) => {
  const [buttonStyle, setButtonStyle] = useState(buttonColorOptions[0]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * buttonColorOptions.length);
    setButtonStyle(buttonColorOptions[randomIndex]);
  }, []);

  const handleButtonClick = () => {
    onSelectGame(game);
  };

  return (
    <div 
      className="bg-pop-white rounded-lg border-4 border-comic-stroke shadow-comic hover:shadow-comic-hover focus-within:shadow-comic-hover transition-all duration-200 ease-in-out flex flex-col h-full group"
      role="listitem"
      aria-labelledby={`game-title-${game.id}`}
    >
      <div className="relative w-full h-48 sm:h-56 overflow-hidden border-b-4 border-comic-stroke">
        <img 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 ease-in-out" 
          src={game.imageUrl} 
          alt={`Cover art for ${game.name}`} 
          loading="lazy"
        />
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <h3 
          id={`game-title-${game.id}`}
          className="text-2xl sm:text-3xl font-bold text-pop-black mb-2 group-hover:text-pop-blue transition-colors duration-200"
          style={{ WebkitTextStroke: '0.5px black' }}
        >
          {game.name}
        </h3>
        <p className="text-pop-black/90 text-sm sm:text-base leading-relaxed line-clamp-3 flex-grow mb-4 font-medium">
          {game.description || 'No description available. But it\'s probably AWESOME!'}
        </p>
        <button 
          onClick={handleButtonClick}
          aria-label={`Consult rulebook for ${game.name}`}
          className={`mt-auto self-start text-sm font-bold 
                     ${buttonStyle.base} ${buttonStyle.text} ${buttonStyle.hover}
                     focus:bg-opacity-80 
                     border-2 border-comic-stroke px-4 py-2 rounded-md shadow-comic hover:shadow-comic-hover 
                     transition-all duration-200 ease-in-out transform hover:scale-105 
                     focus:outline-none focus:ring-2 focus:ring-pop-yellow focus:ring-offset-2 focus:ring-offset-pop-white`}
        >
          RULEBOOK! &rarr;
        </button>
      </div>
    </div>
  );
};