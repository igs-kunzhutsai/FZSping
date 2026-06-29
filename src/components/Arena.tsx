import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/GameEngine';
import { CANVAS_W, CANVAS_H } from '../game/constants';
import { PlayerStats } from '../game/types';
import FinalStrikeVelocityBgm from '../BGM/Final_Strike_Velocity.mp3';
import FinalLevelSprintBgm from '../BGM/Final_Level_Sprint.mp3';
import TheLastColossusBgm from '../BGM/The_Last_Colossus.mp3';

export default function Arena({ players, modelTypes = [1, 1, 1, 1], gameMode, energyPerCoin = 15, isPaused = false, onGameOver }: { players: boolean[], modelTypes?: number[], gameMode: 'campaign' | 'versus', energyPerCoin?: number, isPaused?: boolean, onGameOver: (msg: string, stats?: PlayerStats[]) => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [bgmSource, setBgmSource] = useState(FinalStrikeVelocityBgm);
    
    useEffect(() => {
        if (!canvasRef.current) return;
        
        engineRef.current = new GameEngine(
            canvasRef.current, 
            players, 
            (msg, stats) => {
                onGameOver(msg, stats);
            }, 
            modelTypes, 
            gameMode,
            (music) => {
                let targetSrc = FinalStrikeVelocityBgm;
                if (music === 'boss') targetSrc = TheLastColossusBgm;
                else if (music === 'area2') targetSrc = FinalLevelSprintBgm;
                else if (music === 'area1') targetSrc = FinalStrikeVelocityBgm;
                setBgmSource(targetSrc);
            },
            energyPerCoin
        );
        
        if (audioRef.current) {
            audioRef.current.volume = 0.5;
        }

        return () => {
             if (engineRef.current) engineRef.current.destroy();
        };
    }, []);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.load();
            if (!isPaused) {
                audioRef.current.play().catch(e => console.warn('BGM load/play prevented:', e));
            }
        }
    }, [bgmSource]);

    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.isPaused = isPaused;
        }
        if (audioRef.current) {
            if (isPaused) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(e => console.warn('Autoplay prevented:', e));
            }
        }
    }, [isPaused]);

    return (
        <div className="w-full h-full flex justify-center items-center bg-black overflow-hidden relative">
            <audio ref={audioRef} src={bgmSource} loop autoPlay />
             <canvas 
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="w-full h-full block"
             />
        </div>
    );
}
