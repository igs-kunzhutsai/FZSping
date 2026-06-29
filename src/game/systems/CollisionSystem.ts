import * as InputSystem from './InputSystem';
import * as EffectSystem from './EffectSystem';
import * as EventSystem from './EventSystem';
import * as GameUtils from './GameUtils';
import * as SpawnSystem from './SpawnSystem';
import type { GameEngine } from '../GameEngine';
import { Entity, Top, Zombie, Item, Obstacle } from '../types';
import { getStandbyRadiusForModel } from '../topMovement';
import { resolveCollision, resolveCircleBoxCollision, resolveCircleTriangleCollision } from '../physics';
import { CANVAS_W, CANVAS_H, TOP_RADIUS, MAX_SPIN } from '../constants';
import { SoundSystem } from './SoundSystem';
import { ProbabilityManager } from './ProbabilityManager';

export function handleCollision(engine: GameEngine, a: Entity, b: Entity) {
    if ((a as Top).launchPadState !== undefined || (b as Top).launchPadState !== undefined) {
        return;
    }

    // Boss struggle charge clash trigger
    const isBossStruggleColliding = 
        (a.type === 'zombie_boss' && (a as any).bossAttackState === 'struggle_charge' && b.type === 'top' && (a as any).bossWarningTargetId === b.id) ||
        (b.type === 'zombie_boss' && (b as any).bossAttackState === 'struggle_charge' && a.type === 'top' && (b as any).bossWarningTargetId === a.id);
    if (isBossStruggleColliding) {
        const boss = (a.type === 'zombie_boss' ? a : b) as Zombie;
        const targetTop = (a.type === 'top' ? a : b) as Top;
        
        boss.bossAttackState = 'struggle_clash';
        boss.bossAttackTimer = 3.0; // Exactly 3 seconds intense wrestle event
        targetTop.struggleMashCount = 0;
        targetTop.struggleMashRequired = 8; // 8 mashes required (reduced by 50% for easier victory)
        boss.vx = 0; boss.vy = 0;
        targetTop.vx = 0; targetTop.vy = 0;
        
        // Anchor coordinates to ensure absolutely ZERO displacement (不會有位移)
        const dx = targetTop.x - boss.x;
        const dy = targetTop.y - boss.y;
        const clashAngle = Math.atan2(dy, dx);
        const targetDist = boss.radius + targetTop.radius - 5;
        
        (boss as any).struggleAnchorX = boss.x;
        (boss as any).struggleAnchorY = boss.y;
        (boss as any).struggleClashAngle = clashAngle;
        (targetTop as any).struggleAnchorX = boss.x + Math.cos(clashAngle) * targetDist;
        (targetTop as any).struggleAnchorY = boss.y + Math.sin(clashAngle) * targetDist;
        
        // Apply anchor values immediately to stay locked in contact
        boss.x = (boss as any).struggleAnchorX;
        boss.y = (boss as any).struggleAnchorY;
        targetTop.x = (targetTop as any).struggleAnchorX;
        targetTop.y = (targetTop as any).struggleAnchorY;
        
        engine.screenShakeTimer = 1.0;
        engine.screenShakeIntensity = 8;
        return; // Skip standard physics collision resolution completely!
    }

    // If either entity is in approaching/clinging zombie siege, skip collision response completely
    if (engine.zombieSiegeActive && (engine.siegeStatus === 'approaching' || engine.siegeStatus === 'clinging')) {
        if ((a as any).isSiegeZombie || (b as any).isSiegeZombie) return;
    }

    // If either entity is in deadlock, skip collision response completely
    if (a.deadlockTimer !== undefined && a.deadlockTimer > 0) return;
    if (b.deadlockTimer !== undefined && b.deadlockTimer > 0) return;

    // Player Top vs Boss deadlock standoff
    const isPlayerTopVsBoss = (a.type === 'top' && b.type === 'zombie_boss' && !(a as Top).isAI && (a as Top).state === 'dash') ||
                              (b.type === 'top' && a.type === 'zombie_boss' && !(b as Top).isAI && (b as Top).state === 'dash');
    if (isPlayerTopVsBoss) {
        const top = (a.type === 'top' ? a : b) as Top;
        const boss = (a.type === 'zombie_boss' ? a : b) as Zombie;

        const isSuper = top.superTimer !== undefined && top.superTimer > 0;
        const hasCooldown = top.deadlockCooldownTimer !== undefined && top.deadlockCooldownTimer > 0;

        if (!top.deadlockTimer && !boss.deadlockTimer && !isSuper && !hasCooldown) {
            // Initialize deadlock standoff (0.1 seconds duration)
            top.deadlockPartnerId = boss.id;
            boss.deadlockPartnerId = top.id;
            top.deadlockTimer = 0.1;
            boss.deadlockTimer = 0.1;

            // Freeze them exactly at their collision positions (before physical bouncy resolution)
            top.deadlockX = top.x;
            top.deadlockY = top.y;
            boss.deadlockX = boss.x;
            boss.deadlockY = boss.y;

            top.vx = 0; top.vy = 0;
            boss.vx = 0; boss.vy = 0;

            // High intensity gold & orange standoff sparks!
            EffectSystem.addParticles(engine, (top.x + boss.x) / 2, (top.y + boss.y) / 2, '#fbbf24', 40, 200, 10);
            EffectSystem.addParticles(engine, (top.x + boss.x) / 2, (top.y + boss.y) / 2, '#f97316', 20, 150, 8);
            return;
        }
    }

    // Deadlock Standoff (僵持 0.25 秒) trigger for top vs top
    if (a.type === 'top' && b.type === 'top') {
        const ta = a as Top;
        const tb = b as Top;
        const gridA = Math.max(1, Math.min(10, Math.floor((ta.spin ?? MAX_SPIN) / (ta.maxSpin ?? MAX_SPIN) * 10)));
        const gridB = Math.max(1, Math.min(10, Math.floor((tb.spin ?? MAX_SPIN) / (tb.maxSpin ?? MAX_SPIN) * 10)));
        const gridDiff = Math.abs(gridA - gridB);

        const isSuperA = ta.superTimer !== undefined && ta.superTimer > 0;
        const isSuperB = tb.superTimer !== undefined && tb.superTimer > 0;
        const hasCooldownA = ta.deadlockCooldownTimer !== undefined && ta.deadlockCooldownTimer > 0;
        const hasCooldownB = tb.deadlockCooldownTimer !== undefined && tb.deadlockCooldownTimer > 0;

        const isBothDashing = ta.state === 'dash' && tb.state === 'dash';

        const speedA = Math.hypot(ta.vx, ta.vy);
        const speedB = Math.hypot(tb.vx, tb.vy);
        const isMovingA = speedA > 50;
        const isMovingB = speedB > 50;
        
        let isHeadOn = false;
        if (isMovingA && isMovingB) {
            const dx = tb.x - ta.x;
            const dy = tb.y - ta.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
                const nx = dx / dist;
                const ny = dy / dist;
                const dirAx = ta.vx / speedA;
                const dirAy = ta.vy / speedA;
                const dirBx = tb.vx / speedB;
                const dirBy = tb.vy / speedB;
                
                const dotA = dirAx * nx + dirAy * ny;
                const dotB = dirBx * (-nx) + dirBy * (-ny);
                
                // 0.5 means within 60 degrees. Both tops are roughly facing the collision point.
                if (dotA > 0.5 && dotB > 0.5) {
                    isHeadOn = true;
                }
            }
        }

        const shouldClash = isBothDashing || (isMovingA && isMovingB && isHeadOn);

        if (engine.gameMode === 'versus' && shouldClash && gridDiff <= 3 && !ta.deadlockTimer && !tb.deadlockTimer && !isSuperA && !isSuperB && !hasCooldownA && !hasCooldownB) {
            const midX = (ta.x + tb.x) / 2;
            const midY = (ta.y + tb.y) / 2;

            const dxA = ta.x - midX;
            const dyA = ta.y - midY;
            const angleA = Math.atan2(dyA, dxA) || 0;

            // 【發動陀螺共鬥（角力）狀態】：將兩者鎖定在 standoff 狀態中
            ta.coopState = {
                partnerId: tb.id,
                centerX: midX,
                centerY: midY,
                cycle: 1,
                phase: 'standoff',
                timer: 0.08,
                startAngle: angleA,
                isLeader: true,
                coopSpinCount: 0
            };

            tb.coopState = {
                partnerId: ta.id,
                centerX: midX,
                centerY: midY,
                cycle: 1,
                phase: 'standoff',
                timer: 0.08,
                startAngle: angleA + Math.PI,
                isLeader: false,
                coopSpinCount: 0
            };
            return;
        }
    }

    // Special logic for items/obstacles
    if (a.type === 'item_key' || b.type === 'item_key') {
        const top = a.type === 'top' ? a as Top : (b.type === 'top' ? b as Top : null);
        const key = a.type === 'item_key' ? a as Item : (b.type === 'item_key' ? b as Item : null);
        if (top && key && !key.markForDeletion && key.targetPlayerId !== 'ui_keys') {
            key.targetPlayerId = 'ui_keys';
            key.hoverTimer = 0; // Don't hover, fly immediately
            
            // Celebration particles for key
            EffectSystem.addParticles(engine, key.x, key.y, '#eab308', 20, 200, 6);
        }
        return; // Key doesn't stop movement
    }

    if (a.type === 'item_crate' || b.type === 'item_crate') {
        const top = a.type === 'top' ? a as Top : (b.type === 'top' ? b as Top : null);
        const crate = a.type === 'item_crate' ? a : (b.type === 'item_crate' ? b : null);
        if (top && crate && !crate.markForDeletion) {
            // Activate 6-second "Super State" instead of recovering HP
            top.superTimer = 6;
            
            crate.markForDeletion = true;
            
            // Spawn beautiful colorful celebration particles!
            const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
            colors.forEach(col => {
                EffectSystem.addParticles(engine, crate.x, crate.y, col, 10, 350, 8);
            });
        }
        return; // Crate doesn't stop movement
    }
    
    // Standard Elastic Collision
    const res = resolveCollision(a, b, 1.2); // bouncy
    
    if (res) {
        // Skip damage if any top is in dead state
        const aIsDeadTop = a.type === 'top' && (a as any).isDeadState;
        const bIsDeadTop = b.type === 'top' && (b as any).isDeadState;

        if (!aIsDeadTop && !bIsDeadTop) {
            // Check for Top vs Zombie contact/touch damage or attack on any overlap event
            if (a.type === 'top' && b.type.startsWith('zombie')) hitZombie(engine, a as Top, b as Zombie, res.impactForce);
            if (b.type === 'top' && a.type.startsWith('zombie')) hitZombie(engine, b as Top, a as Zombie, res.impactForce);
        }

        if (res.impactForce > 50) {
        // Apply damage based on type
        if (a.type === 'top' && b.type === 'top') {
            const ta = a as Top; const tb = b as Top;
            const isDashA = ta.state === 'dash';
            const isDashB = tb.state === 'dash';
            
            if (engine.gameMode === 'campaign') {
                // In campaign mode, player tops do not deal damage to each other.
                // Just spawn standard yellow collision sparks.
                EffectSystem.addChainsawSparkParticles(engine, ta.x + res.nx*ta.radius, ta.y + res.ny*ta.radius, res.nx, res.ny, 25, 1.0, Math.max(ta.spin || 0, tb.spin || 0));
            } else if (!isDashA && !isDashB) {
                // 兩者皆無衝刺，則不造成 HP 削減，僅產生火花
                EffectSystem.addChainsawSparkParticles(engine, ta.x + res.nx*ta.radius, ta.y + res.ny*ta.radius, res.nx, res.ny, 25, 1.0, Math.max(ta.spin || 0, tb.spin || 0));
            } else {
                // 陀螺改成只有被對手陀螺用衝刺衝撞時，才會削減耐久值
                let targetToDamage: Top | null = null;
                let attacker: Top | null = null;

                if (isDashA && !isDashB) {
                    targetToDamage = tb;
                    attacker = ta;
                } else if (!isDashA && isDashB) {
                    targetToDamage = ta;
                    attacker = tb;
                } else if (isDashA && isDashB) {
                    // 雙方皆處與衝刺狀態，則轉速低的那方被撞開且受傷
                    if (ta.spin >= tb.spin) {
                        targetToDamage = tb;
                        attacker = ta;
                    } else {
                        targetToDamage = ta;
                        attacker = tb;
                    }
                }

                if (targetToDamage && attacker) {
                    if ((targetToDamage as any).isDeadState || (attacker as any).isDeadState) {
                        // Just spark and bounce
                        EffectSystem.addChainsawSparkParticles(engine, targetToDamage.x - res.nx * targetToDamage.radius, targetToDamage.y - res.ny * targetToDamage.radius, res.nx, res.ny, 15, 1.0, Math.max(targetToDamage.spin || 0, attacker.spin || 0));
                    } else if (targetToDamage.superTimer !== undefined && targetToDamage.superTimer > 0) {
                        // Target is in Super State (Invincible!)
                        // Just spawn defensive high-energy golden particles and skip hp deduction or dash cancelling
                        EffectSystem.addChainsawSparkParticles(engine, targetToDamage.x, targetToDamage.y, res.nx, res.ny, 30, 1.0, Math.max(targetToDamage.spin || 0, attacker.spin || 0));
                        EffectSystem.addParticles(engine, targetToDamage.x, targetToDamage.y, '#fbbf24', 25, res.impactForce, 10);
                    } else if (targetToDamage.hitCooldown === undefined || targetToDamage.hitCooldown <= 0) {
                        const baseDmg = Math.min(10, Math.max(1, Math.floor((attacker.spin / MAX_SPIN) * 6 + (res.impactForce / 200) * 4)));
                        const dmg = Math.round(baseDmg * GameUtils.getTopScale(engine, attacker));
                        targetToDamage.hp -= 1;
                        targetToDamage.hitCooldown = 1.0; // 1-second invulnerability protection
                        targetToDamage.flashTimer = 0.15; // Set flash timer to 150ms
                        EffectSystem.addChainsawSparkParticles(engine, targetToDamage.x - res.nx * targetToDamage.radius, targetToDamage.y - res.ny * targetToDamage.radius, res.nx, res.ny, 30, 1.0, Math.max(targetToDamage.spin || 0, attacker.spin || 0));
                        EffectSystem.addParticles(engine, targetToDamage.x, targetToDamage.y, '#ef4444', 25, res.impactForce);
                        
                        if (!attacker.isAI && attacker.spin >= 400) {
                            engine.screenShakeTimer = 0.9;
                            engine.screenShakeIntensity = 12;
                            engine.screenShakeMaxDuration = 0.9;
                        }

                        // Cancel dash state on the damaged/loser top so it bounces correctly using impulse velocities
                        if (targetToDamage.state === 'dash') {
                            targetToDamage.state = 'standby';
                            targetToDamage.dashTimer = 0;
                        }
                    }
                    
                    if (targetToDamage.hp <= 0 && !targetToDamage.markForDeletion) {
                        const matchAttacker = attacker.id.match(/\d+/);
                        if (matchAttacker) {
                            const idx = parseInt(matchAttacker[0], 10);
                            engine.addScore(idx, 150); // 擊倒對手加 150 分
                            if (engine.gameMode === 'versus') {
                                attacker.kills = (attacker.kills ?? 0) + 1;
                                const part = engine.participants.find(p => p.id === attacker.id);
                                if (part) {
                                    part.kills = attacker.kills;
                                }
                            }
                        }
                    }
                }
            }
        } 
        else if (a.type === 'obstacle_barrel' || b.type === 'obstacle_barrel') {
            const barrel = (a.type === 'obstacle_barrel' ? a : b) as Obstacle;
            const other = a.type === 'obstacle_barrel' ? b : a;
            
            // If a zombie/monster touches the explosive barrel, it does not trigger any explosion
            if (other.type.startsWith('zombie')) {
                return;
            }
            
            if (barrel.durability === undefined) {
                barrel.durability = 1;
            }
            barrel.durability--;
            barrel.flashTimer = 0.15; // Set flash timer to 150ms
            
            if (barrel.durability <= 0) {
                barrel.markForDeletion = true;
                SoundSystem.play('SE-Explo1');
                EffectSystem.addParticles(engine, barrel.x, barrel.y, '#ef4444', 50, 400, 15);

                // Dual ring expanding circular shockwave effect (vibrant red & glowing hot orange)
                engine.shockwaves.push({
                    x: barrel.x,
                    y: barrel.y,
                    radius: 10,
                    maxRadius: 180,
                    speed: 400,
                    color: 'rgba(239, 68, 68, 0.95)',
                    thickness: 12,
                    life: 0.45,
                    maxLife: 0.45
                });
                engine.shockwaves.push({
                    x: barrel.x,
                    y: barrel.y,
                    radius: 5,
                    maxRadius: 130,
                    speed: 300,
                    color: 'rgba(251, 146, 60, 0.85)',
                    thickness: 6,
                    life: 0.4,
                    maxLife: 0.4
                });
                // Massive hit to the other
                if (other.type === 'top') {
                    const topOther = other as Top;
                    
                    // 玩家陀螺碰到炸彈道具時(即使是陀螺衝刺中)，玩家陀螺要會被扣血
                    const isInvulnerable = (topOther.superTimer !== undefined && topOther.superTimer > 0) || (topOther.breakoutOrbitTimer !== undefined && topOther.breakoutOrbitTimer > 0) || (topOther as any).isDeadState;
                    if (isInvulnerable) {
                        // Invincible! Just spawn golden protective sparks and don't deduct HP
                        EffectSystem.addParticles(engine, topOther.x, topOther.y, '#fbbf24', 25, 300, 10);
                    } else {
                        const damage = 5; // Deduct 5 HP (Changed to 5 points damage)
                        if (topOther.hitCooldown === undefined || topOther.hitCooldown <= 0) {
                            topOther.hp = Math.max(0, topOther.hp - damage);
                            SoundSystem.play('SE-Hurt1');
                            topOther.hitCooldown = 1.0; // 1 second protection
                            topOther.flashTimer = 0.25;
                            topOther.damageShockTimer = 0.45;
                            topOther.hpLossTimer = 0.5;
                            topOther.visualHp = topOther.visualHp !== undefined ? Math.max(topOther.hp, topOther.visualHp) : topOther.hp;
                            
                            // Add some explosive particles on player
                            EffectSystem.addParticles(engine, topOther.x, topOther.y, '#ef4444', 25, 300, 10);
                        }

                        // Calculate explicit high-power directional bounce vectors pointing away from the bomb barrel
                        const bounceDx = topOther.x - barrel.x;
                        const bounceDy = topOther.y - barrel.y;
                        const bounceDist = Math.hypot(bounceDx, bounceDy) || 1;
                        const bounceNx = bounceDx / bounceDist;
                        const bounceNy = bounceDy / bounceDist;
                        
                        const bounceForce = 1500; // Strong and satisfying physical knockback speed
                        const baseVx = bounceNx * bounceForce;
                        const baseVy = bounceNy * bounceForce;
                        
                        // Apply custom ±15 deg random rotation modification to explosive barrel blast bounces
                        const bounceAngle = (Math.random() < 0.5 ? 15 : -15) * Math.PI / 180;
                        const bCos = Math.cos(bounceAngle);
                        const bSin = Math.sin(bounceAngle);
                        
                        topOther.vx = baseVx * bCos - baseVy * bSin;
                        topOther.vy = baseVx * bSin + baseVy * bCos;

                        // 如果陀螺正處於衝刺狀態，則取消衝刺並被炸彈爆炸反彈
                        if (topOther.state === 'dash') {
                            topOther.state = 'standby';
                            topOther.dashTimer = 0;
                            
                            const velocityAngle = Math.atan2(topOther.vy, topOther.vx);
                            topOther.standbyAngle = velocityAngle + Math.PI / 2;
                            topOther.standbyCenterX = topOther.x - Math.cos(topOther.standbyAngle) * getStandbyRadiusForModel(topOther, this,  topOther.standbyAngle);
                            topOther.standbyCenterY = topOther.y - Math.sin(topOther.standbyAngle) * getStandbyRadiusForModel(topOther, this,  topOther.standbyAngle);
                        }

                        // Force the standby orbital center of the top to slide back beautifully under high physical friction
                        if (topOther.state === 'standby') {
                            topOther.standbyCenterVx = topOther.vx;
                            topOther.standbyCenterVy = topOther.vy;
                        }
                    }
                } else if (other.type.startsWith('zombie')) {
                    const isBoss_Inv = other.type === 'zombie_boss' && ((other as Zombie).bossAttackState === 'warning' || (other as Zombie).bossAttackState === 'dash');
                    if (!isBoss_Inv && !((other as Zombie) as any).isSiegeZombie) {
                        (other as Zombie).hp -= 1000; // Instakill other zombies
                    }
                }
            } else {
                // Create some sparks on standard bounce/impact - reduced quantity and range by half
                EffectSystem.addParticles(engine, barrel.x, barrel.y, '#f97316', 8, res.impactForce * 0.25, 6);
            }
        }
    }
}
}

export function hitZombie(engine: GameEngine, top: Top, z: Zombie, impact: number) {
    if ((z as any).isSiegeZombie) {
        return;
    }
    if (top.skillActiveTimer !== undefined && top.skillActiveTimer > 0) {
        return;
    }
    
    const isClientControlling = !top.isAI && top.controls;
    let isActivelyPushing = false;
    if (isClientControlling) {
        let inputX = 0;
        let inputY = 0;
        if (engine.keys.has(top.controls.up)) inputY -= 1;
        if (engine.keys.has(top.controls.down)) inputY += 1;
        if (engine.keys.has(top.controls.left)) inputX -= 1;
        if (engine.keys.has(top.controls.right)) inputX += 1;
        if (inputX !== 0 || inputY !== 0) {
            isActivelyPushing = true;
        }
    }
    const isCurrentlyDashing = top.state === 'dash' || isActivelyPushing;

    // 如果是僵屍碰觸陀螺造成傷害，碰觸一次傷害1點，攻擊判定觸發的頻率是0.5秒一次，衝撞狀態 (state === 'dash') 則免疫傷
    if ((z.type === 'zombie_small' || z.type === 'zombie_big' || z.type === 'zombie_bomb') && !top.isExploding && !isCurrentlyDashing) {
        const isSuper = (top.superTimer !== undefined && top.superTimer > 0) || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0);
        if (!isSuper) {
            if (top.hitCooldown === undefined || top.hitCooldown <= 0) {
                SoundSystem.play('SE-Hurt1');
                top.hitCooldown = 1.0; // 1-second invulnerability protection
                top.smallZombieHitCooldown = 1.0;

                top.flashTimer = 0.15;
                top.damageShockTimer = 0.25;
                top.hpLossTimer = 0.5;
                top.visualHp = top.visualHp !== undefined ? Math.max(top.hp, top.visualHp) : top.hp;

                const midX = (top.x + z.x) / 2;
                const midY = (top.y + z.y) / 2;

                // 移除紅色粒子噴發特效，改為只產生顯著、清晰的三條爪痕特效
                // EffectSystem.addParticles(engine, midX, midY, '#ef4444', 15, 180, 5);

                // Spawn the 3 parallel claw scratch effect lines (enlarged and prolonged for maximum impact)
                const slashAngle = -Math.PI / 4 + (Math.random() * 0.4 - 0.2);
                engine.particles.push({
                    x: midX,
                    y: midY,
                    vx: Math.cos(slashAngle) * 40,
                    vy: Math.sin(slashAngle) * 40,
                    life: 0.38,
                    maxLife: 0.38,
                    color: '#dc2626',
                    size: 75,
                    isClawScratch: true,
                    clawAngle: slashAngle
                } as any);

                // 陀螺待機繞圈時，若不是處於按下加速鍵的狀態，則型塑短距離的碰撞偏移物理反映
                if (top.state === 'standby' && !top.isSpinning) {
                    const dx = z.x - top.x;
                    const dy = z.y - top.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    const nx = dx / dist;
                    const ny = dy / dist;

                    const tx = -ny;
                    const ty = nx;

                    const dirVx = -nx * 0.8 + tx * 0.3;
                    const dirVy = -ny * 0.8 + ty * 0.3;

                    // 在高轉速/大繞圈軌道下，將偏移力道與滑行速度顯著放大，以呈現明顯被撞偏離軌道的視覺效果
                    const spinRatio = (top.spin ?? MAX_SPIN) / MAX_SPIN;
                    const spinMultiplier = 1.0 + spinRatio * 3.0; // 高轉速時偏移增強達4.0倍

                    // Accelerate standby center knockback & deflection rebound speed by 50% for hits on enemy (multiplied by 1.5)
                    const kbPower = 640 * spinMultiplier * 1.5;
                    top.standbyCenterVx = (top.standbyCenterVx || 0) + dirVx * kbPower;
                    top.standbyCenterVy = (top.standbyCenterVy || 0) + dirVy * kbPower;

                    top.deflectionVx = (top.deflectionVx || 0) + dirVx * 150 * spinMultiplier * 1.5;
                    top.deflectionVy = (top.deflectionVy || 0) + dirVy * 150 * spinMultiplier * 1.5;
                    top.bounceTimer = 0.3;
                    top.maxBounceTimer = 0.3;
                }
            }
        }
    }

    // Handle boss invincible states (warning and dash attack states) - Check before non-spinning return!
    if (z.type === 'zombie_boss') {
        const boss = z as any;
        if (boss.bossAttackState === 'warning' || boss.bossAttackState === 'dash' || boss.bossAttackState === 'earthquake_leap' || (boss.introZ !== undefined && boss.introZ > 0)) {
            const dx = top.x - z.x;
            const dy = top.y - z.y;
            const dist = Math.hypot(dx, dy) || 1;
            const nx = dx / dist;
            const ny = dy / dist;

            // Boss is invincible! Do not subtract HP and do not apply standard bounce/decay.
            const isDash = boss.bossAttackState === 'dash';
            
            if (isDash) {
                // Apply 1 point damage to player or AI top immediately with hit cooldown protection (laser beam state)
                if (top.hitCooldown === undefined || top.hitCooldown <= 0) {
                    const isInvulnerable = (top.superTimer !== undefined && top.superTimer > 0) || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0);
                    if (!isInvulnerable) {
                        SoundSystem.play('SE-Hurt1');
                        top.hitCooldown = 1.0; // 1 second invincibility protection frame!
                        top.flashTimer = 0.25;
                        top.damageShockTimer = 0.45;
                        top.hpLossTimer = 0.5;
                        top.visualHp = top.visualHp !== undefined ? Math.max(top.hp, top.visualHp) : top.hp;
                        EffectSystem.addChainsawSparkParticles(engine, top.x, top.y, -nx, -ny, 30);
                        EffectSystem.addParticles(engine, top.x, top.y, '#ef4444', 35, 450, 10);
                    } else {
                        EffectSystem.addChainsawSparkParticles(engine, top.x, top.y, -nx, -ny, 30);
                        EffectSystem.addParticles(engine, top.x, top.y, '#fbbf24', 25, 300, 10);
                    }
                }
                // Shake screen (only for AI tops)
                if (top.isAI) {
                    engine.screenShakeTimer = 0.8;
                }
            } else {
                // Warning state: spawn defensive orange warnings/sparks on contacting the heavy charging wall
                EffectSystem.addChainsawSparkParticles(engine, top.x, top.y, -nx, -ny, 18);
                EffectSystem.addParticles(engine, top.x, top.y, '#f59e0b', 20, 200, 6);
            }

            // Push the player top back (extremely strong during dash, moderate during warning setup) - Accelerated 50%
            const bounceForce = (isDash ? 1500 : 750) * 1.5;
            
            top.vx = nx * bounceForce;
            top.vy = ny * bounceForce;

            if (top.state === 'dash') {
                const origDx = top.dashDirectionX ?? 0;
                const origDy = top.dashDirectionY ?? 0;

                // Reflect the dash vector against rebound normal (nx, ny) pointing away from the Boss
                const dotDash = (top.dashDirectionX || 0) * nx + (top.dashDirectionY || 0) * ny;
                if (dotDash < 0) { // moving towards the boss
                    top.dashDirectionX = (top.dashDirectionX || 0) - 2 * dotDash * nx;
                    top.dashDirectionY = (top.dashDirectionY || 0) - 2 * dotDash * ny;
                }

                // Apply exact ±15 deg random rotation modification to the reflected dash direction vector
                const bounceAngle = (Math.random() < 0.5 ? 15 : -15) * Math.PI / 180;
                const bCos = Math.cos(bounceAngle);
                const bSin = Math.sin(bounceAngle);
                const rDx = (top.dashDirectionX ?? 0) * bCos - (top.dashDirectionY ?? 0) * bSin;
                const rDy = (top.dashDirectionX ?? 0) * bSin + (top.dashDirectionY ?? 0) * bCos;

                // Carry original dash direction's inertia/momentum (blend original with rebound)
                const blendFactor = 0.45;
                const fusedDx = origDx * blendFactor + rDx * (1 - blendFactor);
                const fusedDy = origDy * blendFactor + rDy * (1 - blendFactor);
                const fusedLen = Math.hypot(fusedDx, fusedDy) || 1;
                top.dashDirectionX = fusedDx / fusedLen;
                top.dashDirectionY = fusedDy / fusedLen;

                // Keep dynamic velocity consistent during dash deflection - Accelerated 50%
                const maxDur = top.maxDashDuration ?? 1.0;
                const ratio = Math.max(0, Math.min(1, (top.dashTimer ?? 0) / maxDur));
                let dashSpeed = (400 + 1200 * Math.pow(ratio, 2.0)) * 1.5;
                if ((top as any).dashIsGrid2To10) {
                    dashSpeed *= 2.0;
                }
                top.vx = (top.dashDirectionX ?? 0) * dashSpeed;
                top.vy = (top.dashDirectionY ?? 0) * dashSpeed;
            }
            if (top.state === 'standby') {
                top.standbyCenterVx = nx * bounceForce;
                top.standbyCenterVy = ny * bounceForce;
            }
            return; // Absolutely bypass normal hit logic
        }
    }

    // Handle big zombie invincible states (warning and dash attack states) - Check before non-spinning return!
    if (z.type === 'zombie_big') {
        const big = z as any;
        if (big.bigAttackState === 'warning' || big.bigAttackState === 'dash' || big.bigAttackState === 'earthquake_leap') {
            const dx = top.x - z.x;
            const dy = top.y - z.y;
            const dist = Math.hypot(dx, dy) || 1;
            const nx = dx / dist;
            const ny = dy / dist;

            // Big Zombie is invulnerable during its warning charge and active dash states!
            const isDash = big.bigAttackState === 'dash';
            
            if (isDash) {
                // Apply 1 point damage to player or AI top immediately with hit cooldown protection (laser beam state)
                if (top.hitCooldown === undefined || top.hitCooldown <= 0) {
                    const isInvulnerable = (top.superTimer !== undefined && top.superTimer > 0) || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0);
                    if (!isInvulnerable) {
                        SoundSystem.play('SE-Hurt1');
                        top.hitCooldown = 0.8; // 0.8 seconds protection frame
                        top.flashTimer = 0.25;
                        top.damageShockTimer = 0.45;
                        top.hpLossTimer = 0.5;
                        top.visualHp = top.visualHp !== undefined ? Math.max(top.hp, top.visualHp) : top.hp;
                        EffectSystem.addChainsawSparkParticles(engine, top.x, top.y, -nx, -ny, 25);
                        EffectSystem.addParticles(engine, top.x, top.y, '#9333ea', 25, 350, 8); // cyber purple sparks
                    } else {
                        EffectSystem.addChainsawSparkParticles(engine, top.x, top.y, -nx, -ny, 25);
                        EffectSystem.addParticles(engine, top.x, top.y, '#fbbf24', 15, 250, 6); // gold sparks on super top
                    }
                }
                // Shake screen slightly (only for AI tops)
                if (top.isAI) {
                    engine.screenShakeTimer = 0.5;
                }
            } else {
                // Warning state: spawn defensive purple sparks on contacting heavy charging wall
                EffectSystem.addChainsawSparkParticles(engine, top.x, top.y, -nx, -ny, 15);
                EffectSystem.addParticles(engine, top.x, top.y, '#c084fc', 12, 180, 5);
            }

            // Push the player top back - Accelerated 50%
            const bounceForce = (isDash ? 1100 : 550) * 1.5;
            
            top.vx = nx * bounceForce;
            top.vy = ny * bounceForce;

            if (top.state === 'dash') {
                const origDx = top.dashDirectionX ?? 0;
                const origDy = top.dashDirectionY ?? 0;

                // Reflect the dash vector against rebound normal (nx, ny) pointing away from the Big Zombie
                const dotDash = (top.dashDirectionX || 0) * nx + (top.dashDirectionY || 0) * ny;
                if (dotDash < 0) { // moving towards the big zombie
                    top.dashDirectionX = (top.dashDirectionX || 0) - 2 * dotDash * nx;
                    top.dashDirectionY = (top.dashDirectionY || 0) - 2 * dotDash * ny;
                }

                // Apply exact ±15 deg random rotation modification to the reflected dash direction vector
                const bounceAngle = (Math.random() < 0.5 ? 15 : -15) * Math.PI / 180;
                const bCos = Math.cos(bounceAngle);
                const bSin = Math.sin(bounceAngle);
                const rDx = (top.dashDirectionX ?? 0) * bCos - (top.dashDirectionY ?? 0) * bSin;
                const rDy = (top.dashDirectionX ?? 0) * bSin + (top.dashDirectionY ?? 0) * bCos;

                // Carry original dash direction's inertia/momentum (blend original with rebound)
                const blendFactor = 0.45;
                const fusedDx = origDx * blendFactor + rDx * (1 - blendFactor);
                const fusedDy = origDy * blendFactor + rDy * (1 - blendFactor);
                const fusedLen = Math.hypot(fusedDx, fusedDy) || 1;
                top.dashDirectionX = fusedDx / fusedLen;
                top.dashDirectionY = fusedDy / fusedLen;

                // Keep dynamic velocity consistent during dash deflection - Accelerated 50%
                const maxDur = top.maxDashDuration ?? 1.0;
                const ratio = Math.max(0, Math.min(1, (top.dashTimer ?? 0) / maxDur));
                let dashSpeed = (400 + 1200 * Math.pow(ratio, 2.0)) * 1.5;
                if ((top as any).dashIsGrid2To10) {
                    dashSpeed *= 2.0;
                }
                top.vx = (top.dashDirectionX ?? 0) * dashSpeed;
                top.vy = (top.dashDirectionY ?? 0) * dashSpeed;
            }
            if (top.state === 'standby') {
                top.standbyCenterVx = nx * bounceForce;
                top.standbyCenterVy = ny * bounceForce;
            }
            return; // Absolutely bypass normal hit logic
        }
    }

    if (z.type === 'zombie_bouncing') {
        const bz = z as any;
        if (bz.bouncingAttackState === 'warning' || bz.bouncingAttackState === 'bouncing' || bz.bouncingAttackState === 'death_warning' || bz.bouncingAttackState === 'death_bouncing') {
            const dx = top.x - z.x;
            const dy = top.y - z.y;
            const dist = Math.hypot(dx, dy) || 1;
            const nx = dx / dist;
            const ny = dy / dist;

            // Bouncing zombie is invulnerable when attacking
            EffectSystem.addChainsawSparkParticles(engine, top.x, top.y, -nx, -ny, 15);
            EffectSystem.addParticles(engine, top.x, top.y, '#f472b6', 12, 180, 5);

            const bounceForce = 550 * 1.5;
            top.vx = nx * bounceForce;
            top.vy = ny * bounceForce;

            if (top.state === 'dash') {
                const origDx = top.dashDirectionX ?? 0;
                const origDy = top.dashDirectionY ?? 0;

                const dotDash = (top.dashDirectionX || 0) * nx + (top.dashDirectionY || 0) * ny;
                if (dotDash < 0) {
                    top.dashDirectionX = (top.dashDirectionX || 0) - 2 * dotDash * nx;
                    top.dashDirectionY = (top.dashDirectionY || 0) - 2 * dotDash * ny;
                }

                const bounceAngle = (Math.random() < 0.5 ? 15 : -15) * Math.PI / 180;
                const bCos = Math.cos(bounceAngle);
                const bSin = Math.sin(bounceAngle);
                const rDx = (top.dashDirectionX ?? 0) * bCos - (top.dashDirectionY ?? 0) * bSin;
                const rDy = (top.dashDirectionX ?? 0) * bSin + (top.dashDirectionY ?? 0) * bCos;

                const blendFactor = 0.45;
                const fusedDx = origDx * blendFactor + rDx * (1 - blendFactor);
                const fusedDy = origDy * blendFactor + rDy * (1 - blendFactor);
                const fusedLen = Math.hypot(fusedDx, fusedDy) || 1;
                top.dashDirectionX = fusedDx / fusedLen;
                top.dashDirectionY = fusedDy / fusedLen;

                const maxDur = top.maxDashDuration ?? 1.0;
                const ratio = Math.max(0, Math.min(1, (top.dashTimer ?? 0) / maxDur));
                let dashSpeed = (400 + 1200 * Math.pow(ratio, 2.0)) * 1.5;
                if ((top as any).dashIsGrid2To10) {
                    dashSpeed *= 2.0;
                }
                top.vx = (top.dashDirectionX ?? 0) * dashSpeed;
                top.vy = (top.dashDirectionY ?? 0) * dashSpeed;
            }
            if (top.state === 'standby') {
                top.standbyCenterVx = nx * bounceForce;
                top.standbyCenterVy = ny * bounceForce;
            }
            return;
        }
    }

    // 如果陀螺繞行時，若沒有處於按下加速的狀態且沒有移動輸入，則陀螺不具有碰撞攻擊效果與傷害
    if (top.state === 'standby' && !top.isSpinning && !isActivelyPushing) {
        return;
    }

    if (z.hitCooldown !== undefined && z.hitCooldown > 0) {
        return;
    }
    const isBoss = z.type === 'zombie_boss';
    
    if (isBoss && (z as any).bossAttackState === 'warning' && (z as any).weakCornerIndex !== undefined) {
        const shieldRot = (Date.now() / 250) % (Math.PI * 2);
        const shieldRad = 202.5 + 7.5 * Math.sin(Date.now() / 90);
        const theta = ((z as any).weakCornerIndex * Math.PI) / 3;
        const ox = shieldRad * Math.cos(theta);
        const oy = shieldRad * Math.sin(theta);
        
        const rotatedX = ox * Math.cos(shieldRot) - oy * Math.sin(shieldRot);
        const rotatedY = ox * Math.sin(shieldRot) + oy * Math.cos(shieldRot);
        const weakX = z.x + rotatedX;
        const weakY = z.y + rotatedY;
        
        const distToWeak = Math.hypot(top.x - weakX, top.y - weakY);
        if (distToWeak <= top.radius + 35) { // 35px hit radius for the triangle
            if (Math.random() < 0.25) { // 1/4 chance to break
                (z as any).bossAttackState = 'idle';
                (z as any).bossNextAttackTime = 3.0;
                (z as any).weakCornerIndex = undefined;
                
                const kbPower = 1800;
                const kbX = top.x - z.x;
                const kbY = top.y - z.y;
                const kbDist = Math.hypot(kbX, kbY) || 1;
                z.vx = -(kbX / kbDist) * kbPower;
                z.vy = -(kbY / kbDist) * kbPower;
                z.hitByDash = true;
                z.knockbackSpeedStart = kbPower;
                z.bounceTimer = 0.9;
                z.maxBounceTimer = 0.9;
                
                EffectSystem.addParticles(engine, weakX, weakY, '#ef4444', 30, 400, 10);
                EffectSystem.addParticles(engine, weakX, weakY, '#facc15', 20, 300, 8);
                engine.screenShakeTimer = 0.8;
                engine.screenShakeIntensity = 15;
                
                // Keep top momentum
                return;
            }
        }
    }

    z.hitCooldown = isBoss ? 1.0 : 0.25; // Boss enters 1 second invincibility when injured, others have 250ms

    // Trigger extreme "Hit-stop / Hit-lag" (卡肉感頓點) and Proportional Screen Shake based on zombie class/size
    if (isBoss) {
        engine.hitStopTimer = 0.09; // 0.09s heavy boss hit-lag
        engine.screenShakeTimer = 0.35;
        engine.screenShakeIntensity = 32;
        engine.screenShakeMaxDuration = 0.35;
    } else if (z.type === 'zombie_big' || z.type === 'zombie_bomb' || z.type === 'zombie_bouncing') {
        engine.hitStopTimer = 0.06; // 0.06s solid big zombie hit-lag
        engine.screenShakeTimer = 0.25;
        engine.screenShakeIntensity = 18;
        engine.screenShakeMaxDuration = 0.25;
    } else {
        engine.hitStopTimer = 0.03; // 0.03s quick small zombie hit-lag
        engine.screenShakeTimer = 0.12;
        engine.screenShakeIntensity = 7;
        engine.screenShakeMaxDuration = 0.12;
    }

    // Calculate lateral brushing deflection for the top to simulate sliding past
    const dx = z.x - top.x;
    const dy = z.y - top.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    // Apply a gentle curve offset with high fidelity physics
    const isDashing = top.state === 'dash';
    const killsZombie = isDashing && (z.hp - 1 * GameUtils.getTopScale(engine, top) <= 0);
    const isHighSpin = ((top.spin ?? 1000) / (top.maxSpin || 1000) * 10) >= 5.0;

    const baseDeflect = isDashing ? ((killsZombie || isHighSpin) ? 80 : 380) : ((killsZombie || isHighSpin) ? 60 : 180); // Minimal shock back on high spin or slice kills to maintain smooth forward momentum
    const deflectScale = Math.min(320, impact * 0.45);
    
    // Calculate low spin bounce boost (larger rebound reaction when spin speed is low)
    const spinRatio = (top.spin ?? MAX_SPIN) / MAX_SPIN;
    const lowSpinReboundBoost = 1.0 + Math.max(0, 1.0 - spinRatio) * 1.5; // up to 2.5x boost when spin is 0
    
    // Accelerate rebound process speed by 50% (multiplied by 1.5)
    const finalDeflectPower = (baseDeflect + deflectScale) * lowSpinReboundBoost * 1.5;

    // Calculate rebound vectors pointing directly away from the zombie (-nx, -ny)
    let reboundDirX = -nx;
    let reboundDirY = -ny;

    let rx = reboundDirX;
    let ry = reboundDirY;

    if (killsZombie || isHighSpin) {
        // Slide tangent to the collision normal corresponding to current movement flow
        const tx = -ny;
        const ty = nx;
        
        // Get current movement vector to determine slide direction
        let movX = 0;
        let movY = 0;
        if (isDashing) {
            movX = top.dashDirectionX ?? 0;
            movY = top.dashDirectionY ?? 0;
        } else {
            movX = top.vx || 0;
            movY = top.vy || 0;
        }
        if (movX === 0 && movY === 0 && top.inputAxes) {
            movX = top.inputAxes.x;
            movY = top.inputAxes.y;
        }
        if (movX === 0 && movY === 0) {
            movX = tx;
            movY = ty;
        }
        const dotT = movX * tx + movY * ty;
        const slideSign = dotT >= 0 ? 1 : -1;
        
        const driftX = tx * slideSign;
        const driftY = ty * slideSign;
        
        // Mix tangential movement with tiny outward nudge for separation
        rx = driftX * 0.90 + (-nx) * 0.10;
        ry = driftY * 0.90 + (-ny) * 0.10;
        const rLen = Math.hypot(rx, ry) || 1;
        rx /= rLen;
        ry /= rLen;
    } else {
        // Apply a small random angle variance of ±10 degrees for a beautiful organic physical response
        const bounceAngle = (Math.random() < 0.5 ? 10 : -10) * Math.PI / 180;
        const bCos = Math.cos(bounceAngle);
        const bSin = Math.sin(bounceAngle);
        rx = reboundDirX * bCos - reboundDirY * bSin;
        ry = reboundDirX * bSin + reboundDirY * bCos;
    }

    // If in dash state, also reflect the dash direction vector against the rebound normal (-nx, -ny)
    if (isDashing) {
        if (killsZombie || isHighSpin) {
            // Slicing movement vector: Bend dash direction into a smooth high-speed arc
            const tx = -ny;
            const ty = nx;
            const dotT = (top.dashDirectionX || 0) * tx + (top.dashDirectionY || 0) * ty;
            const slideSign = dotT >= 0 ? 1 : -1;
            const driftX = tx * slideSign;
            const driftY = ty * slideSign;
            
            // Form a curved path: mix original direction with tangential slide vector and tiny outward nudge
            let newDx = (top.dashDirectionX || 0) * 0.80 + driftX * 0.45 + (-nx) * 0.10;
            let newDy = (top.dashDirectionY || 0) * 0.80 + driftY * 0.45 + (-ny) * 0.10;
            
            const dLen = Math.hypot(newDx, newDy) || 1;
            top.dashDirectionX = newDx / dLen;
            top.dashDirectionY = newDy / dLen;
            
            // Maintain high dash speed for cutting effect
            const maxDur = top.maxDashDuration ?? 1.0;
            const ratio = Math.max(0, Math.min(1, (top.dashTimer ?? 0) / maxDur));
            let dashSpeed = 450 + 1250 * Math.pow(ratio, 2.0);
            if ((top as any).dashIsGrid2To10) {
                dashSpeed *= 2.0;
            }
            // Slow down the sideswipe speed by 30% to prevent too high speed displacement under killsZombie || isHighSpin
            dashSpeed *= 0.70;

            top.vx = (top.dashDirectionX ?? 0) * dashSpeed;
            top.vy = (top.dashDirectionY ?? 0) * dashSpeed;
        } else {
            const origDx = top.dashDirectionX ?? 0;
            const origDy = top.dashDirectionY ?? 0;

            // Reflect dashDirection against normal pointing from top to zombie (nx, ny)
            const dotDash = (top.dashDirectionX || 0) * nx + (top.dashDirectionY || 0) * ny;
            if (dotDash > 0) {
                top.dashDirectionX = (top.dashDirectionX || 0) - 2 * dotDash * nx;
                top.dashDirectionY = (top.dashDirectionY || 0) - 2 * dotDash * ny;
            }

            // Sync rotation of the reflected dash vector coordinates by ±15 degrees
            const dashBounceAngle = (Math.random() < 0.5 ? 15 : -15) * Math.PI / 180;
            const bCosD = Math.cos(dashBounceAngle);
            const bSinD = Math.sin(dashBounceAngle);
            const rDx = (top.dashDirectionX ?? 0) * bCosD - (top.dashDirectionY ?? 0) * bSinD;
            const rDy = (top.dashDirectionX ?? 0) * bSinD + (top.dashDirectionY ?? 0) * bCosD;

            // Carry original dash direction's inertia/momentum (blend original with rebound)
            const blendFactor = 0.45;
            const fusedDx = origDx * blendFactor + rDx * (1 - blendFactor);
            const fusedDy = origDy * blendFactor + rDy * (1 - blendFactor);
            const fusedLen = Math.hypot(fusedDx, fusedDy) || 1;
            top.dashDirectionX = fusedDx / fusedLen;
            top.dashDirectionY = fusedDy / fusedLen;

            // Keep dynamic velocity consistent during dash deflection - Accelerated 50%
            const maxDur = top.maxDashDuration ?? 1.0;
            const ratio = Math.max(0, Math.min(1, (top.dashTimer ?? 0) / maxDur));
            let dashSpeed = (400 + 1200 * Math.pow(ratio, 2.0)) * 1.5;
            if ((top as any).dashIsGrid2To10) {
                dashSpeed *= 2.0;
            }
            top.vx = (top.dashDirectionX ?? 0) * dashSpeed;
            top.vy = (top.dashDirectionY ?? 0) * dashSpeed;
        }
    }

    let finalPower = finalDeflectPower;
    let offsetPower = (isDashing ? ((killsZombie || isHighSpin) ? 4 : 12) : 6) * 1.5; // Accelerated 50%
    
    // Slow down the sideswipe displacement speed by 30% for 擦撞移動
    if (killsZombie || isHighSpin) {
        finalPower *= 0.70;
        offsetPower *= 0.70;
    }

    if (isBoss && !top.isAI) {
        finalPower *= 2.0;
        offsetPower *= 2.0;
    }

    top.deflectionVx = (top.deflectionVx || 0) + rx * finalPower;
    top.deflectionVy = (top.deflectionVy || 0) + ry * finalPower;
    top.bounceTimer = 0.35;
    top.maxBounceTimer = 0.35;

    top.deflectionX = (top.deflectionX || 0) + rx * offsetPower;
    top.deflectionY = (top.deflectionY || 0) + ry * offsetPower;

    // If in standby state, also knock back the standby center of orbit directly away from the zombie
    if (top.state === 'standby') {
        const spinRatio = (top.spin ?? MAX_SPIN) / MAX_SPIN;
        const spinMultiplier = 1.0 + spinRatio * 2.0;
        // Also scale up standby orbit center knockback when spin is low - Accelerated 50%
        let kbPower = 580 * spinMultiplier * lowSpinReboundBoost * 1.5;
        if (isBoss && !top.isAI) {
            kbPower *= 2.0;
        }
        if (isHighSpin) {
            // Slow down the sideswipe displacement speed of standby center by 30%
            kbPower *= 0.70;
        }
        top.standbyCenterVx = (top.standbyCenterVx || 0) + rx * kbPower;
        top.standbyCenterVy = (top.standbyCenterVy || 0) + ry * kbPower;
        top.joystickReboundTimer = 0.25;
    }

    // Each collision consumes durability units (scaled by top size)
    // If spin is 5 or more (i.e. >= 50% of max), the damage value is 2
    let baseDamage = 1;
    const spinPercentage = (top.spin ?? MAX_SPIN) / (top.maxSpin || MAX_SPIN);
    if (spinPercentage * 10 >= 5.0) {
        baseDamage = 1;
    }
    GameUtils.applyDamageToZombie(engine, z, baseDamage, top.id);
    z.flashTimer = isBoss ? 0.35 : 0.15; // Set flash timer (longer for boss)
    const isSpecialCharge = !!((top.state === 'dash') || (top.superTimer !== undefined && top.superTimer > 0) || (top.launchPadState === 'flying' || top.launchPadState === 'dashing') || isActivelyPushing);
    z.hitByDash = isSpecialCharge;
    z.chainedBounce = false;
    z.bounceTimer = isBoss ? 0.4 : 0.6; // Shorter bounce duration for boss (0.4s vs 0.6s)
    z.maxBounceTimer = isBoss ? 0.4 : 0.6;
    if (isBoss) {
        // Cancel/Interrupt the boss attack cycle if hit with a high-momentum special charge/dash!
        // Require a genuine tactical dash, super state, or launch pad flight (not just steering/actively pushing)
        const isInterruptingDash = !!((top.state === 'dash') || (top.superTimer !== undefined && top.superTimer > 0) || (top.launchPadState === 'flying' || top.launchPadState === 'dashing'));
        if (isInterruptingDash) {
            const boss = z as any;
            if (boss.bossAttackState === 'dash' || boss.bossAttackState === 'warning') {
                boss.bossAttackState = 'idle';
                boss.bossNextAttackTime = 3.0; // Cooldown resetting
            }
        }
        // Give the boss a solid, highly noticeable knockback displacement away from the player
        const kbPower = z.hitByDash ? 550 : 280;
        z.knockbackSpeedStart = kbPower;
        z.vx = nx * kbPower;
        z.vy = ny * kbPower;
        z.hitByDash = true; // Use premium quadratic decay curve for the sliding knockback duration
    } else if (z.hitByDash) {
        const speed = Math.hypot(z.vx, z.vy);
        const scale = 0.56;
        z.knockbackSpeedStart = speed * scale;
        if (speed > 0.1) {
            z.vx = (z.vx / speed) * z.knockbackSpeedStart;
            z.vy = (z.vy / speed) * z.knockbackSpeedStart;
        }
    } else {
        z.knockbackSpeedStart = undefined;
        // Halve the standard standby hit rebound velocity for regular zombies
        z.vx *= 0.5;
        z.vy *= 0.5;
    }
    
    const isBig = z.type === 'zombie_big' || z.type === 'zombie_bomb' || z.type === 'zombie_bouncing';
    
    // Colors for zombie: Boss gets volcanic colors, Big Zombie gets royal cyber purple, Small Zombie gets vibrant toxic scifi green
    let darkColor = '#14532d';
    let lightColor = '#4ade80';
    let midColor = '#22c55e';
    let baseColor = '#15803d';
    if (isBoss) {
        darkColor = '#450a0a'; lightColor = '#fed7aa'; midColor = '#ea580c'; baseColor = '#dc2626';
    } else if (z.type === 'zombie_big') {
        darkColor = '#3b0764'; lightColor = '#d8b4fe'; midColor = '#9333ea'; baseColor = '#6b21a8';
    } else if (z.type === 'zombie_bomb') {
        darkColor = '#451a03'; lightColor = '#fdba74'; midColor = '#f97316'; baseColor = '#ea580c';
    } else if (z.type === 'zombie_bouncing') {
        darkColor = '#831843'; lightColor = '#fbcfe8'; midColor = '#f472b6'; baseColor = '#be185d';
    }
    
    // Match user's request: spawn intense, parallel, chainsaw-style grinding metal sparks at point of contact
    const contactX = top.x + nx * top.radius;
    const contactY = top.y + ny * top.radius;
    EffectSystem.addChainsawSparkParticles(engine, contactX, contactY, nx, ny, 20, 1.0, top.spin);

    // If player top hits zombie boss, generate a beautiful orange-yellow radial star-shaped explosion
    if (isBoss && !top.isAI) {
        // 1. Add central star-shaped burst
        engine.particles.push({
            x: contactX,
            y: contactY,
            vx: 0,
            vy: 0,
            life: 0.30, // 0.45 / 1.5 = 0.30 (50% speedup)
            maxLife: 0.30,
            color: '#f97316', // Orange
            size: 150, // Bold and highly visible
            isBossStarExplosion: true,
            angle: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 3 * 1.5 // 50% faster rotation
        });

        // 2. Add radiating orange-yellow star sparks
        const sparkCount = 12; // Beautiful dense radial wave
        for (let i = 0; i < sparkCount; i++) {
            const baseAng = (i / sparkCount) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
            const sparkSpeed = (180 + Math.random() * 240) * 1.5; // 50% faster flying speed
            const colors = ['#f97316', '#facc15', '#ea580c', '#eab308'];
            const chosenColor = colors[Math.floor(Math.random() * colors.length)];
            
            engine.particles.push({
                x: contactX,
                y: contactY,
                vx: Math.cos(baseAng) * sparkSpeed,
                vy: Math.sin(baseAng) * sparkSpeed,
                life: (0.4 + Math.random() * 0.2) / 1.5, // 50% faster life decay
                maxLife: 0.6 / 1.5,
                color: chosenColor,
                size: 18 + Math.random() * 12,
                isStarSpark: true,
                angle: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 6) * 1.5 // 50% faster rotation
            });
        }
    }

    // Spawn lively zombie damage sparks - tuned to be smaller, slower, and shorter-lived (0.35s duration)
    const spdDark = Math.min(120, impact * 0.12);
    const spdLight = Math.min(95, impact * 0.08);
    for (let i = 0; i < 8; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = Math.random() * spdDark;
        engine.particles.push({
            x: z.x, y: z.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 0.35, maxLife: 0.35,
            color: darkColor,
            size: Math.random() * 3 + 1.5
        });
    }
    for (let i = 0; i < 4; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = Math.random() * spdLight;
        engine.particles.push({
            x: z.x, y: z.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 0.35, maxLife: 0.35,
            color: lightColor,
            size: Math.random() * 2 + 1
        });
    }
    
    if (z.hp <= 0) {
        if (!GameUtils.handleZombieDeath(engine, z, top.id)) return;
        z.markForDeletion = true;
        const match = top.id.match(/\d+/);
        if (match) {
            const idx = parseInt(match[0], 10);
            engine.spawnTicket(z.x, z.y, z.type, idx, z.id); // 擊倒殭屍掉落彩票
        }
        
        // Increment kill tracking for the player
        top.kills = (top.kills ?? 0) + 1;
        const part = engine.participants.find(p => p.id === top.id);
        if (part) {
            part.kills = top.kills;
        }

        // 特殊衝鋒擊殺敵人產生打魔王時的放射狀星星爆點特效
        if (isSpecialCharge && !top.isAI && !isBoss) {
            // 1. Add central star-shaped burst
            engine.particles.push({
                x: contactX,
                y: contactY,
                vx: 0,
                vy: 0,
                life: 0.30, // 0.45 / 1.5 = 0.30 (50% speedup)
                maxLife: 0.30,
                color: '#f97316', // Orange
                size: 112.5, // Bold and highly visible (reduced 25%)
                isBossStarExplosion: true,
                angle: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 3 * 1.5 // 50% faster rotation
            });

            // 2. Add radiating orange-yellow star sparks
            const sparkCount = 12; // Beautiful dense radial wave
            for (let i = 0; i < sparkCount; i++) {
                const baseAng = (i / sparkCount) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
                const sparkSpeed = (180 + Math.random() * 240) * 1.5; // 50% faster flying speed
                const colors = ['#f97316', '#facc15', '#ea580c', '#eab308'];
                const chosenColor = colors[Math.floor(Math.random() * colors.length)];
                
                engine.particles.push({
                    x: contactX,
                    y: contactY,
                    vx: Math.cos(baseAng) * sparkSpeed,
                    vy: Math.sin(baseAng) * sparkSpeed,
                    life: (0.4 + Math.random() * 0.2) / 1.5, // 50% faster life decay
                    maxLife: 0.6 / 1.5,
                    color: chosenColor,
                    size: (18 + Math.random() * 12) * 0.75, // reduced 25%
                    isStarSpark: true,
                    angle: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 6) * 1.5 // 50% faster rotation
                });
            }
        }
        
        if (isBoss) {
            engine.bossDefeated = true; // Mark boss as defeated!
            EffectSystem.addParticles(engine, z.x, z.y, midColor, 80, 500, 16);
            EffectSystem.addParticles(engine, z.x, z.y, baseColor, 40, 350, 12);
            engine.screenShakeTimer = 1.6;
            // Add a cool boss death shockwave
            engine.shockwaves.push({
                x: z.x,
                y: z.y,
                radius: 10,
                maxRadius: 450,
                speed: 800,
                color: '#ea580c',
                thickness: 20,
                life: 0.6,
                maxLife: 0.6
            });
        } else if (isBig) {
            EffectSystem.addParticles(engine, z.x, z.y, midColor, 40, 300, 10); // explosive zombie gore!
            EffectSystem.addParticles(engine, z.x, z.y, baseColor, 20, 200, 6);
        } else {
            // Small zombie: size halved, spread/speed halved
            for (let i = 0; i < 40; i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = Math.random() * 150; // halved from 300
                engine.particles.push({
                    x: z.x, y: z.y,
                    vx: Math.cos(ang) * spd,
                    vy: Math.sin(ang) * spd,
                    life: 1.0, maxLife: 0.5 + Math.random(),
                    color: midColor,
                    size: Math.random() * 5 + 2 // halved size range (average 4.5 vs 9)
                });
            }
            for (let i = 0; i < 20; i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = Math.random() * 100; // halved from 200
                engine.particles.push({
                    x: z.x, y: z.y,
                    vx: Math.cos(ang) * spd,
                    vy: Math.sin(ang) * spd,
                    life: 1.0, maxLife: 0.5 + Math.random(),
                    color: baseColor,
                    size: Math.random() * 3 + 2 // halved size range (average 3.5 vs 7)
                });
            }
        }

        engine.shockwaves.push({
            x: z.x,
            y: z.y,
            radius: 0,
            maxRadius: isBig ? 250 : 150,
            speed: isBig ? 600 : 500,
            color: midColor,
            thickness: isBig ? 12 : 8,
            life: 0.4,
            maxLife: 0.4
        });
    }
}

export function getSpikeTriangles(engine: GameEngine) {
    const cycleTime = 6.0;
    const halfCycle = 3.0;
    let elapsed = 0;
    let isSpikesActive = false;

    // 1.進入魔王戰後，把原本的場地尖刺機關重新開啟。
    if (engine.transitionBgChanged) {
        isSpikesActive = true;
        elapsed = (engine.timeElapsed ?? 0) % cycleTime;
    }

    let factor = 0; // 0 to 1
    if (isSpikesActive) {
        if (elapsed < halfCycle) {
            factor = elapsed / halfCycle;
        } else {
            factor = 1.0 - (elapsed - halfCycle) / halfCycle;
        }
    }

    const centerY = engine.activeArenaCenterY ?? 540;
    const leftCenterX = 540;
    const rightCenterX = 1380;
    const radius = 480;
    const fullHeight = 160;
    const baseWidth = 140;

    const shift = (1.0 - factor) * fullHeight;

    // North: pointing downwards (normal base at Y=60, apex at Y=220)
    const nBaseY = (centerY - radius) - shift;
    const nApexY = (centerY - radius + fullHeight) - shift;
    const north = {
        name: 'North Spike',
        x1: 960 - baseWidth / 2, y1: nBaseY,
        x2: 960 + baseWidth / 2, y2: nBaseY,
        x3: 960, y3: nApexY,
        height: factor * fullHeight
    };

    // South: pointing upwards (normal base at Y=1020, apex at Y=860)
    const sBaseY = (centerY + radius) + shift;
    const sApexY = (centerY + radius - fullHeight) + shift;
    const south = {
        name: 'South Spike',
        x1: 960 - baseWidth / 2, y1: sBaseY,
        x2: 960 + baseWidth / 2, y2: sBaseY,
        x3: 960, y3: sApexY,
        height: factor * fullHeight
    };

    // West: pointing rightwards (normal base at X=60, apex at X=220)
    const wBaseX = (leftCenterX - radius) - shift;
    const wApexX = (leftCenterX - radius + fullHeight) - shift;
    const west = {
        name: 'West Spike',
        x1: wBaseX, y1: centerY - baseWidth / 2,
        x2: wBaseX, y2: centerY + baseWidth / 2,
        x3: wApexX, y3: centerY,
        height: factor * fullHeight
    };

    // East: pointing leftwards (normal base at X=1860, apex at X=1700)
    const eBaseX = (rightCenterX + radius) + shift;
    const eApexX = (rightCenterX + radius - fullHeight) + shift;
    const east = {
        name: 'East Spike',
        x1: eBaseX, y1: centerY - baseWidth / 2,
        x2: eBaseX, y2: centerY + baseWidth / 2,
        x3: eApexX, y3: centerY,
        height: factor * fullHeight
    };

    return [north, south, west, east];
}

export function handleWallBounce(engine: GameEngine, e: Entity) {
    if (e.type === 'top' && engine.areaTransitionState === 'exploding') {
        return;
    }
    let bounced = false;
    const oldX = e.x;
    const oldY = e.y;
    const oldVx = e.vx;
    const oldVy = e.vy;
    
    const R = 480; // capsule radius
    const r = e.radius;
    const limitR = R - r;
    const leftCenterX = 540;
    const rightCenterX = 1380;
    
    let wx = 0; // normal vector pointing outwards (to the wall)
    let wy = 0;
    let depth = 0;

    const applyBounce = (nx: number, ny: number, d: number) => {
        bounced = true; wx = nx; wy = ny; depth = d;
        e.x -= wx * depth; e.y -= wy * depth;
    };

    const centerY = engine.activeArenaCenterY ?? 540;
    if (e.x < leftCenterX) {
        const d = Math.hypot(e.x - leftCenterX, e.y - centerY);
        if (d > limitR) applyBounce((e.x - leftCenterX) / (d || 1), (e.y - centerY) / (d || 1), d - limitR);
    } else if (e.x > rightCenterX) {
        const d = Math.hypot(e.x - rightCenterX, e.y - centerY);
        if (d > limitR) applyBounce((e.x - rightCenterX) / (d || 1), (e.y - centerY) / (d || 1), d - limitR);
    } else {
        const minY = centerY - limitR;
        const maxY = centerY + limitR;
        if (e.y < minY) applyBounce(0, -1, minY - e.y);
        else if (e.y > maxY) applyBounce(0, 1, e.y - maxY);
    }

    if (bounced) {
        // Apply bounce reflection along the custom normal of the wall (wx, wy)
        const velLongNormal = e.vx * wx + e.vy * wy;
        const actuallyBounced = velLongNormal > 0;
        
        if (velLongNormal > 0) {
            const restitution = 0.8;
            e.vx -= (1 + restitution) * velLongNormal * wx;
            e.vy -= (1 + restitution) * velLongNormal * wy;
        }

        if (e.type === 'top') {
            const top = e as Top;
            
            // Generates custom grey particles at the precise collision edge point
            const cX = e.x + wx * e.radius;
            const cY = e.y + wy * e.radius;
            
            if (actuallyBounced && velLongNormal > 100) {
                EffectSystem.addChainsawSparkParticles(engine, cX, cY, wx, wy, 24);
            }

            // Apply dynamic exact ±15 degrees deflection for wall bounces
            const bounceAngle = (Math.random() < 0.5 ? 15 : -15) * Math.PI / 180;
            const bCos = Math.cos(bounceAngle);
            const bSin = Math.sin(bounceAngle);

            if (top.launchPadState === 'dashing') {
                // Trigger screenshake with moderated duration and intensity
                engine.screenShakeTimer = 0.9;
                engine.screenShakeMaxDuration = 0.9;
                engine.screenShakeIntensity = 12;

                // Generate beautiful massive spark particles explosion (white-hot, neon cyan, and top main color)
                EffectSystem.addParticles(engine, cX, cY, '#ffffff', 28, 480, 7);
                EffectSystem.addParticles(engine, cX, cY, '#22d3ee', 24, 380, 6);
                EffectSystem.addParticles(engine, cX, cY, top.color, 28, 420, 7);

                // Reflect the launchPad direction coordinates nicely
                const dotLaunch = ((top as any).launchPadDirX || 0) * wx + ((top as any).launchPadDirY || 0) * wy;
                if (dotLaunch > 0) {
                    (top as any).launchPadDirX = ((top as any).launchPadDirX || 0) - 2 * dotLaunch * wx;
                    (top as any).launchPadDirY = ((top as any).launchPadDirY || 0) - 2 * dotLaunch * wy;
                }

                // Apply exact ±15 deg random rotation
                const rLx = ((top as any).launchPadDirX ?? 0) * bCos - ((top as any).launchPadDirY ?? 0) * bSin;
                const rLy = ((top as any).launchPadDirX ?? 0) * bSin + ((top as any).launchPadDirY ?? 0) * bCos;
                (top as any).launchPadDirX = rLx;
                (top as any).launchPadDirY = rLy;

                top.dashDirectionX = (top as any).launchPadDirX;
                top.dashDirectionY = (top as any).launchPadDirY;

                // Keep launchpad high speed constant upon wall bouncing
                top.vx = (top as any).launchPadDirX * 3900;
                top.vy = (top as any).launchPadDirY * 3900;
            } else if (top.state === 'dash') {
                if (!top.isAI && top.spin >= 400) {
                    engine.screenShakeTimer = 0.8;
                }

                // Reflect the dash vector coordinates nicely to persist moving in rebounded direction
                const dotDash = (top.dashDirectionX || 0) * wx + (top.dashDirectionY || 0) * wy;
                if (dotDash > 0) {
                    top.dashDirectionX = (top.dashDirectionX || 0) - 2 * dotDash * wx;
                    top.dashDirectionY = (top.dashDirectionY || 0) - 2 * dotDash * wy;
                }

                // Apply exact ±15 deg random rotation modification to the reflected dash direction vector
                const rDx = (top.dashDirectionX ?? 0) * bCos - (top.dashDirectionY ?? 0) * bSin;
                const rDy = (top.dashDirectionX ?? 0) * bSin + (top.dashDirectionY ?? 0) * bCos;
                top.dashDirectionX = rDx;
                top.dashDirectionY = rDy;
                
                // Keep dynamic velocity consistent during dash deflection
                let wallBounceSpeed = 1400;
                if ((top as any).dashIsGrid2To10) {
                    wallBounceSpeed *= 2.0;
                }
                top.vx = (top.dashDirectionX ?? 0) * wallBounceSpeed;
                top.vy = (top.dashDirectionY ?? 0) * wallBounceSpeed;
            } else {
                // Apply exact ±15 deg random rotation to velocity for standby/regular state
                const speed = Math.hypot(e.vx, e.vy);
                if (speed > 1) {
                    const newVx = e.vx * bCos - e.vy * bSin;
                    const newVy = e.vx * bSin + e.vy * bCos;
                    e.vx = newVx;
                    e.vy = newVy;
                }
            }

            // Sync with standby parameters if and only if in standby state
            if (top.state === 'standby') {
                const diffX = e.x - oldX;
                const diffY = e.y - oldY;
                const diffVx = e.vx - oldVx;
                const diffVy = e.vy - oldVy;

                top.standbyCenterX = (top.standbyCenterX ?? oldX) + diffX;
                top.standbyCenterY = (top.standbyCenterY ?? oldY) + diffY;
                top.standbyCenterVx = (top.standbyCenterVx ?? 0) + diffVx;
                top.standbyCenterVy = (top.standbyCenterVy ?? 0) + diffVy;
            }
        }
    }
    return bounced;
}

