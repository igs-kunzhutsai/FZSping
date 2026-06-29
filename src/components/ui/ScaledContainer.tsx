import { useState, useEffect, ReactNode } from 'react';

export default function ScaledContainer({ children, isFlipped }: { children: ReactNode; isFlipped: boolean }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      const scaleX = window.innerWidth / 1920;
      const scaleY = window.innerHeight / 1080;
      setScale(Math.min(scaleX, scaleY));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden select-none">
      <div 
        style={{ 
          width: 1920, 
          height: 1080, 
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${scale}) ${isFlipped ? 'rotate(180deg)' : 'rotate(0deg)'}`,
          transformOrigin: 'center center',
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        className="bg-black"
      >
        {children}
      </div>
    </div>
  );
}
