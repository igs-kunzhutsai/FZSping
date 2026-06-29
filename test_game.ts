class MockCanvasContext {
    translate() {}
    scale() {}
    rotate() {}
    save() {}
    restore() {}
    beginPath() {}
    moveTo() {}
    lineTo() {}
    stroke() {}
    fill() {}
    arc() {}
    fillRect() {}
    strokeRect() {}
    clearRect() {}
    fillText() {}
    strokeText() {}
    measureText() { return { width: 0 }; }
    setTransform() {}
    createRadialGradient() { return { addColorStop: () => {} }; }
    createLinearGradient() { return { addColorStop: () => {} }; }
}

const mockCanvas = {
    width: 1920,
    height: 1080,
    getContext: () => new MockCanvasContext(),
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1920, height: 1080 })
};

(global as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    performance: { now: () => Date.now() },
    requestAnimationFrame: (cb: any) => { setTimeout(() => cb(Date.now()), 16); return 1; }
};
(global as any).document = mockCanvas;
(global as any).Image = class {};
(global as any).Math.random = () => 0.5; // predictable

import { GameEngine } from './src/game/GameEngine';

const engine = new GameEngine(
    mockCanvas as any,
    [true, false, false, false],
    () => {},
    [1, 1, 1, 1],
    'campaign'
);

console.log("Engine instantiated. Running update...");

try {
    engine.update(0.016);
    console.log("Update successful!");
} catch (e: any) {
    console.error("Crash!", e.stack);
}
