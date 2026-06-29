import { RefreshCcw } from 'lucide-react';

interface GameOverScreenProps {
  winnerMsg: string;
}

export default function GameOverScreen({ winnerMsg }: GameOverScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full text-white font-mono p-8 relative pointer-events-none">
       <div className="z-10 bg-slate-900 p-24 rounded-3xl border-8 border-yellow-500 text-center shadow-[0_0_150px_rgba(234,179,8,0.3)]">
          <h1 className="text-[100px] leading-tight font-black mb-16 text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 uppercase">
              {winnerMsg}
          </h1>
          
          <div className="flex items-center justify-center gap-6 mx-auto px-16 py-8 bg-white text-black font-bold text-5xl rounded-full shadow-xl">
              <RefreshCcw size={48} className="animate-spin" />
              按任意鍵回到首頁
          </div>
       </div>
    </div>
  )
}
