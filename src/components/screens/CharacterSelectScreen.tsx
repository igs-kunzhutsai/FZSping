import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MODEL_NAMES, MENU_PLAYER_PROFILES } from '../../constants/ui';
import TopPreview from '../ui/TopPreview';
import { SoundSystem } from '../../game/systems/SoundSystem';

interface CharacterSelectScreenProps {
  gameMode: 'campaign' | 'versus';
  onBack: () => void;
  onStartGame: (joined: boolean[], models: number[]) => void;
}

export default function CharacterSelectScreen({ gameMode, onBack, onStartGame }: CharacterSelectScreenProps) {
  const [joined, setJoined] = useState<boolean[]>([false, false, false, false]);
  const [ready, setReady] = useState<boolean[]>([false, false, false, false]);
  const [selectedModels, setSelectedModels] = useState<number[]>([1, 1, 1, 1]);

  useEffect(() => {
    const activeCount = joined.filter(Boolean).length;
    if (activeCount > 0) {
      const allActiveReady = joined.every((isJoined, idx) => !isJoined || ready[idx]);
      if (allActiveReady) {
        onStartGame(joined, selectedModels);
      }
    }
  }, [joined, ready, selectedModels, onStartGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key ? e.key.toLowerCase() : '';
      
      // Player 1 join/ready via Skill Key: E
      if (e.code === 'KeyE' || key === 'e') {
        SoundSystem.play('pickupCoin_1');
        if (!joined[0]) {
          setJoined(prev => {
            const next = [...prev];
            next[0] = true;
            return next;
          });
        } else {
          setReady(prev => {
            const next = [...prev];
            next[0] = !next[0];
            return next;
          });
        }
      }
      // Player 2 join/ready via Skill Key: Ctrl
      if (e.code === 'ControlRight' || e.code === 'ControlLeft' || e.key === 'Control') {
        e.preventDefault();
        SoundSystem.play('pickupCoin_1');
        if (!joined[1]) {
          setJoined(prev => {
            const next = [...prev];
            next[1] = true;
            return next;
          });
        } else {
          setReady(prev => {
            const next = [...prev];
            next[1] = !next[1];
            return next;
          });
        }
      }
      // Player 3 join/ready via Skill Key: O
      if (e.code === 'KeyO' || key === 'o') {
        SoundSystem.play('pickupCoin_1');
        if (!joined[2]) {
          setJoined(prev => {
            const next = [...prev];
            next[2] = true;
            return next;
          });
        } else {
          setReady(prev => {
            const next = [...prev];
            next[2] = !next[2];
            return next;
          });
        }
      }
      // Player 4 join/ready via Skill Key: 9/Digit9/Numpad9
      if (e.code === 'Numpad9' || e.code === 'Digit9' || key === '9') {
        SoundSystem.play('pickupCoin_1');
        if (!joined[3]) {
          setJoined(prev => {
            const next = [...prev];
            next[3] = true;
            return next;
          });
        } else {
          setReady(prev => {
            const next = [...prev];
            next[3] = !next[3];
            return next;
          });
        }
      }

      // P1 model cycle (A / D)
      if (joined[0] && !ready[0]) {
        if (e.code === 'KeyA' || key === 'a') {
          SoundSystem.play('pickupCoin_1');
          setSelectedModels(prev => {
            const next = [...prev];
            next[0] = (next[0] - 2 + 4) % 4 + 1;
            return next;
          });
        }
        if (e.code === 'KeyD' || key === 'd') {
          SoundSystem.play('pickupCoin_1');
          setSelectedModels(prev => {
            const next = [...prev];
            next[0] = (next[0] % 4) + 1;
            return next;
          });
        }
      }

      // P2 model cycle (Left / Right Arrow)
      if (joined[1] && !ready[1]) {
        if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft') {
          SoundSystem.play('pickupCoin_1');
          setSelectedModels(prev => {
            const next = [...prev];
            next[1] = (next[1] - 2 + 4) % 4 + 1;
            return next;
          });
        }
        if (e.code === 'ArrowRight' || e.key === 'ArrowRight') {
          SoundSystem.play('pickupCoin_1');
          setSelectedModels(prev => {
            const next = [...prev];
            next[1] = (next[1] % 4) + 1;
            return next;
          });
        }
      }

      // P3 model cycle (J / L)
      if (joined[2] && !ready[2]) {
        if (e.code === 'KeyJ' || key === 'j') {
          SoundSystem.play('pickupCoin_1');
          setSelectedModels(prev => {
            const next = [...prev];
            next[2] = (next[2] - 2 + 4) % 4 + 1;
            return next;
          });
        }
        if (e.code === 'KeyL' || key === 'l') {
          SoundSystem.play('pickupCoin_1');
          setSelectedModels(prev => {
            const next = [...prev];
            next[2] = (next[2] % 4) + 1;
            return next;
          });
        }
      }

      // P4 model cycle (4 / 6)
      if (joined[3] && !ready[3]) {
        if (e.code === 'Digit4' || e.code === 'Numpad4' || key === '4') {
          SoundSystem.play('pickupCoin_1');
          setSelectedModels(prev => {
            const next = [...prev];
            next[3] = (next[3] - 2 + 4) % 4 + 1;
            return next;
          });
        }
        if (e.code === 'Digit6' || e.code === 'Numpad6' || key === '6') {
          SoundSystem.play('pickupCoin_1');
          setSelectedModels(prev => {
            const next = [...prev];
            next[3] = (next[3] % 4) + 1;
            return next;
          });
        }
      }
      
      // Back to mode select on Escape or Backspace
      if (e.code === 'Escape' || e.code === 'Backspace') {
        e.preventDefault();
        SoundSystem.play('pickupCoin_1');
        onBack();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [joined, ready, onBack]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full text-white font-mono p-4 pointer-events-none">
      <h1 className="text-6xl text-center mb-2 font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 tracking-tighter w-full">
        {gameMode === 'campaign' ? '機甲陀螺：殭屍末日' : '機甲陀螺：對戰擂台'}
      </h1>
      
      <div className="bg-slate-900 border-2 border-slate-800 px-8 py-5 rounded-[2rem] w-full max-w-[2088px] text-center shadow-2xl">
          <h2 className="text-2xl font-extrabold mb-4 text-slate-100">
            請按對應的 <span className="text-pink-400 text-3xl px-2 font-black">技能鍵</span> 來啟動參戰：
          </h2>

          <div className="grid grid-cols-4 gap-4 text-left text-xl text-slate-200 mb-4">
            {MENU_PLAYER_PROFILES.map((prof, i) => {
              const isActive = joined[i];
              const isReady = ready[i];
              return (
                <div 
                  key={i} 
                  className={`p-4 bg-black/60 rounded-[1.5rem] shadow-inner border-2 transition-all duration-300 flex flex-col justify-between ${
                    isActive 
                      ? (isReady ? 'shadow-[0_0_35px_rgba(34,197,94,0.35)] border-green-500 bg-slate-900/40' : prof.activeGlow) 
                      : `${prof.borderColor} opacity-60`
                  }`}
                >
                  <div>
                    {/* Title bar with join stats */}
                    <div className="flex justify-between items-center border-b-4 border-slate-800 pb-2 mb-2">
                      <h3 className={`font-bold ${prof.textColor} text-3xl`}>{prof.label}</h3>
                      {isActive ? (
                        <div className="flex items-center gap-2">
                          {isReady ? (
                            <span className="bg-green-500/10 border border-green-500/40 text-green-400 text-sm px-2.5 py-0.5 rounded-md font-sans font-extrabold animate-pulse">備戰中 LOCK</span>
                          ) : (
                            <span className="bg-amber-500/10 border border-amber-500/40 text-amber-400 text-sm px-2.5 py-0.5 rounded-md font-sans font-bold">選擇中</span>
                          )}
                          <span className={`w-2.5 h-2.5 rounded-full ${isReady ? 'bg-green-400 shadow-[0_0_8px_rgb(74,222,128)]' : 'bg-yellow-400 animate-pulse'}`} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-600 block" />
                        </div>
                      )}
                    </div>

                    {/* Custom canvas top rotation preview with selection arrows */}
                    <div className="relative flex items-center justify-center gap-2">
                      {isActive && !isReady && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            SoundSystem.play('pickupCoin_1');
                            setSelectedModels(prev => {
                              const next = [...prev];
                              next[i] = (next[i] - 2 + 4) % 4 + 1;
                              return next;
                            });
                          }}
                          className="pointer-events-auto p-2 rounded-full bg-slate-800/90 hover:bg-slate-700 text-yellow-400 border border-slate-700 hover:scale-115 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                          title="上一個造型"
                        >
                          <ChevronLeft size={24} />
                        </button>
                      )}

                      <TopPreview color={prof.color} pilotColor={prof.pilotColor} isPowerOn={isActive} modelType={selectedModels[i]} />

                      {isActive && !isReady && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            SoundSystem.play('pickupCoin_1');
                            setSelectedModels(prev => {
                              const next = [...prev];
                              next[i] = (next[i] % 4) + 1;
                              return next;
                            });
                          }}
                          className="pointer-events-auto p-2 rounded-full bg-slate-800/90 hover:bg-slate-700 text-yellow-400 border border-slate-700 hover:scale-115 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                          title="下一個造型"
                        >
                          <ChevronRight size={24} />
                        </button>
                      )}
                    </div>

                    {/* Model name display with styling */}
                    <div className="text-center mt-1 mb-2">
                      <span className={`text-lg font-sans px-3 py-1 rounded-full bg-slate-950/80 font-bold border ${
                        isActive 
                          ? (isReady ? 'text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'text-yellow-400 border-yellow-500/40 animate-pulse') 
                          : 'text-slate-500 border-slate-800'
                      }`}>
                        {isActive ? (isReady ? `🔒 ${MODEL_NAMES[selectedModels[i] - 1]}` : MODEL_NAMES[selectedModels[i] - 1]) : `已裝載 ${MODEL_NAMES[selectedModels[i] - 1]}`}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-xl border-2 border-slate-800/85 mt-2 text-center">
                    <p className="text-lg text-center">
                      <span className="text-slate-400 text-base block mb-0.5">操作移動：</span>
                      <strong className="text-slate-200 text-2xl font-bold">{prof.controlsLabel}</strong>
                    </p>
                    <p className="text-lg text-center">
                      <span className="text-slate-400 text-base block mb-0.5">加速旋轉鍵：</span>
                      <strong className={`${prof.textColor} text-3xl font-black`}>【 {prof.joinKey} 】</strong>
                    </p>
                    <p className="text-lg text-center">
                      <span className="text-slate-400 text-base block mb-0.5">技能鍵／確認：</span>
                      <strong className="text-pink-400 text-3xl font-black">【 {prof.skillKey} 】</strong>
                      <span className="text-xs text-slate-500 block mt-1 leading-normal font-sans font-bold">
                        {!isActive ? '按下啟動參戰' : (isReady ? '再按一次解除備戰' : '再按一次鎖定進入備戰')}
                      </span>
                    </p>
                    <p className="text-lg text-center">
                      <span className="text-slate-400 text-base block mb-0.5">中途投幣鍵 (增加能量上限與現值)：</span>
                      <strong className="text-emerald-400 text-3xl font-black">【 {i + 1} 】</strong>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Enter game button status panel (fixed height to prevent layout shift) */}
          <div className="h-16 mt-2 mb-1 flex items-center justify-center">
            {joined.some(j => j) && (
              <div className="bg-slate-950/90 rounded-2xl p-3 border-2 border-yellow-500/80 shadow-[0_0_30px_rgba(234,179,8,0.15)] inline-block px-8 animate-pulse">
                <span className="text-white text-xl font-extrabold tracking-widest flex items-center justify-center">
                  —— 請所有已啟動的玩家按下 <span className="text-pink-400 font-black">技能鍵</span> ，全部備戰後將自動進入下一流程 ——
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
