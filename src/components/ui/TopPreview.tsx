import { useEffect, useRef } from 'react';
import { createTopSprite } from '../../game/sprites';

export default function TopPreview({ color, pilotColor, isPowerOn, modelType = 1 }: { color: string; pilotColor: string; isPowerOn: boolean; modelType?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const sprite = createTopSprite(color, pilotColor, modelType);

    let angle = 0;
    let animationId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(0.8, 0.8);
      
      // Draw proportional circular top drop shadow (unrotated)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(3, 5, 52, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(angle);

      // Draw sprite
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      ctx.restore();

      angle += isPowerOn ? 0.18 : 0.02;
      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [color, pilotColor, isPowerOn, modelType]);

  return (
    <div className="flex justify-center items-center my-2">
      <div className={`relative p-2 rounded-full border-4 transition-all duration-300 ${
        isPowerOn ? 'border-yellow-400 bg-slate-900 shadow-[0_0_20px_rgba(234,179,8,0.6)]' : 'border-slate-800 bg-slate-950/40 opacity-40'
      }`}>
        <canvas 
          ref={canvasRef} 
          width={96} 
          height={96} 
          className="w-24 h-24 block pointer-events-none"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  );
}
