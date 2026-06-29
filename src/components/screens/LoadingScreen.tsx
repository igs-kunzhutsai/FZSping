import picTopuse1 from '../../PIC/PIC_TOPUSE_01.png';
import picTopuse2 from '../../PIC/PIC_TOPUSE_02.png';
import picTopuse3 from '../../PIC/PIC_TOPUSE_03.png';

interface LoadingScreenProps {
  loadingProgress: number;
  gameMode: 'campaign' | 'versus';
}

export default function LoadingScreen({ loadingProgress, gameMode }: LoadingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full text-white font-mono p-8 select-none">
      <div className="z-10 bg-slate-950/95 border-4 border-yellow-500 p-8 rounded-3xl w-full max-w-[1620px] text-center shadow-[0_0_100px_rgba(234,179,8,0.2)] flex flex-col justify-between relative overflow-hidden" style={{ minHeight: '780px', height: 'auto' }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,24,38,0)_50%,rgba(0,0,0,1)_50%)] bg-[length:100%_4px]" />
        
        {/* Header Title */}
        <div>
          <div className="text-center mb-6 mt-2 relative">
            <h1 className="text-5xl font-black tracking-widest text-yellow-400 uppercase filter drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">
              遊戲提示
            </h1>
            <p className="text-xl text-slate-400 font-bold uppercase tracking-widest mt-2 font-mono">
              {gameMode === 'campaign' ? '—— 存活3分鐘，消滅所有殭屍與魔王 ——' : '—— 90秒極速對戰，擊落所有對手！ ——'}
            </p>
          </div>

          {/* Three Horizontal Cards */}
          <div className="grid grid-cols-3 gap-6 px-4 mt-8">
            {/* Card 1: 陀螺衝撞 */}
            <div className="bg-slate-900/80 border-2 border-blue-500/50 rounded-2xl p-6 py-6 flex flex-col items-center justify-between min-h-[500px] h-auto text-center shadow-[0_0_20px_rgba(59,130,246,0.1)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
              <h3 className="text-4xl font-black text-blue-400 mb-4 select-none uppercase tracking-wider font-sans mt-2">
                陀螺衝撞
              </h3>
              <div className="w-full flex justify-center mb-4">
                <img 
                  src={picTopuse1} 
                  alt="陀螺衝撞" 
                  className="h-[216px] w-auto object-contain rounded-xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] bg-slate-950/50 p-1" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div className="space-y-4 text-slate-300 text-2xl leading-relaxed font-sans w-full text-center">
                <div>
                  推動陀螺，移動衝撞
                </div>
                <div>
                  衝撞會消耗轉速
                </div>
              </div>
            </div>

            {/* Card 2: 陀螺加速 */}
            <div className="bg-slate-900/80 border-2 border-yellow-500/50 rounded-2xl p-6 py-6 flex flex-col items-center justify-between min-h-[500px] h-auto text-center shadow-[0_0_20px_rgba(234,179,8,0.1)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-orange-500" />
              <h3 className="text-4xl font-black text-yellow-400 mb-4 select-none uppercase tracking-wider font-sans mt-2">
                陀螺加速
              </h3>
              <div className="w-full flex justify-center mb-4">
                <img 
                  src={picTopuse2} 
                  alt="陀螺加速" 
                  className="h-[216px] w-auto object-contain rounded-xl border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.15)] bg-slate-950/50 p-1" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div className="space-y-4 text-slate-300 text-2xl leading-relaxed font-sans w-full text-center">
                <div>
                  轉動陀螺，提升轉速
                </div>
                <div>
                  轉速越高，能力越強
                </div>
              </div>
            </div>

            {/* Card 3: 技能施放 */}
            <div className="bg-slate-900/80 border-2 border-pink-500/50 rounded-2xl p-6 py-6 flex flex-col items-center justify-between min-h-[500px] h-auto text-center shadow-[0_0_20px_rgba(236,72,153,0.1)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-rose-500" />
              <h3 className="text-4xl font-black text-pink-400 mb-4 select-none uppercase tracking-wider font-sans mt-2">
                技能施放
              </h3>
              <div className="w-full flex justify-center mb-4">
                <img 
                  src={picTopuse3} 
                  alt="技能施放" 
                  className="h-[216px] w-auto object-contain rounded-xl border border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.15)] bg-slate-950/50 p-1" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div className="space-y-4 text-slate-300 text-2xl leading-relaxed font-sans w-full text-center">
                <div>
                  轉速全滿時，按技能鍵施放技能
                </div>
                <div>
                  施放後會消耗全部轉速
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal Progress Bar & Launch Instruction */}
        <div className="mt-8 mb-4">
          <div className="relative w-full max-w-[500px] mx-auto mb-4">
            {/* Tech Brackets */}
            <div className="absolute -left-6 -top-1 bottom-1 text-yellow-500 font-black text-2xl font-mono opacity-80 select-none flex items-center">⦓</div>
            <div className="absolute -right-6 -top-1 bottom-1 text-yellow-500 font-black text-2xl font-mono opacity-80 select-none flex items-center">⦔</div>
            
            <div className="w-full bg-slate-900/90 rounded-full border-2 border-yellow-500/40 p-1 flex items-center shadow-[0_0_20px_rgba(234,179,8,0.15)] backdrop-blur-sm">
              <div 
                className="h-3 rounded-full bg-gradient-to-r from-yellow-500 via-amber-400 to-orange-500 shadow-[0_0_25px_rgba(245,158,11,0.8)] transition-all duration-75 relative overflow-hidden"
                style={{ width: `${loadingProgress}%` }}
              >
                {/* Glowing highlight animation */}
                <div className="absolute inset-0 bg-white/20 animate-[pulse_1.5s_infinite]" />
              </div>
            </div>
          </div>

          <div className="h-10 flex items-center justify-center">
            {loadingProgress < 100 ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-t-2 border-r-2 border-yellow-500 rounded-full animate-spin" />
                <span className="text-lg text-slate-400 tracking-wider font-bold animate-pulse">
                  讀取中... {Math.round(loadingProgress)}%
                </span>
              </div>
            ) : (
              <div className="inline-block bg-slate-900/80 px-6 py-1.5 rounded-xl border border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.15)] animate-bounce font-sans font-bold">
                <span className="text-yellow-400 text-lg font-black tracking-wide uppercase">
                  按 <span className="text-pink-400 px-1">技能鍵</span> 開戰！
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
