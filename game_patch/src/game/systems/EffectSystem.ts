import * as InputSystem from './InputSystem';
import * as EventSystem from './EventSystem';
import * as CollisionSystem from './CollisionSystem';
import * as GameUtils from './GameUtils';
import * as SpawnSystem from './SpawnSystem';
import type { GameEngine } from '../GameEngine';
import { checkRayCircleCollision } from '../GameEngine';
import { SoundSystem } from './SoundSystem';

export function addParticles(engine: GameEngine, x: number, y: number, color: string, count: number, maxSpeed: number = 200, sizeBase=8) {
    for(let i=0; i<count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = Math.random() * maxSpeed;
        engine.particles.push({
            x, y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 1.0, maxLife: 0.5 + Math.random(),
            color,
            size: Math.random() * sizeBase + 4
        });
    }
}

export function spawnSkillKillExplosion(engine: GameEngine, x: number, y: number, isBoss: boolean = false) {
    SoundSystem.play('Attack_Slash_020');
    const sizeScale = isBoss ? 1.0 : 0.75;
    // 1. Add central star-shaped burst
    engine.particles.push({
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        life: 0.30, 
        maxLife: 0.30,
        color: '#f97316', // Orange
        size: 150 * sizeScale, 
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
            x: x,
            y: y,
            vx: Math.cos(baseAng) * sparkSpeed,
            vy: Math.sin(baseAng) * sparkSpeed,
            life: (0.4 + Math.random() * 0.2) / 1.5, // 50% faster life decay
            maxLife: 0.6 / 1.5,
            color: chosenColor,
            size: (18 + Math.random() * 12) * sizeScale,
            isStarSpark: true,
            angle: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 6) * 1.5 // 50% faster rotation
        });
    }
}

export function addChainsawSparkParticles(engine: GameEngine, x: number, y: number, nx: number, ny: number, count = 25, forceMultiplier = 1.0, spinVal?: number) {
    SoundSystem.play('SE-Bay2');
    let finalSpin = spinVal;
    if (finalSpin === undefined) {
        // Dynmically scan nearby tops if spin is not explicitly provided (sensible design fallback)
        let maxNearbySpin = 0;
        engine.tops.forEach(top => {
            const dist = Math.hypot(top.x - x, top.y - y);
            if (dist < 120) {
                if (top.spin > maxNearbySpin) {
                    maxNearbySpin = top.spin;
                }
            }
        });
        if (maxNearbySpin > 0) {
            finalSpin = maxNearbySpin;
        }
    }

    const len = Math.hypot(nx, ny);
    const nX = len > 0 ? nx / len : 0;
    const nY = len > 0 ? ny / len : 0;

    // Ensure we do not decrease the particle count (spinScale is at least 1.0)
    const spinScale = finalSpin !== undefined ? Math.max(1.0, 1.0 + (finalSpin / 1000) * 1.5) : 1.0;
    const finalCount = Math.round(count * spinScale);

    for (let i = 0; i < finalCount; i++) {
        // Pick positive or negative tangent direction along the collision surface
        const isPositiveTangent = Math.random() < 0.5;
        const tDir = isPositiveTangent ? 1 : -1;
        const tx = -nY * tDir;
        const ty = nX * tDir;

        // Chainsaw sparks have extremely high tangential velocities, which scale with spin speed
        const speedScale = finalSpin !== undefined ? Math.max(1.0, 1.0 + (finalSpin / 1000) * 0.50) : 1.0;
        const speedT = (0.4 + Math.random() * 0.6) * 650 * forceMultiplier * speedScale;
        // Slight outward normal velocity/bounce to fly off the walls and objects
        const speedN = (0.05 + Math.random() * 0.35) * 150 * forceMultiplier * speedScale;

        // Add a slight random noise to the tangent vector to spread the sparks beautifully (like a grinding arc)
        const spreadFactor = 0.15; // 15% spread angle variance
        const rx = tx + (Math.random() - 0.5) * spreadFactor;
        const ry = ty + (Math.random() - 0.5) * spreadFactor;

        const vx = rx * speedT + nX * speedN;
        const vy = ry * speedT + nY * speedN;

        // Random colors for high heat metal sparks (White-hot -> Amber/Yellow -> Orange -> Red)
        const roll = Math.random();
        let color = '#f97316'; // orange default
        const sizeScale = finalSpin !== undefined ? Math.max(1.0, 1.0 + (finalSpin / 1000) * 0.35) : 1.0;
        let size = (Math.random() * 2.5 + 2.0) * sizeScale;

        if (roll < 0.20) {
            color = '#ffffff'; // white-hot peak core
            size = (Math.random() * 2.0 + 2.5) * sizeScale;
        } else if (roll < 0.55) {
            color = '#fbbf24'; // beautiful bright yellow
            size = (Math.random() * 2.5 + 2.0) * sizeScale;
        } else if (roll < 0.88) {
            color = '#ff6b00'; // fiery bright orange
            size = (Math.random() * 2.8 + 1.8) * sizeScale;
        } else {
            color = '#dc2626'; // intense glowing red
            size = (Math.random() * 2.0 + 1.5) * sizeScale;
        }

        // High velocity sparks decay rapidly for a fast, sharp feeling (0.15s - 0.45s)
        // Scale up lifetime slightly with higher spin for a wider, more dramatic arc
        const lifeScale = finalSpin !== undefined ? Math.max(1.0, 1.0 + (finalSpin / 1000) * 0.25) : 1.0;
        const life = (0.15 + Math.random() * 0.30) * lifeScale;

        engine.particles.push({
            x,
            y,
            vx,
            vy,
            life,
            maxLife: life,
            color,
            size,
            isChainsawSpark: true
        } as any);
    }
}

export function updateProjectiles(engine: GameEngine, dt: number) {
    engine.projectiles.forEach(proj => {
        // Find nearest target (zombies or opponent tops) for auto-homing ammunition behavior
        let targetX = 0;
        let targetY = 0;
        let targetFound = false;
        let minDist = Infinity;

        if (!proj.isBombBeam) {
            engine.zombies.forEach(z => {
                if (z.markForDeletion || z.hp <= 0 || (z as any).isSiegeZombie) return;
                const d = Math.hypot(z.x - proj.x, z.y - proj.y);
                if (d < minDist) {
                    minDist = d;
                    targetX = z.x;
                    targetY = z.y;
                    targetFound = true;
                }
            });

            engine.tops.forEach(t => {
                if (t.id === proj.ownerId || t.markForDeletion || t.hp <= 0) return;
                const d = Math.hypot(t.x - proj.x, t.y - proj.y);
                if (d < minDist) {
                    minDist = d;
                    targetX = t.x;
                    targetY = t.y;
                    targetFound = true;
                }
            });
        }

        if (targetFound) {
            const speed = Math.hypot(proj.vx, proj.vy);
            if (speed > 10) {
                const desiredX = targetX - proj.x;
                const desiredY = targetY - proj.y;
                const desiredDist = Math.hypot(desiredX, desiredY);
                if (desiredDist > 1) {
                    const dx = (desiredX / desiredDist) * speed;
                    const dy = (desiredY / desiredDist) * speed;

                    // Smoothly steer velocity towards target
                    const ease = 3.8;
                    proj.vx += (dx - proj.vx) * ease * dt;
                    proj.vy += (dy - proj.vy) * ease * dt;

                    // Keep speed constant
                    const curSpeed = Math.hypot(proj.vx, proj.vy);
                    if (curSpeed > 0) {
                        proj.vx = (proj.vx / curSpeed) * speed;
                        proj.vy = (proj.vy / curSpeed) * speed;
                    }
                }
            }
        }

        if (!proj.isBombBeam) {
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;
        }
        proj.life -= dt;

        if (!proj.trail) {
            proj.trail = [];
        }
        if (!proj.isBombBeam) {
            proj.trail.push({ x: proj.x, y: proj.y });
            if (proj.trail.length > 20) {
                proj.trail.shift();
            }
        }

        // Arena boundary check (capsule ring R=480, height/center configs)
        const R = 480;
        const centerY = engine.activeArenaCenterY ?? 540;
        const leftCenterX = 540;
        const rightCenterX = 1380;
        let hitsWall = false;

        if (!proj.isBombBeam) {
            if (proj.x < leftCenterX) {
                const d = Math.hypot(proj.x - leftCenterX, proj.y - centerY);
                if (d > R) hitsWall = true;
            } else if (proj.x > rightCenterX) {
                const d = Math.hypot(proj.x - rightCenterX, proj.y - centerY);
                if (d > R) hitsWall = true;
            } else {
                if (proj.y < centerY - R || proj.y > centerY + R) {
                    hitsWall = true;
                }
            }
        }

        if (hitsWall) {
            proj.life = 0; // instantly destroy
            // Spawn tiny wall sparks
            addParticles(engine, proj.x, proj.y, proj.color, 4, 100, 2);
            return;
        }

        if (!proj.hitIds) {
            proj.hitIds = [];
        }

        // Collision with Zombies
        engine.zombies.forEach(z => {
            if (proj.life <= 0 || z.markForDeletion || z.hp <= 0 || proj.hitIds!.includes(z.id) || (z as any).isSiegeZombie) return;
            const isBig = z.type === 'zombie_big' || z.type === 'zombie_bomb' || z.type === 'zombie_bouncing';
            const zRadius = z.radius;
            
            let hit = false;
            if (proj.isBombBeam) {
                // For Bomb Beams, vx/vy are direction vectors, radius is laserHalfWidth
                hit = checkRayCircleCollision(proj.x, proj.y, proj.vx, proj.vy, z.x, z.y, zRadius, proj.radius);
            } else {
                const dist = Math.hypot(z.x - proj.x, z.y - proj.y);
                hit = dist <= zRadius + proj.radius;
            }

            if (hit) {
                proj.hitIds!.push(z.id);
                GameUtils.applyDamageToZombie(engine, z, proj.damage, proj.ownerId);
                if (z.type === 'zombie_boss') {
                    SoundSystem.play('SE-Explo1');
                }
                z.flashTimer = 0.15;
                addParticles(engine, z.x, z.y, proj.color, 8, 120, 3);
                addParticles(engine, z.x, z.y, '#ffffff', 4, 140, 2);

                if (z.hp <= 0) {
                    if (!GameUtils.handleZombieDeath(engine, z, proj.ownerId)) return;
                    z.markForDeletion = true;
                    spawnSkillKillExplosion(engine, z.x, z.y, z.type === 'zombie_boss');
                    const points = z.type === 'zombie_boss' ? 500 : (isBig ? 50 : 10);
                    
                    const ownerMatch = proj.ownerId.match(/\d+/);
                    const ownerIdx = ownerMatch ? parseInt(ownerMatch[0], 10) : 0;
                    engine.addScore(ownerIdx, points);
                    
                    engine.spawnTicket(z.x, z.y, z.type, ownerIdx, z.id);

                    const ownerTop = engine.tops.find(t => t.id === proj.ownerId);
                    if (ownerTop) {
                        ownerTop.kills = (ownerTop.kills ?? 0) + 1;
                    }

                    // Play explosion shockwave
                    let selectCol = '#22c55e';
                    if (z.type === 'zombie_boss') selectCol = '#ea580c';
                    else if (z.type === 'zombie_big') selectCol = '#9333ea';
                    else if (z.type === 'zombie_bomb') selectCol = '#f97316';
                    else if (z.type === 'zombie_bouncing') selectCol = '#f472b6';
                    
                    engine.shockwaves.push({
                        x: z.x,
                        y: z.y,
                        radius: 0,
                        maxRadius: z.type === 'zombie_boss' ? 450 : (isBig ? 250 : 150),
                        speed: z.type === 'zombie_boss' ? 800 : (isBig ? 600 : 500),
                        color: selectCol,
                        thickness: z.type === 'zombie_boss' ? 20 : (isBig ? 12 : 8),
                        life: z.type === 'zombie_boss' ? 0.6 : 0.4,
                        maxLife: z.type === 'zombie_boss' ? 0.6 : 0.4
                    });
                }
            }
        });

        // Collision with opponent Tops (versus)
        if (proj.life > 0 && !proj.isBombBeam) {
            engine.tops.forEach(other => {
                if (proj.life <= 0 || other.id === proj.ownerId || other.markForDeletion || other.isExploding || other.hp <= 0 || proj.hitIds!.includes(other.id)) return;
                const dist = Math.hypot(other.x - proj.x, other.y - proj.y);
                if (dist <= other.radius + proj.radius) {
                    proj.hitIds!.push(other.id);
                    const isOtherInvincible = other.hitCooldown !== undefined && other.hitCooldown > 0;
                    const isOtherSuper = other.superTimer !== undefined && other.superTimer > 0;
                    if (!isOtherInvincible && !isOtherSuper) {
                        other.hp = Math.max(0, other.hp - proj.damage);
                        other.hitCooldown = 0.5; // smaller protection for bullet hit
                        other.flashTimer = 0.15;
                        other.damageShockTimer = 0.25;
                        other.visualHp = other.visualHp !== undefined ? Math.max(other.hp, other.visualHp) : other.hp;

                        addParticles(engine, proj.x, proj.y, proj.color, 8, 120, 3);
                        addParticles(engine, proj.x, proj.y, '#ffffff', 4, 140, 2);

                        if (other.hp <= 0) {
                            other.markForDeletion = true;
                            const ownerTop = engine.tops.find(t => t.id === proj.ownerId);
                            if (ownerTop) {
                                ownerTop.kills = (ownerTop.kills ?? 0) + 1;
                            }
                            const ownerMatch = proj.ownerId.match(/\d+/);
                            const ownerIdx = ownerMatch ? parseInt(ownerMatch[0], 10) : 0;
                            engine.addScore(ownerIdx, 150);
                        }
                    }
                }
            });
        }

        // Collision with obstacles
        if (proj.life > 0 && !proj.isBombBeam) {
            engine.obstacles.forEach(o => {
                if (proj.life <= 0 || o.markForDeletion || proj.hitIds!.includes(o.id)) return;
                const dist = Math.hypot(o.x - proj.x, o.y - proj.y);
                const oRadius = o.type === 'obstacle_barrel' ? 30 : 25;
                if (dist <= oRadius + proj.radius) {
                    proj.hitIds!.push(o.id);
                    if (o.type === 'obstacle_barrel') {
                        if (o.durability === undefined) o.durability = 1;
                        o.durability -= proj.damage;
                        o.flashTimer = 0.15;
                        addParticles(engine, proj.x, proj.y, proj.color, 8, 100, 3);
                        
                        if (o.durability <= 0) {
                            o.markForDeletion = true;
                            addParticles(engine, o.x, o.y, '#ef4444', 50, 400, 15);
                            engine.shockwaves.push({
                                x: o.x, y: o.y, radius: 10, maxRadius: 180, speed: 400,
                                color: 'rgba(239, 68, 68, 0.95)', thickness: 12, life: 0.45, maxLife: 0.45
                            });
                            engine.shockwaves.push({
                                x: o.x, y: o.y, radius: 5, maxRadius: 130, speed: 300,
                                color: 'rgba(251, 146, 60, 0.85)', thickness: 6, life: 0.4, maxLife: 0.4
                            });
                        }
                    } else {
                        // hit crate
                        addParticles(engine, proj.x, proj.y, proj.color, 6, 100, 2);
                    }
                }
            });
        }
    });

    // Filter and keep live projectiles
    engine.projectiles = engine.projectiles.filter(proj => proj.life > 0);
}

export function addGreyWallCollisionParticles(engine: GameEngine, x: number, y: number, count1 = 12, count2 = 5) {
    // Halved size: sizeBase of 4 instead of 8, so size is Math.random() * 2 + 2, or Math.random() * 4 + 2
    // Faster emission speed: maxSpeed of 220 and 160 instead of 100/75, and we force higher minimum speed
    // Tuned disappearing/fade-out speed: life = 0.65, maxLife = 0.65 (perfect sweet spot)
    for(let i=0; i<count1; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.5 + Math.random() * 0.5) * 220; 
        engine.particles.push({
            x, y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 0.65, maxLife: 0.65, 
            color: '#94a3b8',
            size: Math.random() * 3 + 1.5 // halved size
        });
    }
    for(let i=0; i<count2; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.5 + Math.random() * 0.5) * 160; 
        engine.particles.push({
            x, y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 0.65, maxLife: 0.65, 
            color: '#e2e8f0',
            size: Math.random() * 2 + 1 // halved size
        });
    }
}

export function addPurpleDashParticles(engine: GameEngine, x: number, y: number, count1 = 12, count2 = 5) {
    // Identical specs to grey wall collision particles:
    // Size: halved (sizeBase of 4, so size is Math.random() * 3 + 1.5, or Math.random() * 2 + 1)
    // Speed: 220 and 160 max with 0.5-1.0 multiplier
    // Life: 0.65 seconds
    for(let i=0; i<count1; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.5 + Math.random() * 0.5) * 220; 
        engine.particles.push({
            x, y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 0.65, maxLife: 0.65, 
            color: '#a855f7', // vibrant purple
            size: Math.random() * 3 + 1.5
        });
    }
    for(let i=0; i<count2; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.5 + Math.random() * 0.5) * 160; 
        engine.particles.push({
            x, y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 0.65, maxLife: 0.65, 
            color: '#e879f9', // beautiful lighter/pinkish purple
            size: Math.random() * 2 + 1
        });
    }
}

