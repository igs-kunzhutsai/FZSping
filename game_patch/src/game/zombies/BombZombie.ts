import * as InputSystem from '../systems/InputSystem';
import * as EffectSystem from '../systems/EffectSystem';
import * as EventSystem from '../systems/EventSystem';
import * as CollisionSystem from '../systems/CollisionSystem';
import * as GameUtils from '../systems/GameUtils';
import * as SpawnSystem from '../systems/SpawnSystem';
import type { GameEngine } from '../GameEngine';
import { Top, Zombie } from '../types';
import { getStandbyRadiusForModel } from '../topMovement';
import { SoundSystem } from '../systems/SoundSystem';
import { updateBasicZombie } from './BasicZombie';

export function updateBombZombie(engine: GameEngine, z: Zombie, dt: number, zombieTargets: Top[]) {
    if (z.type === 'zombie_bomb') {
        const big = z as any;
        
        if (big.isDying) {
            if (big.bigAttackState !== 'idle' && big.bigAttackState !== undefined) {
                big.bigAttackState = 'idle';
                (engine as any).purpleBrownSkillCooldown = 3.0 + Math.random() * 3.0;
            }
            big.dyingTimer -= dt;
            big.vx = 0;
            big.vy = 0;
            
            // Spin only during the first 1 second (dyingTimer > 0.25)
            if (big.dyingTimer > 0.25) {
                big.angle += 15 * dt; // spin fast
            }
            
            // Fire earthquake at exactly 0.25s remaining (only once)
            if (big.dyingTimer <= 0.25 && !big.deathBeamFired) {
                big.deathBeamFired = true;
                const match = big.lastKillerId ? big.lastKillerId.match(/\d+/) : null;
                const idx = match ? parseInt(match[0], 10) : 0;
                
                // Create multi-layered concentric spectacular shockwaves that expand
                // Layer 1
                engine.shockwaves.push({
                    x: big.x,
                    y: big.y,
                    radius: 10,
                    maxRadius: 350,
                    speed: 1025,
                    color: 'rgba(244, 63, 94, 0.95)',
                    thickness: 95,
                    life: 0.4,
                    maxLife: 0.4,
                    isRainbow: true
                });

                // Layer 2
                engine.shockwaves.push({
                    x: big.x,
                    y: big.y,
                    radius: 10,
                    maxRadius: 300,
                    speed: 875,
                    color: 'rgba(249, 115, 22, 0.9)',
                    thickness: 75,
                    life: 0.4,
                    maxLife: 0.4,
                    isRainbow: true
                });

                // Layer 3
                engine.shockwaves.push({
                    x: big.x,
                    y: big.y,
                    radius: 10,
                    maxRadius: 250,
                    speed: 725,
                    color: 'rgba(234, 179, 8, 0.85)',
                    thickness: 55,
                    life: 0.4,
                    maxLife: 0.4,
                    isRainbow: true
                });

                // Shake camera extremely intensely
                engine.screenShakeTimer = 0.5; // (halved from 1.0)
                engine.screenShakeIntensity = 12; // restored to original amplitude

                SoundSystem.play('Attack_Punch_024');

                EffectSystem.addParticles(engine, big.x, big.y, '#ea580c', 35, 400, 10);
                EffectSystem.addParticles(engine, big.x, big.y, '#7c2d12', 30, 280, 12);
                EffectSystem.addParticles(engine, big.x, big.y, '#fef08a', 25, 360, 6);

                // Deal damage to all players within 350px radius
                engine.tops.forEach(top => {
                    if (top.markForDeletion || top.isExploding || (top as any).isDeadState || (top.skillActiveTimer !== undefined && top.skillActiveTimer > 0)) return;
                    const dist = Math.hypot(top.x - big.x, top.y - big.y);
                    if (dist <= 350) {
                        if (top.hitCooldown === undefined || top.hitCooldown <= 0) {
                            const isInvulnerable = (top.superTimer !== undefined && top.superTimer > 0) || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0);
                            if (!isInvulnerable) {
                                SoundSystem.play('SE-Hurt1');
                                top.hitCooldown = 1.0; // 1-second invulnerability protection
                                top.flashTimer = 0.25;
                                top.damageShockTimer = 0.45;
                                top.hpLossTimer = 0.5;
                                top.visualHp = top.visualHp !== undefined ? Math.max(top.hp, top.visualHp) : top.hp;

                                EffectSystem.addParticles(engine, top.x, top.y, '#ef4444', 35, 450, 10);
                            } else {
                                EffectSystem.addParticles(engine, top.x, top.y, '#fbbf24', 25, 300, 10);
                            }
                        }

                        if (top.isAI) {
                            engine.screenShakeTimer = 0.8;
                        }

                        // Apply extreme knockback
                        const dx = top.x - big.x;
                        const dy = top.y - big.y;
                        const dist2 = Math.hypot(dx, dy) || 1;
                        const nx = dx / dist2;
                        const ny = dy / dist2;
                        const bounceForce = 1500; // heavy kinetic impact rebound

                        top.vx = nx * bounceForce;
                        top.vy = ny * bounceForce;

                        if (top.state === 'dash') {
                            top.state = 'standby';
                            top.dashTimer = 0;
                            const velocityAngle = Math.atan2(ny, nx);
                            top.standbyAngle = velocityAngle + Math.PI / 2;
                            top.standbyCenterX = top.x - Math.cos(top.standbyAngle) * getStandbyRadiusForModel(top, engine as any,  top.standbyAngle);
                            top.standbyCenterY = top.y - Math.sin(top.standbyAngle) * getStandbyRadiusForModel(top, engine as any,  top.standbyAngle);
                        }
                        if (top.state === 'standby') {
                            top.standbyCenterVx = nx * bounceForce;
                            top.standbyCenterVy = ny * bounceForce;
                        }
                    }
                });
            }
            
            if (big.dyingTimer <= 0) {
                big.markForDeletion = true;
                const match = big.lastKillerId ? big.lastKillerId.match(/\d+/) : null;
                const idx = match ? parseInt(match[0], 10) : 0;
                engine.spawnTicket(big.x, big.y, big.type, idx, big.id);
                
                EffectSystem.addParticles(engine, big.x, big.y, '#f97316', 35, 300, 10);
                EffectSystem.addParticles(engine, big.x, big.y, '#78350f', 15, 200, 6);
                
                engine.shockwaves.push({
                    x: big.x, y: big.y, radius: 0, maxRadius: 250,
                    speed: 600, color: '#f97316', thickness: 12,
                    life: 0.4, maxLife: 0.4
                });
            }
            return;
        }

        if (big.bigAttackState === undefined) big.bigAttackState = 'idle';
        if (big.bigAttackTimer === undefined) big.bigAttackTimer = 0;
        if (big.bigNextAttackTime === undefined) big.bigNextAttackTime = 4.0 + Math.random() * 3;

        if (big.bigAttackState === 'idle') {
            big.bigNextAttackTime -= dt;
            
            let minDist = Infinity;
            let targetTop: Top | null = null;
            zombieTargets.forEach(t => {
                const d = Math.hypot(t.x - big.x, t.y - big.y);
                if (d < minDist) { minDist = d; targetTop = t; }
            });

            if (big.bigNextAttackTime <= 0 && targetTop) {
                const globalCooldownActive = (engine as any).purpleBrownSkillCooldown !== undefined && (engine as any).purpleBrownSkillCooldown > 0;
                const anotherIsAttacking = engine.zombies.some(other => {
                    if (other.id === big.id) return false;
                    const isBigAttacking = (other.type === 'zombie_big' || other.type === 'zombie_bomb') && (other as any).bigAttackState !== undefined && (other as any).bigAttackState !== 'idle';
                    const isBouncingAttacking = other.type === 'zombie_bouncing' && (other as any).bouncingAttackState !== undefined && (other as any).bouncingAttackState !== 'idle';
                    return isBigAttacking || isBouncingAttacking;
                });

                if (!anotherIsAttacking && !globalCooldownActive) {
                    big.bigAttackState = 'warning';
                    big.bigAttackTimer = 1.5;
                    SoundSystem.play('SRW_Lock_01');
                    big.vx = 0;
                    big.vy = 0;

                    big.bigWarningTargetX = big.x;
                    big.bigWarningTargetY = big.y;
                } else {
                    // Delay the check slightly and run normal basic behavior
                    big.bigNextAttackTime = 0.5 + Math.random() * 0.5;
                    updateBasicZombie(engine, z, dt, zombieTargets);
                }
            } else {
                updateBasicZombie(engine, z, dt, zombieTargets);
            }
        } else if (big.bigAttackState === 'warning') {
            big.bigAttackTimer -= dt;
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
                    color: '#78350f',
                    size: Math.random() * 5 + 2
                });
            }

            if (big.bigAttackTimer <= 0) {
                big.bigAttackState = 'earthquake_leap';
                big.bigAttackTimer = 0.8;
                big.vx = 0;
                big.vy = 0;
                engine.screenShakeTimer = 0.3;
            }
        } else if (big.bigAttackState === 'earthquake_leap') {
            big.bigAttackTimer -= dt;
            big.vx = 0;
            big.vy = 0;

            if (big.bigAttackTimer <= 0) {
                big.bigAttackState = 'idle';
                big.bigNextAttackTime = 5.0 + Math.random() * 4;
                // Set global cooldown for purple/brown zombie skill attacks
                (engine as any).purpleBrownSkillCooldown = 3.0 + Math.random() * 3.0;

                engine.shockwaves.push({
                    x: big.x,
                    y: big.y,
                    radius: 10,
                    maxRadius: 350,
                    speed: 1025,
                    color: 'rgba(244, 63, 94, 0.95)',
                    thickness: 95,
                    life: 0.4,
                    maxLife: 0.4
                });

                engine.shockwaves.push({
                    x: big.x,
                    y: big.y,
                    radius: 10,
                    maxRadius: 300,
                    speed: 875,
                    color: 'rgba(249, 115, 22, 0.9)',
                    thickness: 75,
                    life: 0.4,
                    maxLife: 0.4
                });

                engine.shockwaves.push({
                    x: big.x,
                    y: big.y,
                    radius: 10,
                    maxRadius: 250,
                    speed: 725,
                    color: 'rgba(234, 179, 8, 0.85)',
                    thickness: 55,
                    life: 0.4,
                    maxLife: 0.4
                });

                engine.screenShakeTimer = 0.5;
                engine.screenShakeIntensity = 12;

                SoundSystem.play('Attack_Punch_024');

                EffectSystem.addParticles(engine, big.x, big.y, '#ea580c', 35, 400, 10);
                EffectSystem.addParticles(engine, big.x, big.y, '#7c2d12', 30, 280, 12);
                EffectSystem.addParticles(engine, big.x, big.y, '#fef08a', 25, 360, 6);
                EffectSystem.addParticles(engine, big.x, big.y, '#451a03', 25, 220, 8);

                engine.tops.forEach(top => {
                    if (top.markForDeletion || top.isExploding || (top as any).isDeadState || (top.skillActiveTimer !== undefined && top.skillActiveTimer > 0)) return;
                    const dist = Math.hypot(top.x - big.x, top.y - big.y);
                    if (dist <= 350) {
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

                                EffectSystem.addParticles(engine, top.x, top.y, '#ef4444', 35, 450, 10);
                            } else {
                                EffectSystem.addParticles(engine, top.x, top.y, '#fbbf24', 25, 300, 10);
                            }
                        }

                        if (top.isAI) {
                            engine.screenShakeTimer = 0.8;
                        }

                        const dx = top.x - big.x;
                        const dy = top.y - big.y;
                        const dist2 = Math.hypot(dx, dy) || 1;
                        const nx = dx / dist2;
                        const ny = dy / dist2;
                        const bounceForce = 1500;

                        top.vx = nx * bounceForce;
                        top.vy = ny * bounceForce;

                        if (top.state === 'dash') {
                            top.state = 'standby';
                            top.dashTimer = 0;
                            const velocityAngle = Math.atan2(ny, nx);
                            top.standbyAngle = velocityAngle + Math.PI / 2;
                            top.standbyCenterX = top.x - Math.cos(top.standbyAngle) * getStandbyRadiusForModel(top, engine as any,  top.standbyAngle);
                            top.standbyCenterY = top.y - Math.sin(top.standbyAngle) * getStandbyRadiusForModel(top, engine as any,  top.standbyAngle);
                        }
                        if (top.state === 'standby') {
                            top.standbyCenterVx = nx * bounceForce;
                            top.standbyCenterVy = ny * bounceForce;
                        }
                    }
                });
            }
        }

        z.x += z.vx * dt;
        z.y += z.vy * dt;
        CollisionSystem.handleWallBounce(engine, z);
    }
}
