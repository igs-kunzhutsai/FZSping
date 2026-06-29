import { Top, Zombie, Obstacle, Item, Particle, Entity, ConcreteBlock, Afterimage, PlayerStats, Projectile, PhantomClone } from './types';
import { createTopSprite, createZombieSprite, createBarrelSprite, createCrateSprite, createZombieBossSprite, createZombieBombSprite, createZombieBouncingSprite } from './spriteLoader';
import type { GameEngine } from './GameEngine';

import { drawArena } from './renderers/ArenaRenderer';
import { drawEntities } from './renderers/EntityRenderer';
import { drawEffects } from './renderers/EffectRenderer';
import { drawUIWorld, drawUIScreen, drawUI, drawIntroMessage, drawBossIntroMessage, drawVersusEndMessage, drawCapsuleBorder } from './renderers/UIRenderer';
import { drawCapsulePath } from './renderers/Utils';

export const PLAYER_PROFILES = [
    { color: '#3b82f6', pilot: '#93c5fd', label: 'P1', controls: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', spin: 'KeyQ', skill: 'KeyE' } },
    { color: '#ef4444', pilot: '#fca5a5', label: 'P2', controls: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', spin: 'Enter', skill: 'ControlRight' } },
    { color: '#eab308', pilot: '#fdf08a', label: 'P3', controls: { up: 'KeyK', down: 'KeyI', left: 'KeyL', right: 'KeyJ', spin: 'KeyU', skill: 'KeyO' } },
    { color: '#22c55e', pilot: '#86efac', label: 'P4', controls: { up: 'Numpad5', down: 'Numpad8', left: 'Numpad6', right: 'Numpad4', spin: 'Digit7', skill: 'Numpad9' } }
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
            this.sprites[`top_${i}`] = createTopSprite(p.color, p.pilot, mType);
        });
        this.sprites['zombie_small'] = createZombieSprite(false);
        this.sprites['zombie_big'] = createZombieSprite(true);
        this.sprites['zombie_bomb'] = createZombieBombSprite();
        this.sprites['zombie_bouncing'] = createZombieBouncingSprite();
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
        this.ctx.clearRect(0, 0, 1920, 1080);
        drawArena(this.ctx, engine);
        
        const isLaunching = engine.tops.some(t => t.launchPadState === 'prep_spinning' || t.launchPadState === 'charging' || t.launchPadState === 'flying' || t.launchPadState === 'dashing');
        
        if (engine.introStage === 'ready_spin' || engine.introStage === 'center_dash' || isLaunching) {
            // Draw capsule border FIRST so tops and UI are ON TOP of the whole track without being bordered!
            drawCapsuleBorder(this.ctx, engine);
            drawEntities(this.ctx, engine, this.sprites);
            drawEffects(this.ctx, engine, this.sprites);
            drawUIWorld(this.ctx, engine);
        } else {
            // Standard rendering: Entities inside arena, bordered by capsule mask.
            drawEntities(this.ctx, engine, this.sprites);
            drawEffects(this.ctx, engine, this.sprites);
            drawCapsuleBorder(this.ctx, engine);
            drawUIWorld(this.ctx, engine);
        }
        
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
    drawCapsuleBorder(engine: GameEngine) {
        drawCapsuleBorder(this.ctx, engine);
    }
}
