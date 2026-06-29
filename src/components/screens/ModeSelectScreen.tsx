import { useEffect } from 'react';
import { isSkillKey } from '../../constants/ui';
import bgImage from '../../PIC/Gemini_Generated_Image_zgmjdfzgmjdfzgmj.png';
import { SoundSystem } from '../../game/systems/SoundSystem';

interface ModeSelectScreenProps {
  onSelectMode: (mode: 'campaign' | 'versus') => void;
  energyPerCoin: number;
  onEnergyChange: (val: number) => void;
}

export default function ModeSelectScreen({ onSelectMode, energyPerCoin, onEnergyChange }: ModeSelectScreenProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const energies = [10, 15, 20, 25, 30];
      const currentIndex = energies.indexOf(energyPerCoin);

      if (e.key === 'ArrowLeft' || e.key === 'a') {
        if (currentIndex > 0) {
          SoundSystem.play('pickupCoin_1');
          onEnergyChange(energies[currentIndex - 1]);
        }
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        if (currentIndex < energies.length - 1) {
          SoundSystem.play('pickupCoin_1');
          onEnergyChange(energies[currentIndex + 1]);
        }
      } else if (isSkillKey(e)) {
        e.preventDefault();
        SoundSystem.play('pickupCoin_1');
        onSelectMode('campaign');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectMode, energyPerCoin, onEnergyChange]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full text-white font-mono p-16 select-none relative bg-slate-950 overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none" 
        style={{ backgroundImage: `url(${bgImage})`, filter: 'brightness(0.8)' }} 
      />
      {/* Animated Matrix-like Background Sparkles and Contrast Overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-slate-950/75 to-black pointer-events-none" />
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center max-w-7xl w-full">
        {/* Title / Header Area */}
        <div className="text-center mb-10 animate-fade-in pointer-events-none">
          <h1 className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-amber-400 to-red-500 tracking-widest mb-6 drop-shadow-[0_10px_25px_rgba(245,158,11,0.25)]">
            迴 旋 突 擊
          </h1>
          <p className="text-slate-400 text-2xl uppercase tracking-[0.4em] font-extrabold flex items-center justify-center gap-6">
            <span className="w-16 h-[3px] bg-cyan-500/50" />
            彩票機 V0.6
            <span className="w-16 h-[3px] bg-red-500/50" />
          </p>
        </div>

        {/* Energy Settings */}
        <div className="flex flex-col items-center gap-4 mb-10 pointer-events-auto">
          <h2 className="text-2xl font-bold tracking-widest text-slate-300 shadow-black drop-shadow-md">每1幣獲得能量數</h2>
          <div className="flex gap-4">
            {[10, 15, 20, 25, 30].map(val => (
              <button
                key={val}
                onClick={() => {
                  SoundSystem.play('pickupCoin_1');
                  onEnergyChange(val);
                }}
                className={`px-6 py-3 rounded-xl font-bold text-2xl border-2 transition-all ${energyPerCoin === val ? 'bg-cyan-500 text-slate-950 border-cyan-400 scale-110 shadow-[0_0_20px_rgba(34,211,238,0.6)]' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white hover:bg-slate-700'}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Mode Select Area (Centered Single Option) */}
        <div className="flex justify-center w-full max-w-2xl px-8 mb-8 pointer-events-none">
          {/* Campaign Mode Option */}
          <div 
            id="btn_mode_campaign"
            className="transition-all duration-300 relative rounded-[2.5rem] p-12 py-16 border-4 h-[480px] w-full max-w-md bg-slate-950/90 backdrop-blur-md overflow-hidden flex flex-col items-center justify-center text-center scale-105 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.35)]"
          >
            {/* Mode Accent Corner Glow */}
            <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full blur-3xl transition-opacity duration-300 bg-amber-500/30 opacity-100" />

            {/* Mode Icon */}
            <div className="w-28 h-28 rounded-full flex items-center justify-center mb-8 bg-slate-900 border border-slate-800 shadow-inner relative">
              <div className="absolute inset-0 rounded-full animate-ping opacity-25 bg-amber-500" />
              <span className="text-6xl transition-transform duration-300 scale-110">☠️</span>
            </div>

            <h3 className="text-5xl font-black tracking-widest mb-2 text-amber-400">
              闖 關 模 式
            </h3>
            <span className="text-xl font-bold tracking-widest uppercase mb-6 text-amber-500/80">
              CAMPAIGN MODE
            </span>

            <div className="grow" />

            {/* Selector visual tick */}
            <div className="absolute bottom-8 text-base tracking-[0.2em] text-amber-500 font-black uppercase animate-pulse bg-amber-500/10 px-6 py-2 rounded-full border border-amber-500/30">
              READY TO SPIN
            </div>
          </div>
        </div>

        {/* Coin Insertion Instructions */}
        <div className="flex items-center gap-8 mb-6 bg-slate-900/60 border border-slate-800/80 px-10 py-3.5 rounded-full text-slate-300 text-base tracking-[0.12em] backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
          <span className="text-amber-400 font-extrabold tracking-widest">各P位投幣按鍵：</span>
          <span className="flex items-center gap-2">
            <span className="bg-slate-950 px-2.5 py-0.5 text-emerald-400 border border-slate-700 rounded-lg text-lg font-black font-mono">1</span>
            <span className="font-bold">1P投幣</span>
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-2">
            <span className="bg-slate-950 px-2.5 py-0.5 text-emerald-400 border border-slate-700 rounded-lg text-lg font-black font-mono">2</span>
            <span className="font-bold">2P投幣</span>
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-2">
            <span className="bg-slate-950 px-2.5 py-0.5 text-emerald-400 border border-slate-700 rounded-lg text-lg font-black font-mono">3</span>
            <span className="font-bold">3P投幣</span>
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-2">
            <span className="bg-slate-950 px-2.5 py-0.5 text-emerald-400 border border-slate-700 rounded-lg text-lg font-black font-mono">4</span>
            <span className="font-bold">4P投幣</span>
          </span>
        </div>

        {/* Interactive Control Hint Bar */}
        <div className="flex items-center gap-10 bg-slate-900/80 border-2 border-slate-800 px-12 py-5 rounded-full text-slate-300 text-lg tracking-[0.15em] animate-pulse backdrop-blur-md shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
          <span className="flex items-center gap-3">
            <span className="bg-slate-950 px-3 py-1 text-cyan-400 border border-slate-700 rounded-lg text-xl font-black">← / →</span>
            <span>選擇能量</span>
          </span>
          <span className="flex items-center gap-3">
            <span className="bg-slate-950 px-3 py-1 text-pink-400 border border-slate-700 rounded-lg text-xl font-black">任一技能鍵(Ctrl)</span>
            <span>確認進入</span>
          </span>
        </div>
      </div>
    </div>
  );
}
