import { PlayerStats } from '../../game/types';
import { MODEL_NAMES } from '../../constants/ui';

interface ResultsScreenProps {
  resultsStats: PlayerStats[];
  gameMode: 'campaign' | 'versus';
  canExitResults: boolean;
}

export default function ResultsScreen({ resultsStats, gameMode, canExitResults }: ResultsScreenProps) {
  const sortedStats = [...resultsStats].sort((a, b) => b.score - a.score);
  const rankLabels = ['1ST', '2ND', '3RD', '4TH'];
  const rankColors = [
    'text-yellow-400 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)] bg-yellow-950/20',
    'text-slate-300 border-slate-400 bg-slate-900/40',
    'text-amber-500 border-amber-600 bg-amber-950/10',
    'text-slate-500 border-slate-800 bg-slate-950/40'
  ];

  return (
    <div className="flex flex-col items-center justify-center w-full h-full text-white font-mono p-8 relative">
      <div className="z-10 bg-slate-950/95 border-4 border-yellow-500 p-8 py-10 rounded-3xl w-full max-w-[1450px] text-center shadow-[0_0_120px_rgba(234,179,8,0.25)] relative overflow-hidden flex flex-col justify-between" style={{ minHeight: '900px', height: 'auto' }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,24,38,0)_50%,rgba(0,0,0,1)_50%)] bg-[length:100%_4px]" />
        
        <div>
          <div className="text-center mb-6 relative">
            <h1 className="text-6xl leading-none font-black tracking-widest text-[#f59e0b] filter drop-shadow-[0_0_20px_rgba(245,158,11,0.5)] uppercase">
              戰役結算 / RESULTS
            </h1>
            <p className="text-xl text-[#f59e0b] font-bold uppercase tracking-widest mt-2 animate-pulse">
              {gameMode === 'campaign' ? '⚡ 霸主殭屍已被全數殲滅 ── 戰場掃蕩完成！ ⚡' : '⚡ 對戰結束 ── 終極霸主誕生！ ⚡'}
            </p>
          </div>

          <div className="grid grid-cols-5 gap-6 text-lg font-bold uppercase py-3 border-b-2 border-slate-800 text-slate-400 px-6 text-left mb-4 font-sans">
            <div>排名 (Rank)</div>
            <div>玩家 (Pilot)</div>
            <div>型號款式 (Model Frame)</div>
            <div className="text-right">{gameMode === 'campaign' ? '擊殺殭屍 (Kills)' : '擊倒次數 (KOs)'}</div>
            <div className="text-right">總彩票 (Total Tickets)</div>
          </div>

          <div className="space-y-3">
            {sortedStats.map((stats, idx) => {
              const rankColor = rankColors[idx] || 'text-slate-500 border-slate-800';
              const labelName = stats.label;
              const isAI = stats.isAI;
              const color = stats.color;
              const kills = stats.kills || 0;
              const score = stats.score || 0;
              const modelName = MODEL_NAMES[stats.modelType - 1] || MODEL_NAMES[0];

              return (
                <div 
                  key={stats.id}
                  className={`grid grid-cols-5 gap-6 items-center py-3 px-6 rounded-xl border-2 bg-slate-900/60 hover:bg-slate-900 transition-all font-sans ${
                    idx === 0 ? 'border-yellow-500/40 shadow-[0_0_20px_rgba(234,179,8,0.05)]' : 'border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3 font-mono">
                    <span className={`w-12 h-12 flex items-center justify-center font-black text-xl border-2 rounded-xl ${rankColor}`}>
                      {rankLabels[idx] || `${idx + 1}`}
                    </span>
                    {idx === 0 && <span className="text-yellow-400 text-2xl">👑</span>}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-3.5 rounded-full border border-white/25 animate-pulse" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />
                    <span className="text-xl font-black" style={{ color: color }}>
                      {labelName}
                    </span>
                    {isAI ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 ml-2">電腦</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/50 ml-2">玩家</span>
                    )}
                  </div>

                  <div className="text-slate-350 text-base font-bold">
                    {modelName}
                  </div>

                  <div className="text-right font-mono text-xl text-slate-100 font-extrabold flex items-center justify-end gap-2 text-red-400">
                    <span>{gameMode === 'campaign' ? '💀' : '⚔️'}</span> {kills} <span className="text-xs text-slate-500 font-sans">{gameMode === 'campaign' ? 'KILLS' : 'KOs'}</span>
                  </div>

                  <div className="text-right font-mono text-2xl font-black text-green-400 filter drop-shadow-[0_0_10px_rgba(74,222,128,0.2)]">
                    {score.toLocaleString()} <span className="text-xs text-slate-500 font-sans">PTS</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          {!canExitResults ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-[260px] h-2.5 bg-slate-900 border border-slate-850 rounded-full overflow-hidden relative">
                <div className="h-full bg-yellow-500 rounded-full animate-pulse" style={{ width: '100%', animationDuration: '1.2s' }} />
              </div>
              <span className="text-lg text-slate-400 font-mono font-bold animate-pulse mt-0.5 select-none">
                —— 戰果核算中 (COMPILING BATTLE SUMMARY...) ——
              </span>
            </div>
          ) : (
            <div className="inline-block bg-slate-900/60 px-8 py-3 rounded-xl border border-yellow-500/80 shadow-[0_0_15px_rgba(234,179,8,0.15)] animate-bounce hover:scale-[1.02] transition-all cursor-pointer">
              <span className="text-yellow-400 text-xl font-black tracking-wider font-sans uppercase">
                按任意鍵回到首頁 / PRESS ANY KEY TO RETURN
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
