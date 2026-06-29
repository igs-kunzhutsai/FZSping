import * as InputSystem from './InputSystem';
import * as EffectSystem from './EffectSystem';
import * as CollisionSystem from './CollisionSystem';
import * as GameUtils from './GameUtils';
import * as SpawnSystem from './SpawnSystem';
import { SoundSystem } from './SoundSystem';
import type { GameEngine } from '../GameEngine';
import { Top, Zombie } from '../types';
import { CANVAS_W, CANVAS_H, MAX_SPIN } from '../constants';
import { getStandbyRadiusForModel, updateTopStandby } from '../topMovement';

export function updateCoopState(engine: GameEngine, top: Top, dt: number) {
    if (!top.coopState) return;

    const state = top.coopState;
    state.timer = Math.max(0, state.timer - dt);

    const partner = engine.tops.find(t => t.id === state.partnerId);
    if (!partner || !partner.coopState) {
        top.coopState = undefined;
        return;
    }

    const prevX = top.x;
    const prevY = top.y;

    top.state = 'dash'; // 力保衝刺姿態與特效持續
    top.vx = 0; top.vy = 0; // 凍結一般物理移動

    // 玩家此時若按下加速按鍵，可在更新邏輯中使 state.coopSpinCount++
    if (top.isAI && Math.random() < 6.0 * dt) {
        state.coopSpinCount = (state.coopSpinCount || 0) + 1;
    }

    // ----------------------------------------
    // 各階段演出細節
    // ----------------------------------------
    if (state.phase === 'standoff') {
        // 【1. 僵持狀態】：高飽和度強烈抖動
        const vibeForce = 20.0;
        const vibeX = (Math.random() - 0.5) * vibeForce;
        const vibeY = (Math.random() - 0.5) * vibeForce;

        // 接觸點精準偏移抖動
        top.x = state.centerX + Math.cos(state.startAngle) * top.radius + vibeX;
        top.y = state.centerY + Math.sin(state.startAngle) * top.radius + vibeY;

        // 領袖渲染高密度的碰撞火花粒子
        if (state.isLeader) {
            const midX = state.centerX;
            const midY = state.centerY;
            if (Math.random() < 0.4) { EffectSystem.addParticles(engine, midX, midY, '#fbbf24', 2, 120, 6); }
            if (Math.random() < 0.3) { EffectSystem.addParticles(engine, midX, midY, '#f97316', 2, 140, 6); }
        }

        // 時間結束，轉入外撤旋轉階段
        if (state.timer <= 0) {
            state.phase = 'retreat_rotate';
            state.timer = 0.33; // 迴避旋轉時間 0.33s
            if (state.isLeader) { engine.screenShakeTimer = 0.4; }
        }

    } else if (state.phase === 'retreat_rotate') {
        // 【2. 迴旋撤離】：往外大幅度拋射，並沿中心作逆時針偏移 60 度角
        const duration = 0.33;
        const t = Math.max(0, Math.min(1, (duration - state.timer) / duration));

        // 漸慢回調曲線
        const easeOut = 1 - Math.pow(1 - t, 3);
        const maxRetreat = 216; // 半徑擴張最高達 216px
        const retreatDist = top.radius + maxRetreat * easeOut;

        // 最終逆時針轉過 60 度 (Math.PI / 3)
        const currentAngle = state.startAngle - (Math.PI / 3) * t;

        top.x = state.centerX + Math.cos(currentAngle) * retreatDist;
        top.y = state.centerY + Math.sin(currentAngle) * retreatDist;

        if (state.timer <= 0) {
            state.phase = 'charge';
            state.timer = 0.18; // 充電衝剪速度更快
            if (state.isLeader) { engine.screenShakeTimer = 0.15; }
        }

    } else if (state.phase === 'charge') {
        // 【3. 高速回衝】：加速向對撞點衝擊，並保持之前旋轉到位的 60 度角
        const duration = 0.18;
        const t = Math.max(0, Math.min(1, (duration - state.timer) / duration));

        const easeIn = t * t; // 二次加速猛撞
        const maxRetreat = 216;
        const currentDist = top.radius + maxRetreat * (1 - easeIn);
        const currentAngle = state.startAngle - (Math.PI / 3);

        top.x = state.centerX + Math.cos(currentAngle) * currentDist;
        top.y = state.centerY + Math.sin(currentAngle) * currentDist;

        if (state.timer <= 0) {
            // 接觸瞬間，若尚未完成 3 次對撞，則進入下一輪
            if (state.cycle < 3) {
                state.cycle += 1;
                state.phase = 'standoff';
                state.timer = 0.25;
                state.startAngle = state.startAngle - (Math.PI / 3); // 重新錨定下一次撞擊角度

                if (state.isLeader) {
                    engine.screenShakeTimer = 0.6;
                    const midX = state.centerX;
                    const midY = state.centerY;
                    
                    // 中途碰撞釋放強烈紫能衝擊波
                    engine.shockwaves.push({
                        x: midX, y: midY, radius: 20, maxRadius: 400, speed: 900,
                        thickness: 14, life: 0.4, maxLife: 0.4, color: '#a855f7'
                    });
                }
            } else {
                // 【4. 終局判定】
                if (state.isLeader) {
                    engine.screenShakeTimer = 1.0;
                    resolveFinalVictory(engine, top, partner, state);
                }
            }
        }
    }

    // 陀螺角力過程中，若碰觸到彈射區或炸彈物件，則該彈射區、炸彈物件會直接從場上移除消失
    const padRadius = 48;
    const touchedPads = engine.activeLaunchPads.filter(pad => {
        const dist = Math.hypot(top.x - pad.x, top.y - pad.y);
        return dist <= (top.radius + padRadius) * 0.9;
    });
    if (touchedPads.length > 0) {
        const touchedIds = touchedPads.map(p => p.id);
        engine.activeLaunchPads = engine.activeLaunchPads.filter(pad => !touchedIds.includes(pad.id));
        touchedPads.forEach(pad => {
            EffectSystem.addParticles(engine, pad.x, pad.y, '#38bdf8', 25, 300, 6);
        });
    }

    engine.obstacles.forEach(o => {
        if (o.type === 'obstacle_barrel' && !o.markForDeletion) {
            const barrelRadius = 30;
            const dist = Math.hypot(top.x - o.x, top.y - o.y);
            if (dist <= (top.radius + barrelRadius)) {
                o.markForDeletion = true;
                EffectSystem.addParticles(engine, o.x, o.y, '#ef4444', 35, 400, 10);
                engine.shockwaves.push({
                    x: o.x, y: o.y, radius: 10, maxRadius: 180, speed: 400,
                    thickness: 8, life: 0.3, maxLife: 0.3, color: '#f87171'
                });
            }
        }
    });
}

export function resolveFinalVictory(engine: GameEngine, top: Top, partner: Top, state: any) {
    const midX = state.centerX;
    const midY = state.centerY;
    
    // 生成雙主題巨大能量爆炸粒子
    EffectSystem.addParticles(engine, midX, midY, '#ef4444', 40, 350, 10);
    EffectSystem.addParticles(engine, midX, midY, '#06b6d4', 40, 350, 10);
    EffectSystem.addParticles(engine, midX, midY, '#ffffff', 30, 250, 8);
    
    // 計算彈射偏向角
    const finalAngleSelf = state.startAngle - (Math.PI / 3);
    const selfRx = Math.cos(finalAngleSelf);
    const selfRy = Math.sin(finalAngleSelf);

    const finalAnglePartner = partner.coopState!.startAngle - (Math.PI / 3);
    const partnerRx = Math.cos(finalAnglePartner);
    const partnerRy = Math.sin(finalAnglePartner);

    const selfSpins = state.coopSpinCount || 0;
    const partnerSpins = partner.coopState!.coopSpinCount || 0;

    // [X-SHAPED DECISIVE SLASH EFFECT] 閃亮且擴散的 X 型刀光特效 (尺寸放大一倍)
    engine.xSlashes.push({
        x: midX,
        y: midY,
        size: 80,
        maxSize: 1200,
        speed: 3200, // 擴散速度快
        angle: finalAngleSelf, // 與雙方撞擊角度對齊
        life: 0.5,
        maxLife: 0.5,
        color: '#38bdf8', // 賽博藍/青色高能電光
        thickness: 40
    });

    engine.xSlashes.push({
        x: midX,
        y: midY,
        size: 40,
        maxSize: 1000,
        speed: 2400, // 略慢一丁點，形成多色階發散感
        angle: finalAngleSelf + Math.PI / 12, // 微幅偏移角
        life: 0.45,
        maxLife: 0.45,
        color: '#f43f5e', // 霓虹玫瑰紅/粉色
        thickness: 28
    });
    
    // [KNOCKBACK LOGIC FOR THE LOSER]
    if (selfSpins < partnerSpins) {
        // ─── 隊長 (top) 輸了，夥伴 (partner) 贏了 ───
        top.hp -= 1;
        top.hitCooldown = 1.0; // 1-second invulnerability protection
        top.flashTimer = 1.0;
        EffectSystem.addParticles(engine, top.x, top.y, '#ef4444', 60, 800, 16);

        // Loser blown back heavily (state: standby for immediate active feedback recovery)
        top.vx = selfRx * 5000;
        top.vy = selfRy * 5000;
        top.deflectionVx = top.vx;
        top.deflectionVy = top.vy;
        top.deflectionX = 0;
        top.deflectionY = 0;
        
        top.state = 'standby';
        top.standbyAngle = Math.atan2(top.vy, top.vx);
        top.standbyCenterX = top.x - Math.cos(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
        top.standbyCenterY = top.y - Math.sin(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
        top.standbyCenterVx = selfRx * 1600;
        top.standbyCenterVy = selfRy * 1600;
        top.customKnockbackTimer = 0.5;

        // Winner dashes forward triumphantly
        partner.state = 'dash';
        partner.dashInputHistory = [];
        partner.dashSpinHoldTimer = 0;
        partner.maxDashDuration = 0.5;
        partner.dashTimer = 0.5;
        partner.dashDirectionX = partnerRx;
        partner.dashDirectionY = partnerRy;
        partner.vx = partnerRx * 2400;
        partner.vy = partnerRy * 2400;
        partner.dashCooldown = 0;
        partner.maxDashCooldown = 0;
        EffectSystem.addParticles(engine, partner.x, partner.y, '#38bdf8', 30, 400, 8);
    } else if (selfSpins > partnerSpins) {
        // ─── 夥伴 (partner) 輸了，隊長 (top) 贏了 ───
        partner.hp -= 1;
        partner.hitCooldown = 1.0; // 1-second invulnerability protection
        partner.flashTimer = 1.0;
        EffectSystem.addParticles(engine, partner.x, partner.y, '#ef4444', 60, 800, 16);

        // Loser blown back heavily (state: standby for immediate active feedback recovery)
        partner.vx = partnerRx * 5000;
        partner.vy = partnerRy * 5000;
        partner.deflectionVx = partner.vx;
        partner.deflectionVy = partner.vy;
        partner.deflectionX = 0;
        partner.deflectionY = 0;

        partner.state = 'standby';
        partner.standbyAngle = Math.atan2(partner.vy, partner.vx);
        partner.standbyCenterX = partner.x - Math.cos(partner.standbyAngle) * getStandbyRadiusForModel(partner, this,  partner.standbyAngle);
        partner.standbyCenterY = partner.y - Math.sin(partner.standbyAngle) * getStandbyRadiusForModel(partner, this,  partner.standbyAngle);
        partner.standbyCenterVx = partnerRx * 1600;
        partner.standbyCenterVy = partnerRy * 1600;
        partner.customKnockbackTimer = 0.5;

        // Winner dashes forward triumphantly
        top.state = 'dash';
        top.dashInputHistory = [];
        top.dashSpinHoldTimer = 0;
        top.maxDashDuration = 0.5;
        top.dashTimer = 0.5;
        top.dashDirectionX = selfRx;
        top.dashDirectionY = selfRy;
        top.vx = selfRx * 2400;
        top.vy = selfRy * 2400;
        top.dashCooldown = 0;
        top.maxDashCooldown = 0;
        EffectSystem.addParticles(engine, top.x, top.y, '#38bdf8', 30, 400, 8);
    } else {
        // ─── 平手 (Tie) ───
        // Both get blown away equally
        top.vx = selfRx * 3000;
        top.vy = selfRy * 3000;
        top.deflectionVx = top.vx;
        top.deflectionVy = top.vy;
        top.deflectionX = 0;
        top.deflectionY = 0;

        top.state = 'standby';
        top.standbyAngle = Math.atan2(top.vy, top.vx);
        top.standbyCenterX = top.x - Math.cos(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
        top.standbyCenterY = top.y - Math.sin(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
        top.standbyCenterVx = selfRx * 1000;
        top.standbyCenterVy = selfRy * 1000;
        top.customKnockbackTimer = 0.5;

        partner.vx = partnerRx * 3000;
        partner.vy = partnerRy * 3000;
        partner.deflectionVx = partner.vx;
        partner.deflectionVy = partner.vy;
        partner.deflectionX = 0;
        partner.deflectionY = 0;

        partner.state = 'standby';
        partner.standbyAngle = Math.atan2(partner.vy, partner.vx);
        partner.standbyCenterX = partner.x - Math.cos(partner.standbyAngle) * getStandbyRadiusForModel(partner, this,  partner.standbyAngle);
        partner.standbyCenterY = partner.y - Math.sin(partner.standbyAngle) * getStandbyRadiusForModel(partner, this,  partner.standbyAngle);
        partner.standbyCenterVx = partnerRx * 1000;
        partner.standbyCenterVy = partnerRy * 1000;
        partner.customKnockbackTimer = 0.5;
    }

    // Clean coopState and set CD
    top.coopState = undefined;
    top.deadlockCooldownTimer = 1.5;
    partner.coopState = undefined;
    partner.deadlockCooldownTimer = 1.5;
}

export function spawnSiegeWarningZone(engine: GameEngine) {
    return; // User request: Disable zombie siege/surround event

    if (engine.zombieSiegeActive || engine.siegeWarningZone || GameUtils.isClashActive(engine)) return;

    // "1.當場上有玩家處於星星狀態時，不要觸發殭屍包圍事件。"
    const hasSuperPlayer = engine.tops.some(t => t.superTimer !== undefined && t.superTimer > 0);
    if (hasSuperPlayer) return;

    const activePlayers = engine.tops.filter(t => !t.isAI && !t.isExploding && t.hp > 0 && t.launchPadState === undefined);
    if (activePlayers.length === 0) return;

    // Find a random location inside the safe capsule boundaries
    let wx = 960;
    let wy = 540;
    let attempts = 0;
    while (attempts < 200) {
        const checkX = 200 + Math.random() * (CANVAS_W - 400);
        const checkY = 200 + Math.random() * (CANVAS_H - 400);
        if (GameUtils.isPointInsideCapsule(engine, checkX, checkY, 150)) {
            // Ensure checkX, checkY is far enough from all active players (distance > 250px)
            let tooClose = false;
            for (const p of activePlayers) {
                if (Math.hypot(p.x - checkX, p.y - checkY) < 250) {
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) {
                wx = checkX;
                wy = checkY;
                break;
            }
        }
        attempts++;
    }

    engine.siegeWarningZone = {
        x: wx,
        y: wy,
        radius: 150,
        timer: 0
    };
}

export function triggerZombieSiege(engine: GameEngine, overrideTargetPlayer?: Top, zoneCenter?: { x: number; y: number }) {
    return; // User request: Disable zombie siege/surround event

    if (engine.zombieSiegeActive || GameUtils.isClashActive(engine)) return; // Only one active siege event at a time and no active clash event

    // "1.當場上有玩家處於星星狀態時，不要觸發殭屍包圍事件。"
    const hasSuperPlayer = engine.tops.some(t => t.superTimer !== undefined && t.superTimer > 0);
    if (hasSuperPlayer) return;

    const activePlayers = engine.tops.filter(t => !t.isAI && !t.isExploding && t.hp > 0 && t.launchPadState === undefined);
    if (activePlayers.length === 0) return;

    // Choose a random active player to siege
    const targetPlayer = overrideTargetPlayer || activePlayers[Math.floor(Math.random() * activePlayers.length)];
    engine.zombieSiegeActive = true;
    engine.siegeTargetPlayerId = targetPlayer.id;
    engine.siegeStatus = 'approaching';
    engine.siegeProgress = 0.0;

    const refX = zoneCenter ? zoneCenter.x : targetPlayer.x;
    const refY = zoneCenter ? zoneCenter.y : targetPlayer.y;

    // Forcibly snap player to the warning zone center!
    targetPlayer.x = refX;
    targetPlayer.y = refY;
    targetPlayer.vx = 0;
    targetPlayer.vy = 0;

    engine.siegeTargetStartX = refX;
    engine.siegeTargetStartY = refY;
    engine.siegeMashCount = 0;
    engine.siegeMashRequired = 6; // 6 keypresses to break free (reduced by 50% per user request)
    engine.siegeTimeRemaining = 0;
    engine.siegeZombies = [];
    engine.siegeAnimateFlingTimer = 0;
    engine.siegeAnimateThrowIndex = 0;

    // Spawn 6 extra small zombies from the outer ring of the warning zone (radius 150px)
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6;
        const spawnX = refX + Math.cos(angle) * 150;
        const spawnY = refY + Math.sin(angle) * 150;

        const zb: any = {
            id: 'siege_z_' + Math.random() + '_' + i,
            type: 'zombie_small',
            x: spawnX,
            y: spawnY,
            vx: 0,
            vy: 0,
            radius: 24,
            mass: 8,
            markForDeletion: false,
            hp: 2,
            maxHp: 2,
            angle: angle + Math.PI,
            speedMultiplier: 0.5 + Math.random() * 1.0,
            hitCooldown: 0,
            isSiegeZombie: true,
            siegeIndex: i,
            spawnX: spawnX,
            spawnY: spawnY
        };
        engine.zombies.push(zb);
        engine.siegeZombies.push(zb);

        // Spawn awesome dirt/soil-burst particles for the break-out theme (破土而出)
        EffectSystem.addParticles(engine, spawnX, spawnY, '#854d0e', 12, 120, 5); // mud brown
        EffectSystem.addParticles(engine, spawnX, spawnY, '#15803d', 8, 100, 4);   // toxic dark green grass
    }

    // Trigger dramatic camera screen shake
    engine.screenShakeTimer = 1.2;
}

export function updateZombieSiege(engine: GameEngine, dt: number) {
    const player = engine.tops.find(t => t.id === engine.siegeTargetPlayerId);
    if (!player || player.hp <= 0 || player.isExploding) {
        cancelZombieSiege(engine);
        return;
    }

    if (engine.siegeStatus === 'approaching') {
        // Keep the player top immobilized at the warning zone center from the start!
        player.x = engine.siegeTargetStartX;
        player.y = engine.siegeTargetStartY;
        player.vx = 0;
        player.vy = 0;
        player.standbyCenterVx = 0;
        player.standbyCenterVy = 0;

        // All siege zombies crawl smoothly from their boundary spawn position towards their designated slot
        const timeAngleOffset = engine.timeElapsed * 1.5;
        let firstZombieCaught = false;

        engine.siegeZombies.forEach((z, idx) => {
            if (z.markForDeletion) return;
            const angle = (idx * Math.PI * 2 / 6) + timeAngleOffset;
            const targetX = player.x + Math.cos(angle) * (player.radius + 10);
            const targetY = player.y + Math.sin(angle) * (player.radius + 10);

            // Dynamically crawl towards the target rather than interpolating from starting snapshot
            // This prevents rigid sliding with the player but ensures real-time tracking!
            const dx = targetX - z.x;
            const dy = targetY - z.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 1) {
                const speed = 450;
                const step = speed * dt;
                if (step >= dist) {
                    z.x = targetX;
                    z.y = targetY;
                } else {
                    z.x += (dx / dist) * step;
                    z.y += (dy / dist) * step;
                }
            } else {
                z.x = targetX;
                z.y = targetY;
            }

            // Check distance to check if this zombie caught the player
            const distToPlayer = Math.hypot(z.x - player.x, z.y - player.y);
            if (distToPlayer <= player.radius + z.radius + 15) {
                firstZombieCaught = true;
            }

            // Turn facing towards player
            z.angle = Math.atan2(player.y - z.y, player.x - z.x) + Math.PI / 2;
            z.vx = 0;
            z.vy = 0;
        });

        if (firstZombieCaught) {
            engine.siegeStatus = 'clinging';
            SoundSystem.play('SE-Dizzy1');
            engine.siegeTimeRemaining = 3.0; // 3 seconds count down starts
            engine.siegeMashCount = 0;

            // Snap/immobilize player top precisely at their current location
            engine.siegeTargetStartX = player.x;
            engine.siegeTargetStartY = player.y;
            player.vx = 0;
            player.vy = 0;

            // Thud camera shake when they latch on
            engine.screenShakeTimer = 0.8;
        }
    } else if (engine.siegeStatus === 'clinging') {
        engine.siegeTimeRemaining -= dt;

        // Keep the player top immobilized!
        player.x = engine.siegeTargetStartX;
        player.y = engine.siegeTargetStartY;
        player.vx = 0;
        player.vy = 0;
        player.standbyCenterVx = 0;
        player.standbyCenterVy = 0;

        // Positioning clinging zombies closely with trembling offset to look like clawing claws
        const timeAngleOffset = engine.timeElapsed * 1.8;
        engine.siegeZombies.forEach((z, idx) => {
            if (z.markForDeletion) return;
            const angle = (idx * Math.PI * 2 / 6) + timeAngleOffset;
            const vibration = Math.sin(engine.timeElapsed * 24 + idx) * 3; // 3px vibration
            const r = player.radius + 10 + vibration;
            const targetX = engine.siegeTargetStartX + Math.cos(angle) * r;
            const targetY = engine.siegeTargetStartY + Math.sin(angle) * r;

            // Move them smoothly towards this target position if they are not already there
            const dx = targetX - z.x;
            const dy = targetY - z.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 1) {
                const speed = 500; // fast converge speed
                const step = speed * dt;
                if (step >= dist) {
                    z.x = targetX;
                    z.y = targetY;
                } else {
                    z.x += (dx / dist) * step;
                    z.y += (dy / dist) * step;
                }
            } else {
                z.x = targetX;
                z.y = targetY;
            }

            z.angle = angle + Math.PI;
            z.vx = 0;
            z.vy = 0;
        });

        // Evaluate QTE results
        if (engine.siegeMashCount >= engine.siegeMashRequired) {
            // SUCCESS: Fling them outward!
            engine.siegeStatus = 'resolved_success';
            SoundSystem.play('Attack_wave_032');
            engine.siegeAnimateFlingTimer = 0.8; // fling animation duration

            // Player top is released into beautiful orbital standby spin alignment
            player.state = 'standby';
            player.spin = MAX_SPIN; // fully recharged spin!
            if (player.smoothSpin !== undefined) player.smoothSpin = MAX_SPIN;
            player.standbyAngle = Math.random() * Math.PI * 2;
            
            // Keep the standby center exactly at the pinned center to execute the majestic 360-degree breakout orbit loop!
            player.standbyCenterX = engine.siegeTargetStartX;
            player.standbyCenterY = engine.siegeTargetStartY;
            player.breakoutOrbitTimer = 1.0; // Trigger the 1-second breakout orbit whip!

            // Bursting energy shockwave
            engine.shockwaves.push({
                x: player.x,
                y: player.y,
                radius: 20,
                maxRadius: 180,
                speed: 400,
                color: 'rgba(236, 72, 153, 0.85)', // Magenta shockwave
                thickness: 15,
                life: 0.5,
                maxLife: 0.5
            });
            engine.screenShakeTimer = 1.0;
        } else if (engine.siegeTimeRemaining <= 0) {
            // FAILURE: Blowback player top and deal 25 damage points!
            engine.siegeStatus = 'resolved_fail';
            engine.siegeTimeRemaining = 0;

            if (player.superTimer === undefined || player.superTimer <= 0) {
                if (player.isAI) {
                    player.hp = Math.max(0, player.hp - 25);
                }
                player.flashTimer = 0.4;
                player.damageShockTimer = 0.6;
                player.hpLossTimer = 0.7;
                player.visualHp = player.visualHp !== undefined ? Math.max(player.hp, player.visualHp) : player.hp;
            }

            // Knock them back violently away
            const reboundAngle = Math.random() * Math.PI * 2;
            const blowBackForce = 2200;
            player.vx = Math.cos(reboundAngle) * blowBackForce;
            player.vy = Math.sin(reboundAngle) * blowBackForce;

            player.state = 'standby';
            player.standbyAngle = reboundAngle + Math.PI;
            const rad = getStandbyRadiusForModel(player, this,  player.standbyAngle);
            player.standbyCenterX = player.x - Math.cos(player.standbyAngle) * rad;
            player.standbyCenterY = player.y - Math.sin(player.standbyAngle) * rad;

            // Fire red shockwave and massive sparks
            engine.shockwaves.push({
                x: player.x,
                y: player.y,
                radius: 25,
                maxRadius: 240,
                speed: 600,
                color: 'rgba(239, 68, 68, 0.95)',
                thickness: 25,
                life: 0.6,
                maxLife: 0.6
            });
            EffectSystem.addParticles(engine, player.x, player.y, '#dc2626', 60, 600, 15);
            engine.screenShakeTimer = 1.6;

            // Scatter away remaining siege zombies
            engine.siegeZombies.forEach((z, idx) => {
                if (z.markForDeletion) return;
                const scatterAngle = (idx * Math.PI * 2 / 6) + Math.random() * 0.4;
                z.vx = Math.cos(scatterAngle) * 600;
                z.vy = Math.sin(scatterAngle) * 600;
                z.bounceTimer = 0.5;
                z.maxBounceTimer = 0.5;
                z.isSiegeZombie = false; // standard zombies now
            });

            engine.zombieSiegeActive = false;
            engine.siegeStatus = null;
            engine.siegeZombies = [];
        }
    } else if (engine.siegeStatus === 'resolved_success') {
        engine.siegeAnimateFlingTimer -= dt;

        // Flung zombies fly outwards rapidly and explode/die!
        const flingSpeed = 1600;
        const timeAngleOffset = engine.timeElapsed * 2.0;
        engine.siegeZombies.forEach((z, idx) => {
            if (z.markForDeletion) return;
            const angle = (idx * Math.PI * 2 / 6) + timeAngleOffset;
            z.vx = Math.cos(angle) * flingSpeed;
            z.vy = Math.sin(angle) * flingSpeed;
            z.x += z.vx * dt;
            z.y += z.vy * dt;

            // Sparks trail
            if (Math.random() < 0.3) {
                EffectSystem.addParticles(engine, z.x, z.y, '#ec4899', 3, 100, 3);
            }

            // Explode and delete
            const dist = Math.hypot(z.x - player.x, z.y - player.y);
            if (dist > 180 || engine.siegeAnimateFlingTimer <= 0) {
                z.hp = 0;
                z.markForDeletion = true;

                EffectSystem.addParticles(engine, z.x, z.y, '#f472b6', 15, 200, 5);
                EffectSystem.addParticles(engine, z.x, z.y, '#ffffff', 8, 150, 3);

                // Add to score
                const pIndex = engine.tops.indexOf(player);
                if (pIndex >= 0 && pIndex < 4) {
                    engine.scores[pIndex] = (engine.scores[pIndex] || 0) + 150;
                }
            }
        });

        if (engine.siegeAnimateFlingTimer <= 0) {
            engine.zombieSiegeActive = false;
            engine.siegeStatus = null;
            engine.siegeZombies = [];
        }
    }
}

export function cancelZombieSiege(engine: GameEngine) {
    engine.siegeZombies.forEach(z => {
        if (!z.markForDeletion) {
            z.isSiegeZombie = false;
            z.vx = (Math.random() - 0.5) * 100;
            z.vy = (Math.random() - 0.5) * 100;
        }
    });
    engine.zombieSiegeActive = false;
    engine.siegeStatus = null;
    engine.siegeZombies = [];
}

