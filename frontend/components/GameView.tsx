
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BoardGame } from '../types';
import { PopArtCardsIcon, PopArtPawnIcon } from './icons'; 

interface GameViewProps {
  game: BoardGame;
  onBack: () => void;
}

interface DetectedItem {
  id: string;
  name: string;
}

interface PlayerItems {
  playerId: string;
  playerName: string;
  items: DetectedItem[];
}

interface GameAction {
  id: string;
  timestamp: number;
  image: string | null; 
  text: string;
}

interface GeminiApiResponseData {
  textResponse?: string;
  audioUrl?: string;
}

const MAX_AUDIO_RETRIES = 3;
const AUDIO_RETRY_DELAY_MS = 1500;

export const GameView: React.FC<GameViewProps> = ({ game, onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isSpeechApiAvailable, setIsSpeechApiAvailable] = useState(false);
  
  const currentFinalTranscriptRef = useRef<string>('');
  const errorDuringRecognitionRef = useRef<string | null>(null);
  const wasListeningWhenKeyInitiatedRef = useRef<boolean>(false);
  const stopRecognitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capturedImageRef = useRef<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const [gameActions, setGameActions] = useState<GameAction[]>([]);
  const [isProcessingWithGemini, setIsProcessingWithGemini] = useState<boolean>(false);
  const [isAdvisingAudioPlaying, setIsAdvisingAudioPlaying] = useState<boolean>(false);
  const [geminiInteractionError, setGeminiInteractionError] = useState<string | null>(null);


  // Placeholder data for detected objects
  const [detectedObjects, setDetectedObjects] = useState<PlayerItems[]>([
    {
      playerId: 'player1',
      playerName: 'Player 1',
      items: [
        { id: 'item1', name: 'Red Energy Cube' },
        { id: 'item2', name: '5 Gold Coins' },
        { id: 'item3', name: 'Forcefield Token' },
      ],
    },
    {
      playerId: 'player2',
      playerName: 'Player 2',
      items: [
        { id: 'item4', name: 'Blue Meeple Scout' },
        { id: 'item5', name: 'Ancient Relic Card' },
        { id: 'item6', name: '3 Victory Point Chips' },
      ],
    },
  ]);

  async function base64ToBlob(base64DataUrl: string): Promise<Blob> {
    const response = await fetch(base64DataUrl);
    const blob = await response.blob();
    return blob;
  }

  const playAudioWithRetries = useCallback(async (fullAudioUrl: string, retriesLeft: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.onended = null;
      audioPlayerRef.current.onerror = null;
      audioPlayerRef.current.removeAttribute('src'); // Fully reset src
      audioPlayerRef.current.load(); // Reload to apply src change
      audioPlayerRef.current = null;
    }

    audioPlayerRef.current = new Audio(fullAudioUrl);
    // isAdvisingAudioPlaying should already be true or set by the caller
    // setGeminiInteractionError(null); // Cleared by caller before initiating

    const currentAttempt = MAX_AUDIO_RETRIES - retriesLeft + 1;

    audioPlayerRef.current.onended = () => {
      console.log("AI Coach audio finished playing successfully.");
      setIsAdvisingAudioPlaying(false);
      setGeminiInteractionError(null);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.onended = null;
        audioPlayerRef.current.onerror = null;
        audioPlayerRef.current = null;
      }
    };

    audioPlayerRef.current.onerror = (e: Event) => {
      const audioElement = e.target as HTMLAudioElement;
      let errorDetails = "Unknown audio playback error.";
      if (audioElement && audioElement.error) {
        console.error("Audio playback error event. Target error:", audioElement.error, "Current src:", audioElement.currentSrc);
        switch (audioElement.error.code) {
            case MediaError.MEDIA_ERR_ABORTED: errorDetails = "Playback aborted."; break;
            case MediaError.MEDIA_ERR_NETWORK: errorDetails = "Network error during audio download."; break;
            case MediaError.MEDIA_ERR_DECODE: errorDetails = "Audio decoding error."; break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorDetails = "Audio source not supported (URL invalid/file unplayable/server issue)."; break;
            default: errorDetails = `Unknown media error (code: ${audioElement.error.code}).`;
        }
        errorDetails += ` URL: ${audioElement.src || fullAudioUrl}`;
      } else {
        errorDetails += ` URL: ${fullAudioUrl}`;
      }
      console.error(`Audio playback error (onerror, attempt ${currentAttempt}/${MAX_AUDIO_RETRIES}):`, errorDetails);

      if (retriesLeft > 0) {
        setGeminiInteractionError(`Audio problem... Retrying (${retriesLeft} left). Details: ${errorDetails.substring(0, 150)}...`);
        if (audioPlayerRef.current) { // Clean up before retry
            audioPlayerRef.current.pause();
            audioPlayerRef.current.onended = null;
            audioPlayerRef.current.onerror = null;
            audioPlayerRef.current = null;
        }
        setTimeout(() => {
          playAudioWithRetries(fullAudioUrl, retriesLeft - 1);
        }, AUDIO_RETRY_DELAY_MS);
      } else {
        setGeminiInteractionError(`KAPOW! AI audio failed after ${MAX_AUDIO_RETRIES} attempts. ${errorDetails}`);
        setIsAdvisingAudioPlaying(false);
        if (audioPlayerRef.current) {
          audioPlayerRef.current.onended = null;
          audioPlayerRef.current.onerror = null;
          audioPlayerRef.current = null;
        }
      }
    };

    try {
      console.log(`Attempting to play audio (attempt ${currentAttempt}/${MAX_AUDIO_RETRIES}): ${fullAudioUrl}`);
      await audioPlayerRef.current.play();
      // If play() resolves, audio is playing or will play.
    } catch (err) {
      console.error(`Failed to initiate AI coach audio playback (play() promise rejected, attempt ${currentAttempt}/${MAX_AUDIO_RETRIES}):`, err, "URL attempted:", audioPlayerRef.current?.src || fullAudioUrl);
      let playErrorMsg = "Could not start AI audio. ";
      if (err instanceof DOMException) {
        playErrorMsg += `(${err.name}: ${err.message})`;
        if (err.name === 'NotSupportedError') playErrorMsg += " Format/URL likely unsupported.";
      } else if (err instanceof Error) {
        playErrorMsg += err.message;
      } else {
        playErrorMsg += String(err);
      }
      playErrorMsg += ` URL: ${audioPlayerRef.current?.src || fullAudioUrl}`;

      if (retriesLeft > 0) {
        setGeminiInteractionError(`Audio start issue... Retrying (${retriesLeft} left). ${playErrorMsg.substring(0, 150)}...`);
        if (audioPlayerRef.current) { // Clean up before retry
            audioPlayerRef.current.pause();
            audioPlayerRef.current.onended = null;
            audioPlayerRef.current.onerror = null;
            audioPlayerRef.current = null;
        }
        setTimeout(() => {
          playAudioWithRetries(fullAudioUrl, retriesLeft - 1);
        }, AUDIO_RETRY_DELAY_MS);
      } else {
        setGeminiInteractionError(`BOOM! AI audio failed to start after ${MAX_AUDIO_RETRIES} attempts. ${playErrorMsg}`);
        setIsAdvisingAudioPlaying(false);
        if (audioPlayerRef.current) {
            audioPlayerRef.current.onended = null;
            audioPlayerRef.current.onerror = null;
            audioPlayerRef.current = null;
        }
      }
    }
  }, []);


  useEffect(() => {
    let stream: MediaStream | null = null;
    const videoElement = videoRef.current;

    const startCamera = async () => {
      setIsLoadingCamera(true);
      setCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError("Webcam access is not supported by your browser. BAM!");
          setIsLoadingCamera(false);
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); 
        if (videoElement) {
          videoElement.srcObject = stream;
          videoElement.onloadedmetadata = () => {
             setIsLoadingCamera(false); 
          }
        } else {
            setIsLoadingCamera(false);
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
        if (err instanceof Error) {
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                 setCameraError("Webcam/Microphone permission denied. WHOOSH! Please enable access in your browser settings.");
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                setCameraError("No webcam/microphone found. ZAP! Make sure your devices are connected.");
            } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
                setCameraError("Webcam or microphone is already in use or cannot be accessed. POW!");
            }
            else {
                setCameraError(`Error accessing media devices: ${err.message}. POW!`);
            }
        } else {
            setCameraError("An unknown error occurred while accessing media devices. WHAM!");
        }
        setIsLoadingCamera(false);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoElement) {
        videoElement.srcObject = null;
        videoElement.onloadedmetadata = null;
      }
    };
  }, []);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setIsSpeechApiAvailable(true);
      const instance = new SpeechRecognitionAPI();
      instance.continuous = true; 
      instance.interimResults = true; 
      instance.lang = 'en-US';

      instance.onresult = (event: SpeechRecognitionEvent) => {
        let final_transcript_for_this_session = "";
        for (let i = event.resultIndex; i < event.results.length; i++) { 
            if (event.results[i].isFinal) {
                final_transcript_for_this_session += event.results[i][0].transcript + " ";
            }
        }
        currentFinalTranscriptRef.current += final_transcript_for_this_session; 
      };

      instance.onerror = (event: SpeechRecognitionErrorEvent) => {
        errorDuringRecognitionRef.current = event.error;
        console.error('Speech recognition error:', event.error, event.message);
        let micErrorMsg = null;
        if (event.error === 'no-speech') {
          console.warn('No speech detected. WHISPER!');
        } else if (event.error === 'audio-capture') {
          micErrorMsg = "Microphone problem. STATIC! Check your mic connection or permissions.";
          console.error(micErrorMsg);
        } else if (event.error === 'not-allowed') {
          micErrorMsg = "Microphone permission denied. MUTED! Please enable microphone access.";
          console.error('Permission denied for microphone. SILENCED!');
        }
        if (micErrorMsg && (!cameraError || !(cameraError.toLowerCase().includes("microphone") || cameraError.toLowerCase().includes("mic problem")))) {
            setCameraError(micErrorMsg);
        }
      };

      instance.onstart = () => {
        currentFinalTranscriptRef.current = ""; 
        errorDuringRecognitionRef.current = null;
        setGeminiInteractionError(null); 
      };

      instance.onend = async () => {
        const finalTranscript = currentFinalTranscriptRef.current.trim();
        const imageToLog = capturedImageRef.current; 
        let newAction: GameAction | null = null;

        if (wasListeningWhenKeyInitiatedRef.current) {
            newAction = {
              id: `action-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              timestamp: Date.now(),
              image: imageToLog,
              text: finalTranscript || (errorDuringRecognitionRef.current === 'no-speech' ? "No speech detected. SILENCE!" : "Speech input error."),
            };
            const currentActionId = newAction.id; 
            setGameActions(prevActions => [newAction!, ...prevActions]);
            console.log(`[Klaus.AI Action Added]: Speech: '${newAction.text}' | Image: ${newAction.image || "No image data"}`);

            if (newAction && game.systemPrompt && game.gameSchema) {
              setIsProcessingWithGemini(true);
              setGeminiInteractionError(null);
              try {
                const formData = new FormData();
                formData.append('systemPrompt', game.systemPrompt);
                formData.append('responseFormat', JSON.stringify(game.gameSchema));
                formData.append('userTTSInput', newAction.text);

                if (newAction.image && newAction.image.startsWith('data:image')) {
                  const imageBlob = await base64ToBlob(newAction.image);
                  formData.append('imageFile', imageBlob, 'webcam-capture.jpg');
                } else if (newAction.image) {
                  console.warn("Cannot send image to Gemini API, image data is an error or invalid:", newAction.image);
                }

                const geminiApiResponse = await fetch('https://klaus-node-server-fphw3.ondigitalocean.app/api/gemini-interaction', {
                  method: 'POST',
                  body: formData,
                });

                if (geminiApiResponse.ok) {
                  const geminiData: GeminiApiResponseData = await geminiApiResponse.json();
                  console.log('Gemini interaction successful:', geminiData);
                  
                  if(geminiData.textResponse) {
                    console.log("AI Coach Text Response:", geminiData.textResponse);
                    setGameActions(prevActions =>
                      prevActions.map(act =>
                        act.id === currentActionId
                          ? { ...act, text: `${act.text}\n\nKlaus said: ${geminiData.textResponse}` }
                          : act
                      )
                    );
                  }

                  if (geminiData.audioUrl) {
                    setIsAdvisingAudioPlaying(true); 
                    setGeminiInteractionError(null); // Clear previous errors before attempting to play
                    const fullAudioUrl = `https://klaus-node-server-fphw3.ondigitalocean.app${geminiData.audioUrl}`;
                    playAudioWithRetries(fullAudioUrl, MAX_AUDIO_RETRIES);
                  } else {
                     console.log("Gemini response OK, but no audioUrl provided.");
                  }
                } else {
                  const errorText = await geminiApiResponse.text();
                  console.error('Gemini interaction failed:', geminiApiResponse.status, errorText);
                  setGeminiInteractionError(`WHAMMO! AI Coach hiccuped: ${geminiApiResponse.status} - ${errorText || 'Unknown error'}`);
                }
              } catch (error) {
                console.error('Error during Gemini interaction POST:', error);
                let detail = "Network error or server issue.";
                if (error instanceof Error) detail = error.message;
                setGeminiInteractionError(`POOF! Failed to talk to AI Coach: ${detail}`);
              } finally {
                setIsProcessingWithGemini(false);
              }
            } else {
              if (!game.systemPrompt || !game.gameSchema) {
                console.warn("Skipping Gemini interaction: systemPrompt or gameSchema is missing for the current game.", game);
                if (game.id.startsWith("uploaded-")) { 
                    setGeminiInteractionError("CRITICAL! Game configuration (prompt/schema) is missing for this uploaded game. Cannot contact AI Coach.");
                }
              }
            }
        }
        
        currentFinalTranscriptRef.current = "";
        errorDuringRecognitionRef.current = null; 
        wasListeningWhenKeyInitiatedRef.current = false; 
        capturedImageRef.current = null; 
        setIsListening(false); 
      };
      
      recognitionRef.current = instance;
    } else {
      console.warn('Speech Recognition API is not supported in this browser. BOO!');
      setIsSpeechApiAvailable(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current = null;
      }
      if (stopRecognitionTimeoutRef.current) {
        clearTimeout(stopRecognitionTimeoutRef.current);
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.removeAttribute('src'); 
        audioPlayerRef.current.load(); 
        audioPlayerRef.current.onended = null;
        audioPlayerRef.current.onerror = null;
        audioPlayerRef.current = null;
      }
    };
  }, [game, cameraError, playAudioWithRetries]); 

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === '`' && !event.repeat && 
        isSpeechApiAvailable && recognitionRef.current && 
        !isProcessingWithGemini && !isListening ) { 
      
      if (isAdvisingAudioPlaying) {
        if (audioPlayerRef.current) {
          console.log("Interrupting AI Coach audio playback to listen.");
          audioPlayerRef.current.pause();
          // Event handlers will be reset by playAudioWithRetries or cleanup
          audioPlayerRef.current.onended = null; 
          audioPlayerRef.current.onerror = null; 
          audioPlayerRef.current = null; 
        }
        setIsAdvisingAudioPlaying(false); // Stop advising state
        setGeminiInteractionError(null); // Clear any audio error messages
      }

      if (cameraError && (cameraError.toLowerCase().includes("microphone") || cameraError.toLowerCase().includes("mic problem"))) {
        console.warn("Cannot start speech recognition due to microphone issue:", cameraError);
        return;
      }
      if (stopRecognitionTimeoutRef.current) { 
        clearTimeout(stopRecognitionTimeoutRef.current);
        stopRecognitionTimeoutRef.current = null;
      }
      
      try {
        currentFinalTranscriptRef.current = ""; 
        recognitionRef.current.start();
        setIsListening(true);
        wasListeningWhenKeyInitiatedRef.current = true;
        setGeminiInteractionError(null); 
      } catch (e) {
        console.error("Error starting speech recognition:", e);
        setIsListening(false); 
        wasListeningWhenKeyInitiatedRef.current = false;
          if (e instanceof Error && e.name === 'InvalidStateError') {
            console.warn("Speech recognition service was already active or in an invalid state.");
            setGeminiInteractionError("Speech input hiccup. Please try again.");
          } else {
          setCameraError("Failed to start speech input. BLIP!"); 
          }
      }
    }
  }, [isSpeechApiAvailable, isListening, cameraError, isProcessingWithGemini, isAdvisingAudioPlaying]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (event.key === '`' && isSpeechApiAvailable && recognitionRef.current) {
      if (isListening) { 
        const video = videoRef.current;
        const isCameraOkayForImage = !cameraError || (cameraError && (cameraError.toLowerCase().includes("microphone") || cameraError.toLowerCase().includes("mic problem")));

        if (video && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0 && isCameraOkayForImage) {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            capturedImageRef.current = canvas.toDataURL('image/jpeg');
          } else {
            console.warn('[Klaus.AI Vision]: Could not get canvas context to capture image.');
            capturedImageRef.current = "Image capture failed: Canvas context error.";
          }
        } else if (!isCameraOkayForImage) {
            console.warn(`[Klaus.AI Vision]: Camera has a non-microphone related issue (${cameraError}), cannot capture image.`);
            capturedImageRef.current = `Image capture failed: Camera error (${cameraError}).`;
        } else if (video && (video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0)) {
           console.warn('[Klaus.AI Vision]: Webcam not ready (no data/zero dimensions), cannot capture image.');
           capturedImageRef.current = "Image capture failed: Webcam not ready.";
        } else if (!video) {
            console.warn('[Klaus.AI Vision]: Video element not available.');
            capturedImageRef.current = "Image capture failed: Video element unavailable.";
        }

        if (stopRecognitionTimeoutRef.current) {
            clearTimeout(stopRecognitionTimeoutRef.current);
        }
        stopRecognitionTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current && isListening) { 
            recognitionRef.current.stop(); 
          }
          stopRecognitionTimeoutRef.current = null;
        }, 1500); 
      }
    }
  }, [isSpeechApiAvailable, isListening, cameraError]); 

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (stopRecognitionTimeoutRef.current) {
        clearTimeout(stopRecognitionTimeoutRef.current);
      }
    };
  }, [handleKeyDown, handleKeyUp]);


  const SidebarCard: React.FC<{title: string, icon?: React.ReactNode, children: React.ReactNode, className?: string}> = ({ title, icon, children, className }) => (
    <div className={`bg-pop-white rounded-lg border-2 border-comic-stroke shadow-comic p-4 ${className}`}>
      <h3 className="font-display text-2xl sm:text-3xl text-pop-black mb-3 flex items-center" style={{ WebkitTextStroke: '1px black' }}>
        {icon && <span className="mr-2 transform scale-75 sm:scale-90">{icon}</span>}
        {title}
      </h3>
      {children}
    </div>
  );

  const getStatusText = () => {
    if (isAdvisingAudioPlaying) {
        if (geminiInteractionError && geminiInteractionError.toLowerCase().includes("retrying")) return "Audio Retrying...";
        return "Advising...";
    }
    if (isProcessingWithGemini) return "AI Coach is thinking...";
    if (isListening) return "Listening...";
    if (isLoadingCamera) return "Initializing...";
    if (cameraError && (cameraError.toLowerCase().includes("microphone") || cameraError.toLowerCase().includes("mic problem"))) {
        return "Mic Problem";
    }
    if (cameraError) return "Camera Error";
    return "Ready! Hold '`' to talk.";
  };

  const getStatusIconClass = () => {
    if (isAdvisingAudioPlaying) return 'text-pop-green animate-pulse-slow'; 
    if (isProcessingWithGemini) return 'text-pop-blue animate-pulse-slow';
    if (isListening) return 'text-pop-pink animate-dot-pulse';
    if (isLoadingCamera) return 'text-pop-yellow animate-pulse-slow';
    if (cameraError) return 'text-pop-red';
    return 'text-pop-green';
  };


  return (
    <div className="min-h-screen bg-pop-blue/10 flex flex-col items-center p-4 sm:p-6 font-sans text-pop-black">
      <header className="w-full max-w-6xl mb-6 sm:mb-8 flex flex-row items-end justify-between">
         <h1 
          className="font-display text-4xl sm:text-5xl md:text-6xl text-pop-blue tracking-wider text-left flex-grow sm:pr-4"
          style={{ WebkitTextStroke: '1.5px black', textShadow: '3px 3px 0 #FFFFFF, 5px 5px 0 #000000' }}
        >
          {game.name}
        </h1>
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {(game.systemPrompt && game.gameSchema) && (
            <button
              aria-label={`View rulebook for ${game.name}`}
              className={`hidden sm:flex items-center space-x-2 text-sm font-bold bg-pop-yellow text-pop-black hover:bg-yellow-500
                        focus:bg-opacity-80 
                        border-2 border-comic-stroke px-4 py-2 rounded-md shadow-comic hover:shadow-comic-hover 
                        transition-all duration-200 ease-in-out transform hover:scale-105 
                        focus:outline-none focus:ring-2 focus:ring-pop-blue focus:ring-offset-2 focus:ring-offset-pop-white`}
              onClick={() => alert('KAZAM! Rulebook details (system prompt & schema) would be shown here.\n\nSystem Prompt:\n' + game.systemPrompt + '\n\nGame Schema:\n' + JSON.stringify(game.gameSchema, null, 2))} 
            >
              <span>RULEBOOK</span>
            </button>
          )}
          <button
            onClick={onBack}
            aria-label="End Game"
            className="bg-pop-red text-pop-white hover:bg-red-700 
                       border-2 border-comic-stroke px-4 py-2 rounded-md shadow-comic hover:shadow-comic-hover 
                       transition-all duration-200 ease-in-out transform hover:scale-105 
                       focus:outline-none focus:ring-2 focus:ring-pop-yellow focus:ring-offset-2 focus:ring-offset-pop-white
                       flex items-center space-x-2 text-sm font-bold"
          >
            <span>END GAME</span>
          </button>
        </div>
      </header>

      <div className="w-full max-w-6xl flex flex-col md:flex-row flex-grow gap-4 md:gap-6 lg:gap-8">
        <main className="w-full md:w-2/3 lg:w-3/4 flex flex-col">
          <div className="w-full aspect-video bg-pop-black/80 rounded-lg border-4 border-comic-stroke shadow-comic overflow-hidden relative">
            {isLoadingCamera && (
              <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-pop-white p-4 bg-pop-black/50">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-pop-yellow mx-auto"></div>
                <p className="mt-6 text-xl font-bold">INITIALIZING CAMERA... KABOOM!</p>
              </div>
            )}
            {!isLoadingCamera && cameraError && !(cameraError.toLowerCase().includes("microphone") || cameraError.toLowerCase().includes("mic problem")) && (
              <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-pop-red/80 text-pop-white p-6 rounded-md">
                <h2 className="text-2xl font-bold text-center" style={{ WebkitTextStroke: '0.5px black' }}>CAMERA ERROR!</h2>
                <p className="mt-3 text-center font-semibold">{cameraError}</p>
                <p className="mt-2 text-center text-sm">Try checking browser permissions or camera connection.</p>
              </div>
            )}
             {!isLoadingCamera && cameraError && (cameraError.toLowerCase().includes("microphone") || cameraError.toLowerCase().includes("mic problem")) && !isAdvisingAudioPlaying && (
              <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-pop-pink/70 text-pop-white p-6 rounded-md z-10">
                <h2 className="text-2xl font-bold text-center" style={{ WebkitTextStroke: '0.5px black' }}>MICROPHONE ISSUE!</h2>
                <p className="mt-3 text-center font-semibold">{cameraError}</p>
                <p className="mt-2 text-center text-sm">Enable microphone access or check mic connection to use speech input.</p>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted 
              className={`w-full h-full object-cover 
                         ${ (isLoadingCamera || (cameraError && !(cameraError.toLowerCase().includes("microphone") || cameraError.toLowerCase().includes("mic problem")))) ? 'opacity-0' : 'opacity-100'}
                         transition-opacity duration-300`}
              aria-label="Webcam feed"
            />
          </div>
           {!isLoadingCamera && !cameraError && (
               <p className="mt-4 text-md text-pop-black/70 font-medium">
                  Make sure the <span className="font-display text-pop-pink text-md">ENTIRE BOARD</span> is visible!
               </p>
           )}
            {!isLoadingCamera && cameraError && (cameraError.toLowerCase().includes("microphone") || cameraError.toLowerCase().includes("mic problem")) && (
                <p className="mt-4 text-sm text-pop-black/70 font-medium">
                  Camera feed active. <span className="font-bold text-pop-red">Speech input needs microphone access/check.</span>
               </p>
            )}
             {!isLoadingCamera && cameraError && !(cameraError.toLowerCase().includes("microphone") || cameraError.toLowerCase().includes("mic problem")) && (
                <p className="mt-4 text-sm text-pop-red font-semibold">
                  Camera not available. Gameplay insights might be limited!
               </p>
            )}
          
          {/* Action Log Moved Here */}
          <div className="w-full mt-8">
              <h2 className="font-display text-3xl sm:text-4xl text-pop-red mb-4 flex items-center" style={{ WebkitTextStroke: '1px black', textShadow: '2px 2px 0 #FFFFFF' }}>
                <span role="img" aria-label="explosion" className="mr-2 text-2xl sm:text-3xl">⚡️</span>
                POW! Action Log
                <span role="img" aria-label="explosion" className="ml-2 text-2xl sm:text-3xl">⚡️</span>
              </h2>
              {gameActions.length === 0 ? (
                <div className="p-6 bg-pop-white rounded-lg border-2 border-dashed border-comic-stroke text-center shadow-inner">
                  <p className="text-pop-black/80 font-semibold text-lg">No game actions recorded yet. Zzz...</p>
                  <p className="text-pop-black/60 mt-1">Hold <code className="bg-pop-black/10 px-1.5 py-0.5 rounded">`</code> (backtick), say something AWESOME, then release to log your move!</p>
                </div>
              ) : (
                <div className="space-y-4 rounded-lg max-h-96 overflow-y-auto pr-2">
                  {gameActions.map(action => (
                    <div 
                      key={action.id} 
                      className="flex flex-col sm:flex-row items-start p-3 bg-pop-white rounded-md border-2 border-comic-stroke shadow-comic"
                      role="listitem"
                      aria-labelledby={`action-text-${action.id}`}
                      aria-describedby={`action-time-${action.id}`}
                    >
                      {action.image && action.image.startsWith('data:image') ? (
                        <img 
                          src={action.image} 
                          alt="Captured game action" 
                          className="w-full sm:w-24 md:w-32 h-auto mb-2 sm:mb-0 sm:mr-3 rounded border border-comic-stroke object-cover aspect-video sm:aspect-square" 
                        />
                      ) : action.image ? ( 
                          <div className="w-full sm:w-24 md:w-32 h-20 sm:h-auto aspect-video sm:aspect-square mb-2 sm:mb-0 sm:mr-3 rounded border border-comic-stroke bg-pop-red/10 flex items-center justify-center text-center text-xs p-2 text-pop-red font-semibold">
                            {action.image}
                          </div>
                      ) : (
                        <div className="w-full sm:w-24 md:w-32 h-20 sm:h-auto aspect-video sm:aspect-square mb-2 sm:mb-0 sm:mr-3 rounded border border-comic-stroke bg-pop-black/5 flex items-center justify-center text-center text-xs p-2 text-pop-black/50">
                          No Image
                        </div>
                      )}
                      <div className="flex-1">
                        <p id={`action-text-${action.id}`} className="text-sm sm:text-base text-pop-black font-medium leading-snug whitespace-pre-line">{action.text}</p>
                        <p id={`action-time-${action.id}`} className="text-xs text-pop-black/60 mt-1">{new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </main>

        <aside className="w-full md:w-1/3 lg:w-1/4 flex flex-col gap-4 md:gap-6">
          <SidebarCard 
            title="Current Action" 
            icon={<PopArtPawnIcon className={`w-8 h-8 ${getStatusIconClass()}`} />}
          >
            <p className={`text-pop-black font-semibold text-lg ${isListening ? 'text-pop-pink' : ''} ${isProcessingWithGemini ? 'text-pop-blue' : ''} ${isAdvisingAudioPlaying ? 'text-pop-green' : ''}`}>
              {getStatusText()}
            </p>
            {geminiInteractionError && (
              <p className="mt-2 text-xs text-pop-red font-bold break-words">
                <span role="img" aria-label="error icon" className="mr-1">💥</span> 
                {geminiInteractionError}
              </p>
            )}
            {!isSpeechApiAvailable && (
                 <p className="mt-2 text-xs text-pop-red font-semibold">Speech input not available in this browser. Bummer!</p>
            )}
          </SidebarCard>

          <SidebarCard 
            title="Game State"
            icon={<PopArtCardsIcon className="w-8 h-8 text-pop-blue" />}
          >

            <div className="mt-4 pt-3 border-t-2 border-comic-stroke/30">
              <h4 className="font-bold text-pop-green mb-1 text-lg" style={{ WebkitTextStroke: '0.5px black' }}>AI System Prompt:</h4>
              <p className="text-xs text-pop-black/90 font-medium bg-pop-black/5 p-2 rounded border border-comic-stroke/20 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                {
                  typeof game.systemPrompt === 'string' 
                    ? (game.systemPrompt.trim() === '' ? <em className="text-pop-black/60">[System Prompt is empty]</em> : game.systemPrompt)
                    : <em className="text-pop-black/60">[System Prompt not available]</em>
                }
              </p>
            </div>
            
            <div className="mt-3 pt-3 border-t-2 border-comic-stroke/10">
              <h4 className="font-bold text-pop-green mb-1 text-lg" style={{ WebkitTextStroke: '0.5px black' }}>AI Expected Response Format:</h4>
              <pre className="text-xs text-pop-black/90 font-mono bg-pop-black/5 p-2 rounded border border-comic-stroke/20 whitespace-pre-wrap break-words overflow-auto max-h-60">
                <code>
                  {
                    game.gameSchema !== null && game.gameSchema !== undefined
                      ? JSON.stringify(game.gameSchema, null, 2)
                      : <em className="text-pop-black/60">[Game Schema not available]</em>
                  }
                </code>
              </pre>
            </div>
          </SidebarCard>
        </aside>
      </div>

      <footer className="w-full text-center py-6 mt-auto pt-8">
        <p className="text-md text-pop-black/70 font-semibold">
          AI Coach for {game.name} - Ready to strategize!
        </p>
      </footer>
    </div>
  );
};
