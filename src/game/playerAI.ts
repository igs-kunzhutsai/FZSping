import * as EffectSystem from './systems/EffectSystem';
import type { GameEngine } from './GameEngine';
import { Top, Entity } from './types';
import { MAX_SPIN } from './constants';

export function updatePlayerAI(top: Top, engine: GameEngine, dt: number, target: Entity | null | undefined): { inputX: number, inputY: number, isActivelyPushing: boolean, isSpinning: boolean } {
    let inputX = 0;
    let inputY = 0;
    let isActivelyPushing = false;
    let isSpinning = false;
    
    if (!top.isAI || top.hp <= 0 || top.isExploding) {
        return { inputX, inputY, isActivelyPushing, isSpinning };
    }

    // 1. 自動追蹤 (Auto-Tracking) & 突圍判斷
    const isClinging = (engine.zombieSiegeActive && (engine.siegeStatus === 'clinging' || engine.siegeStatus === 'resolved_success') && top.id === engine.siegeTargetPlayerId) || top.launchPadState !== undefined || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0) || engine.transitionState === 'buffer';
    
    if (!isClinging && !engine.versusEndActive && top.spin > 0) {
        if (target) {
            const dx = target.x - top.x;
            const dy = target.y - top.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 50) {
                inputX = dx / dist;
                inputY = dy / dist;
                isActivelyPushing = true;
            }
        }
    }

    // 2. 充能 (Charging)
    if (top.aiSpinTimer === undefined || top.aiSpinTimer <= 0) {
        if (Math.random() < 0.004) {
            top.aiSpinTimer = 0.2 + Math.random() * 0.4;
        }
    }
    if (top.aiSpinTimer > 0) {
        top.aiSpinTimer -= dt;
        isSpinning = true;
    }

    if (Math.random() < 1.5 * dt) {
        top.spin = Math.min(MAX_SPIN, (top.spin ?? 0) + 100);
    }
    
    // Launchpad Preparation AI Spin Simulation
    if (top.launchPadState === 'prep_spinning') {
        const time = Date.now() / 1000;
        if (!(top as any).launchPadNextAiSpinTime) {
            (top as any).launchPadNextAiSpinTime = time + 0.15 + Math.random() * 0.15;
        }
        if (time >= (top as any).launchPadNextAiSpinTime) {
            top.launchPadSpinCount = (top.launchPadSpinCount ?? 0) + 1;
            (top as any).launchPadNextAiSpinTime = time + 0.15 + Math.random() * 0.15;
            if (Math.random() < 0.25) {
                EffectSystem.addParticles(engine, top.x, top.y, '#fbbf24', 2, 100, 1.5);
            }
        }
    }

    // 3. 施放技能 (Skill Casting)
    if (top.spin >= MAX_SPIN) {
        if (top.modelType === 1 && (top.skillActiveTimer === undefined || top.skillActiveTimer <= 0) && Math.random() < 0.05 * dt) {
            top.spin = 100;
            if (top.smoothSpin !== undefined) top.smoothSpin = 100;
            top.skillActiveTimer = 4.0;
            top.state = 'dash';
            top.skillStartCenter = { x: top.x, y: top.y };
            engine.shockwaves.push({
                x: top.x, y: top.y,
                radius: 10, maxRadius: 360, speed: 1200,
                color: 'rgba(236, 72, 153, 0.95)', thickness: 12, life: 0.5, maxLife: 0.5
            });
        } else if (top.modelType === 2 && (top.model2SkillTimer === undefined || top.model2SkillTimer <= 0) && Math.random() < 0.05 * dt) {
            top.spin = 100;
            if (top.smoothSpin !== undefined) top.smoothSpin = 100;
            top.model2SkillTimer = 9.6;
            top.model2OrbAngle = Math.random() * Math.PI * 2;
            top.model2SkillHitCooldowns = new Map<string, number>();
            engine.shockwaves.push({
                x: top.x, y: top.y,
                radius: 10, maxRadius: 180, speed: 650,
                color: '#38bdf8', thickness: 12, life: 0.45, maxLife: 0.45
            });
        } else if (top.modelType === 3 && (engine.phantomClones.filter(pc => pc.ownerId === top.id).length < 2) && Math.random() < 0.05 * dt) {
            top.spin = 100;
            if (top.smoothSpin !== undefined) top.smoothSpin = 100;
            top.model3SkillTimer = 12.0;

            const matchIdx = top.id.match(/\d+/);
            const originalIdx = matchIdx ? parseInt(matchIdx[0], 10) : 0;

            const ownerClones = engine.phantomClones.filter(pc => pc.ownerId === top.id);
            if (ownerClones.length >= 2) {
                ownerClones.sort((a, b) => a.life - b.life);
                while (ownerClones.length >= 2) {
                    const oldest = ownerClones.shift();
                    if (oldest) {
                        engine.phantomClones = engine.phantomClones.filter(pc => pc.id !== oldest.id);
                    }
                }
            }

            engine.phantomClones.push({
                id: `${top.id}_phantom_${Date.now()}`,
                centerX: top.x,
                centerY: top.y,
                x: top.x,
                y: top.y,
                radius: 48,
                maxLife: 12.0,
                life: 12.0,
                color: top.color,
                ownerId: top.id,
                originalIdx: originalIdx,
                angle: top.angle,
                orbitAngle: top.standbyAngle ?? 0,
                spin: 1000,
                hitCooldowns: new Map<string, number>()
            });

            engine.shockwaves.push({
                x: top.x, y: top.y,
                radius: 10, maxRadius: 280, speed: 850,
                color: '#38bdf8', thickness: 12, life: 0.45, maxLife: 0.45
            });
            EffectSystem.addParticles(engine, top.x, top.y, '#38bdf8', 40, 260, 7);
            EffectSystem.addParticles(engine, top.x, top.y, '#0ea5e9', 30, 210, 5);
            EffectSystem.addParticles(engine, top.x, top.y, '#ffffff', 20, 180, 4);
        } else if (top.modelType === 4 && Math.random() < 0.05 * dt) {
            top.spin = 100;
            if (top.smoothSpin !== undefined) top.smoothSpin = 100;
            
            engine.shockwaves.push({
                x: top.x, y: top.y,
                radius: 10, maxRadius: 150, speed: 600,
                color: top.color, thickness: 10, life: 0.3, maxLife: 0.3
            });

            EffectSystem.addParticles(engine, top.x, top.y, top.color, 30, 200, 6);
            EffectSystem.addParticles(engine, top.x, top.y, '#ffffff', 15, 250, 4);

            const bulletSpeed = 1000;
            const numBullets = 8;
            for (let i = 0; i < numBullets; i++) {
                const angle = (i * Math.PI * 2) / numBullets;
                const vx = Math.cos(angle) * bulletSpeed;
                const vy = Math.sin(angle) * bulletSpeed;
                engine.projectiles.push({
                    id: `bullet_${top.id}_${Date.now()}_${i}_${Math.random()}`,
                    x: top.x, y: top.y,
                    vx, vy,
                    radius: 28,
                    color: top.color,
                    ownerId: top.id,
                    life: 1.5, maxLife: 1.5,
                    damage: 5,
                    trail: [{ x: top.x, y: top.y }]
                });
            }
        }
    }

    return { inputX, inputY, isActivelyPushing, isSpinning };
}
