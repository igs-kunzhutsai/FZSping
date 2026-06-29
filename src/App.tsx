/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RefreshCcw } from 'lucide-react';
import Arena from './components/Arena';
import { PlayerStats } from './game/types';
import ScaledContainer from './components/ui/ScaledContainer';
import LoadingScreen from './components/screens/LoadingScreen';
import GameOverScreen from './components/screens/GameOverScreen';
import ResultsScreen from './components/screens/ResultsScreen';

import ModeSelectScreen from './components/screens/ModeSelectScreen';
import CharacterSelectScreen from './components/screens/CharacterSelectScreen';
import ApexMomentumBgm from './BGM/Apex_Momentum.mp3';
import { isSkillKey, isDirectionKey } from './constants/ui';
import { SoundSystem } from './game/systems/SoundSystem';

export default function App() {
  const [status, setStatus] = useState<'modeSelect' | 'menu' | 'loading' | 'playing' | 'gameover' | 'results'>('modeSelect');
  const [gameMode, setGameMode] = useState<'campaign' | 'versus'>('campaign');
  const [energyPerCoin, setEnergyPerCoin] = useState(10);
  const [joined, setJoined] = useState<boolean[]>([false, false, false, false]);
  const [selectedModels, setSelectedModels] = useState<number[]>([1, 1, 1, 1]);
  const [winnerMsg, setWinnerMsg] = useState("");
  const [resultsStats, setResultsStats] = useState<PlayerStats[]>([]);
  const [canExitResults, setCanExitResults] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showResetToast, setShowResetToast] = useState(false);
  const menuBgmRef = useRef<HTMLAudioElement>(null);
  const [bgmPausedByUser, setBgmPausedByUser] = useState(false);

  const shouldPlayMenuBgm = status === 'modeSelect' || status === 'menu' || status === 'loading';

  useEffect(() => {
    const bgm = menuBgmRef.current;
    if (!bgm) return;

    bgm.volume = 0.75; // Lower volume by 25%

    const startPlaying = () => {
      if (bgmPausedByUser) {
        bgm.pause();
        return;
      }
      bgm.play()
        .then(() => {
          cleanupListeners();
        })
        .catch(e => {
          console.warn('Menu BGM play blocked by browser autoplay policy:', e);
        });
    };

    const cleanupListeners = () => {
      window.removeEventListener('click', startPlaying);
      window.removeEventListener('keydown', startPlaying);
      window.removeEventListener('touchstart', startPlaying);
      window.removeEventListener('mousedown', startPlaying);
    };

    if (shouldPlayMenuBgm) {
      if (bgmPausedByUser) {
        bgm.pause();
      } else {
        startPlaying();
        window.addEventListener('click', startPlaying);
        window.addEventListener('keydown', startPlaying);
        window.addEventListener('touchstart', startPlaying);
        window.addEventListener('mousedown', startPlaying);
      }
    } else {
      bgm.pause();
      bgm.currentTime = 0;
      cleanupListeners();
    }

    return () => {
      cleanupListeners();
    };
  }, [shouldPlayMenuBgm, status, bgmPausedByUser]);

  useEffect(() => {
    SoundSystem.init();
    if (status === 'modeSelect') {
      setIsPaused(false);
      setJoined([false, false, false, false]);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'loading') {
      setLoadingProgress(0);
      const duration = 2000;
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(100, (elapsed / duration) * 100);
        setLoadingProgress(pct);
        if (pct >= 100) {
          clearInterval(interval);
        }
      }, 16);
      return () => clearInterval(interval);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'results') {
      setCanExitResults(false);
      const timer = setTimeout(() => {
        setCanExitResults(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    if (showResetToast) {
      const timer = setTimeout(() => {
        setShowResetToast(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showResetToast]);

  useEffect(() => {
    // Master Event Listener for the App
    const handleGlobalEvents = (e: KeyboardEvent) => {
      // Global overrides
      if (e.key === 't' || e.key === 'T' || e.code === 'KeyT') {
        setStatus('modeSelect');
        return;
      }
      if (e.key === 'g' || e.key === 'G' || e.code === 'KeyG') {
        setIsFlipped(prev => !prev);
        return;
      }
      if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
        if (shouldPlayMenuBgm) {
          e.preventDefault();
          setBgmPausedByUser(prev => !prev);
          return;
        }
      }
      if (status === 'playing' && (e.key === 'b' || e.key === 'B' || e.code === 'KeyB')) {
        import('./game/systems/ProbabilityManager').then(({ ProbabilityManager }) => {
          ProbabilityManager.getInstance().resetPool();
          SoundSystem.play('pickupCoin_1');
          setShowResetToast(true);
        });
        return;
      }

      // State-specific actions
      switch (status) {
        case 'playing':
          if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            setIsPaused(prev => !prev);
          }
          break;
        case 'loading':
          if (loadingProgress >= 100) {
            e.preventDefault();
            if (isSkillKey(e)) {
              SoundSystem.play('pickupCoin_1');
              setStatus('playing');
            }
          }
          break;
        case 'gameover':
          SoundSystem.play('pickupCoin_1');
          setStatus('modeSelect');
          break;
        case 'results':
          if (canExitResults) {
            SoundSystem.play('pickupCoin_1');
            setStatus('modeSelect');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalEvents);
    
    return () => {
      window.removeEventListener('keydown', handleGlobalEvents);
    };
  }, [status, loadingProgress, canExitResults, shouldPlayMenuBgm]);

  const renderContent = () => {
    switch (status) {
      case 'modeSelect':
        return (
          <ModeSelectScreen 
            energyPerCoin={energyPerCoin}
            onEnergyChange={setEnergyPerCoin}
            onSelectMode={(mode) => {
              setGameMode(mode);
              setJoined([false, false, false, false]);
              setStatus('playing');
            }} 
          />
        );
      case 'menu':
        return (
          <CharacterSelectScreen 
            gameMode={gameMode}
            onBack={() => setStatus('modeSelect')}
            onStartGame={(activeJoined, activeModels) => {
              setJoined(activeJoined);
              setSelectedModels(activeModels);
              setStatus('loading');
            }}
          />
        );
      case 'loading':
        return <LoadingScreen loadingProgress={loadingProgress} gameMode={gameMode} />;
      case 'playing':
        return (
          <div className="relative w-full h-full">
            <Arena 
              players={joined} 
              modelTypes={selectedModels} 
              gameMode={gameMode}
              energyPerCoin={energyPerCoin}
              isPaused={isPaused}
              onGameOver={(msg, stats) => { 
                setIsPaused(false);
                if (msg === 'results' && stats) {
                  setResultsStats(stats);
                  setStatus('results');
                } else {
                  setWinnerMsg(msg);
                  setStatus('gameover'); 
                }
              }} 
            />
            {isPaused && (
              <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none select-none z-40">
                <span className="bg-slate-950/90 text-cyan-400 border border-cyan-500/30 px-5 py-1.5 rounded-full text-xs font-bold tracking-widest animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                  暫停中
                </span>
              </div>
            )}

            {/* Reset / Refresh Buffer Button */}
            <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
              <button
                onClick={() => {
                  import('./game/systems/ProbabilityManager').then(({ ProbabilityManager }) => {
                    ProbabilityManager.getInstance().resetPool();
                    SoundSystem.play('pickupCoin_1');
                    setShowResetToast(true);
                  });
                }}
                className="bg-slate-900/90 hover:bg-red-950/90 text-red-400 hover:text-red-200 border border-red-500/30 hover:border-red-500/60 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)] active:scale-95 cursor-pointer flex items-center gap-1.5 backdrop-blur-sm"
              >
                <RefreshCcw size={13} className="animate-spin-slow" />
                <span>重置 Buffer 水位 (B)</span>
              </button>
            </div>

            {/* Reset Toast Message */}
            <AnimatePresence>
              {showResetToast && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-16 right-4 z-50 bg-red-950/95 border border-red-500/50 px-4 py-2.5 rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.25)] flex items-center gap-2 pointer-events-none select-none backdrop-blur-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-200 text-xs font-bold font-mono tracking-widest">
                    SYSTEM: WATER LEVEL BUFFER RESET! (水位Buffer已重置)
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      case 'gameover':
        return <GameOverScreen winnerMsg={winnerMsg} />;
      case 'results':
        return <ResultsScreen resultsStats={resultsStats} gameMode={gameMode} canExitResults={canExitResults} />;
      default:
        return null;
    }
  };

  return (
    <ScaledContainer isFlipped={isFlipped}>
      <audio ref={menuBgmRef} src={ApexMomentumBgm} loop />
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full relative"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </ScaledContainer>
  );
}
