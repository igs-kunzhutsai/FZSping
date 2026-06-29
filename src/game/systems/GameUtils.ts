import * as InputSystem from './InputSystem';
import * as EffectSystem from './EffectSystem';
import * as EventSystem from './EventSystem';
import * as CollisionSystem from './CollisionSystem';
import * as SpawnSystem from './SpawnSystem';
import { SoundSystem } from './SoundSystem';
import type { GameEngine } from '../GameEngine';
import { Top, Entity } from '../types';
import { CANVAS_W, CANVAS_H, TOP_RADIUS } from '../constants';
import { ProbabilityManager, TARGET_TYPE, GAME_MODE, BULLET_TYPE, RESULT_INFO, BUF_TYPE } from './ProbabilityManager';

export function applyDamageToZombie(engine: GameEngine, z: import('../types').Zombie, damage: number, sourceTopId: string) {
    if (z.hp <= 0) return;

    const playerTop = engine.tops.find(t => t.id === sourceTopId);
    if (playerTop) {
        if (playerTop.hp <= 0) return;

        const isSuperHit = (playerTop.superTimer !== undefined && playerTop.superTimer > 0) || (playerTop.breakoutOrbitTimer !== undefined && playerTop.breakoutOrbitTimer > 0);
        const isBreakoutWhip = (playerTop.breakoutOrbitTimer !== undefined && playerTop.breakoutOrbitTimer > 0);
        if (!isSuperHit || isBreakoutWhip) {
            playerTop.hp = Math.max(0, playerTop.hp - 1);
            playerTop.visualHp = playerTop.visualHp !== undefined ? Math.max(playerTop.hp, playerTop.visualHp) : playerTop.hp;
            playerTop.hpLossTimer = 0.5;
        }
    }

    // Initialize hit counts if not present
    if (!z.hitCounts) {
        z.hitCounts = new Map<string, number>();
    }
    
    let currentHits = z.hitCounts.get(sourceTopId) || 0;
    currentHits++;
    z.hitCounts.set(sourceTopId, currentHits);

    let instakill = false;
    const pm = ProbabilityManager.getInstance();
    const chance = pm.getChance();

    // Map zombie types to their C++ target equivalents
    let targetType = TARGET_TYPE.CartonBoy;
    if (z.type === 'zombie_boss') {
        targetType = TARGET_TYPE.Mummy;
    } else if (z.type === 'zombie_big') {
        targetType = TARGET_TYPE.GraveRobber;
    } else if (z.type === 'zombie_bomb') {
        targetType = TARGET_TYPE.BombMan;
    } else if (z.type === 'zombie_bouncing') {
        targetType = TARGET_TYPE.FootballPlayer;
    } else {
        // Map small zombie based on its ID deterministically
        let hash = 0;
        for (let i = 0; i < z.id.length; i++) {
            hash = z.id.charCodeAt(i) + ((hash << 5) - hash);
        }
        const idx = Math.abs(hash) % 4;
        if (idx === 0) targetType = TARGET_TYPE.CartonBoy;
        else if (idx === 1) targetType = TARGET_TYPE.ZombieDog;
        else if (idx === 2) targetType = TARGET_TYPE.ZombieGirl;
        else if (idx === 3) targetType = TARGET_TYPE.ZombieMan;
    }

    // Parse player index from sourceTopId (e.g. "top_0", "top_1" -> index 0, 1)
    const matchIdx = sourceTopId.match(/\d+/);
    const playerIdx = matchIdx ? parseInt(matchIdx[0], 10) : 0;

    // Record player hit and trigger water level accumulation
    pm.recordHitEnergyDeducted(playerIdx, z.type === 'zombie_boss');

    // Simulate C++ shoot and probability resolution for the specific player index
    chance.vChance_SetShoot(playerIdx, GAME_MODE.GAME_MODE_MAIN, BULLET_TYPE.BULLET_NORMAL, targetType, currentHits, false, 1);

    // Read both results explicitly to avoid JavaScript short-circuit evaluation leaving awake/break states uncleared
    const breakResult = chance.ulChance_GetResult(playerIdx, RESULT_INFO.RESULT_INFO_BREAK);
    const awakeResult = chance.ulChance_GetResult(playerIdx, RESULT_INFO.RESULT_INFO_AWAKE);
    instakill = breakResult > 0 || awakeResult > 0;

    // Safeguards (保底機制: 保底下數是平均下數的2倍)
    let maxHits = 5;
    if (z.type === 'zombie_boss') {
        maxHits = 2 * pm.getRequiredHits(playerIdx, TARGET_TYPE.Mummy, BUF_TYPE.BUF_JP_BOSS);
    } else if (z.type === 'zombie_big') {
        maxHits = 2 * pm.getRequiredHits(playerIdx, TARGET_TYPE.GraveRobber, BUF_TYPE.BUF_MAIN);
    } else if (z.type === 'zombie_bomb') {
        maxHits = 2 * pm.getRequiredHits(playerIdx, TARGET_TYPE.BombMan, BUF_TYPE.BUF_MAIN);
    } else if (z.type === 'zombie_bouncing') {
        maxHits = 2 * pm.getRequiredHits(playerIdx, TARGET_TYPE.FootballPlayer, BUF_TYPE.BUF_MAIN);
    } else {
        let targetType = TARGET_TYPE.CartonBoy;
        let hash = 0;
        for (let i = 0; i < z.id.length; i++) {
            hash = z.id.charCodeAt(i) + ((hash << 5) - hash);
        }
        const idx = Math.abs(hash) % 4;
        if (idx === 0) targetType = TARGET_TYPE.CartonBoy;
        else if (idx === 1) targetType = TARGET_TYPE.ZombieDog;
        else if (idx === 2) targetType = TARGET_TYPE.ZombieGirl;
        else if (idx === 3) targetType = TARGET_TYPE.ZombieMan;
        maxHits = 2 * pm.getRequiredHits(playerIdx, targetType, BUF_TYPE.BUF_MAIN);
    }

    if (currentHits >= maxHits) {
        instakill = true;
    }

    z.hp = Math.max(0, z.hp - 1);

    if (instakill) {
        z.hp = 0;
    }
}

export function handleZombieDeath(engine: GameEngine, z: import('../types').Zombie, killerId: string): boolean {
    if ((z.type === 'zombie_big' || z.type === 'zombie_bomb' || z.type === 'zombie_bouncing') && !(z as any).isDying) {
        (z as any).isDying = true;
        (z as any).dyingTimer = 1.25;
        (z as any).lastKillerId = killerId;
        z.hp = 0;
        return false;
    }
    return true;
}

export function isPointInsideCapsule(engine: GameEngine, x: number, y: number, r: number = 0): boolean {
    const R = 480 - r;
    const centerY = engine.activeArenaCenterY ?? 540;
    return (x < 540 ? Math.hypot(x - 540, y - centerY) <= R : 
            x > 1380 ? Math.hypot(x - 1380, y - centerY) <= R : 
            y >= centerY - R && y <= centerY + R);
}

export function isClashActive(engine: GameEngine) {
    const isBossStruggle = engine.zombies ? engine.zombies.some(z => z.type === 'zombie_boss' && (z as any).bossAttackState === 'struggle_clash') : false;
    const isTopStruggle = engine.tops ? engine.tops.some(t => t.coopState !== undefined) : false;
    return isBossStruggle || isTopStruggle;
}

export function isPlayerFreeOrStandby(engine: GameEngine, top: Top): boolean {
    if (!top || top.markForDeletion || top.hp <= 0 || top.isExploding) {
        return false;
    }
    if (top.launchPadState !== undefined) {
        return false;
    }
    if (top.coopState !== undefined) {
        return false;
    }
    if (engine.zombieSiegeActive && engine.siegeTargetPlayerId === top.id) {
        return false;
    }
    return true;
}

export function updateTutorialTimestamps(engine: GameEngine, top: Top) {
    if (top.isAI) return;

    if (!(top as any).tutorialTimes) {
        (top as any).tutorialTimes = {};
    }
    const times = (top as any).tutorialTimes;

    // 1. game_start_spin
    const isSpinTutActive = top.spinTutorialTimer !== undefined && top.spinTutorialTimer > 0;
    if (isSpinTutActive) {
        if (times.game_start_spin === undefined) {
            times.game_start_spin = Date.now();
        }
    } else {
        times.game_start_spin = undefined;
    }

    // 2. launch_pad
    const isLaunchPadActive = !top.isExploding && top.launchPadState === 'prep_spinning';
    if (isLaunchPadActive) {
        if (times.launch_pad === undefined) {
            times.launch_pad = Date.now();
        }
    } else {
        times.launch_pad = undefined;
    }

    // 3. zombie_siege
    const isZombieSiegeActive = engine.zombieSiegeActive && engine.siegeStatus === 'clinging' && engine.siegeTargetPlayerId === top.id;
    if (isZombieSiegeActive) {
        if (times.zombie_siege === undefined) {
            times.zombie_siege = Date.now();
        }
    } else {
        times.zombie_siege = undefined;
    }

    // 4. boss_struggle
    const isBossStruggleActive = engine.zombies ? engine.zombies.some(
        z => z.type === 'zombie_boss' && 
             (z as any).bossAttackState === 'struggle_clash' && 
             (z as any).bossWarningTargetId === top.id
    ) : false;
    if (isBossStruggleActive) {
        if (times.boss_struggle === undefined) {
            times.boss_struggle = Date.now();
        }
    } else {
        times.boss_struggle = undefined;
    }

    // 5. active_coop_overlay
    const isCoopOverlayActive = top.coopState !== undefined && 
        (top.coopState.phase === 'standoff' || top.coopState.phase === 'retreat_rotate');
    if (isCoopOverlayActive) {
        if (times.active_coop_overlay === undefined) {
            times.active_coop_overlay = Date.now();
        }
    } else {
        times.active_coop_overlay = undefined;
    }
}

export function getLatestActiveTutorial(engine: GameEngine, top: Top): string | null {
    if (top.isAI) return null;
    
    updateTutorialTimestamps(engine, top);
    
    const times = (top as any).tutorialTimes;
    if (!times) return null;

    let latestType: string | null = null;
    let maxTime = -1;

    const types = ['game_start_spin', 'launch_pad', 'zombie_siege', 'boss_struggle', 'active_coop_overlay'];
    for (const type of types) {
        const time = times[type];
        if (time !== undefined && time > maxTime) {
            maxTime = time;
            latestType = type;
        }
    }

    return latestType;
}

export function clampToCapsule(engine: GameEngine, x: number, y: number, r: number): { x: number, y: number } {
    const R = 480 - r;
    const doorOpen = ['waiting_to_move', 'moving_down'].includes(engine.oneMinuteTransitionState);

    if (!doorOpen) {
        const centerY = engine.activeArenaCenterY ?? 540;
        if (x < 540) {
            const d = Math.hypot(x - 540, y - centerY);
            if (d > R) {
                return { x: 540 + ((x - 540) / (d || 1)) * R, y: centerY + ((y - centerY) / (d || 1)) * R };
            }
        } else if (x > 1380) {
            const d = Math.hypot(x - 1380, y - centerY);
            if (d > R) {
                return { x: 1380 + ((x - 1380) / (d || 1)) * R, y: centerY + ((y - centerY) / (d || 1)) * R };
            }
        } else {
            const minY = centerY - R;
            const maxY = centerY + R;
            if (y < minY) return { x, y: minY };
            if (y > maxY) return { x, y: maxY };
        }
    } else {
        const topCenterY = 540;
        const botCenterY = 1620;
        if (y < 1080) {
            if (x < 540) {
                const d = Math.hypot(x - 540, y - topCenterY);
                if (d > R) return { x: 540 + ((x - 540) / (d || 1)) * R, y: topCenterY + ((y - topCenterY) / (d || 1)) * R };
            } else if (x > 1380) {
                const d = Math.hypot(x - 1380, y - topCenterY);
                if (d > R) return { x: 1380 + ((x - 1380) / (d || 1)) * R, y: topCenterY + ((y - topCenterY) / (d || 1)) * R };
            } else {
                const minY = topCenterY - R;
                const maxY = topCenterY + R; // 1020
                if (y < minY) return { x, y: minY };
                if (y > maxY) {
                    if (x < 840 + r || x > 1080 - r) return { x, y: maxY };
                    else {
                        // in corridor, x is good, y is safely in gap so far
                        let nx = Math.max(840 + r, Math.min(1080 - r, x));
                        return { x: nx, y };
                    }
                }
            }
        } else {
            if (x < 540) {
                const d = Math.hypot(x - 540, y - botCenterY);
                if (d > R) return { x: 540 + ((x - 540) / (d || 1)) * R, y: botCenterY + ((y - botCenterY) / (d || 1)) * R };
            } else if (x > 1380) {
                const d = Math.hypot(x - 1380, y - botCenterY);
                if (d > R) return { x: 1380 + ((x - 1380) / (d || 1)) * R, y: botCenterY + ((y - botCenterY) / (d || 1)) * R };
            } else {
                const minY = botCenterY - R; // 1140
                const maxY = botCenterY + R;
                if (y > maxY) return { x, y: maxY };
                if (y < minY) {
                    if (x < 840 + r || x > 1080 - r) return { x, y: minY };
                    else {
                        let nx = Math.max(840 + r, Math.min(1080 - r, x));
                        return { x: nx, y };
                    }
                }
            }
        }
    }
    return { x, y };
}

export function clampTopWithinArena(engine: GameEngine, top: Top) {
    if (engine.oneMinuteTransitionState === 'moving_down' || engine.oneMinuteTransitionState === 'exploding') return;
    const cl = clampToCapsule(engine, top.x, top.y, top.radius || TOP_RADIUS);
    top.x = cl.x;
    top.y = cl.y;
}

export function findLaunchPadNearestTargetDir(engine: GameEngine, top: Top) {
    let nearestTarget: any = null;
    let minDist = Infinity;

    if (engine.gameMode === 'campaign') {
        engine.zombies.forEach(z => {
            if (z.markForDeletion || z.hp <= 0 || (z as any).isSiegeZombie) return;
            const d = Math.hypot(z.x - top.x, z.y - top.y);
            if (d < minDist) {
                minDist = d;
                nearestTarget = z;
            }
        });
    } else {
        engine.tops.forEach(other => {
            if (other.id === top.id || other.markForDeletion || other.isExploding || other.hp <= 0) return;
            const d = Math.hypot(other.x - top.x, other.y - top.y);
            if (d < minDist) {
                minDist = d;
                nearestTarget = other;
            }
        });
    }

    if (!nearestTarget) {
        engine.tops.forEach(other => {
            if (other.id === top.id || other.markForDeletion || other.isExploding || other.hp <= 0) return;
            const d = Math.hypot(other.x - top.x, other.y - top.y);
            if (d < minDist) {
                minDist = d;
                nearestTarget = other;
            }
        });
        engine.zombies.forEach(z => {
            if (z.markForDeletion || z.hp <= 0 || (z as any).isSiegeZombie) return;
            const d = Math.hypot(z.x - top.x, z.y - top.y);
            if (d < minDist) {
                minDist = d;
                nearestTarget = z;
            }
        });
    }

    if (nearestTarget) {
        const dx = nearestTarget.x - top.x;
        const dy = nearestTarget.y - top.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.1) {
            return { x: dx / dist, y: dy / dist };
        }
    }

    const dx = 960 - top.x;
    const dy = 540 - top.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.1) {
        return { x: dx / dist, y: dy / dist };
    }
    return { x: 1, y: 0 };
}

export function dealLaunchPadSweepDamage(engine: GameEngine, top: Top, dt: number) {
    if (!(top as any).launchPadDamageCooldowns) {
        (top as any).launchPadDamageCooldowns = new Map<string, number>();
    }
    
    for (const [id, cd] of (top as any).launchPadDamageCooldowns.entries()) {
        if (cd > 0) {
            (top as any).launchPadDamageCooldowns.set(id, cd - dt);
        } else {
            (top as any).launchPadDamageCooldowns.delete(id);
        }
    }

    const isDashing = top.launchPadState === 'dashing';
    const range = top.radius + 30;
    
    const matchIdx = top.id.match(/\d+/);
    const playerIdx = matchIdx ? parseInt(matchIdx[0], 10) : 0;

    engine.zombies.forEach(z => {
        if (z.markForDeletion || z.hp <= 0 || (z as any).isSiegeZombie) return;
        const isBoss = z.type === 'zombie_boss';
        if (isBoss && top.launchPadBossDamaged) return;

        const zRadius = z.radius;
        const dist = Math.hypot(z.x - top.x, z.y - top.y);
        if (dist <= range + zRadius) {
            const cd = (top as any).launchPadDamageCooldowns.get(z.id) ?? 0;
            if (cd <= 0) {
                const damage = 1;
                applyDamageToZombie(engine, z, damage, top.id);
                (top as any).launchPadDamageCooldowns.set(z.id, 0.15);
                
                // Deduct 1 energy point per collision during launch/sweep
                top.hp = Math.max(0, top.hp - 1);
                top.visualHp = top.visualHp !== undefined ? Math.max(top.hp, top.visualHp) : top.hp;
                top.hpLossTimer = 0.5;
                if (isBoss) {
                    top.launchPadBossDamaged = true;
                }

                z.flashTimer = 0.15;
                EffectSystem.addParticles(engine, z.x, z.y, '#eab308', 4, 150, 4);
                EffectSystem.addParticles(engine, z.x, z.y, top.color, 4, 180, 3);
                
                z.bounceTimer = isBoss ? 0.4 : 0.6;
                z.maxBounceTimer = isBoss ? 0.4 : 0.6;
                z.hitByDash = true;
                
                const dx = z.x - top.x;
                const dy = z.y - top.y;
                const dHypot = Math.hypot(dx, dy) || 1;
                const kbSpeed = isDashing ? 1600 : 800;
                z.knockbackSpeedStart = kbSpeed;
                z.vx = (dx / dHypot) * kbSpeed;
                z.vy = (dy / dHypot) * kbSpeed;

                if (isBoss) {
                    const boss = z as any;
                    if (boss.bossAttackState === 'dash' || boss.bossAttackState === 'warning') {
                        boss.bossAttackState = 'idle';
                        boss.bossNextAttackTime = 3.0;
                    }
                }

                if (z.hp <= 0) {
                    if (!handleZombieDeath(engine, z, top.id)) return;
                    SoundSystem.play('Attack_Slash_020');
                    z.markForDeletion = true;
                    const points = z.type === 'zombie_boss' ? 500 : ((z.type === 'zombie_big' || z.type === 'zombie_bomb') ? 50 : 10);
                    engine.addScore(playerIdx, points);
                    top.kills = (top.kills ?? 0) + 1;

                    engine.shockwaves.push({
                        x: z.x,
                        y: z.y,
                        radius: 0,
                        maxRadius: z.type === 'zombie_boss' ? 450 : 150,
                        speed: 600,
                        color: top.color,
                        thickness: 8,
                        life: 0.3,
                        maxLife: 0.3
                    });

                    // 彈射衝鋒擊殺非魔王敵人產生相同的放射狀星星爆點特效
                    if (!top.isAI && z.type !== 'zombie_boss') {
                        const launchContactX = z.x;
                        const launchContactY = z.y;
                        
                        // 1. Add central star-shaped burst
                        engine.particles.push({
                            x: launchContactX,
                            y: launchContactY,
                            vx: 0,
                            vy: 0,
                            life: 0.30,
                            maxLife: 0.30,
                            color: '#f97316',
                            size: 112.5, // reduced by 25%
                            isBossStarExplosion: true,
                            angle: Math.random() * Math.PI * 2,
                            rotationSpeed: (Math.random() - 0.5) * 3 * 1.5
                        });

                        // 2. Add radiating orange-yellow star sparks
                        const sparkCount = 12;
                        for (let i = 0; i < sparkCount; i++) {
                            const baseAng = (i / sparkCount) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
                            const sparkSpeed = (180 + Math.random() * 240) * 1.5;
                            const colors = ['#f97316', '#facc15', '#ea580c', '#eab308'];
                            const chosenColor = colors[Math.floor(Math.random() * colors.length)];
                            
                            engine.particles.push({
                                x: launchContactX,
                                y: launchContactY,
                                vx: Math.cos(baseAng) * sparkSpeed,
                                vy: Math.sin(baseAng) * sparkSpeed,
                                life: (0.4 + Math.random() * 0.2) / 1.5,
                                maxLife: 0.6 / 1.5,
                                color: chosenColor,
                                size: (18 + Math.random() * 12) * 0.75, // reduced by 25%
                                isStarSpark: true,
                                angle: Math.random() * Math.PI * 2,
                                rotationSpeed: (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 6) * 1.5
                            });
                        }
                    }
                }
            }
        }
    });

    engine.tops.forEach(other => {
        if (other.id === top.id || other.markForDeletion || other.isExploding || other.hp <= 0) return;
        const dist = Math.hypot(other.x - top.x, other.y - top.y);
        if (dist <= range + other.radius) {
            const cd = (top as any).launchPadDamageCooldowns.get(other.id) ?? 0;
            if (cd <= 0) {
                const damage = 4;
                other.hp = Math.max(0, other.hp - damage);
                (top as any).launchPadDamageCooldowns.set(other.id, 0.3);

                other.flashTimer = 0.15;
                other.damageShockTimer = 0.2;
                
                EffectSystem.addParticles(engine, other.x, other.y, '#ffffff', 5, 200, 3);
                EffectSystem.addParticles(engine, other.x, other.y, other.color, 4, 150, 2);

                const dx = other.x - top.x;
                const dy = other.y - top.y;
                const dHypot = Math.hypot(dx, dy) || 1;
                const kbSpeed = isDashing ? 2000 : 1200;
                other.vx = (dx / dHypot) * kbSpeed;
                other.vy = (dy / dHypot) * kbSpeed;
                
                other.state = 'standby';
                engine.screenShakeTimer = Math.max(engine.screenShakeTimer, isDashing ? 0.4 : 0.2);

                if (other.hp <= 0) {
                    other.isExploding = true;
                    other.explosionTimer = 1.2;
                    engine.addScore(playerIdx, 150);
                    top.kills = (top.kills ?? 0) + 1;
                    
                    engine.shockwaves.push({
                        x: other.x,
                        y: other.y,
                        radius: 10,
                        maxRadius: 280,
                        speed: 850,
                        color: other.color,
                        thickness: 10,
                        life: 0.4,
                        maxLife: 0.4
                    });
                }
            }
        }
    });
}

export function getTopScale(engine: GameEngine, top: any): number {
    return 1.0;
}



export function getRandomCapsuleBoundaryPoint(engine: GameEngine) {
    const centerY = 540;
    const leftCenterX = 540;
    const rightCenterX = 1380;
    const radius = 480;

    const r = Math.random();
    if (r < 0.25) {
        // Top straight line
        const x = leftCenterX + Math.random() * (rightCenterX - leftCenterX);
        return { x, y: centerY - radius };
    } else if (r < 0.50) {
        // Bottom straight line
        const x = leftCenterX + Math.random() * (rightCenterX - leftCenterX);
        return { x, y: centerY + radius };
    } else if (r < 0.75) {
        // Left arc (angle between Math.PI/2 and 3*Math.PI/2)
        const angle = Math.PI / 2 + Math.random() * Math.PI;
        const x = leftCenterX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        return { x, y };
    } else {
        // Right arc (angle between -Math.PI/2 and Math.PI/2)
        const angle = -Math.PI / 2 + Math.random() * Math.PI;
        const x = rightCenterX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        return { x, y };
    }
}

export function getNearestEnemy(engine: GameEngine, top: Top): Entity | null {
    let nearest = null;
    let md = Infinity;
    const targets = [...engine.zombies, ...engine.tops.filter(t => t.id !== top.id)];
    targets.forEach(t => {
        const d = Math.hypot(t.x-top.x, t.y-top.y);
        if (d < md) { md = d; nearest = t; }
    });
    return nearest;
}

