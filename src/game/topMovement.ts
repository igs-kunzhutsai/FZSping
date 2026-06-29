import * as InputSystem from './systems/InputSystem';
import * as EffectSystem from './systems/EffectSystem';
import * as EventSystem from './systems/EventSystem';
import * as CollisionSystem from './systems/CollisionSystem';
import * as GameUtils from './systems/GameUtils';
import * as SpawnSystem from './systems/SpawnSystem';
import { updatePlayerAI } from './playerAI';
import type { GameEngine } from './GameEngine';
import { MAX_SPIN, TOP_RADIUS } from './constants';
import { Top } from './types';
import { checkCircleBoxCollision, resolveCircleBoxCollision } from './physics';

    export function getStandbyRadius(top: Top, engine: GameEngine): number {
        // Fix standby radius to always use the lowest possible spin (0) per user request
        const currentSpin = 0;
        const ratio = Math.max(0, Math.min(1, currentSpin / MAX_SPIN));
        // Base radius is 70 * 0.5 = 35. Original max radius (at ratio = 1) was 70 * 1.5 = 105.
        // Increasing max radius by 50% yields 105 * 1.5 = 157.5.
        // We interpolate smoothly between 35 and 157.5: 35 + 122.5 * ratio.
        return 35 + 122.5 * ratio;
    }


    export function getStandbyRadiusForModel(top: Top, engine: GameEngine, angle: number): number {
        // All models are unified to use Model 1's standard circular standby radius per user request
        return getStandbyRadius(top, engine);
    }


    export function updateTopStandby(top: Top, engine: GameEngine, dt: number) {
        top.state = 'standby';
        top.dashCount = 0;

        // Initialize or update spinInputFactor for user/AI acceleration commands
        if (top.spinInputFactor === undefined) {
            top.spinInputFactor = 0;
        }
        if (top.isSpinning) {
            top.spinInputFactor = Math.min(1.0, top.spinInputFactor + dt * 0.5); // Gradually expand orbit to 150px over 2 seconds
        } else {
            top.spinInputFactor = Math.max(0.0, top.spinInputFactor - dt * 2.0); // Rapidly shrink within 0.5s (decay rate = 1.0/0.5s = 2.0/s)
        }

        let breakoutRadiusBonus = 0;
        let isBreakout = false;

        if (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0) {
            top.breakoutOrbitTimer -= dt;
            if (top.breakoutOrbitTimer < 0) {
                top.breakoutOrbitTimer = 0;
            }
            isBreakout = true;
            const tRatio = top.breakoutOrbitTimer / 1.0; // 1.0 -> 0 value
            breakoutRadiusBonus = 150 * Math.sin(tRatio * Math.PI); // beautiful wide orbit swell peaking at 150px

            // Keep the standby center perfectly locked at the pinned center during breakout orbit loop
            // to execute the majestic 360-degree breakout orbit loop without sliding away or registering keyboard drift velocities!
            if (engine.siegeTargetStartX !== undefined && engine.siegeTargetStartY !== undefined && engine.siegeTargetPlayerId === top.id) {
                top.standbyCenterX = engine.siegeTargetStartX;
                top.standbyCenterY = engine.siegeTargetStartY;
            }
            top.standbyCenterVx = 0;
            top.standbyCenterVy = 0;

            // Spawn beautiful breakout energy trails and spark particles
            if (Math.random() < 0.4) {
                engine.particles.push({
                    x: top.x,
                    y: top.y,
                    vx: (Math.random() - 0.5) * 150,
                    vy: (Math.random() - 0.5) * 150,
                    life: 0.5,
                    maxLife: 0.5,
                    color: Math.random() < 0.5 ? '#f472b6' : '#ffffff',
                    size: Math.random() * 4 + 2,
                    isSpark: true
                });
            }
        }

        const currentSpin = top.smoothSpin ?? top.spin ?? MAX_SPIN;
        // Fix orbit speed calculation in standby to always assume the lowest possible spin (0) per user request
        const currentSpinForOrbit = 0;
        const orbitSpeed = 2.5 + Math.pow(currentSpinForOrbit / MAX_SPIN, 2.0) * 5.5 + (top.spinBoostFactor ?? 0) * 6.0;
        
        let factor = 1.0;
        let radiusFactor = 1.0;
        
        if (top.introOrbitTime !== undefined) {
            top.introOrbitTime += dt;
            const duration = 1.8; // 1.8 seconds to reach full state
            const progress = Math.min(1.0, top.introOrbitTime / duration);
            
            // Seamless smoothstep ease-in-out: starts with 0 velocity and speed, ends elegantly with 0 acceleration
            factor = 3.0 * Math.pow(progress, 2.0) - 2.0 * Math.pow(progress, 3.0);
            
            // Same ultra-smooth curve for standby radius expansion to avoid any starting jolt
            radiusFactor = 3.0 * Math.pow(progress, 2.0) - 2.0 * Math.pow(progress, 3.0);
        }

        let speedMultiplier = 1.0; // Unified to 1.0 for all models to match Model 1's standby behavior
        // When accelerating/spinning, speed varies with spin value - Increased difference between low and high spin per user request
        const spinRatioForOrbit = (top.spin ?? MAX_SPIN) / MAX_SPIN;
        const spinningOrbitSpeed = 1.5 + 14.5 * spinRatioForOrbit;
        const standbyOrbitSpeed = orbitSpeed * factor * speedMultiplier;
        // Interpolate speed based on spinInputFactor for smooth acceleration speed transition
        const currentOrbitSpeed = isBreakout ? 15.0 : (standbyOrbitSpeed + (spinningOrbitSpeed - standbyOrbitSpeed) * (top.spinInputFactor ?? 0));
        top.standbyAngle = (top.standbyAngle ?? 0) - currentOrbitSpeed * dt;

        // Ensure standby center and velocities exist
        if (top.standbyCenterX === undefined) top.standbyCenterX = top.x;
        if (top.standbyCenterY === undefined) top.standbyCenterY = top.y;
        if (top.standbyCenterVx === undefined) top.standbyCenterVx = 0;
        if (top.standbyCenterVy === undefined) top.standbyCenterVy = 0;

        // Maintain & update joystickReboundTimer if present
        if (top.joystickReboundTimer === undefined) {
            top.joystickReboundTimer = 0;
        }
        if (top.joystickReboundTimer > 0) {
            top.joystickReboundTimer -= dt;
            if (top.joystickReboundTimer < 0) {
                top.joystickReboundTimer = 0;
            }
        }

        // Support joystick continuous control
        let inputX = 0;
        let inputY = 0;
        let isActivelyPushing = false;
        if (!top.isAI && top.controls) {
            const isClinging = (engine.zombieSiegeActive && (engine.siegeStatus === 'clinging' || engine.siegeStatus === 'resolved_success') && top.id === engine.siegeTargetPlayerId) || top.launchPadState !== undefined || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0) || engine.transitionState === 'buffer';
            if (!isClinging && !engine.versusEndActive) {
                if (engine.keys.has(top.controls.up)) inputY -= 1;
                if (engine.keys.has(top.controls.down)) inputY += 1;
                if (engine.keys.has(top.controls.left)) inputX -= 1;
                if (engine.keys.has(top.controls.right)) inputX += 1;
                if (inputX !== 0 || inputY !== 0) {
                    isActivelyPushing = true;
                }
            }
        } else if (top.isAI) {
            const target = GameUtils.getNearestEnemy(engine, top);
            const aiResult = updatePlayerAI(top, engine, dt, target);
            inputX = aiResult.inputX;
            inputY = aiResult.inputY;
            isActivelyPushing = aiResult.isActivelyPushing;
            (top as any).isSpinningFromAI = aiResult.isSpinning;
        }

    top.isActivelyPushing = isActivelyPushing;

        if (isActivelyPushing) {
            top.spin = Math.max(100, (top.spin ?? MAX_SPIN) - dt * 50);
        }

        const isRebounding = (top.joystickReboundTimer ?? 0) > 0;

        if (isActivelyPushing && !isRebounding) {
            const len = Math.hypot(inputX, inputY) || 1;
            const ndx = inputX / len;
            const ndy = inputY / len;
            
            // Continuous movement speed scales beautifully with spin rate - Increased difference per user request
            const spinRatio = (top.spin ?? MAX_SPIN) / MAX_SPIN;
            // Base speed is much lower at 0 spin, but ramps up higher at max spin to maintain similar max speed
            let joystickSpeed = (120 + 720 * spinRatio) * 1.3 * 1.5;
            if (top.isAI) {
                // Limited basic movement speed for AI, matching human hand control and keeping it under control
                // Adjusted AI speed to also reflect higher contrast between low and high spin
                joystickSpeed = (80 + 260 * spinRatio);
            }
            
            top.standbyCenterVx = ndx * joystickSpeed;
            top.standbyCenterVy = ndy * joystickSpeed;
            
            // Occasionally spawn subtle micro dust trail particles for high-speed feel
            if (Math.random() < 0.12) {
                engine.particles.push({
                    x: top.x, y: top.y,
                    vx: -ndx * 50 + (Math.random() - 0.5) * 20,
                    vy: -ndy * 50 + (Math.random() - 0.5) * 20,
                    life: 0.3, maxLife: 0.3,
                    color: top.color,
                    size: Math.random() * 3 + 1
                });
            }
        } else {
            // If currently spinning and not pushing direction, completely zero out slide velocities of the standby center to stay fixed in place
            if (top.isSpinning && !isRebounding) {
                top.standbyCenterVx = 0;
                top.standbyCenterVy = 0;
            }
        }

        // Apply sliding velocity of the standby center
        top.standbyCenterX += top.standbyCenterVx * dt;
        top.standbyCenterY += top.standbyCenterVy * dt;

        // Friction decay on the standby center velocity
        if (top.customKnockbackTimer !== undefined && top.customKnockbackTimer > 0) {
            top.customKnockbackTimer = Math.max(0, top.customKnockbackTimer - dt);
        }

        const standbySpd = Math.hypot(top.standbyCenterVx, top.standbyCenterVy);
        let decay = 0.96;
        if (top.customKnockbackTimer !== undefined && top.customKnockbackTimer > 0) {
            decay = Math.exp(-6.0 * dt);
        } else if (standbySpd > 100) {
            // Apply decay curve so that bounce is snappy
            decay = Math.max(0.65, Math.exp(-12.0 * dt));
        } else {
            decay = Math.exp(-4.0 * dt);
        }
        
        // Decay speed when not actively driving, OR when undergoing active physics rebound bounce
        if (!isActivelyPushing || isRebounding) {
            top.standbyCenterVx *= decay;
            top.standbyCenterVy *= decay;
        }

        // Clamp standby center inside arena boundaries to avoid getting stuck outside
        // Set margin strictly to TOP_RADIUS so the orbiting-top's coordinate can easily reach the outer arena edges
        const margin = TOP_RADIUS;
        const clampedCenter = GameUtils.clampToCapsule(engine, top.standbyCenterX, top.standbyCenterY, margin);
        
        // Arena boundary collision bounce/rebound!
        if (clampedCenter.x !== top.standbyCenterX || clampedCenter.y !== top.standbyCenterY) {
            const dx = top.standbyCenterX - clampedCenter.x;
            const dy = top.standbyCenterY - clampedCenter.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
                const nx = dx / dist;
                const ny = dy / dist;
                const dot = (top.standbyCenterVx || 0) * nx + (top.standbyCenterVy || 0) * ny;
                // Since normal nx/ny points outwards (towards the wall), meeting the wall means dot > 0
                if (dot > 0) {
                    top.standbyCenterVx = (top.standbyCenterVx || 0) - 2.2 * dot * nx;
                    top.standbyCenterVy = (top.standbyCenterVy || 0) - 2.2 * dot * ny;
                    
                    // Add wall spark particles at the boundary and juice up with screenshake
                    EffectSystem.addChainsawSparkParticles(engine, clampedCenter.x, clampedCenter.y, nx, ny, 16);
                    engine.screenShakeTimer = Math.max(engine.screenShakeTimer ?? 0, 0.15);
                    top.joystickReboundTimer = 0.25;
                }
            }
        }
        top.standbyCenterX = clampedCenter.x;
        top.standbyCenterY = clampedCenter.y;

        // Position on orbit circle or rose curve (for 2號陀螺 / Model 2)
        let targetX: number;
        let targetY: number;
        let orbitalVx: number;
        let orbitalVy: number;

        // All top models unified to execute Model 1's standard pristine circular orbit with dynamic expansion per user request
        const standbyRadius = getStandbyRadius(top, engine) * radiusFactor;
        const currentRadius = isBreakout ? (standbyRadius + breakoutRadiusBonus) : (standbyRadius + (150 - standbyRadius) * (top.spinInputFactor ?? 0) + breakoutRadiusBonus);

        targetX = top.standbyCenterX + Math.cos(top.standbyAngle) * currentRadius;
        targetY = top.standbyCenterY + Math.sin(top.standbyAngle) * currentRadius;

        orbitalVx = currentRadius * Math.sin(top.standbyAngle) * currentOrbitSpeed;
        orbitalVy = -currentRadius * Math.cos(top.standbyAngle) * currentOrbitSpeed;

        top.vx = orbitalVx + top.standbyCenterVx;
        top.vy = orbitalVy + top.standbyCenterVy;

        top.x = targetX + (top.deflectionX ?? 0);
        top.y = targetY + (top.deflectionY ?? 0);

        // 1. Check capsule boundary collision for the actual top body
        const actualClamped = GameUtils.clampToCapsule(engine, top.x, top.y, top.radius || TOP_RADIUS);
        if (actualClamped.x !== top.x || actualClamped.y !== top.y) {
            const dx = top.x - actualClamped.x;
            const dy = top.y - actualClamped.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
                const nx = dx / dist;
                const ny = dy / dist;
                
                // Dot product of current standby velocity and normal
                const dot = (top.standbyCenterVx || 0) * nx + (top.standbyCenterVy || 0) * ny;
                // Since normal nx/ny points outwards (towards the wall), meeting the wall means dot > 0
                if (dot > 0) {
                    // Rebound velocity!
                    top.standbyCenterVx = (top.standbyCenterVx || 0) - 2.2 * dot * nx;
                    top.standbyCenterVy = (top.standbyCenterVy || 0) - 2.2 * dot * ny;
                    
                    // Physically push back standby center away from the wall (subtract since nx points outwards)
                    top.standbyCenterX -= nx * (dist + 5);
                    top.standbyCenterY -= ny * (dist + 5);
                    
                    // Spawn wall spark particles and juice up with screenshake
                    EffectSystem.addChainsawSparkParticles(engine, actualClamped.x, actualClamped.y, nx, ny, 20);
                    engine.screenShakeTimer = Math.max(engine.screenShakeTimer ?? 0, 0.22);
                    top.joystickReboundTimer = 0.25;
                }
            }
            top.x = actualClamped.x;
            top.y = actualClamped.y;
        }

        // 2. Check collision with concrete block obstacles for the actual top body during standby mode
        engine.concreteBlocks.forEach(block => {
            if (block.markForDeletion) return;
            
            // Check bounding box overlap using checkCircleBoxCollision
            if (checkCircleBoxCollision(top, block)) {
                // Determine collision normal and overlap using resolveCircleBoxCollision
                const res = resolveCircleBoxCollision(top, block, 1.2);
                if (res) {
                    // Bounce standby center back
                    const dot = (top.standbyCenterVx || 0) * res.nx + (top.standbyCenterVy || 0) * res.ny;
                    if (dot < 0) {
                        top.standbyCenterVx = (top.standbyCenterVx || 0) - 2.2 * dot * res.nx;
                        top.standbyCenterVy = (top.standbyCenterVy || 0) - 2.2 * dot * res.ny;
                        
                        top.standbyCenterX += res.nx * 5;
                        top.standbyCenterY += res.ny * 5;
                        
                        top.joystickReboundTimer = 0.25;
                    }
                    
                    // Bullet/impact sparks at edge
                    const collisionX = top.x - res.nx * (top.radius || TOP_RADIUS);
                    const collisionY = top.y - res.ny * (top.radius || TOP_RADIUS);
                    EffectSystem.addChainsawSparkParticles(engine, collisionX, collisionY, res.nx, res.ny, 18);
                    
                    // Apply visual flash to block
                    block.flashTimer = 0.15;
                    block.durability = (block.durability ?? 5) - 1;
                    if (block.durability <= 0) {
                        block.markForDeletion = true;
                        EffectSystem.addParticles(engine, block.x, block.y, '#64748b', 40, 300, 10);
                        engine.screenShakeTimer = 0.4;
                    }
                }
            }
        });
    }
