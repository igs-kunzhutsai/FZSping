import * as InputSystem from './InputSystem';
import * as EffectSystem from './EffectSystem';
import * as EventSystem from './EventSystem';
import * as CollisionSystem from './CollisionSystem';
import * as GameUtils from './GameUtils';
import type { GameEngine } from '../GameEngine';
import { Zombie, Item, Obstacle } from '../types';
import { CANVAS_W, CANVAS_H, MAX_SPIN } from '../constants';
import { ProbabilityManager, TARGET_TYPE, BUF_TYPE } from './ProbabilityManager';

function getInitialZombieHp(spawnType: string, isBig: boolean): number {
    const pm = ProbabilityManager.getInstance();
    if (spawnType === 'zombie_boss') {
        return 2 * pm.getRequiredHits(0, TARGET_TYPE.Mummy, BUF_TYPE.BUF_JP_BOSS);
    } else if (spawnType === 'zombie_big') {
        return 2 * pm.getRequiredHits(0, TARGET_TYPE.GraveRobber, BUF_TYPE.BUF_MAIN);
    } else if (spawnType === 'zombie_bomb') {
        return 2 * pm.getRequiredHits(0, TARGET_TYPE.BombMan, BUF_TYPE.BUF_MAIN);
    } else if (spawnType === 'zombie_bouncing') {
        return 2 * pm.getRequiredHits(0, TARGET_TYPE.FootballPlayer, BUF_TYPE.BUF_MAIN);
    } else {
        let targetType = TARGET_TYPE.CartonBoy;
        if (spawnType === 'zombie_dog') targetType = TARGET_TYPE.ZombieDog;
        else if (spawnType === 'zombie_girl') targetType = TARGET_TYPE.ZombieGirl;
        else if (spawnType === 'zombie_man') targetType = TARGET_TYPE.ZombieMan;
        return 2 * pm.getRequiredHits(0, targetType, BUF_TYPE.BUF_MAIN);
    }
}

export function spawnBoss(engine: GameEngine) {
    if (engine.bossSpawned) {
        return;
    }
    engine.bossSpawned = true;

    if (engine.onMusicChange) {
        engine.onMusicChange('boss');
    }

    const sx = CANVAS_W / 2;
    const sy = engine.activeArenaCenterY ?? (CANVAS_H / 2); // spawn right in the center of the active field

    let realMarkForDeletion = false;
    let realHp = getInitialZombieHp('zombie_boss', false);

    const bossObj: Zombie = {
        id: 'boss_' + Math.random(),
        type: 'zombie_boss',
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        radius: 128, // 2x big zombie size (64)
        mass: 150,   // very heavy, unpushable
        angle: 0,
        hitCooldown: 0,
        bossAttackState: 'idle',
        bossAttackTimer: 0,
        bossNextAttackTime: 2.5, // wait 2.5s before first dash warning
        bossAttackIndex: 0,
        maxHp: getInitialZombieHp('zombie_boss', false),
        hp: getInitialZombieHp('zombie_boss', false),
        markForDeletion: false,
        introZ: 1500 // starts high up in the sky
    } as any;

    Object.defineProperty(bossObj, 'hp', {
        get() { return realHp; },
        set(val) {
            if ((bossObj as any).isDying) {
                realHp = 0;
                return;
            }
            realHp = val;
            if (realHp <= 0) {
                realHp = 0;
                if (!(bossObj as any).isDying) {
                    (bossObj as any).isDying = true;
                    (bossObj as any).bossDyingTimer = 3.0;
                    (bossObj as any).bossDyingExplosionTimer = 0.0;
                    bossObj.vx = 0;
                    bossObj.vy = 0;
                    bossObj.bossAttackState = 'idle';

                    // When boss dies, all other zombies immediately die and disappear
                    if (engine.zombies) {
                        engine.zombies.forEach(z => {
                            if (z.id !== bossObj.id && !z.markForDeletion) {
                                z.hp = 0;
                                z.markForDeletion = true;

                                // Trigger death particle effects and shockwaves for immediate visual feedback
                                const isBig = z.type === 'zombie_big';
                                const mainColor = isBig ? '#9333ea' : '#22c55e';
                                const secondColor = isBig ? '#6b21a8' : '#15803d';

                                if (isBig) {
                                    EffectSystem.addParticles(engine, z.x, z.y, mainColor, 35, 300, 10);
                                    EffectSystem.addParticles(engine, z.x, z.y, secondColor, 15, 200, 6);
                                } else {
                                    for (let i = 0; i < 35; i++) {
                                        const ang = Math.random() * Math.PI * 2;
                                        const spd = Math.random() * 150;
                                        engine.particles.push({
                                            x: z.x, y: z.y,
                                            vx: Math.cos(ang) * spd,
                                            vy: Math.sin(ang) * spd,
                                            life: 1.0, maxLife: 0.5 + Math.random(),
                                            color: mainColor,
                                            size: Math.random() * 5 + 2
                                        });
                                    }
                                    for (let i = 0; i < 15; i++) {
                                        const ang = Math.random() * Math.PI * 2;
                                        const spd = Math.random() * 100;
                                        engine.particles.push({
                                            x: z.x, y: z.y,
                                            vx: Math.cos(ang) * spd,
                                            vy: Math.sin(ang) * spd,
                                            life: 1.0, maxLife: 0.5 + Math.random(),
                                            color: secondColor,
                                            size: Math.random() * 3 + 2
                                        });
                                    }
                                }

                                engine.shockwaves.push({
                                    x: z.x,
                                    y: z.y,
                                    radius: 0,
                                    maxRadius: isBig ? 250 : 150,
                                    speed: isBig ? 600 : 500,
                                    color: mainColor,
                                    thickness: isBig ? 12 : 8,
                                    life: 0.4,
                                    maxLife: 0.4
                                });
                            }
                        });
                    }
                }
            }
        },
        configurable: true,
        enumerable: true
    });

    Object.defineProperty(bossObj, 'markForDeletion', {
        get() { return realMarkForDeletion; },
        set(val) {
            if (val === true && !(bossObj as any).isDyingComplete) {
                return;
            }
            realMarkForDeletion = val;
        },
        configurable: true,
        enumerable: true
    });

    engine.zombies.push(bossObj);
    engine.introActive = true;
    engine.introStage = 'boss_falling';
    engine.introTimer = 2.0;
}

export function spawnZombie(engine: GameEngine) {
    const humanPlayers = engine.participants ? engine.participants.filter(p => !p.isAI).length : 0;
    const playerCount = humanPlayers > 0 ? humanPlayers : 1;
    const scaleMultiplier = Math.min(1.8, 1.0 + (playerCount - 1) * 0.267);

    const currentSmalls = engine.zombies.filter(z => z.type === 'zombie_small' && !z.markForDeletion).length;
    const currentBigs = engine.zombies.filter(z => (z.type === 'zombie_big' || z.type === 'zombie_bomb' || z.type === 'zombie_bouncing') && !z.markForDeletion).length;
    const totalAlive = currentSmalls + currentBigs;
    
    const baseMaxZombies = 26;
    const baseMaxBigs = 6;
    const baseMaxSmalls = 20;

    const maxZombies = Math.round(baseMaxZombies * scaleMultiplier);
    const maxBigs = Math.round(baseMaxBigs * scaleMultiplier);
    const maxSmalls = Math.round(baseMaxSmalls * scaleMultiplier);

    if (totalAlive >= maxZombies) {
        engine.spawnPausedDueToCap = true;
    }

    if (engine.spawnPausedDueToCap) {
        if (totalAlive <= maxZombies / 2) {
            engine.spawnPausedDueToCap = false;
        } else {
            return;
        }
    }

    let isBig = Math.random() < 0.2; // 20% big
    if (isBig && currentBigs >= maxBigs) {
        isBig = false;
    }
    if (!isBig && currentSmalls >= maxSmalls) {
        isBig = true;
    }

    if (isBig && currentBigs >= maxBigs) return;
    if (!isBig && currentSmalls >= maxSmalls) return;

    // Halve the bomb zombie chance from 0.5 to 0.25, and limit maximum active zombie_bomb to 1
    let spawnType: 'zombie_small' | 'zombie_big' | 'zombie_boss' | 'zombie_bomb' | 'zombie_bouncing' = 'zombie_small';
    if (isBig) {
        const currentBombs = engine.zombies.filter(z => z.type === 'zombie_bomb' && !z.markForDeletion).length;
        const currentBouncers = engine.zombies.filter(z => z.type === 'zombie_bouncing' && !z.markForDeletion).length;
        const rand = Math.random();
        
        if (currentBombs < 1 && rand < 0.25) {
            spawnType = 'zombie_bomb';
        } else if (currentBouncers < 1 && rand < 0.5) {
            spawnType = 'zombie_bouncing';
        } else {
            spawnType = 'zombie_big';
        }
    } else {
        spawnType = 'zombie_small';
    }
    let r = 24;
    if (spawnType === 'zombie_big') {
        r = 48;
    } else if (spawnType === 'zombie_bomb') {
        r = 72;
    } else if (spawnType === 'zombie_bouncing') {
        r = 96;
    }
    
    const R = 480;
    const leftCenterX = 540;
    const rightCenterX = 1380;
    const centerY = engine.activeArenaCenterY ?? 540;
    
    // Pick random angle for spawning off-screen
    const spawnAng = Math.random() * Math.PI * 2;
    const dxP = 960 / Math.max(0.001, Math.abs(Math.cos(spawnAng)));
    const dyP = 540 / Math.max(0.001, Math.abs(Math.sin(spawnAng)));
    const dEdge = Math.min(dxP, dyP) + r + 50; // extra padding to hide completely off screen
    
    let sx = 960 + Math.cos(spawnAng) * dEdge;
    let sy = centerY + Math.sin(spawnAng) * dEdge;
    
    // Find closest point on capsule spine
    let px = Math.max(leftCenterX, Math.min(sx, rightCenterX));
    let py = centerY;
    
    let nx = sx - px;
    let ny = sy - py;
    let len = Math.hypot(nx, ny);
    if (len === 0) { nx = 0; ny = -1; len = 1; }
    nx /= len; ny /= len;
    
    // The monster walks towards the boundary
    const walkTargetX = px + nx * (R + r + 20); // stops 20px away from the boundary
    const walkTargetY = py + ny * (R + r + 20);
    
    // The monster jumps over the boundary, landing inside
    const jumpTargetX = px + nx * (R - r - 60); // lands 60px inside the boundary
    const jumpTargetY = py + ny * (R - r - 60);
    
    engine.zombies.push({
        id: 'z_'+Math.random(),
        type: spawnType,
        x: sx, y: sy,
        vx: 0, vy: 0,
        radius: r,
        mass: isBig ? 30 : 8,
        markForDeletion: false,
        hp: getInitialZombieHp(spawnType, isBig),
        maxHp: getInitialZombieHp(spawnType, isBig),
        angle: 0,
        speedMultiplier: 0.5 + Math.random() * 1.0,
        hitCooldown: 0,
        introState: 'walking_in',
        introWalkTargetX: walkTargetX,
        introWalkTargetY: walkTargetY,
        introJumpTargetX: jumpTargetX,
        introJumpTargetY: jumpTargetY,
        introTimer: 0,
        introZ: 0
    });
}

export function spawnItemOrObstacle(engine: GameEngine, forcedType?: 'item_crate' | 'obstacle_barrel') {
    const hasSuperPlayer = engine.tops.some(t => t.superTimer !== undefined && t.superTimer > 0);
    const currentCrates = engine.obstacles.filter(o => (o.type as string) === 'item_crate' && !o.markForDeletion).length;
    const currentBarrels = engine.obstacles.filter(o => (o.type as string) === 'obstacle_barrel' && !o.markForDeletion).length;

    // Map forced item_crate to obstacle_barrel dynamically to prevent type narrowing while honoring the disable request
    const targetForcedType = forcedType === 'item_crate' ? ('obstacle_barrel' as 'item_crate' | 'obstacle_barrel') : forcedType;

    let type: 'item_crate' | 'obstacle_barrel';
    if (targetForcedType) {
        type = targetForcedType;
    } else {
        type = 'obstacle_barrel';
    }

    if (type === 'obstacle_barrel' && currentBarrels >= 1) {
        return;
    }

    if (type === 'item_crate') {
        return; // Safety guard: do not spawn any item_crate
    }
    
    let rx = CANVAS_W / 2;
    let ry = (engine.activeArenaCenterY ?? 540);
    let found = false;
    const centerY = engine.activeArenaCenterY ?? 540;
    
    for (let attempts = 0; attempts < 150; attempts++) {
        const bx = 200 + Math.random() * (CANVAS_W - 400);
        const by = (centerY - 540) + 200 + Math.random() * (CANVAS_H - 400);
        if (GameUtils.isPointInsideCapsule(engine, bx, by, 50)) {
            // Multi-stage buffer tightness relaxation as attempts count increases
            let bufferMultiplier = 1.0;
            if (attempts > 50) bufferMultiplier = 0.6;
            if (attempts > 100) bufferMultiplier = 0.3;
            
            let isTooClose = false;
            
            // 1. Check distance to other active obstacles (items, barrels, gears)
            const minObstacleDistance = 140 * bufferMultiplier; // 30 (spawned radius) + 30 (other radius) + 80 buffer
            for (const o of engine.obstacles) {
                if (o.markForDeletion) continue;
                const d = Math.hypot(bx - o.x, by - o.y);
                if (d < minObstacleDistance) {
                    isTooClose = true;
                    break;
                }
            }
            
            if (isTooClose) continue;
            
            // 2. Check distance to concrete blocks
            for (const block of engine.concreteBlocks) {
                if (block.markForDeletion) continue;
                const dx = Math.abs(bx - block.x);
                const dy = Math.abs(by - block.y);
                const minDistX = (block.w / 2 + 100) * bufferMultiplier; // block.w/2 + 30 + 70 buffer
                const minDistY = (block.h / 2 + 100) * bufferMultiplier; // block.h/2 + 30 + 70 buffer
                if (dx < minDistX && dy < minDistY) {
                    isTooClose = true;
                    break;
                }
            }
            
            if (isTooClose) continue;
            
            // 3. Keep away from alive player/AI tops if buffer is still reasonable
            if (attempts < 100) {
                for (const top of engine.tops) {
                    if (top.markForDeletion) continue;
                    const d = Math.hypot(bx - top.x, by - top.y);
                    if (d < 120 * bufferMultiplier) {
                        isTooClose = true;
                        break;
                    }
                }
                if (isTooClose) continue;
            }

            // 4. Keep away from launch pads (corners and center!)
            const padsToCheck = [
                { x: 360, y: 840 },
                { x: 1560, y: 240 },
                { x: 960, y: 540 }
            ];
            let tooCloseToPad = false;
            for (const pad of padsToCheck) {
                if (Math.hypot(bx - pad.x, by - pad.y) < 130 * bufferMultiplier) {
                    tooCloseToPad = true;
                    break;
                }
            }
            if (tooCloseToPad) {
                isTooClose = true;
            }
            if (isTooClose) continue;
            
            rx = bx;
            ry = by;
            found = true;
            break;
        }
    }
    
    engine.obstacles.push({ // pushing to obstacles is fine for all these static drops
        id: 'drop_'+Math.random(),
        type: type as any,
        x: rx,
        y: ry,
        vx: 0, vy: 0,
        radius: 30, // visual size
        mass: 999999, // static
        markForDeletion: false,
        durability: type === 'obstacle_barrel' ? 1 : 5
    } as Obstacle);

    if (type === 'obstacle_barrel') {
        engine.shockwaves.push({
            x: rx,
            y: ry,
            radius: 5,
            maxRadius: 100,
            speed: 300,
            color: '#ef4444',
            thickness: 6,
            life: 0.5,
            maxLife: 0.5,
            isDashedRed: true
        });
    }
}

