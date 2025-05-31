
import React, { useState, useEffect, useCallback } from 'react';
import { BoardGame } from './types';
import { BoardGameGrid } from './components/BoardGameGrid';
import { GameView } from './components/GameView';
import { LoadingUploadScreen } from './components/LoadingUploadScreen';
import { UploadResultView } from './components/UploadResultView';
import { ChevronDownIcon, PopArtDiceIcon, PopArtPawnIcon, PopArtStarIcon, PopArtCardsIcon } from './components/icons'; 

const App: React.FC = () => {
  const [games, setGames] = useState<BoardGame[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState<boolean>(true);
  const [selectedGame, setSelectedGame] = useState<BoardGame | null>(null);

  const [isLoadingUpload, setIsLoadingUpload] = useState<boolean>(false);
  const [uploadResponse, setUploadResponse] = useState<any | null>(null); 
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadedFileName, setLastUploadedFileName] = useState<string | null>(null);

  useEffect(() => {
    const initialGamesData: BoardGame[] = [
      { id: '1', name: 'Risk', imageUrl: 'https://imgur.com/GIiMCQA.png', description: 'Game of global domination: deploy armies, conquer territories, and battle opponents with strategic dice rolls.' },
      { id: '2', name: 'Great Western Trail', imageUrl: 'https://imgur.com/JjixbFA.png', description: 'Drive cattle to Kansas City. Optimize your deck, build structures, and hire staff for strategic victory.' },
      { id: '3', name: 'Chess', imageUrl: 'https://imgur.com/7KbMt4A.png', description: 'Strategic two-player game: move unique pieces, capture opponents, and checkmate the king for victory.' },
      { id: '4', name: 'Connect Four', imageUrl: 'https://imgur.com/KcoGm13.png', description: 'Players drop discs into a grid, aiming for four in a row horizontally, vertically, or diagonally.' },
      { id: '5', name: 'Gloomhaven', imageUrl: 'https://imgur.com/zBVQtZo.png', description: 'Cooperative tactical combat RPG: explore dungeons, fight monsters, and shape an evolving fantasy world.' },
      { id: '6', name: 'Yahtzee', imageUrl: 'https://imgur.com/B8FybQq.png', description: 'Roll five dice up to three times, aiming for specific combinations to score points. High score wins!' },
      { id: '7', name: 'Candyland', imageUrl: 'https://imgur.com/FJa7Pej.png', description: 'Simple race game for kids: draw colored cards, move gingerbread man along rainbow path to King Kandy.'},
      { id: '8', name: 'Monopoly', imageUrl: 'https://imgur.com/UcCWJvA.png', description: 'Buy, sell, and trade properties to bankrupt opponents, building houses and hotels for rent.'},
      { id: '9', name: 'Ticket to Ride', imageUrl: 'https://imgur.com/yEg7lTD.png', description: 'Collect colored train cars to claim railway routes across a map, connecting cities for points.'},
    ];
    
    setTimeout(() => {
      setGames(initialGamesData);
      setIsLoadingGames(false);
    }, 1000);
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return;

    setIsLoadingUpload(true);
    setUploadResponse(null);
    setUploadError(null);
    setSelectedGame(null); 
    setLastUploadedFileName(file.name); 

    const formData = new FormData();
    formData.append('uploadedFile', file);

    try {
      console.log("Making POST to /api/upload for file:", file.name);
      const response = await fetch('https://klaus-node-server-fphw3.ondigitalocean.app/api/uploadCached', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('[App.tsx] Upload successful, raw responseData:', JSON.stringify(responseData, null, 2));
        if (responseData && typeof responseData === 'object') {
            console.log('[App.tsx] Upload successful, responseData keys:', Object.keys(responseData).join(', '));
        } else {
            console.warn('[App.tsx] responseData is not an object or is null:', responseData);
        }
        
        const rawFileName = responseData?.fileName || responseData?.FileName || responseData?.file_name || responseData?.FILE_NAME || file.name || 'Uploaded Game';
        const gameName = rawFileName.replace(/\.[^/.]+$/, ""); 
        console.log(responseData)

        const systemPrompt = responseData?.prompt;
        const gameSchema = responseData?.schema;


        const newGame: BoardGame = {
          id: `uploaded-${Date.now()}`,
          name: gameName,
          imageUrl: 'https://imgur.com/wg9q8Z3.png', 
          description: `Rulebook for ${gameName} uploaded. Ready for AI coaching!`,
          systemPrompt: systemPrompt,
          gameSchema: gameSchema,
        };

        console.log('[App.tsx] Constructed newGame object:', JSON.stringify(newGame, null, 2));
        setSelectedGame(newGame);
        setUploadResponse(null); 
        setUploadError(null);

      } else {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, response.statusText, errorText);
        setUploadError(`BOOM! Upload failed for '${file.name}'. Server responded: ${response.status} ${response.statusText}. ${errorText || 'No additional error message.'}`);
        setUploadResponse({ error: true, status: response.status, message: errorText });
      }
    } catch (error) {
      console.error('Network error during upload:', error);
      let errorMessage = `SPLAT! Network error trying to upload '${file.name}'. Check your connection and the server.`;
      if (error instanceof Error) {
        errorMessage += ` Details: ${error.message}`;
      }
      setUploadError(errorMessage);
      setUploadResponse({ error: true, message: errorMessage });
    } finally {
      setIsLoadingUpload(false);
    }
  }, []);

  const handleSelectGame = (game: BoardGame) => {
    setSelectedGame(game);
    setUploadResponse(null);
    setUploadError(null);
    setLastUploadedFileName(null);
  };

  const handleBackToGrid = () => {
    setSelectedGame(null);
    setLastUploadedFileName(null); 
  };

  const handleProceedFromUpload = useCallback(() => {
    setUploadResponse(null);
    setUploadError(null);
    setLastUploadedFileName(null);
    setSelectedGame(null); 
  }, []);


  if (isLoadingUpload) {
    return <LoadingUploadScreen />;
  }

  if (uploadError) { 
    return <UploadResultView 
             error={uploadError} 
             onProceed={handleProceedFromUpload} 
             fileName={lastUploadedFileName} 
           />;
  }

  if (selectedGame) {
    return <GameView game={selectedGame} onBack={handleBackToGrid} />;
  }

  return (
    <div className="bg-pop-white min-h-screen font-sans text-pop-black">
      <header className="min-h-screen flex flex-col items-center justify-center border-b-4 border-comic-stroke bg-pop-yellow relative overflow-hidden p-4">
        {/* Background Decorative Shapes */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-pop-red/50 rounded-full transform rotate-12 opacity-60 -z-0"></div>
        <div className="absolute -bottom-24 -right-16 w-80 h-80 bg-pop-blue/40 rounded-lg transform -rotate-12 opacity-70 -z-0"></div>
        <div className="absolute top-1/4 left-1/3 w-40 h-40 bg-pop-green/50 rounded-xl transform rotate-45 opacity-50 -z-0 hidden sm:block"></div>
        <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-pop-pink/30 rounded-full transform -rotate-45 opacity-60 -z-0 hidden md:block"></div>

        {/* Scattered Pop Art Icons */}
        <PopArtDiceIcon className="absolute top-[10%] left-[5%] w-20 h-20 text-pop-red transform -rotate-12 animate-wiggle-slow opacity-80 z-0" />
        <PopArtPawnIcon className="absolute bottom-[15%] right-[8%] w-24 h-24 text-pop-blue transform rotate-[20deg] animate-wiggle-slow opacity-70 z-0" />
        <PopArtStarIcon className="absolute top-[15%] right-[10%] w-16 h-16 text-pop-pink transform rotate-[10deg] animate-pulse-slow opacity-90 z-0" />
        <PopArtDiceIcon className="absolute bottom-[8%] left-[12%] w-16 h-16 text-pop-yellow transform rotate-[5deg] animate-wiggle-slow opacity-75 z-0 hidden md:block" />
        <PopArtPawnIcon className="absolute top-[45%] left-[2%] w-12 h-12 text-pop-yellow transform -rotate-[25deg] animate-pulse-slow opacity-80 z-0 hidden lg:block" />
        <PopArtStarIcon className="absolute bottom-[30%] right-[25%] w-10 h-10 text-pop-red transform rotate-[30deg] animate-wiggle-slow opacity-70 z-0 hidden sm:block" />
        <PopArtPawnIcon className="absolute top-[20%] right-[35%] w-14 h-14 text-pop-green transform rotate-[-10deg] animate-pulse-slow opacity-60 z-0 hidden md:block"/>
        <PopArtCardsIcon className="absolute bottom-[20%] left-[20%] w-24 h-24 text-pop-green transform -rotate-[15deg] animate-wiggle-slow opacity-75 z-0" />
        <PopArtCardsIcon className="absolute top-[30%] right-[3%] w-24 h-24 text-pop-blue transform -rotate-[15deg] animate-wiggle-slow opacity-75 z-0 hidden md:block" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="flex items-center justify-center mb-4">
            <h1 className="font-display text-6xl sm:text-8xl md:text-9xl text-pop-blue tracking-wider" style={{ WebkitTextStroke: '2px black', textShadow: '4px 4px 0 #FFFFFF, 6px 6px 0 #000000' }}>
              Klaus.AI!
            </h1>
          </div>
          <p className="mt-4 text-lg sm:text-xl md:text-2xl text-pop-black font-semibold max-w-3xl mx-auto drop-shadow-[1px_1px_0px_#FFFFFF]">
            Your board game coach. So smart, it's <span className="text-pop-red" style={{ WebkitTextStroke: '0.5px black' }}>almost</span> unfair.  <span className="text-pop-green" style={{ WebkitTextStroke: '0.5px black' }}>(Almost.)</span>
          </p>
        </div>
        
        <div className="absolute bottom-8 sm:bottom-10 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-pop-white rounded-full flex items-center justify-center border-4 border-comic-stroke shadow-comic">
            <ChevronDownIcon className="w-8 h-8 sm:w-10 sm:h-10 text-comic-stroke" />
          </div>
        </div>
      </header>

      <main className="bg-pop-blue/10 w-full py-12 sm:py-16">
        <section className="max-w-7xl mx-auto p-6 sm:p-8 md:p-12 px-4 sm:px-6 lg:px-8">
          {isLoadingGames ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-pop-red mx-auto"></div>
              <p className="mt-8 text-pop-black text-2xl font-bold">LOADING AWESOMENESS...</p>
            </div>
          ) : (
            <BoardGameGrid games={games} onFileSelect={handleFileSelect} onSelectGame={handleSelectGame} />
          )}
        </section>
      </main>
      <footer className="text-center py-10 border-t-4 border-comic-stroke bg-pop-blue">
        <p className="text-md sm:text-lg text-pop-white font-semibold">
          &copy; {new Date().getFullYear()} AI Game Coach! Ready to POW?!
        </p>
      </footer>
    </div>
  );
};

export default App;
