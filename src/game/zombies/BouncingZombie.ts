import * as EffectSystem from '../systems/EffectSystem';
import * as CollisionSystem from '../systems/CollisionSystem';
import type { GameEngine } from '../GameEngine';
import { Top, Zombie } from '../types';
import { SoundSystem } from '../systems/SoundSystem';
import { updateBasicZombie } from './BasicZombie';
import { CANVAS_W, CANVAS_H } from '../constants';
import * as GameUtils from '../systems/GameUtils';

export function updateBouncingZombie(engine: GameEngine, z: Zombie, dt: number, zombieTargets: Top[]) {
    if (z.type === 'zombie_bouncing') {
        const big = z as any;
        
        if (big.isDying) {
            // Keep dyingTimer high so it doesn't get deleted by generic logic prematurely
            big.dyingTimer = 10; 

            if (!big.deathBouncingStarted) {
                big.deathBouncingStarted = true;
                big.bouncingAttackState = 'death_warning';
                big.bouncingAttackTimer = 1.5;
                SoundSystem.play('SRW_Lock_01');
                big.vx = 0;
                big.vy = 0;

                // Choose 3 random points inside the capsule arena
                const targets: { x: number; y: number }[] = [];
                const cy = engine.activeArenaCenterY ?? 540;
                for (let i = 0; i < 3; i++) {
                    let tx = 540;
                    let ty = cy;
                    for (let attempt = 0; attempt < 100; attempt++) {
                        const rx = 300 + Math.random() * (CANVAS_W - 600);
                        const ry = cy - 400 + Math.random() * 800;
                        if (GameUtils.isPointInsideCapsule(engine, rx, ry, 60)) {
                            tx = rx;
                            ty = ry;
                            break;
                        }
                    }
                    targets.push({ x: tx, y: ty });
                }
                big.bouncingTargets = targets;
                big.bouncingCurrentTargetIndex = 0;
            }

            if (big.bouncingAttackState === 'death_warning') {
                big.bouncingAttackTimer -= dt;
                big.vx = 0;
                big.vy = 0;

                if (Math.random() < 0.25) {
                    const ang = Math.random() * Math.PI * 2;
                    const rainbowColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#f472b6'];
                    const col = rainbowColors[Math.floor(Math.random() * rainbowColors.length)];
                    engine.particles.push({
                        x: big.x + Math.cos(ang) * big.radius * (0.5 + Math.random() * 0.5),
                        y: big.y + Math.sin(ang) * big.radius * (0.5 + Math.random() * 0.5),
                        vx: -Math.cos(ang) * 120,
                        vy: -Math.sin(ang) * 120,
                        life: 0.45,
                        maxLife: 0.45,
                        color: col,
                        size: Math.random() * 5 + 2
                    });
                }

                if (big.bouncingAttackTimer <= 0) {
                    big.bouncingAttackState = 'death_bouncing';
                    big.bouncingAttackTimer = 0.8;
                    big.bouncingStartX = big.x;
                    big.bouncingStartY = big.y;
                }
            } else if (big.bouncingAttackState === 'death_bouncing') {
                big.bouncingAttackTimer -= dt;
                
                const duration = 0.8;
                const progress = Math.min(1.0, 1.0 - (big.bouncingAttackTimer / duration));
                const tg = big.bouncingTargets[big.bouncingCurrentTargetIndex];
                
                big.x = big.bouncingStartX + (tg.x - big.bouncingStartX) * progress;
                big.y = big.bouncingStartY + (tg.y - big.bouncingStartY) * progress;
                
                big.angle += 20 * dt;
                const maxZ = 180;
                big.introZ = 4 * maxZ * progress * (1 - progress);

                if (big.bouncingAttackTimer <= 0) {
                    big.introZ = 0;
                    big.x = tg.x;
                    big.y = tg.y;
                    
                    SoundSystem.play('Attack_Punch_024');
                    engine.screenShakeTimer = 0.4;
                    
                    // Rainbow shockwaves
                    const rainbowColors = ['rgba(239, 68, 68, 0.85)', 'rgba(234, 179, 8, 0.85)', 'rgba(59, 130, 246, 0.85)', 'rgba(168, 85, 247, 0.85)'];
                    for (let c of rainbowColors) {
                        engine.shockwaves.push({
                            x: big.x, y: big.y, radius: 10 + Math.random()*20, maxRadius: 120 + Math.random()*30,
                            speed: 600 + Math.random()*100, color: c, thickness: 20,
                            life: 0.35, maxLife: 0.35
                        });
                    }

                    // Deal damage
                    engine.tops.forEach(top => {
                        if (top.markForDeletion || top.isExploding || (top as any).isDeadState || (top.skillActiveTimer !== undefined && top.skillActiveTimer > 0)) return;
                        const dist = Math.hypot(top.x - big.x, top.y - big.y);
                        if (dist <= 120) {
                            if (top.hitCooldown === undefined || top.hitCooldown <= 0) {
                                const isInvulnerable = (top.superTimer !== undefined && top.superTimer > 0) || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0);
                                if (!isInvulnerable) {
                                    SoundSystem.play('SE-Hurt1');
                                    top.hitCooldown = 1.0;
                                    top.flashTimer = 0.25;
                                    top.damageShockTimer = 0.45;
                                    top.hpLossTimer = 0.5;
                                    top.visualHp = top.visualHp !== undefined ? Math.max(top.hp, top.visualHp) : top.hp;
                                    top.hp = Math.max(0, top.hp - 15);

                                    EffectSystem.addParticles(engine, top.x, top.y, '#f472b6', 35, 450, 10);
                                }
                            }
                        }
                    });

                    big.bouncingCurrentTargetIndex++;
                    if (big.bouncingCurrentTargetIndex >= big.bouncingTargets.length) {
                        // Finally Die
                        big.markForDeletion = true;
                        const match = big.lastKillerId ? big.lastKillerId.match(/\d+/) : null;
                        const idx = match ? parseInt(match[0], 10) : 0;
                        engine.spawnTicket(big.x, big.y, big.type, idx, big.id);
                        
                        EffectSystem.addParticles(engine, big.x, big.y, '#be185d', 45, 400, 12);
                        EffectSystem.addParticles(engine, big.x, big.y, '#f472b6', 25, 300, 8);
                    } else {
                        big.bouncingAttackState = 'death_bouncing';
                        big.bouncingAttackTimer = 0.8;
                        big.bouncingStartX = big.x;
                        big.bouncingStartY = big.y;
                    }
                }
            }
            return;
        }

        if (big.bouncingAttackState === undefined) big.bouncingAttackState = 'idle';
        if (big.bouncingAttackTimer === undefined) big.bouncingAttackTimer = 0;
        if (big.bouncingNextAttackTime === undefined) big.bouncingNextAttackTime = 4.0 + Math.random() * 3;

        if (big.bouncingAttackState === 'idle') {
            big.bouncingNextAttackTime -= dt;
            
            let minDist = Infinity;
            let targetTop: Top | null = null;
            zombieTargets.forEach(t => {
                const d = Math.hypot(t.x - big.x, t.y - big.y);
                if (d < minDist) { minDist = d; targetTop = t; }
            });

            if (big.bouncingNextAttackTime <= 0 && targetTop) {
                const globalCooldownActive = (engine as any).purpleBrownSkillCooldown !== undefined && (engine as any).purpleBrownSkillCooldown > 0;
                const anotherIsAttacking = engine.zombies.some(other => {
                    if (other.id === big.id) return false;
                    const isBigAttacking = (other.type === 'zombie_big' || other.type === 'zombie_bomb') && (other as any).bigAttackState !== undefined && (other as any).bigAttackState !== 'idle';
                    const isBouncingAttacking = other.type === 'zombie_bouncing' && (other as any).bouncingAttackState !== undefined && (other as any).bouncingAttackState !== 'idle';
                    return isBigAttacking || isBouncingAttacking;
                });

                if (!anotherIsAttacking && !globalCooldownActive) {
                    big.bouncingAttackState = 'warning';
                    big.bouncingAttackTimer = 1.5;
                    SoundSystem.play('SRW_Lock_01');
                    big.vx = 0;
                    big.vy = 0;

                    // Choose 3 random points inside the capsule arena
                    const targets: { x: number; y: number }[] = [];
                    const cy = engine.activeArenaCenterY ?? 540;
                    for (let i = 0; i < 3; i++) {
                        let tx = 540;
                        let ty = cy;
                        for (let attempt = 0; attempt < 100; attempt++) {
                            const rx = 300 + Math.random() * (CANVAS_W - 600);
                            const ry = cy - 400 + Math.random() * 800;
                            if (GameUtils.isPointInsideCapsule(engine, rx, ry, 60)) {
                                tx = rx;
                                ty = ry;
                                break;
                            }
                        }
                        targets.push({ x: tx, y: ty });
                    }
                    big.bouncingTargets = targets;
                    big.bouncingCurrentTargetIndex = 0;
                } else {
                    big.bouncingNextAttackTime = 0.5 + Math.random() * 0.5;
                    updateBasicZombie(engine, z, dt, zombieTargets);
                }
            } else {
                updateBasicZombie(engine, z, dt, zombieTargets);
            }
        } else if (big.bouncingAttackState === 'warning') {
            big.bouncingAttackTimer -= dt;
            big.vx = 0;
            big.vy = 0;

            if (Math.random() < 0.25) {
                const ang = Math.random() * Math.PI * 2;
                engine.particles.push({
                    x: big.x + Math.cos(ang) * big.radius * (0.5 + Math.random() * 0.5),
                    y: big.y + Math.sin(ang) * big.radius * (0.5 + Math.random() * 0.5),
                    vx: -Math.cos(ang) * 120,
                    vy: -Math.sin(ang) * 120,
                    life: 0.45,
                    maxLife: 0.45,
                    color: '#be185d',
                    size: Math.random() * 5 + 2
                });
            }

            if (big.bouncingAttackTimer <= 0) {
                big.bouncingAttackState = 'bouncing';
                big.bouncingAttackTimer = 0.8; // jump duration
                big.vx = 0;
                big.vy = 0;
                big.bouncingStartX = big.x;
                big.bouncingStartY = big.y;
            }
        } else if (big.bouncingAttackState === 'bouncing') {
            big.bouncingAttackTimer -= dt;
            big.vx = 0;
            big.vy = 0;
            
            const duration = 0.8;
            const progress = Math.min(1.0, 1.0 - (big.bouncingAttackTimer / duration));
            
            const tg = big.bouncingTargets[big.bouncingCurrentTargetIndex];
            
            // Move horizontally
            big.x = big.bouncingStartX + (tg.x - big.bouncingStartX) * progress;
            big.y = big.bouncingStartY + (tg.y - big.bouncingStartY) * progress;
            
            // Fast spin!
            big.angle += 20 * dt;
            
            // Parabola height
            const maxZ = 180;
            big.introZ = 4 * maxZ * progress * (1 - progress);

            if (big.bouncingAttackTimer <= 0) {
                // Landed!
                big.introZ = 0;
                big.x = tg.x;
                big.y = tg.y;
                
                SoundSystem.play('Attack_Punch_024');
                engine.screenShakeTimer = 0.3;
                
                engine.shockwaves.push({
                    x: big.x,
                    y: big.y,
                    radius: 10,
                    maxRadius: 120,
                    speed: 600,
                    color: 'rgba(190, 24, 93, 0.85)',
                    thickness: 30,
                    life: 0.3,
                    maxLife: 0.3
                });

                EffectSystem.addParticles(engine, big.x, big.y, '#be185d', 20, 300, 8);
                EffectSystem.addParticles(engine, big.x, big.y, '#f472b6', 15, 200, 6);

                // Deal damage in 120px radius
                engine.tops.forEach(top => {
                    if (top.markForDeletion || top.isExploding || (top as any).isDeadState || (top.skillActiveTimer !== undefined && top.skillActiveTimer > 0)) return;
                    const dist = Math.hypot(top.x - big.x, top.y - big.y);
                    if (dist <= 120) {
                        if (top.hitCooldown === undefined || top.hitCooldown <= 0) {
                            const isInvulnerable = (top.superTimer !== undefined && top.superTimer > 0) || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0);
                            if (!isInvulnerable) {
                                SoundSystem.play('SE-Hurt1');
                                top.hitCooldown = 1.0;
                                top.flashTimer = 0.25;
                                top.damageShockTimer = 0.45;
                                top.hpLossTimer = 0.5;
                                top.visualHp = top.visualHp !== undefined ? Math.max(top.hp, top.visualHp) : top.hp;
                                top.hp = Math.max(0, top.hp - 10);

                                EffectSystem.addParticles(engine, top.x, top.y, '#be185d', 35, 450, 10);
                            }
                        }
                    }
                });

                // Next jump or finish
                big.bouncingCurrentTargetIndex++;
                if (big.bouncingCurrentTargetIndex >= big.bouncingTargets.length) {
                    big.bouncingAttackState = 'idle';
                    big.bouncingNextAttackTime = 5.0 + Math.random() * 3;
                    (engine as any).purpleBrownSkillCooldown = 3.0 + Math.random() * 3.0;
                } else {
                    big.bouncingAttackState = 'bouncing';
                    big.bouncingAttackTimer = 0.8;
                    big.bouncingStartX = big.x;
                    big.bouncingStartY = big.y;
                }
            }
        }

        if (big.bouncingAttackState === 'idle' || big.bouncingAttackState === 'warning') {
            z.x += z.vx * dt;
            z.y += z.vy * dt;
            CollisionSystem.handleWallBounce(engine, z);
        }
    }
}
