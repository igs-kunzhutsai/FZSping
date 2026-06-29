const fs = require('fs');

const content = fs.readFileSync('src/game/GameRenderer.ts', 'utf8');

const arenaStart = content.indexOf('        // Deep space black backdrop');
const entityStart = content.indexOf('        // Draw Concrete Blocks');
const effectsStart = content.indexOf('        // Draw Particles');
const topsStart = content.indexOf('        // Draw Tops');
const uiWorldStart = content.indexOf('        // Draw Coop/Deadlock Battle Standoff UI in world space');
const uiScreenStart = content.indexOf('        this.ctx.restore();\n\n        // Draw Overlay UI (Corners for players)');
const drawUIStart = content.indexOf('    drawUI(engine: GameEngine) {');
const drawCapsulePathStart = content.indexOf('    drawCapsulePath(ctx: CanvasRenderingContext2D, radius: number = 480) {');

const drawCapsulePathBlock = content.substring(drawCapsulePathStart, content.indexOf('    }', drawCapsulePathStart) + 5).replace(/^    /gm, '');
const drawCapsuleFunc = `export ${drawCapsulePathBlock}`;

fs.mkdirSync('src/game/renderers', { recursive: true });
fs.writeFileSync('src/game/renderers/Utils.ts', drawCapsuleFunc);

function transformBlock(code) {
    return code.replace(/this\.ctx/g, 'ctx').replace(/this\.sprites/g, 'sprites').replace(/this\.drawCapsulePath/g, 'drawCapsulePath');
}

// Blocks content
const arenaCode = transformBlock(content.substring(arenaStart, entityStart));
const entityCode1 = transformBlock(content.substring(entityStart, effectsStart));
const effectsCode = transformBlock(content.substring(effectsStart, topsStart));
const topsCode = transformBlock(content.substring(topsStart, uiWorldStart));
const uiWorldCode = transformBlock(content.substring(uiWorldStart, uiScreenStart));

// Everything after uiScreenStart inside _draw up to drawUI
const endOfDraw = content.indexOf('    }', drawUIStart - 10);
const uiScreenCode = transformBlock(content.substring(uiScreenStart, endOfDraw));

const drawUIEnd = content.indexOf('    drawCapsulePath');
const drawUIMethods = transformBlock(content.substring(drawUIStart, drawUIEnd).replace(/^    /gm, 'export function ')); // This might need manual tweaking.

// ArenaRenderer
const arenaRendererContent = `import type { GameEngine } from '../GameEngine';
import { drawCapsulePath } from './Utils';
import { CANVAS_W, CANVAS_H } from '../constants';
import groundImageSrc from '../../PIC/Gemini_Generated_Image_x6yu9x6yu9x6yu9x.png';
import stage2GroundImageSrc from '../../PIC/Gemini_Generated_Image_hkbptohkbptohkbp.png';

const groundImage = new Image();
groundImage.src = groundImageSrc;
const stage2GroundImage = new Image();
stage2GroundImage.src = stage2GroundImageSrc;

export function drawArena(ctx: CanvasRenderingContext2D, engine: GameEngine) {
${arenaCode}
}
`;
fs.writeFileSync('src/game/renderers/ArenaRenderer.ts', arenaRendererContent);

// EntityRenderer
// It needs the images for item drops? Let's check imports in GameRenderer.
const entityRendererContent = `import type { GameEngine } from '../GameEngine';
import { drawCapsulePath } from './Utils';

export function drawEntities(ctx: CanvasRenderingContext2D, engine: GameEngine, sprites: Record<string, HTMLCanvasElement>) {
${entityCode1}
${topsCode}
}
`;
fs.writeFileSync('src/game/renderers/EntityRenderer.ts', entityRendererContent);

// EffectRenderer
const effectRendererContent = `import type { GameEngine } from '../GameEngine';
import { drawCapsulePath } from './Utils';

export function drawEffects(ctx: CanvasRenderingContext2D, engine: GameEngine) {
${effectsCode}
}
`;
fs.writeFileSync('src/game/renderers/EffectRenderer.ts', effectRendererContent);

// UIRenderer
const uiRendererContent = `import type { GameEngine } from '../GameEngine';
import { drawCapsulePath } from './Utils';
import { CANVAS_W, CANVAS_H } from '../constants';
import picTopuse2Src from '../../PIC/PIC_TOPUSE_02.png';
import picTopuse3Src from '../../PIC/PIC_TOPUSE_03.png';

const picTopuse2Image = new Image();
picTopuse2Image.src = picTopuse2Src;
const picTopuse3Image = new Image();
picTopuse3Image.src = picTopuse3Src;

export function drawUIWorld(ctx: CanvasRenderingContext2D, engine: GameEngine) {
${uiWorldCode}
}

export function drawUIScreen(ctx: CanvasRenderingContext2D, engine: GameEngine) {
${uiScreenCode}
}

${drawUIMethods.replace(/export function drawUI(?:.*?){/, 'export function drawUI(ctx: CanvasRenderingContext2D, engine: GameEngine) {').replace(/export function drawIntroMessage(?:.*?){/, 'export function drawIntroMessage(ctx: CanvasRenderingContext2D, engine: GameEngine) {').replace(/export function drawBossIntroMessage(?:.*?){/, 'export function drawBossIntroMessage(ctx: CanvasRenderingContext2D, engine: GameEngine) {').replace(/export function drawVersusEndMessage(?:.*?){/, 'export function drawVersusEndMessage(ctx: CanvasRenderingContext2D, engine: GameEngine) {').replace(/export function drawCapsuleBorder(?:.*?){/, 'export function drawCapsuleBorder(ctx: CanvasRenderingContext2D, engine: GameEngine) {')}
`;
fs.writeFileSync('src/game/renderers/UIRenderer.ts', uiRendererContent);

// Modify GameRenderer to import them
const beforeDraw = content.substring(0, arenaStart);
let newGameRenderer = `import { Top, Zombie, Obstacle, Item, Particle, Entity, ConcreteBlock, Afterimage, PlayerStats, Projectile, PhantomClone } from './types';
import { createTopSprite, createZombieSprite, createBarrelSprite, createCrateSprite, createZombieBossSprite } from './sprites';
import type { GameEngine } from './GameEngine';

import { drawArena } from './renderers/ArenaRenderer';
import { drawEntities } from './renderers/EntityRenderer';
import { drawEffects } from './renderers/EffectRenderer';
import { drawUIWorld, drawUIScreen, drawUI, drawIntroMessage, drawBossIntroMessage, drawVersusEndMessage, drawCapsuleBorder } from './renderers/UIRenderer';
import { drawCapsulePath } from './renderers/Utils';

const PLAYER_PROFILES = [
    { color: '#3b82f6', pilot: '#93c5fd', label: 'P1', controls: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', spin: 'KeyQ', skill: 'KeyE' } },
    { color: '#ef4444', pilot: '#fca5a5', label: 'P2', controls: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', spin: 'Enter', skill: 'ControlRight' } },
    { color: '#eab308', pilot: '#fdf08a', label: 'P3', controls: { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', spin: 'KeyU', skill: 'KeyO' } },
    { color: '#22c55e', pilot: '#86efac', label: 'P4', controls: { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', spin: 'Digit7', skill: 'Numpad9' } }
];

export class GameRenderer {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    sprites: Record<string, HTMLCanvasElement> = {};
    pausedDrawTime = 0;
    private _isPaused = false;

    constructor(canvas: HTMLCanvasElement, modelTypes: number[]) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false })!;
        this.ctx.imageSmoothingEnabled = false;

        PLAYER_PROFILES.forEach((p, i) => {
            const mType = modelTypes[i] || 1;
            this.sprites[\`top_\${i}\`] = createTopSprite(p.color, p.pilot, mType);
        });
        this.sprites['zombie_small'] = createZombieSprite(false);
        this.sprites['zombie_big'] = createZombieSprite(true);
        this.sprites['zombie_boss'] = createZombieBossSprite();
        this.sprites['barrel'] = createBarrelSprite();
        this.sprites['crate'] = createCrateSprite();
    }

    render(engine: GameEngine) {
        this._isPaused = engine.isPaused;
        const originalDateNow = Date.now;
        const originalMathRandom = Math.random;

        if (this._isPaused) {
            if (!this.pausedDrawTime) {
                this.pausedDrawTime = originalDateNow();
            }
            Date.now = () => this.pausedDrawTime;

            let seed = 12345;
            Math.random = () => {
                const x = Math.sin(seed++) * 10000;
                return x - Math.floor(x);
            };
        } else {
            this.pausedDrawTime = 0;
        }

        try {
            this._draw(engine);
        } finally {
            Date.now = originalDateNow;
            Math.random = originalMathRandom;
        }
    }

    _draw(engine: GameEngine) {
        drawArena(this.ctx, engine);
        drawEntities(this.ctx, engine, this.sprites);
        drawEffects(this.ctx, engine);
        drawUIWorld(this.ctx, engine);
        drawUIScreen(this.ctx, engine);
    }
    
    drawUI(engine: GameEngine) {
        drawUI(this.ctx, engine);
    }
    drawIntroMessage(engine: GameEngine) {
        drawIntroMessage(this.ctx, engine);
    }
    drawBossIntroMessage(engine: GameEngine) {
        drawBossIntroMessage(this.ctx, engine);
    }
    drawVersusEndMessage(engine: GameEngine) {
        drawVersusEndMessage(this.ctx, engine);
    }
    drawCapsulePath(ctx: CanvasRenderingContext2D, radius: number = 480) {
        drawCapsulePath(ctx, radius);
    }
    drawCapsuleBorder(engine: GameEngine) {
        drawCapsuleBorder(this.ctx, engine);
    }
}
`;

fs.writeFileSync('src/game/GameRenderer.ts', newGameRenderer);
console.log('Renderer splitting done.');
