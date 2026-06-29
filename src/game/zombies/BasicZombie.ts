import type { GameEngine } from '../GameEngine';
import { Top, Zombie } from '../types';
import { CANVAS_W, CANVAS_H } from '../constants';
import { getStandbyRadiusForModel } from '../topMovement';

export function updateBasicZombie(engine: GameEngine, z: Zombie, dt: number, zombieTargets: Top[]) {
    // Handle active physical rebound bounce timer and decay
    if (z.bounceTimer !== undefined && z.bounceTimer > 0) {
        z.bounceTimer -= dt;
        if (z.hitByDash && z.knockbackSpeedStart !== undefined && z.maxBounceTimer) {
            const ratio = Math.max(0, Math.min(1, z.bounceTimer / z.maxBounceTimer));
            // Smooth quadratic decay for high impact deceleration feedback!
            const targetSpeed = z.knockbackSpeedStart * Math.pow(ratio, 2.0);
            const currentSpeed = Math.hypot(z.vx, z.vy);
            if (currentSpeed > 0.1) {
                z.vx = (z.vx / currentSpeed) * targetSpeed;
                z.vy = (z.vy / currentSpeed) * targetSpeed;
            }
        } else {
            // Decay the physical slide velocity with 0.96 (1.5x longer slide duration)
            z.vx *= 0.96;
            z.vy *= 0.96;
        }
        
        // Spin like a top! Scale rotation speed with current velocity
        const speed = Math.hypot(z.vx, z.vy);
        const spinDir = (z.vx + z.vy >= 0) ? 1 : -1;
        z.angle += spinDir * (speed / 70) * Math.PI * dt;

        if (z.bounceTimer <= 0) {
            z.bounceTimer = 0;
            z.hitByDash = false;
        }
    } else {
        // Move slowly towards nearest top
        let minDist = Infinity;
        let targetTop: Top | null = null;
        zombieTargets.forEach(t => {
           const d = Math.hypot(t.x-z.x, t.y-z.y);
           if (d < minDist) { minDist = d; targetTop = t; }
        });
        
        if (targetTop) {
            const dx = targetTop.x - z.x;
            const dy = targetTop.y - z.y;
            const dist = Math.hypot(dx, dy) || 1;
            const spd = 80 * (z.speedMultiplier ?? 1.0);
            z.vx = (dx/dist) * spd;
            z.vy = (dy/dist) * spd;
            
            // Smoothly rotate face angle instead of snapping directly
            const targetAngle = Math.atan2(dy, dx) + Math.PI/2;
            let diff = targetAngle - z.angle;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            const turnSpeed = 4.5; // Turn speed in rad/s
            const maxRotation = turnSpeed * dt;
            if (Math.abs(diff) < maxRotation) {
                z.angle = targetAngle;
            } else {
                z.angle += Math.sign(diff) * maxRotation;
            }
        } else {
            // Wander around!
            if (z.wanderTimer === undefined || z.wanderTimer <= 0) {
                z.wanderTimer = 1.0 + Math.random() * 2.0;
                z.wanderAngle = Math.random() * Math.PI * 2;
            }
            z.wanderTimer -= dt;
            
            const spd = 40 * (z.speedMultiplier ?? 1.0); // slow wander speed
            z.vx = Math.cos(z.wanderAngle) * spd;
            z.vy = Math.sin(z.wanderAngle) * spd;
            
            // Face wander angle smoothly
            const targetAngle = z.wanderAngle + Math.PI/2;
            let diff = targetAngle - z.angle;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            const turnSpeed = 2.0;
            const maxRotation = turnSpeed * dt;
            if (Math.abs(diff) < maxRotation) {
                z.angle = targetAngle;
            } else {
                z.angle += Math.sign(diff) * maxRotation;
            }
        }
    }
    

}
