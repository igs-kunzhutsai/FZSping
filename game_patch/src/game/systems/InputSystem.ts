import * as EffectSystem from './EffectSystem';
import * as EventSystem from './EventSystem';
import * as CollisionSystem from './CollisionSystem';
import * as GameUtils from './GameUtils';
import * as SpawnSystem from './SpawnSystem';
import { SoundSystem } from './SoundSystem';
import { getStandbyRadiusForModel } from '../topMovement';
import { MAX_SPIN, CANVAS_W, CANVAS_H } from '../constants';
import type { GameEngine } from '../GameEngine';
import { PLAYER_PROFILES } from '../GameRenderer';
import { ProbabilityManager } from './ProbabilityManager';

function checkSkillPress(e: KeyboardEvent, controls: any): boolean {
    let isSkillPress = e.code === controls.skill;
    if (controls.skill === 'ControlRight' && (e.code === 'ControlRight' || e.code === 'ControlLeft' || e.key === 'Control')) {
        isSkillPress = true;
    } else if (controls.skill === 'KeyE' && (e.code === 'KeyE' || e.key === 'e' || e.key === 'E')) {
        isSkillPress = true;
    } else if (controls.skill === 'KeyO' && (e.code === 'KeyO' || e.key === 'o' || e.key === 'O')) {
        isSkillPress = true;
    } else if (controls.skill === 'Numpad9' && (e.code === 'Numpad9' || e.code === 'Digit9' || e.key === '9')) {
        isSkillPress = true;
    }
    return isSkillPress;
}

export function handleKeyDown(engine: GameEngine, e: KeyboardEvent) {
    if (e.code === 'KeyH' || e.key === 'h' || e.key === 'H') {
        engine.showFullDebug = !engine.showFullDebug;
        return;
    }

    if (engine.introActive) {
        if (engine.introStage === 'ready_spin') {
            engine.tops.forEach(top => {
                if (!top.isAI && top.controls) {
                    let isSpinPress = e.code === top.controls.spin || checkSkillPress(e, top.controls);
                    if (top.label === 'P4' && (e.code === 'Numpad7' || e.code === 'Digit7' || e.key === '7')) isSpinPress = true;
                    if (isSpinPress) {
                        top.virtualSpinHoldTimer = 0.5;
                        top.spinTutorialSpun = true;
                        top.spin = Math.min(MAX_SPIN, (top.spin || 0) + 100);
                        (top as any).introSpinCount = ((top as any).introSpinCount || 0) + 1;
                        (top as any).introShake = 8; // trigger visual shake intensity
                    }
                }
            });
        }
        return;
    }
    
    if (engine.versusEndActive || engine.areaTransitionState !== 'none') {
        return;
    }
    if (!engine.keys.has(e.code)) {
        engine.keys.add(e.code);

        // Fast-forward '+' hotkey
        if (e.key === '+' || e.key === '=') {
            if (engine.gameMode === 'campaign' && engine.areaTransitionState === 'none') {
                const nextTargetTime = (engine.areaCycle + 1) * 120;
                engine.timeElapsed = nextTargetTime;
            }
        }
        
        // Check Zombie Siege mashing during clinging status: Only allow spin button to mash/breakout!
        if (engine.zombieSiegeActive && engine.siegeStatus === 'clinging') {
            const player = engine.tops.find(t => t.id === engine.siegeTargetPlayerId);
            if (player && player.controls) {
                const c = player.controls;
                let isSpinPress = e.code === c.spin || checkSkillPress(e, c);
                if (player.label === 'P4' && (e.code === 'Numpad7' || e.code === 'Digit7' || e.key === '7')) {
                    isSpinPress = true;
                } else if (c.spin === 'KeyQ' && (e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q')) {
                    isSpinPress = true;
                } else if (c.spin === 'KeyU' && (e.code === 'KeyU' || e.key === 'u' || e.key === 'U')) {
                    isSpinPress = true;
                } else if (c.spin === 'Enter' && e.code === 'Enter') {
                    isSpinPress = true;
                }

                if (isSpinPress) {
                    engine.siegeMashCount++;
                    // Particles & camera jitter feedback
                    EffectSystem.addParticles(engine, player.x, player.y, '#fbbf24', 10, 250, 5);
                    EffectSystem.addParticles(engine, player.x, player.y, '#38bdf8', 6, 200, 4);
                    engine.screenShakeTimer = Math.max(engine.screenShakeTimer, 0.15);
                }
            }
        }
        
        // "2.戰鬥中，若按下"Y"，則可以強制開啟未加入的P位，並讓AI去控制這些陀螺行為。"
        if (e.code === 'KeyY' || e.key === 'y' || e.key === 'Y') {
            engine.forceActivateInactiveSlots();
        }

        // "4.戰鬥中，若按下"R"，則可以立即呼叫魔王怪物登場。"
        if (engine.gameMode === 'campaign' && (e.code === 'KeyR' || e.key === 'r' || e.key === 'R')) {
            SpawnSystem.spawnBoss(engine);
        }

        // 按下"P"鍵，立即將所有機率水池與累積水位（iBuffer）重設回初始基準 LV5 (0)
        if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
            ProbabilityManager.getInstance().resetPool();
            SoundSystem.play('pickupCoin_1');
        }

        // 新增一個主戰鬥中的快捷鍵"*"，輸入時，場中央會立即生成一個彩虹色鑰匙道具。
        if (e.key === '*') {
            engine.items.push({
                id: `key_${Date.now()}_${Math.random()}`,
                type: 'item_key',
                x: 1920 / 2,
                y: engine.activeArenaCenterY ?? (1080 / 2),
                vx: 0,
                vy: 0,
                radius: 20,
                mass: 1,
                markForDeletion: false,
            });
        }

        // 新增快捷鍵"*"來測試殺死非BOSS敵人後有1/3400機率掉落的鑰匙道具（彈出、停留2秒、自動飛往上方鑰匙UI）
        if (e.key === '*' || e.code === 'NumpadMultiply') {
            engine.spawnDroppedKey(1920 / 2, engine.activeArenaCenterY ?? (1080 / 2));
        }

        // P1-P4 Coin-In Keys: Digit1, Digit2, Digit3, Digit4 (Exclusively top row, no Numpad)
        let coinSlotIdx = -1;
        if (e.code === 'Digit1') coinSlotIdx = 0;
        else if (e.code === 'Digit2') coinSlotIdx = 1;
        else if (e.code === 'Digit3') coinSlotIdx = 2;
        else if (e.code === 'Digit4') coinSlotIdx = 3;

        if (coinSlotIdx !== -1) {
            engine.insertCoin(coinSlotIdx);
            const top = engine.tops.find(t => t.id === `top_${coinSlotIdx}`);
            if (top) {
                SoundSystem.play('pickupCoin_1');
                EffectSystem.addParticles(engine, top.x, top.y, '#10b981', 12, 180, 5);
                EffectSystem.addParticles(engine, top.x, top.y, '#34d399', 8, 240, 4);
            }
        }

        engine.tops.forEach(top => {
            // Ignore all key actions for target player during active zombie siege success breakout/fling performance
            if (engine.zombieSiegeActive && engine.siegeStatus === 'resolved_success' && top.id === engine.siegeTargetPlayerId) {
                return;
            }
            if (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0) {
                return;
            }

            if (top.launchPadState === 'prep_spinning') {
                if (!top.isAI && top.controls) {
                    let isSpinPress = e.code === top.controls.spin || checkSkillPress(e, top.controls);
                    if (top.label === 'P4' && (e.code === 'Numpad7' || e.code === 'Digit7' || e.key === '7')) {
                        isSpinPress = true;
                    }
                    if (isSpinPress) {
                        top.launchPadSpinCount = (top.launchPadSpinCount ?? 0) + 1;
                        EffectSystem.addParticles(engine, top.x, top.y, '#f59e0b', 8, 160, 2);
                        engine.screenShakeTimer = Math.max(engine.screenShakeTimer, 0.08);
                        engine.screenShakeIntensity = 2;
                    }
                }
                return;
            }
            if (top.launchPadState !== undefined) {
                return; // Ignore controls during other launch pad processes!
            }
            if (!top.isAI && top.controls) {
                const isClinging = engine.zombieSiegeActive && engine.siegeStatus === 'clinging' && top.id === engine.siegeTargetPlayerId;

                // check for Model 1 Skill Press
                let isSkillPress = checkSkillPress(e, top.controls);
                
                if (top.struggleMashCount !== undefined) {
                    if (isSkillPress) {
                        top.struggleMashCount++;
                        // Spawn bright tapping energy sparks around player top
                        EffectSystem.addParticles(engine, top.x, top.y, '#38bdf8', 12, 350, 5);
                        EffectSystem.addParticles(engine, top.x, top.y, '#ffffff', 6, 250, 3);
                        engine.screenShakeTimer = 0.15;
                        engine.screenShakeIntensity = 4;
                    }
                    return; // Bypass normal skill triggers during active wrestle clash!
                }

                if (isClinging) {
                    isSkillPress = false; // Disable all skill triggers under pinned/surrounded status!
                }
                
                if (top.coopState) {
                    if (isSkillPress) {
                        top.coopState.coopSpinCount++;
                    }
                    return;
                }

                let isSpinPress = e.code === top.controls.spin || isSkillPress;
                // For P4, support both Digit7 and Numpad7 for ease of use
                if (top.label === 'P4' && (e.code === 'Numpad7' || e.code === 'Digit7' || e.key === '7')) {
                    isSpinPress = true;
                }
                if (isSpinPress) {
                    if (top.state === 'dash') {
                        return;
                    }
                    top.spinIdleTime = 0;
                    top.virtualSpinHoldTimer = 0.5;
                    
                    // Check if spin tutorial is active and not yet triggered
                    if (top.spinTutorialTimer !== undefined && top.spinTutorialTimer > 0 && !top.spinTutorialSpun) {
                        top.spinTutorialSpun = true;
                        // 1 second later, the display will finish early
                        top.spinTutorialTimer = Math.min(top.spinTutorialTimer, 1.0);
                    }

                         if (false) {
                             // Cancel dash immediately and transition to standby circling behavior!
                            top.state = 'standby';
                            top.dashTimer = 0;
                            top.dashTrailTimer = 0;
                            top.dashInputHistory = [];
                            top.dashSpinHoldTimer = 0;
                            top.dirKeyPressDuration = 0;

                            const velocityAngle = Math.atan2(top.vy, top.vx);
                            top.standbyAngle = velocityAngle + Math.PI / 2;
                            top.standbyCenterX = top.x - Math.cos(top.standbyAngle) * getStandbyRadiusForModel(top, engine,  top.standbyAngle);
                            top.standbyCenterY = top.y - Math.sin(top.standbyAngle) * getStandbyRadiusForModel(top, engine,  top.standbyAngle);

                            // Emerald / Cyan energy dissipation shockwave & particle burst feedback
                            EffectSystem.addParticles(engine, top.x, top.y, '#38bdf8', 35, 240, 6);
                            engine.shockwaves.push({
                                x: top.x,
                                y: top.y,
                                radius: 10,
                                maxRadius: 120,
                                speed: 350,
                                color: 'rgba(56, 189, 248, 0.85)',
                                thickness: 5,
                                life: 0.35,
                                maxLife: 0.35
                            });

                            // Increase spin as part of the press (exactly 0.5 grid = 50 spin points)
                            top.spin = Math.min(MAX_SPIN, top.spin + 50);
                            return;
                        }

                    top.spin = Math.min(MAX_SPIN, top.spin + 50); // 0.5 grid boost (50 spin points) per press
                    return;
                }

                // Sudden Directional Impulse with a Cooldown & 8-direction Input Buffering Window
                const isDirPress = e.code === top.controls.up || 
                                   e.code === top.controls.down || 
                                   e.code === top.controls.left || 
                                   e.code === top.controls.right;

                if (isDirPress && !isClinging && (top.spin >= 0 || (top.superTimer !== undefined && top.superTimer > 0))) {
                    if (top.dashPendingTimer === undefined || top.dashPendingTimer <= 0) {
                        top.dashPendingTimer = 0.08; // 80ms window to register other keys for diagonal directions
                    }
                }
            }
        });
    }
}
export function handleKeyUp(engine: GameEngine, e: KeyboardEvent) {
    engine.keys.delete(e.code);
}

