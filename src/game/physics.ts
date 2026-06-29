import { Entity } from './types';

export function getEffectiveRadius(entity: Entity) {
    if (entity.type === 'zombie_boss' && !(entity as any).isDying) {
        if ((entity as any).bossAttackState === 'warning' || (entity as any).bossAttackState === 'dash' || (entity as any).bossAttackState === 'earthquake_leap' || ((entity as any).introZ !== undefined && (entity as any).introZ > 0)) {
            return 202.5; // Shield radius increases effective collision size
        }
    }
    return entity.radius;
}

export function checkCollision(a: Entity, b: Entity) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    return dist < (getEffectiveRadius(a) + getEffectiveRadius(b));
}

export function resolveCollision(a: Entity, b: Entity, bounciness = 0.8) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    
    const rA = getEffectiveRadius(a);
    const rB = getEffectiveRadius(b);

    if (dist === 0 || dist >= rA + rB) return null;
    
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = (rA + rB) - dist;
    
    // Resolve penetration fully to avoid sticking
    const totalMass = a.mass + b.mass;
    const mRatioA = b.mass / totalMass;
    const mRatioB = a.mass / totalMass;
    
    const isDashA = a.type === 'top' && (a as any).state === 'dash';
    const isDashB = b.type === 'top' && (b as any).state === 'dash';

    const isStandbyTopA_ZombieB = a.type === 'top' && (a as any).state === 'standby' && b.type.startsWith('zombie');
    const isZombieA_StandbyTopB = a.type.startsWith('zombie') && b.type === 'top' && (b as any).state === 'standby';

    const isBossA_Inv = (a.type === 'zombie_boss' && (
        (a as any).bossAttackState === 'warning' || 
        (a as any).bossAttackState === 'dash' ||
        (a as any).bossAttackState === 'earthquake_leap' || 
        ((a as any).introZ !== undefined && (a as any).introZ > 0)
    )) || (a.type === 'zombie_bomb' && (
        (a as any).bigAttackState === 'warning' || 
        (a as any).bigAttackState === 'earthquake_leap'
    )) || (a.type === 'zombie_bouncing' && (
        (a as any).bouncingAttackState === 'warning' ||
        (a as any).bouncingAttackState === 'bouncing' ||
        (a as any).bouncingAttackState === 'death_warning' ||
        (a as any).bouncingAttackState === 'death_bouncing'
    ));

    const isBossB_Inv = (b.type === 'zombie_boss' && (
        (b as any).bossAttackState === 'warning' || 
        (b as any).bossAttackState === 'dash' ||
        (b as any).bossAttackState === 'earthquake_leap' ||
        ((b as any).introZ !== undefined && (b as any).introZ > 0)
    )) || (b.type === 'zombie_bomb' && (
        (b as any).bigAttackState === 'warning' || 
        (b as any).bigAttackState === 'earthquake_leap'
    )) || (b.type === 'zombie_bouncing' && (
        (b as any).bouncingAttackState === 'warning' ||
        (b as any).bouncingAttackState === 'bouncing' ||
        (b as any).bouncingAttackState === 'death_warning' ||
        (b as any).bouncingAttackState === 'death_bouncing'
    ));

    let pushA = mRatioA;
    let pushB = mRatioB;

    if (isBossA_Inv) {
        pushA = 0;
        pushB = 1.0;
    } else if (isBossB_Inv) {
        pushA = 1.0;
        pushB = 0;
    } else if (isStandbyTopA_ZombieB) {
        pushA = 0;
        pushB = 1.0;
    } else if (isZombieA_StandbyTopB) {
        pushA = 1.0;
        pushB = 0;
    } else if (isDashA && !isDashB) {
        pushA = 0;
        pushB = 1.0;
    } else if (!isDashA && isDashB) {
        pushA = 1.0;
        pushB = 0;
    } else if (isDashA && isDashB) {
        const spinA = (a as any).spin || 0;
        const spinB = (b as any).spin || 0;
        if (spinA >= spinB) {
            pushA = 0;
            pushB = 1.0;
        } else {
            pushA = 1.0;
            pushB = 0;
        }
    }

    let aBoost = 1.0;
    let bBoost = 1.0;

    if (a.type === 'top') {
        const isEnemy = b.type.startsWith('zombie') || (b.type === 'top' && (a as any).isAI !== (b as any).isAI);
        if (isEnemy) {
            const spinRatio = ((a as any).spin ?? 1000) / 1000;
            // Accelerate rebound process speed by 50% (boost multiplied by 1.5)
            aBoost = (1.0 + Math.max(0, 1.0 - spinRatio) * 1.5) * 1.5;
        }
    }
    if (b.type === 'top') {
        const isEnemy = a.type.startsWith('zombie') || (a.type === 'top' && (a as any).isAI !== (b as any).isAI);
        if (isEnemy) {
            const spinRatio = ((b as any).spin ?? 1000) / 1000;
            // Accelerate rebound process speed by 50% (boost multiplied by 1.5)
            bBoost = (1.0 + Math.max(0, 1.0 - spinRatio) * 1.5) * 1.5;
        }
    }

    const shiftAx = -nx * overlap * pushA * aBoost;
    const shiftAy = -ny * overlap * pushA * aBoost;
    const shiftBx = nx * overlap * pushB * bBoost;
    const shiftBy = ny * overlap * pushB * bBoost;

    a.x += shiftAx;
    a.y += shiftAy;
    b.x += shiftBx;
    b.y += shiftBy;

    if (a.type === 'top' && (a as any).state === 'standby') {
        (a as any).standbyCenterX = ((a as any).standbyCenterX ?? a.x) + shiftAx;
        (a as any).standbyCenterY = ((a as any).standbyCenterY ?? a.y) + shiftAy;
    }
    if (b.type === 'top' && (b as any).state === 'standby') {
        (b as any).standbyCenterX = ((b as any).standbyCenterX ?? b.x) + shiftBx;
        (b as any).standbyCenterY = ((b as any).standbyCenterY ?? b.y) + shiftBy;
    }
    
    // Relative velocity
    const dvx = b.vx - a.vx;
    const dvy = b.vy - a.vy;
    const velAlongNormal = dvx * nx + dvy * ny;
    
    if (velAlongNormal > 0) return null; // moving apart
    
    // Save old velocities to capture net velocity change for standby centers
    const oldVxA = a.vx;
    const oldVyA = a.vy;
    const oldVxB = b.vx;
    const oldVyB = b.vy;

    // Apply bounce (amplitude enhanced 1.1x for a pleasant smooth feel)
    const impulse = -(1 + bounciness) * velAlongNormal / (1/a.mass + 1/b.mass) * 1.1;
    let finalImpulse = impulse;

    if (isBossA_Inv) {
        // Boss A has infinite mass, so boss A's velocity is unaffected. Only object B bounces.
        const specialImpulse = -(1 + bounciness) * velAlongNormal * b.mass * 1.1;
        b.vx += (specialImpulse / b.mass) * nx * bBoost;
        b.vy += (specialImpulse / b.mass) * ny * bBoost;
        finalImpulse = specialImpulse;
    } else if (isBossB_Inv) {
        // Boss B has infinite mass, so boss B's velocity is unaffected. Only object A bounces.
        const specialImpulse = -(1 + bounciness) * velAlongNormal * a.mass * 1.1;
        a.vx -= (specialImpulse / a.mass) * nx * aBoost;
        a.vy -= (specialImpulse / a.mass) * ny * aBoost;
        finalImpulse = specialImpulse;
    } else if (isStandbyTopA_ZombieB) {
        // Treat raw standby top (a) as having infinite mass. Only zombie (b) bounces.
        const specialImpulse = -(1 + bounciness) * velAlongNormal * b.mass * 1.1;
        b.vx += (specialImpulse / b.mass) * nx * bBoost;
        b.vy += (specialImpulse / b.mass) * ny * bBoost;
        finalImpulse = specialImpulse;
    } else if (isZombieA_StandbyTopB) {
        // Treat raw standby top (b) as having infinite mass. Only zombie (a) bounces.
        const specialImpulse = -(1 + bounciness) * velAlongNormal * a.mass * 1.1;
        a.vx -= (specialImpulse / a.mass) * nx * aBoost;
        a.vy -= (specialImpulse / a.mass) * ny * aBoost;
        finalImpulse = specialImpulse;
    } else if (isDashA && !isDashB) {
        // Treat a as infinite mass to b
        const specialImpulse = -(1 + bounciness) * velAlongNormal * b.mass * 1.1;
        b.vx += (specialImpulse / b.mass) * nx * bBoost;
        b.vy += (specialImpulse / b.mass) * ny * bBoost;
        finalImpulse = specialImpulse;
    } else if (!isDashA && isDashB) {
        // Treat b as infinite mass to a
        const specialImpulse = -(1 + bounciness) * velAlongNormal * a.mass * 1.1;
        a.vx -= (specialImpulse / a.mass) * nx * aBoost;
        a.vy -= (specialImpulse / a.mass) * ny * aBoost;
        finalImpulse = specialImpulse;
    } else if (isDashA && isDashB) {
        const spinA = (a as any).spin || 0;
        const spinB = (b as any).spin || 0;
        if (spinA >= spinB) {
            // A has higher spin. B is pushed away. A is unaffected
            const specialImpulse = -(1 + bounciness) * velAlongNormal * b.mass * 1.1;
            b.vx += (specialImpulse / b.mass) * nx * bBoost;
            b.vy += (specialImpulse / b.mass) * ny * bBoost;
            finalImpulse = specialImpulse;
        } else {
            // B has higher spin. A is pushed away. A is unaffected
            const specialImpulse = -(1 + bounciness) * velAlongNormal * a.mass * 1.1;
            a.vx -= (specialImpulse / a.mass) * nx * aBoost;
            a.vy -= (specialImpulse / a.mass) * ny * aBoost;
            finalImpulse = specialImpulse;
        }
    } else {
        const massFactorA = a.type === 'zombie_boss' ? 0.05 : 1.0;
        const massFactorB = b.type === 'zombie_boss' ? 0.05 : 1.0;
        
        a.vx -= (impulse / a.mass) * nx * massFactorA * aBoost;
        a.vy -= (impulse / a.mass) * ny * massFactorA * aBoost;
        b.vx += (impulse / b.mass) * nx * massFactorB * bBoost;
        b.vy += (impulse / b.mass) * ny * massFactorB * bBoost;
    }
    
    // Forcefully deflect a and b if they are tops and not in dash state, to avoid perfect retracing
    if (a.type === 'top' && !isDashA && !isStandbyTopA_ZombieB) {
        const speed = Math.hypot(a.vx, a.vy);
        if (speed > 1) {
            const sign = Math.random() < 0.5 ? -1 : 1;
            const angleRad = sign * (12 + Math.random() * 12) * Math.PI / 180;
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const newVx = a.vx * cos - a.vy * sin;
            const newVy = a.vx * sin + a.vy * cos;
            a.vx = newVx;
            a.vy = newVy;
        }
    }
    if (b.type === 'top' && !isDashB && !isZombieA_StandbyTopB) {
        const speed = Math.hypot(b.vx, b.vy);
        if (speed > 1) {
            const sign = Math.random() < 0.5 ? -1 : 1;
            const angleRad = sign * (12 + Math.random() * 12) * Math.PI / 180;
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const newVx = b.vx * cos - b.vy * sin;
            const newVy = b.vx * sin + b.vy * cos;
            b.vx = newVx;
            b.vy = newVy;
        }
    }

    if (a.type === 'top' && (a as any).state === 'standby' && !isStandbyTopA_ZombieB) {
        const dVx = a.vx - oldVxA;
        const dVy = a.vy - oldVyA;
        (a as any).standbyCenterVx = ((a as any).standbyCenterVx ?? 0) + dVx;
        (a as any).standbyCenterVy = ((a as any).standbyCenterVy ?? 0) + dVy;
        (a as any).joystickReboundTimer = 0.25;
    }
    if (b.type === 'top' && (b as any).state === 'standby' && !isZombieA_StandbyTopB) {
        const dVx = b.vx - oldVxB;
        const dVy = b.vy - oldVyB;
        (b as any).standbyCenterVx = ((b as any).standbyCenterVx ?? 0) + dVx;
        (b as any).standbyCenterVy = ((b as any).standbyCenterVy ?? 0) + dVy;
        (b as any).joystickReboundTimer = 0.25;
    }
    
    return { nx, ny, impactForce: Math.abs(finalImpulse) };
}

export function checkCircleBoxCollision(circle: { x: number, y: number, radius: number }, box: { x: number, y: number, w: number, h: number }) {
    const halfW = box.w / 2;
    const halfH = box.h / 2;
    const nearestX = Math.max(box.x - halfW, Math.min(circle.x, box.x + halfW));
    const nearestY = Math.max(box.y - halfH, Math.min(circle.y, box.y + halfH));
    const dx = circle.x - nearestX;
    const dy = circle.y - nearestY;
    const dist = Math.hypot(dx, dy);
    return dist < circle.radius;
}

export function resolveCircleBoxCollision(circle: { x: number, y: number, vx: number, vy: number, radius: number, mass: number, type?: string }, box: { x: number, y: number, w: number, h: number }, bounciness = 0.8) {
    const halfW = box.w / 2;
    const halfH = box.h / 2;
    const nearestX = Math.max(box.x - halfW, Math.min(circle.x, box.x + halfW));
    const nearestY = Math.max(box.y - halfH, Math.min(circle.y, box.y + halfH));
    
    let dx = circle.x - nearestX;
    let dy = circle.y - nearestY;
    let dist = Math.hypot(dx, dy);
    
    // If circle center is perfectly on boundary or inside
    if (dist === 0) {
        const distL = circle.x - (box.x - halfW);
        const distR = (box.x + halfW) - circle.x;
        const distT = circle.y - (box.y - halfH);
        const distB = (box.y + halfH) - circle.y;
        const minDist = Math.min(distL, distR, distT, distB);
        if (minDist === distL) { dx = -1; }
        else if (minDist === distR) { dx = 1; }
        else if (minDist === distT) { dy = -1; }
        else { dy = 1; }
        dist = 1;
    }
    
    if (dist >= circle.radius) return null;
    
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = circle.radius - dist;
    
    // Push the circle out of the box
    circle.x += nx * overlap;
    circle.y += ny * overlap;
    
    if (circle.type === 'top' && (circle as any).state === 'standby') {
        (circle as any).standbyCenterX = ((circle as any).standbyCenterX ?? circle.x) + nx * overlap;
        (circle as any).standbyCenterY = ((circle as any).standbyCenterY ?? circle.y) + ny * overlap;
    }
    
    // Relative velocity along collision normal (box has infinite mass and is stationary)
    const velAlongNormal = circle.vx * nx + circle.vy * ny;
    
    if (velAlongNormal >= 0) return null; // already moving away
    
    // Save old velocity
    const oldVx = circle.vx;
    const oldVy = circle.vy;

    // Bounce calculation (amplitude enhanced 1.1x for a pleasant smooth feel)
    const impulse = -(1 + bounciness) * velAlongNormal * circle.mass * 1.1;
    
    circle.vx += (impulse / circle.mass) * nx;
    circle.vy += (impulse / circle.mass) * ny;
    
    // Forcefully deflect circle if it is a top, to avoid perfect retracing
    if (circle.type === 'top') {
        const speed = Math.hypot(circle.vx, circle.vy);
        if (speed > 1) {
            const sign = Math.random() < 0.5 ? -1 : 1;
            const angleRad = sign * (12 + Math.random() * 12) * Math.PI / 180;
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const newVx = circle.vx * cos - circle.vy * sin;
            const newVy = circle.vx * sin + circle.vy * cos;
            circle.vx = newVx;
            circle.vy = newVy;
        }
    }

    if (circle.type === 'top' && (circle as any).state === 'standby') {
        const dVx = circle.vx - oldVx;
        const dVy = circle.vy - oldVy;
        (circle as any).standbyCenterVx = ((circle as any).standbyCenterVx ?? 0) + dVx;
        (circle as any).standbyCenterVy = ((circle as any).standbyCenterVy ?? 0) + dVy;
        (circle as any).joystickReboundTimer = 0.25;
    }
    
    return { nx, ny, impactForce: Math.abs(impulse) };
}

function closestPointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq === 0) return { x: ax, y: ay };
    let t = (apx * abx + apy * aby) / abLenSq;
    t = Math.max(0, Math.min(1, t));
    return { x: ax + t * abx, y: ay + t * aby };
}

function isPointInTriangle(px: number, py: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
    const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
    const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
    const has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(has_neg && has_pos);
}

export function resolveCircleTriangleCollision(
    circle: { x: number, y: number, vx: number, vy: number, radius: number, mass: number, type?: string },
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    bounciness = 0.8
) {
    // 1. Closest point on perimeter
    const q1 = closestPointOnSegment(circle.x, circle.y, x1, y1, x2, y2);
    const q2 = closestPointOnSegment(circle.x, circle.y, x2, y2, x3, y3);
    const q3 = closestPointOnSegment(circle.x, circle.y, x3, y3, x1, y1);
    
    const d1 = Math.hypot(circle.x - q1.x, circle.y - q1.y);
    const d2 = Math.hypot(circle.x - q2.x, circle.y - q2.y);
    const d3 = Math.hypot(circle.x - q3.x, circle.y - q3.y);
    
    let q = q1;
    let dist = d1;
    if (d2 < dist) { q = q2; dist = d2; }
    if (d3 < dist) { q = q3; dist = d3; }
    
    const inside = isPointInTriangle(circle.x, circle.y, x1, y1, x2, y2, x3, y3);
    
    if (!inside && dist >= circle.radius) return null;
    
    // Collision normal pointing outwards from the triangle
    let dx = circle.x - q.x;
    let dy = circle.y - q.y;
    let d = Math.hypot(dx, dy);
    
    let nx = 0;
    let ny = 0;
    if (d > 0.001) {
        nx = dx / d;
        ny = dy / d;
    } else {
        // Fallback: point towards circle center from triangle center
        const tcX = (x1 + x2 + x3) / 3;
        const tcY = (y1 + y2 + y3) / 3;
        dx = circle.x - tcX;
        dy = circle.y - tcY;
        d = Math.hypot(dx, dy);
        if (d > 0.001) {
            nx = dx / d;
            ny = dy / d;
        } else {
            nx = 0;
            ny = -1;
        }
    }
    
    // Penetration depth
    const overlap = inside ? (circle.radius + d) : (circle.radius - d);
    
    // Push circle out
    circle.x += nx * overlap;
    circle.y += ny * overlap;
    
    if (circle.type === 'top' && (circle as any).state === 'standby') {
        (circle as any).standbyCenterX = ((circle as any).standbyCenterX ?? circle.x) + nx * overlap;
        (circle as any).standbyCenterY = ((circle as any).standbyCenterY ?? circle.y) + ny * overlap;
    }
    
    // Relative velocity along normal
    const velAlongNormal = circle.vx * nx + circle.vy * ny;
    if (velAlongNormal >= 0) return { nx, ny, overlap, impactForce: 0 }; // already moving away
    
    // Save old velocity
    const oldVx = circle.vx;
    const oldVy = circle.vy;
    
    // Bounce impulse
    const impulse = -(1 + bounciness) * velAlongNormal * circle.mass * 1.1;
    circle.vx += (impulse / circle.mass) * nx;
    circle.vy += (impulse / circle.mass) * ny;
    
    // Forcefully deflect circle if it is a top, to avoid perfect retracing
    if (circle.type === 'top') {
        const speed = Math.hypot(circle.vx, circle.vy);
        if (speed > 1) {
            const sign = Math.random() < 0.5 ? -1 : 1;
            const angleRad = sign * (12 + Math.random() * 12) * Math.PI / 180;
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const newVx = circle.vx * cos - circle.vy * sin;
            const newVy = circle.vx * sin + circle.vy * cos;
            circle.vx = newVx;
            circle.vy = newVy;
        }
    }
    
    if (circle.type === 'top' && (circle as any).state === 'standby') {
        const dVx = circle.vx - oldVx;
        const dVy = circle.vy - oldVy;
        (circle as any).standbyCenterVx = ((circle as any).standbyCenterVx ?? 0) + dVx;
        (circle as any).standbyCenterVy = ((circle as any).standbyCenterVy ?? 0) + dVy;
    }
    
    return { nx, ny, overlap, impactForce: Math.abs(impulse) };
}
