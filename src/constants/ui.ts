export const MODEL_NAMES = [
  '型號 I：五爪鬥士',
  '型號 II：螺旋忍者',
  '型號 III：方陣死神',
  '型號 IV：鐵壁悍將'
];

export const MENU_PLAYER_PROFILES = [
  { label: '玩家 1 (藍)', color: '#3b82f6', pilotColor: '#93c5fd', controlsLabel: 'W A S D', joinKey: 'Q', skillKey: 'E', textColor: 'text-blue-400', borderColor: 'border-blue-900/50', activeGlow: 'shadow-[0_0_30px_rgba(59,130,246,0.4)] border-blue-500' },
  { label: '玩家 2 (紅)', color: '#ef4444', pilotColor: '#fca5a5', controlsLabel: '方向鍵 (↑↓←→)', joinKey: 'ENTER', skillKey: '右邊 Ctrl', textColor: 'text-red-400', borderColor: 'border-red-900/50', activeGlow: 'shadow-[0_0_30px_rgba(239,68,68,0.4)] border-red-500' },
  { label: '玩家 3 (黃)', color: '#eab308', pilotColor: '#fdf08a', controlsLabel: 'I J K L', joinKey: 'U', skillKey: 'O', textColor: 'text-yellow-400', borderColor: 'border-yellow-900/50', activeGlow: 'shadow-[0_0_30px_rgba(234,179,8,0.4)] border-yellow-500' },
  { label: '玩家 4 (綠)', color: '#22c55e', pilotColor: '#86efac', controlsLabel: '數字鍵 8 4 5 6', joinKey: '7', skillKey: '數字鍵 9', textColor: 'text-green-400', borderColor: 'border-green-900/50', activeGlow: 'shadow-[0_0_30px_rgba(34,197,94,0.4)] border-green-500' },
];

export const isSkillKey = (e: KeyboardEvent) => {
  const key = e.key ? e.key.toLowerCase() : '';
  return (
    e.code === 'KeyE' || key === 'e' ||
    e.code === 'ControlRight' || e.code === 'ControlLeft' || e.key === 'Control' ||
    e.code === 'KeyO' || key === 'o' ||
    e.code === 'Numpad9' || e.code === 'Digit9' || key === '9'
  );
};

export const isDirectionKey = (e: KeyboardEvent) => {
  const key = e.key ? e.key.toLowerCase() : '';
  return (
    e.code === 'ArrowUp' || e.key === 'ArrowUp' || e.code === 'KeyW' || key === 'w' || e.code === 'KeyI' || key === 'i' || e.code === 'Numpad8' || e.code === 'Digit8' || key === '8' ||
    e.code === 'ArrowDown' || e.key === 'ArrowDown' || e.code === 'KeyS' || key === 's' || e.code === 'KeyK' || key === 'k' || e.code === 'Numpad5' || e.code === 'Digit5' || key === '5' ||
    e.code === 'ArrowLeft' || e.key === 'ArrowLeft' || e.code === 'KeyA' || key === 'a' || e.code === 'KeyJ' || key === 'j' || e.code === 'Numpad4' || e.code === 'Digit4' || key === '4' ||
    e.code === 'ArrowRight' || e.key === 'ArrowRight' || e.code === 'KeyD' || key === 'd' || e.code === 'KeyL' || key === 'l' || e.code === 'Numpad6' || e.code === 'Digit6' || key === '6'
  );
};
