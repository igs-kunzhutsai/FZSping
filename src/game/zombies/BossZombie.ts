import * as InputSystem from '../systems/InputSystem';
import * as EffectSystem from '../systems/EffectSystem';
import * as EventSystem from '../systems/EventSystem';
import * as CollisionSystem from '../systems/CollisionSystem';
import * as GameUtils from '../systems/GameUtils';
import * as SpawnSystem from '../systems/SpawnSystem';
import type { GameEngine } from '../GameEngine';
import { Top, Zombie, Obstacle } from '../types';
import { CANVAS_W, CANVAS_H } from '../constants';
import { getStandbyRadiusForModel } from '../topMovement';
import { SoundSystem } from '../systems/SoundSystem';

export function updateBossZombie(engine: GameEngine, z: Zombie, dt: number, zombieTargets: Top[]) {
    const boss = z as any;
    // 2. Process custom boss updates
    if (z.type === 'zombie_boss') {
        const boss = z as any;
        
        // If the boss is in a deadlock standoff, update its timer and vibrate
        if (boss.deadlockTimer !== undefined && boss.deadlockTimer > 0) {
            boss.deadlockTimer = Math.max(0, boss.deadlockTimer - dt);

            // Physical high intensity vibration for standoff
            const vibeForce = 24.0;
            boss.deadlockVibeX = (Math.random() - 0.5) * vibeForce;
            boss.deadlockVibeY = (Math.random() - 0.5) * vibeForce;

            // Stop all other movement velocities
            boss.vx = 0;
            boss.vy = 0;

            // Lock position with vibration offset
            boss.x = (boss.deadlockX ?? boss.x) + boss.deadlockVibeX;
            boss.y = (boss.deadlockY ?? boss.y) + boss.deadlockVibeY;

            // Skip normal boss AI/movement updates
            return;
        }

        if (boss.bossAttackState === undefined) boss.bossAttackState = 'idle';
        if (boss.bossAttackTimer === undefined) boss.bossAttackTimer = 0;
        if (boss.bossNextAttackTime === undefined) boss.bossNextAttackTime = 2.5;

        // --- 1. Decrement state timers & progress attack state machine FIRST ---
        if (boss.bossAttackState === 'idle') {
            // Decrement charge attack timer
            boss.bossNextAttackTime -= dt;
            
            // Look for target to start warning phase
            let minDist = Infinity;
            let targetTop: Top | null = null;
            zombieTargets.forEach(t => {
               const d = Math.hypot(t.x - boss.x, t.y - boss.y);
               if (d < minDist) { minDist = d; targetTop = t; }
            });
            
            if (boss.bossNextAttackTime <= 0 && targetTop) {
                // Play all boss attacks in sequence, then loop back
                const attackSequence: ('dash' | 'bomb' | 'earthquake' | 'struggle')[] = ['dash', 'bomb', 'earthquake', 'struggle'];
                if (boss.bossAttackIndex === undefined) {
                    boss.bossAttackIndex = 0;
                }
                const attackType = attackSequence[boss.bossAttackIndex % attackSequence.length];
                if (attackType === 'struggle' && !GameUtils.isPlayerFreeOrStandby(engine, targetTop)) {
                    // Delay this attack and retry shortly to see if player becomes free/standby
                    boss.bossNextAttackTime = 0.5;
                    return;
                }
                boss.bossSelectedAttack = attackType;
                boss.bossAttackIndex++;

                // Start warning phase!
                boss.bossAttackState = 'warning';
                boss.bossAttackTimer = attackType === 'struggle' ? 1.5 : 2.0; // 1.5 seconds for struggle, 2.0 otherwise
                boss.weakCornerIndex = Math.floor(Math.random() * 6);
                SoundSystem.play('SRW_Lock_01');
                boss.vx = 0;
                boss.vy = 0;
                
                if (attackType === 'dash') {
                    // Lock initial target direction
                    const dx = targetTop.x - boss.x;
                    const dy = targetTop.y - boss.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    boss.bossDashDirectionX = dx / dist;
                    boss.bossDashDirectionY = dy / dist;
                    boss.bossWarningTargetX = targetTop.x;
                    boss.bossWarningTargetY = targetTop.y;
                } else if (attackType === 'struggle') {
                    boss.bossWarningTargetId = targetTop.id;
                    boss.bossWarningTargetX = targetTop.x;
                    boss.bossWarningTargetY = targetTop.y;
                } else if (attackType === 'earthquake') {
                    boss.bossWarningTargetX = boss.x;
                    boss.bossWarningTargetY = boss.y;
                } else {
                    // Bomb Summon! Choose 3 random points inside the capsule arena
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
                    boss.bossBombTargets = targets;
                }
            }
        } else if (boss.bossAttackState === 'warning') {
            boss.bossAttackTimer -= dt;

            if (boss.bossSelectedAttack === 'struggle') {
                const targetTop = engine.tops.find(t => t.id === boss.bossWarningTargetId);
                if (targetTop) {
                    boss.bossWarningTargetX = targetTop.x;
                    boss.bossWarningTargetY = targetTop.y;
                }
            }

            // Emit charging orange/red energy particles to show build up
            if (Math.random() < 0.4) {
                const ang = Math.random() * Math.PI * 2;
                engine.particles.push({
                    x: boss.x + Math.cos(ang) * boss.radius * (0.5 + Math.random() * 0.5),
                    y: boss.y + Math.sin(ang) * boss.radius * (0.5 + Math.random() * 0.5),
                    vx: -Math.cos(ang) * 150,
                    vy: -Math.sin(ang) * 150,
                    life: 0.45,
                    maxLife: 0.45,
                    color: '#ea580c',
                    size: Math.random() * 6 + 4
                });
            }

            // Emit particles rising up from the ground at the 3 warning coordinates during bomb warning
            if (boss.bossSelectedAttack === 'bomb' && boss.bossBombTargets) {
                boss.bossBombTargets.forEach((tg: { x: number; y: number }) => {
                    if (Math.random() < 0.25) {
                        engine.particles.push({
                            x: tg.x + (Math.random() - 0.5) * 40,
                            y: tg.y + (Math.random() - 0.5) * 40,
                            vx: (Math.random() - 0.5) * 30,
                            vy: -50 - Math.random() * 80, // float upwards
                            life: 0.5,
                            maxLife: 0.5,
                            color: '#ef4444',
                            size: Math.random() * 5 + 3
                        });
                    }
                });
            }

            if (boss.bossAttackTimer <= 0) {
                if (boss.bossSelectedAttack === 'dash') {
                    // Let's Charge/Dash!
                    boss.bossAttackState = 'dash';
                    boss.bossAttackTimer = 0.25; // Laser active duration: 0.25 seconds
                    SoundSystem.play('Shot_Beam_08');
                    engine.screenShakeTimer = 0.8;
                } else if (boss.bossSelectedAttack === 'struggle') {
                    const targetTop = engine.tops.find(t => t.id === boss.bossWarningTargetId);
                    if (targetTop && GameUtils.isPlayerFreeOrStandby(engine, targetTop)) {
                        // Let's Charge/Ram directly!
                        boss.bossAttackState = 'struggle_charge';
                        boss.bossAttackTimer = 4.0; // max charge time of 4.0 seconds to prevent getting stuck
                        engine.screenShakeTimer = 0.5;
                    } else {
                        // Forcefully cancel the attack!
                        boss.bossAttackState = 'idle';
                        boss.bossNextAttackTime = 1.0;
                        boss.vx = 0; boss.vy = 0;
                    }
                } else if (boss.bossSelectedAttack === 'earthquake') {
                    // Let's Leap/Jump up!
                    boss.bossAttackState = 'earthquake_leap';
                    boss.bossAttackTimer = 0.8; // Leap duration of 0.8 seconds
                    boss.vx = 0;
                    boss.vy = 0;
                    engine.screenShakeTimer = 0.3;
                } else {
                    // Let's Summon Bombs!
                    if (boss.bossBombTargets) {
                        boss.bossBombTargets.forEach((tg: { x: number; y: number }) => {
                            // Spawn the actual bomb obstacle_barrel (this will have identical damage logic to standard ones)
                            engine.obstacles.push({
                                id: 'boss_bomb_' + Math.random(),
                                type: 'obstacle_barrel',
                                x: tg.x,
                                y: tg.y,
                                vx: 0,
                                vy: 0,
                                radius: 30,
                                mass: 999999,
                                markForDeletion: false,
                                durability: 1
                            } as Obstacle);

                            // Spontaneous magical summoning particles!
                            EffectSystem.addParticles(engine, tg.x, tg.y, '#ef4444', 35, 300, 10);
                            EffectSystem.addParticles(engine, tg.x, tg.y, '#fbbf24', 20, 200, 8);
                            
                            // Add a small shockwave indicator for summoning spawning
                            engine.shockwaves.push({
                                x: tg.x,
                                y: tg.y,
                                radius: 5,
                                maxRadius: 100,
                                speed: 300,
                                color: '#ef4444',
                                thickness: 6,
                                life: 0.5,
                                maxLife: 0.5,
                                isDashedRed: true
                            });
                        });
                    }
                    
                    engine.screenShakeTimer = 0.5;

                    // Summoning complete, rest/idle transition immediately
                    boss.bossAttackState = 'idle';
                    boss.bossNextAttackTime = 3.0; // Wait 3.0 seconds before next attack
                    boss.vx = 0;
                    boss.vy = 0;
                    boss.bossBombTargets = [];
                }
            }
        } else if (boss.bossAttackState === 'dash') {
            boss.bossAttackTimer -= dt;
            if (boss.bossAttackTimer <= 0) {
                // Charge completed, rest/idle transition
                boss.bossAttackState = 'idle';
                boss.bossNextAttackTime = 3.0; // Wait 3.0 seconds before next attack
                boss.vx = 0;
                boss.vy = 0;
            }
        } else if (boss.bossAttackState === 'struggle_charge') {
            boss.bossAttackTimer -= dt;
            const targetTop = engine.tops.find(t => t.id === boss.bossWarningTargetId);
            if (targetTop && !targetTop.markForDeletion && targetTop.hp > 0 && GameUtils.isPlayerFreeOrStandby(engine, targetTop)) {
                const dx = targetTop.x - boss.x;
                const dy = targetTop.y - boss.y;
                const dist = Math.hypot(dx, dy) || 1;
                if (dist <= (boss.radius + targetTop.radius + 15)) {
                    // Collision contact! Initiate struggle clashing immediately!
                    boss.bossAttackState = 'struggle_clash';
                    boss.bossAttackTimer = 3.0; // Exactly 3 seconds intense wrestle event
                    targetTop.struggleMashCount = 0;
                    targetTop.struggleMashRequired = 8; // 8 mashes required (reduced by 50% for easier victory)
                    boss.vx = 0; boss.vy = 0;
                    targetTop.vx = 0; targetTop.vy = 0;
                    
                    // Anchor coordinates and calculate clashing direction
                    (boss as any).struggleAnchorX = boss.x;
                    (boss as any).struggleAnchorY = boss.y;
                    
                    const clashAngle = Math.atan2(dy, dx);
                    (boss as any).struggleClashAngle = clashAngle;
                    const targetDist = boss.radius + targetTop.radius - 5;
                    (targetTop as any).struggleAnchorX = boss.x + Math.cos(clashAngle) * targetDist;
                    (targetTop as any).struggleAnchorY = boss.y + Math.sin(clashAngle) * targetDist;
                    
                    engine.screenShakeTimer = 1.0;
                    engine.screenShakeIntensity = 8;
                } else {
                    // Run extremely fast towards target
                    const chargeSpeed = 1000;
                    boss.vx = (dx / dist) * chargeSpeed;
                    boss.vy = (dy / dist) * chargeSpeed;
                    boss.angle = Math.atan2(dy, dx) + Math.PI/2;
                    
                    // Spawn charging wind particles behind boss
                    if (Math.random() < 0.5) {
                        engine.particles.push({
                            x: boss.x - (dx / dist) * boss.radius + (Math.random() - 0.5) * 30,
                            y: boss.y - (dy / dist) * boss.radius + (Math.random() - 0.5) * 30,
                            vx: -boss.vx * 0.2 + (Math.random() - 0.5) * 50,
                            vy: -boss.vy * 0.2 + (Math.random() - 0.5) * 50,
                            life: 0.4, maxLife: 0.4,
                            color: '#ef4444',
                            size: Math.random() * 8 + 4
                        });
                    }
                }
            } else {
                // Target lost or dead
                boss.bossAttackState = 'idle';
                boss.bossNextAttackTime = 1.5;
                boss.vx = 0; boss.vy = 0;
            }
            if (boss.bossAttackTimer <= 0 && boss.bossAttackState === 'struggle_charge') {
                // Charge timeout
                boss.bossAttackState = 'idle';
                boss.bossNextAttackTime = 2.0;
                boss.vx = 0; boss.vy = 0;
            }
        } else if (boss.bossAttackState === 'struggle_clash') {
            boss.bossAttackTimer -= dt;
            const targetTop = engine.tops.find(t => t.id === boss.bossWarningTargetId);
            if (targetTop && !targetTop.markForDeletion && targetTop.hp > 0) {
                // Push-and-pull displacement: Continuously shift the positions back-and-forth along the clash angle!
                let clashAngle = (boss as any).struggleClashAngle;
                if (clashAngle === undefined) {
                    const bdx = (targetTop as any).struggleAnchorX !== undefined ? (targetTop as any).struggleAnchorX - (boss as any).struggleAnchorX : targetTop.x - boss.x;
                    const bdy = (targetTop as any).struggleAnchorY !== undefined ? (targetTop as any).struggleAnchorY - (boss as any).struggleAnchorY : targetTop.y - boss.y;
                    clashAngle = Math.atan2(bdy, bdx);
                    (boss as any).struggleClashAngle = clashAngle;
                }

                const elapsed = 3.0 - boss.bossAttackTimer;
                const currentMash = targetTop.struggleMashCount ?? 0;
                const requiredMash = targetTop.struggleMashRequired ?? 8;
                const playerProgress = Math.min(1.0, currentMash / requiredMash);
                const timeProgress = Math.min(1.0, elapsed / 3.0);

                // Drift depends on mashing progress relative to elapsed time (player mashing pushes boss back, delay lets boss push player forward)
                const drift = (timeProgress - playerProgress) * 70; // Range: -70 to +70

                // Fast chaotic back-and-forth oscillation (sway) to give visual organic wrestling feel
                const sway = Math.sin(elapsed * 12.0) * 16 + Math.cos(elapsed * 23.4) * 6;
                const pushOffset = drift + sway;

                const dx_offset = Math.cos(clashAngle) * pushOffset;
                const dy_offset = Math.sin(clashAngle) * pushOffset;

                if ((boss as any).struggleAnchorX !== undefined) {
                    boss.x = (boss as any).struggleAnchorX + dx_offset;
                    boss.y = (boss as any).struggleAnchorY + dy_offset;
                }
                if ((targetTop as any).struggleAnchorX !== undefined) {
                    const targetDist = boss.radius + targetTop.radius - 5;
                    targetTop.x = boss.x + Math.cos(clashAngle) * targetDist;
                    targetTop.y = boss.y + Math.sin(clashAngle) * targetDist;
                }
                
                boss.vx = 0; boss.vy = 0;
                targetTop.vx = 0; targetTop.vy = 0;
                
                const dx = targetTop.x - boss.x;
                const dy = targetTop.y - boss.y;
                const dist = Math.hypot(dx, dy) || 1;
                
                // Jitter vibrate offsets (角色圖像激烈抖動) - increased scale to 35 for dramatic continuous shake
                const vibeScale = 35;
                const vibeX = (Math.random() - 0.5) * vibeScale;
                const vibeY = (Math.random() - 0.5) * vibeScale;
                boss.struggleJitterX = vibeX;
                boss.struggleJitterY = vibeY;
                
                targetTop.struggleJitterX = -vibeX;
                targetTop.struggleJitterY = -vibeY;
                
                // Face each other
                boss.angle = Math.atan2(dy, dx) + Math.PI/2;
                targetTop.angle += 15 * dt; // spin player fast
                
                // Friction sparks spray intensely at contact point (兩方接觸點有激烈摩擦火化持續噴發)
                const contactX = boss.x + (dx / dist) * boss.radius;
                const contactY = boss.y + (dy / dist) * boss.radius;
                for (let k = 0; k < 3; k++) {
                    const angleOffset = (Math.random() - 0.5) * Math.PI * 0.7;
                    const sparkAngle = Math.atan2(dy, dx) + Math.PI/2 + angleOffset;
                    const spd = 150 + Math.random() * 350;
                    engine.particles.push({
                        x: contactX + (Math.random() - 0.5) * 10,
                        y: contactY + (Math.random() - 0.5) * 10,
                        vx: Math.cos(sparkAngle) * spd,
                        vy: Math.sin(sparkAngle) * spd,
                        life: 0.2 + Math.random() * 0.3,
                        maxLife: 0.5,
                        color: k % 3 === 0 ? '#fbbf24' : (k % 3 === 1 ? '#ea580c' : '#ffffff'),
                        size: Math.random() * 6 + 3,
                        isSpark: true
                    });
                }
                
                // If player is AI, automatically struggle
                if (targetTop.isAI) {
                    if (targetTop.aiMashTimer === undefined) targetTop.aiMashTimer = 0;
                    targetTop.aiMashTimer += dt;
                    if (targetTop.aiMashTimer >= 0.15) {
                        targetTop.aiMashTimer = 0;
                        targetTop.struggleMashCount = (targetTop.struggleMashCount ?? 0) + 1;
                    }
                }
                
                // Check outcomes: End early if player mashes enough, or wait for timer
                const currentCount = targetTop.struggleMashCount ?? 0;
                const currentRequired = targetTop.struggleMashRequired ?? 8;
                
                if (currentCount >= currentRequired || boss.bossAttackTimer <= 0) {
                    const count = currentCount;
                    const required = currentRequired;
                    
                    if (count >= required) {
                        // SUCCESS OUTCOME: Push boss back!
                        const rdx = boss.x - targetTop.x;
                        const rdy = boss.y - targetTop.y;
                        const rdist = Math.hypot(rdx, rdy) || 1;
                        const nx = rdx / rdist;
                        const ny = rdy / rdist;
                        
                        boss.vx = nx * 1600;
                        boss.vy = ny * 1600;
                        boss.bounceTimer = 0.9;
                        boss.maxBounceTimer = 0.9;
                        boss.hitByDash = true;
                        boss.knockbackSpeedStart = 1600;
                        SoundSystem.play('SE-Explo1');
                        boss.flashTimer = 0.5;
                        
                        // Player dashes forward triumphantly
                        targetTop.vx = nx * 1800;
                        targetTop.vy = ny * 1800;
                        targetTop.state = 'dash';
                        targetTop.dashTimer = 0.6;
                        targetTop.maxDashDuration = 0.6;
                        
                        engine.shockwaves.push({
                            x: targetTop.x,
                            y: targetTop.y,
                            radius: 10,
                            maxRadius: 350,
                            speed: 900,
                            color: '#38bdf8',
                            thickness: 25,
                            life: 0.5,
                            maxLife: 0.5
                        });
                        EffectSystem.addParticles(engine, contactX, contactY, '#38bdf8', 40, 500, 10);
                        EffectSystem.addParticles(engine, contactX, contactY, '#fbbf24', 25, 400, 8);
                        EffectSystem.addParticles(engine, contactX, contactY, '#ffffff', 20, 300, 6);
                        engine.screenShakeTimer = 1.2;
                        engine.screenShakeIntensity = 12;
                    } else {
                        // FAILURE OUTCOME: Player is severely beaten back & loses 10hp!
                        const rdx = targetTop.x - boss.x;
                        const rdy = targetTop.y - boss.y;
                        const rdist = Math.hypot(rdx, rdy) || 1;
                        const nx = rdx / rdist;
                        const ny = rdy / rdist;
                        
                        targetTop.vx = nx * 1200;
                        targetTop.vy = ny * 1200;
                        targetTop.standbyCenterVx = nx * 1200;
                        targetTop.standbyCenterVy = ny * 1200;
                        // Fling high up in the air
                        targetTop.zPos = 1;
                        targetTop.zVel = 1200;
                        
                        if (targetTop.state === 'dash') {
                            targetTop.state = 'standby';
                            targetTop.dashTimer = 0;
                            const velocityAngle = Math.atan2(ny, nx);
                            targetTop.standbyAngle = velocityAngle + Math.PI / 2;
                            targetTop.standbyCenterX = targetTop.x - Math.cos(targetTop.standbyAngle) * getStandbyRadiusForModel(targetTop, this,  targetTop.standbyAngle);
                            targetTop.standbyCenterY = targetTop.y - Math.sin(targetTop.standbyAngle) * getStandbyRadiusForModel(targetTop, this,  targetTop.standbyAngle);
                        }
                        
                        SoundSystem.play('SE-Hurt1');
                        targetTop.flashTimer = 0.35;
                        targetTop.damageShockTimer = 0.6;
                        targetTop.hpLossTimer = 0.5;
                        targetTop.visualHp = targetTop.visualHp !== undefined ? Math.max(targetTop.hp, targetTop.visualHp) : targetTop.hp;
                        
                        engine.shockwaves.push({
                            x: targetTop.x,
                            y: targetTop.y,
                            radius: 10,
                            maxRadius: 250,
                            speed: 700,
                            color: '#ef4444',
                            thickness: 18,
                            life: 0.5,
                            maxLife: 0.5
                        });
                        EffectSystem.addParticles(engine, targetTop.x, targetTop.y, '#ef4444', 35, 450, 10);
                        EffectSystem.addParticles(engine, targetTop.x, targetTop.y, '#ea580c', 20, 350, 8);
                        engine.screenShakeTimer = 1.3;
                        engine.screenShakeIntensity = 15;
                    }
                    
                    // Clean offsets & reset
                    boss.bossAttackState = 'idle';
                    boss.bossNextAttackTime = count >= required ? 3.5 : 2.0;
                    boss.struggleJitterX = undefined;
                    boss.struggleJitterY = undefined;
                    (boss as any).struggleAnchorX = undefined;
                    (boss as any).struggleAnchorY = undefined;
                    (boss as any).struggleClashAngle = undefined;
                    targetTop.struggleJitterX = undefined;
                    targetTop.struggleJitterY = undefined;
                    (targetTop as any).struggleAnchorX = undefined;
                    (targetTop as any).struggleAnchorY = undefined;
                    targetTop.struggleMashCount = undefined;
                    targetTop.struggleMashRequired = undefined;
                }
            } else {
                // Target lost
                boss.bossAttackState = 'idle';
                boss.bossNextAttackTime = 1.5;
                boss.vx = 0; boss.vy = 0;
                boss.struggleJitterX = undefined;
                boss.struggleJitterY = undefined;
                (boss as any).struggleAnchorX = undefined;
                (boss as any).struggleAnchorY = undefined;
                (boss as any).struggleClashAngle = undefined;
            }
        } else if (boss.bossAttackState === 'dash') {
            boss.bossAttackTimer -= dt;
            if (boss.bossAttackTimer <= 0) {
                // Charge completed, rest/idle transition
                boss.bossAttackState = 'idle';
                boss.bossNextAttackTime = 3.0; // Wait 3.0 seconds before next attack
                boss.vx = 0;
                boss.vy = 0;
            }
        } else if (boss.bossAttackState === 'earthquake_leap') {
            boss.bossAttackTimer -= dt;
            boss.vx = 0;
            boss.vy = 0;
            if (boss.bossAttackTimer <= 0) {
                // Slam down!
                boss.bossAttackState = 'idle';
                boss.bossNextAttackTime = 3.0; // Wait 3.0 seconds before next attack
                boss.vx = 0;
                boss.vy = 0;

                // Create multi-layered concentric spectacular shockwaves that expand fully past the 350px warning boundary
                // Layer 1: Massive Outer Rose-Red Shock Ring (Max Radius: 420px)
                engine.shockwaves.push({
                    x: boss.x,
                    y: boss.y,
                    radius: 10,
                    maxRadius: 420,
                    speed: 1025, // Covers 410px in 0.4 seconds to reach 420px max radius
                    color: 'rgba(244, 63, 94, 0.95)', // Rose Red energy ring
                    thickness: 95,
                    life: 0.4,
                    maxLife: 0.4
                });

                // Layer 2: Middle Vibrant Fire-Orange Shock Ring (Max Radius: 360px)
                engine.shockwaves.push({
                    x: boss.x,
                    y: boss.y,
                    radius: 10,
                    maxRadius: 360,
                    speed: 875, // Covers 350px in 0.4 seconds to reach 360px max radius
                    color: 'rgba(249, 115, 22, 0.9)', // Deep orange kinetic shock
                    thickness: 75,
                    life: 0.4,
                    maxLife: 0.4
                });

                // Layer 3: Inner Auric-Golden Shock Ring (Max Radius: 300px)
                engine.shockwaves.push({
                    x: boss.x,
                    y: boss.y,
                    radius: 10,
                    maxRadius: 300,
                    speed: 725, // Covers 290px in 0.4 seconds to reach 300px max radius
                    color: 'rgba(234, 179, 8, 0.85)', // Radiant solar gold
                    thickness: 55,
                    life: 0.4,
                    maxLife: 0.4
                });

                // Layer 4: Concentrated Core White-Hot Shockwave (Max Radius: 220px)
                engine.shockwaves.push({
                    x: boss.x,
                    y: boss.y,
                    radius: 5,
                    maxRadius: 220,
                    speed: 537,
                    color: 'rgba(255, 255, 255, 0.95)', // White core flash
                    thickness: 35,
                    life: 0.4,
                    maxLife: 0.4
                });

                // Shake camera extremely intensely
                engine.screenShakeTimer = 1.2;
                engine.screenShakeIntensity = 15;
                
                SoundSystem.play('Attack_Punch_024');

                // Highly detailed explosive landing particles (heavy, dramatic, multi-colored)
                EffectSystem.addParticles(engine, boss.x, boss.y, '#f43f5e', 40, 480, 14); // Rose-red primary impact bloom
                EffectSystem.addParticles(engine, boss.x, boss.y, '#ea580c', 35, 400, 10); // Secondary lava-orange bursts
                EffectSystem.addParticles(engine, boss.x, boss.y, '#7c2d12', 30, 280, 12); // Large dirt/soil/rubble boulders
                EffectSystem.addParticles(engine, boss.x, boss.y, '#451a03', 25, 220, 8);  // Dense dark brown heavy earth clumps
                EffectSystem.addParticles(engine, boss.x, boss.y, '#fef08a', 25, 360, 6);  // Glittering yellow sparks
                EffectSystem.addParticles(engine, boss.x, boss.y, '#ffffff', 20, 320, 5);  // Super hot white sparks

                // Deal 10 damage to all players within 350px radius
                engine.tops.forEach(top => {
                    if (top.markForDeletion || top.isExploding || (top as any).isDeadState || (top.skillActiveTimer !== undefined && top.skillActiveTimer > 0)) return;
                    const dist = Math.hypot(top.x - boss.x, top.y - boss.y);
                    if (dist <= 350) {
                        if (top.hitCooldown === undefined || top.hitCooldown <= 0) {
                            const isInvulnerable = (top.superTimer !== undefined && top.superTimer > 0) || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0);
                            if (!isInvulnerable) {
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
                        const dx = top.x - boss.x;
                        const dy = top.y - boss.y;
                        const dist2 = Math.hypot(dx, dy) || 1;
                        const nx = dx / dist2;
                        const ny = dy / dist2;
                        const bounceForce = 1850; // heavy kinetic impact rebound

                        top.vx = nx * bounceForce;
                        top.vy = ny * bounceForce;

                        if (top.state === 'dash') {
                            top.state = 'standby';
                            top.dashTimer = 0;
                            const velocityAngle = Math.atan2(ny, nx);
                            top.standbyAngle = velocityAngle + Math.PI / 2;
                            top.standbyCenterX = top.x - Math.cos(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
                            top.standbyCenterY = top.y - Math.sin(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
                        }
                        if (top.state === 'standby') {
                            top.standbyCenterVx = nx * bounceForce;
                            top.standbyCenterVy = ny * bounceForce;
                        }
                    }
                });
            }
        }

        // --- 2. Calculate movement based on physical/attack states ---
        if (boss.bounceTimer !== undefined && boss.bounceTimer > 0) {
            // Handle physical bounce slides from hits/collisions
            boss.bounceTimer -= dt;
            
            if (boss.hitByDash && boss.knockbackSpeedStart !== undefined && boss.maxBounceTimer) {
                const ratio = Math.max(0, Math.min(1, boss.bounceTimer / boss.maxBounceTimer));
                const targetSpeed = boss.knockbackSpeedStart * Math.pow(ratio, 2.0);
                const currentSpeed = Math.hypot(boss.vx, boss.vy);
                if (currentSpeed > 0.1) {
                    boss.vx = (boss.vx / currentSpeed) * targetSpeed;
                    boss.vy = (boss.vy / currentSpeed) * targetSpeed;
                }
            } else {
                boss.vx *= 0.90; // Dampen slide quickly to feel heavy
                boss.vy *= 0.90;
            }
            if (boss.bounceTimer <= 0) {
                boss.bounceTimer = 0;
                boss.hitByDash = false;
            }
            
            // Spin slightly on bounce but much less because of its colossal size
            const speed = Math.hypot(boss.vx, boss.vy);
            boss.angle += (speed / 300) * Math.PI * dt; // Spin less for heavy feel
        } else if (boss.bossAttackState === 'dash' || boss.bossAttackState === 'earthquake_leap' || boss.bossAttackState === 'struggle_clash') {
            // Stay in place during beam firing, leaping, or clashing; velocity is 0
            boss.vx = 0;
            boss.vy = 0;
            
            if (boss.bossAttackState === 'dash') {
                // Face direction of beam
                boss.angle = Math.atan2(boss.bossDashDirectionY ?? 0, boss.bossDashDirectionX ?? 1) + Math.PI/2;

                // Spawn spectacular glowing discharging fire particles along the laser beam
                if (Math.random() < 0.9) {
                    const sparkDx = (boss.bossDashDirectionX ?? 1);
                    const sparkDy = (boss.bossDashDirectionY ?? 0);
                    const dist = 70 + Math.random() * 600; // spawn sparks along the boss laser line
                    engine.particles.push({
                        x: boss.x + sparkDx * dist + (Math.random() - 0.5) * 50,
                        y: boss.y + sparkDy * dist + (Math.random() - 0.5) * 50,
                        vx: (Math.random() - 0.5) * 50,
                        vy: (Math.random() - 0.5) * 50,
                        life: 0.3,
                        maxLife: 0.3,
                        color: '#ef4444',
                        size: Math.random() * 10 + 5
                    });
                }
            } else {
                // Slowly spin the boss's body during the epic airtime leap
                boss.angle += 3.5 * dt;
            }
        } else if (boss.bossAttackState === 'warning') {
            // Warning state: boss is building energy, decelerates/stops moving
            boss.vx = 0;
            boss.vy = 0;
            
            // Face target direction
            if (boss.bossSelectedAttack === 'struggle') {
                const dx = (boss.bossWarningTargetX ?? boss.x) - boss.x;
                const dy = (boss.bossWarningTargetY ?? boss.y) - boss.y;
                boss.angle = Math.atan2(dy, dx) + Math.PI/2;
            } else {
                const targetAngle = Math.atan2(boss.bossDashDirectionY ?? 0, boss.bossDashDirectionX ?? 1) + Math.PI/2;
                boss.angle = targetAngle;
            }
        } else if (boss.bossAttackState === 'idle') {
            // Move slowly towards nearest top
            let minDist = Infinity;
            let targetTop: Top | null = null;
            zombieTargets.forEach(t => {
               const d = Math.hypot(t.x - boss.x, t.y - boss.y);
               if (d < minDist) { minDist = d; targetTop = t; }
            });
            
            if (targetTop) {
                const dx = targetTop.x - boss.x;
                const dy = targetTop.y - boss.y;
                const dist = Math.hypot(dx, dy) || 1;
                const spd = 65; // moves slowly but menacingly
                boss.vx = (dx / dist) * spd;
                boss.vy = (dy / dist) * spd;
                
                // Face target
                const targetAngle = Math.atan2(dy, dx) + Math.PI/2;
                let diff = targetAngle - boss.angle;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                boss.angle += Math.sign(diff) * Math.min(Math.abs(diff), 2.5 * dt);
            } else {
                // Wander around!
                if (boss.wanderTimer === undefined || boss.wanderTimer <= 0) {
                    boss.wanderTimer = 1.0 + Math.random() * 2.0;
                    boss.wanderAngle = Math.random() * Math.PI * 2;
                }
                boss.wanderTimer -= dt;
                
                const spd = 40; // slow wander speed
                boss.vx = Math.cos(boss.wanderAngle) * spd;
                boss.vy = Math.sin(boss.wanderAngle) * spd;
                
                // Face wander angle smoothly
                const targetAngle = boss.wanderAngle + Math.PI/2;
                let diff = targetAngle - boss.angle;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                boss.angle += Math.sign(diff) * Math.min(Math.abs(diff), 1.5 * dt);
            }
        }

        // Apply movement
        boss.x += boss.vx * dt;
        boss.y += boss.vy * dt;
        CollisionSystem.handleWallBounce(engine, boss);
        return; // skip standard zombie path planning below
    }


}
