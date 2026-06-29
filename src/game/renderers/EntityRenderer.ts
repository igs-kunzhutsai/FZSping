import * as GameUtils from '../systems/GameUtils';
import { ProbabilityManager, TARGET_TYPE } from '../systems/ProbabilityManager';
import type { GameEngine } from '../GameEngine';
import { drawCapsulePath } from './Utils';
import { CANVAS_W, CANVAS_H, MAX_SPIN } from '../constants';
import { Top, Zombie, Obstacle, Item, Particle, Entity, ConcreteBlock, Afterimage, PlayerStats, Projectile, PhantomClone } from '../types';

export function drawEntities(ctx: CanvasRenderingContext2D, engine: GameEngine, sprites: Record<string, HTMLCanvasElement>) {
        // Draw Concrete Blocks
        engine.concreteBlocks.forEach(block => {
            ctx.save();
            const left = block.x - block.w / 2;
            const top = block.y - block.h / 2;
            
            if (block.flashTimer !== undefined && block.flashTimer > 0) {
                // Same soft silver-white/gray silhouette flash as zombies (invert 0.7)
                // Filter removed for perf
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.6;
            }
            
            // Scaled detail dimensions (50% of original for perfect high-fidelity visual consistency)
            const shadowOff = 8;
            const borderOff = 8;
            const stripeOff = 4;
            const screwOffset = 12;
            const screwRadius = 3;
            const frameLineWidth = 3;
            
            // Drop heavy shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(left + shadowOff, top + shadowOff, block.w, block.h);
            
            // Concrete outer fill
            ctx.fillStyle = '#475569'; // slate-600
            ctx.fillRect(left, top, block.w, block.h);
            
            // Darker core plate
            ctx.fillStyle = '#1e293b'; // slate-800
            ctx.fillRect(left + borderOff, top + borderOff, block.w - borderOff * 2, block.h - borderOff * 2);
            
            // Outer highlighted steel framing
            ctx.strokeStyle = '#94a3b8'; // slate-400
            ctx.lineWidth = frameLineWidth;
            ctx.strokeRect(left, top, block.w, block.h);

            // Shading highlights for concrete texture feel (subtle X inside)
            ctx.strokeStyle = '#334155'; // slate-700
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(left + borderOff, top + borderOff);
            ctx.lineTo(left + block.w - borderOff, top + block.h - borderOff);
            ctx.moveTo(left + block.w - borderOff, top + borderOff);
            ctx.lineTo(left + borderOff, top + block.h - borderOff);
            ctx.stroke();

            // Inner highlighted steel framing 
            ctx.strokeStyle = '#64748b'; // slate-500
            ctx.lineWidth = 1;
            ctx.strokeRect(left + borderOff, top + borderOff, block.w - borderOff * 2, block.h - borderOff * 2);
            
            // Yellow warning striped margins
            ctx.strokeStyle = '#eab308'; // Amber hazard indicator
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 6]);
            ctx.strokeRect(left + stripeOff, top + stripeOff, block.w - stripeOff * 2, block.h - stripeOff * 2);
            ctx.setLineDash([]);

            // Technical details: 4 metal screw points on corners
            ctx.fillStyle = '#e2e8f0';
            const screwPos = [
                { x: left + screwOffset, y: top + screwOffset },
                { x: left + block.w - screwOffset, y: top + screwOffset },
                { x: left + screwOffset, y: top + block.h - screwOffset },
                { x: left + block.w - screwOffset, y: top + block.h - screwOffset }
            ];
            screwPos.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, screwRadius, 0, Math.PI * 2);
                ctx.fill();
                
                // Bolt slot line
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x - 1.5, p.y - 1.5);
                ctx.lineTo(p.x + 1.5, p.y + 1.5);
                ctx.stroke();
            });

            // Draw cracks on the concrete block as durability drops
            const dur = block.durability ?? 5;
            if (dur < 5) {
                ctx.strokeStyle = '#0f172a'; // very dark shadow cracks
                ctx.lineWidth = 2.5;
                
                // Deterministic seed for cracks based on block.id
                let seed = 0;
                for (let c = 0; c < block.id.length; c++) {
                    seed += block.id.charCodeAt(c);
                }
                
                const random = () => {
                    let x = Math.sin(seed++) * 10000;
                    return x - Math.floor(x);
                };

                const crackCount = (5 - dur) * 2; // more cracks as it is damaged
                for (let i = 0; i < crackCount; i++) {
                    const px = left + borderOff + random() * (block.w - borderOff * 2);
                    const py = top + borderOff + random() * (block.h - borderOff * 2);
                    const length = 12 + random() * 20;
                    const angleRad = random() * Math.PI * 2;
                    
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(px + Math.cos(angleRad) * length, py + Math.sin(angleRad) * length);
                    ctx.stroke();
                }
            }

            // Draw segmented durability indicator for concrete block (Hidden per user request)
            if (false && dur < 5) {
                const barWidth = Math.min(45, block.w - 16);
                const barHeight = 5;
                const startX = block.x - barWidth / 2;
                const startY = top - 12; // drawn neatly above the concrete block

                // Translucent background
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                ctx.fillRect(startX - 2, startY - 2, barWidth + 4, barHeight + 4);

                // Tech cyan to orange to red
                const pct = Math.max(0, dur / 5);
                const color = pct > 0.6 ? '#38bdf8' : (pct > 0.2 ? '#f97316' : '#ef4444');
                ctx.fillStyle = color;
                ctx.fillRect(startX, startY, barWidth * pct, barHeight);

                // Dark separators
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 1;
                for (let i = 1; i < 5; i++) {
                     const tickX = startX + (barWidth / 5) * i;
                     ctx.beginPath();
                     ctx.moveTo(tickX, startY);
                     ctx.lineTo(tickX, startY + barHeight);
                     ctx.stroke();
                }
            }

            ctx.restore();
        });

        // Draw Items (Tickets)
        engine.items.forEach(item => {
            if (item.type === 'item_ticket') {
                ctx.save();
                ctx.translate(item.x, item.y);
                
                // Draw golden radial light if hovering
                if (item.hoverTimer !== undefined && item.hoverTimer > 0) {
                    ctx.save();
                    const lightRadius = 80 + Math.sin(Date.now() * 0.01) * 10;
                    const lightGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, lightRadius);
                    lightGrad.addColorStop(0, 'rgba(253, 224, 71, 0.8)'); // yellow-300
                    lightGrad.addColorStop(0.5, 'rgba(234, 179, 8, 0.4)'); // yellow-500
                    lightGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
                    ctx.fillStyle = lightGrad;
                    ctx.beginPath();
                    ctx.arc(0, 0, lightRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // Apply Z offset for the bounce
                if (item.z) {
                    ctx.translate(0, -item.z);
                }
                
                // Add spinning effect when hovering, and straight flying angle when flying
                if (item.hoverTimer !== undefined && item.hoverTimer > 0) {
                    ctx.rotate(Date.now() * 0.005);
                } else {
                    let targetX = CANVAS_W / 2;
                    let targetY = CANVAS_H / 2;
                    const padding = 24;
                    const barW = 210;
                    if (item.targetPlayerId === 'top_0') { targetX = padding + barW / 2; targetY = CANVAS_H - 130 + 50; }
                    else if (item.targetPlayerId === 'top_1') { targetX = CANVAS_W - barW - padding + barW / 2; targetY = CANVAS_H - 130 + 50; }
                    else if (item.targetPlayerId === 'top_2') { targetX = padding + barW / 2; targetY = padding + 50; }
                    else if (item.targetPlayerId === 'top_3') { targetX = CANVAS_W - barW - padding + barW / 2; targetY = padding + 50; }

                    targetX = (targetX - CANVAS_W / 2) / engine.camera.zoom + engine.camera.x;
                    targetY = (targetY - CANVAS_H / 2) / engine.camera.zoom + engine.camera.y;
                    
                    const dx = targetX - item.x;
                    const dy = targetY - item.y;
                    ctx.rotate(Math.atan2(dy, dx));
                }

                // Draw Ticket shape
                const width = 72;
                const height = 40;

                // Rainbow gradient
                const grad = ctx.createLinearGradient(-width/2, 0, width/2, 0);
                grad.addColorStop(0, '#ef4444');
                grad.addColorStop(0.2, '#f97316');
                grad.addColorStop(0.4, '#eab308');
                grad.addColorStop(0.6, '#22c55e');
                grad.addColorStop(0.8, '#3b82f6');
                grad.addColorStop(1, '#a855f7');

                ctx.fillStyle = grad;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.rect(-width/2, -height/2, width, height);
                ctx.fill();
                ctx.stroke();

                // Draw amount
                ctx.save();
                // When rotating dynamically, ensure text is readable by forcing it upright if hover, or matching direction if flying
                if (item.hoverTimer !== undefined && item.hoverTimer > 0) {
                    ctx.rotate(-Date.now() * 0.005);
                } else {
                    // Adjust text rotation if flying left so it doesn't appear upside down
                    let targetX = CANVAS_W / 2;
                    if (item.targetPlayerId === 'top_0' || item.targetPlayerId === 'top_2') {
                        targetX = 24 + 210/2;
                    } else if (item.targetPlayerId === 'top_1' || item.targetPlayerId === 'top_3') {
                        targetX = CANVAS_W - 210 - 24 + 210/2;
                    }
                    targetX = (targetX - CANVAS_W / 2) / engine.camera.zoom + engine.camera.x;
                    if (targetX < item.x) {
                        ctx.rotate(Math.PI);
                    }
                }
                ctx.font = 'bold 28px "Courier New"';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // Add dark text shadow for readability against rainbow
                ctx.shadowColor = '#000000';
                ctx.shadowBlur = 8;
                ctx.lineWidth = 4;
                ctx.strokeText(item.amount?.toString() || '0', 0, 0);
                ctx.fillText(item.amount?.toString() || '0', 0, 0);
                ctx.restore();

                ctx.restore();
            } else if (item.type === 'item_key') {
                ctx.save();
                ctx.translate(item.x, item.y);

                // Floating animation
                const bobOffset = Math.sin(Date.now() * 0.005) * 15;
                ctx.translate(0, bobOffset);

                // Rainbow glow
                ctx.shadowColor = `hsl(${(Date.now() * 0.1) % 360}, 100%, 50%)`;
                ctx.shadowBlur = 15;

                // Rainbow gradient
                const grad = ctx.createLinearGradient(-15, -30, 15, 30);
                grad.addColorStop(0, '#ef4444');
                grad.addColorStop(0.2, '#f97316');
                grad.addColorStop(0.4, '#eab308');
                grad.addColorStop(0.6, '#22c55e');
                grad.addColorStop(0.8, '#3b82f6');
                grad.addColorStop(1, '#a855f7');

                ctx.fillStyle = grad;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;

                // Draw a simple key shape
                ctx.beginPath();
                ctx.arc(0, -15, 10, 0, Math.PI * 2); // Key head
                ctx.rect(-4, -5, 8, 30); // Key shaft
                ctx.rect(4, 15, 8, 4); // Key teeth 1
                ctx.rect(4, 22, 8, 4); // Key teeth 2
                ctx.fill();
                ctx.stroke();

                ctx.restore();
            }
        });

        // Draw Obstacles
        engine.obstacles.forEach(o => {
            if ((o.type as string) === 'item_crate') {
                // Ground / floor shadow underneath the floating object
                const hoverAmp = 12;
                const hoverSpeed = 0.004;
                const bounceHeight = Math.abs(Math.sin(Date.now() * hoverSpeed + (o.x * 0.05))) * hoverAmp;
                const offsetY = -bounceHeight;
                
                const shadowX = o.x;
                const shadowY = o.y + 14;
                const shadowT = bounceHeight / hoverAmp;
                const shadowDilation = 1.0 - shadowT * 0.3;
                const shadowAlpha = 0.45 - shadowT * 0.3;
                
                ctx.save();
                ctx.fillStyle = `rgba(15, 23, 42, ${shadowAlpha})`;
                ctx.beginPath();
                ctx.ellipse(shadowX, shadowY, 20 * shadowDilation, 7 * shadowDilation, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Dynamic 3D Star Coordinates (No auto-rotation, pointing straight up)
                const dx = o.x;
                const dy = o.y + offsetY - 8;
                const outerRadius = 26; // nice and visible
                const innerRadius = 12;
                const angle = -Math.PI / 2; // Fixed angle pointing straight up
                
                ctx.save();
                
                if (o.flashTimer !== undefined && o.flashTimer > 0) {
                    // Filter removed for perf
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.6;
                }

                // Helper to path a 5-point star
                const pathStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rot: number) => {
                    ctx.beginPath();
                    const spikes = 5;
                    let step = Math.PI / spikes;
                    let currentRot = rot;
                    ctx.moveTo(cx + Math.cos(currentRot) * outerRadius, cy + Math.sin(currentRot) * outerRadius);
                    for (let i = 0; i < spikes * 2; i++) {
                        let r = (i % 2 === 0) ? outerRadius : innerRadius;
                        let x = cx + Math.cos(currentRot) * r;
                        let y = cy + Math.sin(currentRot) * r;
                        ctx.lineTo(x, y);
                        currentRot += step;
                    }
                    ctx.closePath();
                };

                // Draw the 3D extrusion side (shading depth layers)
                ctx.fillStyle = '#1e1b4b'; // solid deep dark purple/slate extrusion body
                for (let d = 5; d > 0; d--) {
                    pathStar(ctx, dx, dy + d, angle);
                    ctx.fill();
                }

                // Draw Top Star Face with Dynamic Cycling Rainbow Colors
                const timeSec = Date.now() / 1500;
                const topStarGrad = ctx.createLinearGradient(dx - outerRadius, dy - outerRadius, dx + outerRadius, dy + outerRadius);
                for (let step = 0; step <= 5; step++) {
                    const h = (timeSec * 360 + step * 45) % 360;
                    topStarGrad.addColorStop(step / 5, `hsl(${h}, 95%, 62%)`);
                }

                // Add dynamic pulsating star glow
                // Removed shadowColor for perf
                // Removed shadowBlur for perf
                
                ctx.fillStyle = topStarGrad;
                pathStar(ctx, dx, dy, angle);
                ctx.fill();
                
                // Removed shadowBlur for perf // turn off glow for stroke & sweep details

                // Sharp polished white border stroke
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw high-fidelity moving specular light sweep overlay
                ctx.save();
                pathStar(ctx, dx, dy, angle);
                ctx.clip(); // restrict specular sweep strictly to inside top star face
                
                const sweepX = dx + Math.sin(Date.now() / 400) * 45;
                const glossGrad = ctx.createLinearGradient(sweepX - 20, dy - outerRadius, sweepX + 20, dy + outerRadius);
                glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
                glossGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)');
                glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = glossGrad;
                ctx.fillRect(dx - outerRadius * 2, dy - outerRadius * 2, outerRadius * 4, outerRadius * 4);
                ctx.restore();

                ctx.restore();
                return;
            }

            ctx.save();
            const spr = sprites['barrel'];
            
            if (o.flashTimer !== undefined && o.flashTimer > 0) {
                // Same soft silver-white/gray silhouette flash as zombies (invert 0.7)
                // Filter removed for perf
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.6;
            }
            ctx.drawImage(spr, o.x - spr.width/2, o.y - spr.height/2);
            if (o.flashTimer !== undefined && o.flashTimer > 0) {
                // Filter reset removed
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1.0;
            }

            // Central red alarm light flashing continuously for the bomb barrel
            if (o.type === 'obstacle_barrel') {
                const time = Date.now();
                const blinkT = (Math.sin(time * 0.007) + 1) / 2; // oscillates 0 to 1
                
                // Pulsing hot red glow centered inside the reactor chamber of the bomb barrel
                const glowRad = 5 + blinkT * 9; // expands smoothly
                const glowAlpha = 0.25 + blinkT * 0.75; // dynamic breathing alpha
                
                ctx.save();
                ctx.beginPath();
                ctx.arc(o.x, o.y, glowRad, 0, Math.PI * 2);
                
                const blinkGrad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, glowRad);
                blinkGrad.addColorStop(0, '#ffffff'); // blinding white warning core
                blinkGrad.addColorStop(0.35, `rgba(239, 68, 68, ${glowAlpha})`); // warning red
                blinkGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
                ctx.fillStyle = blinkGrad;
                ctx.fill();
                ctx.restore();
            }

            // Draw segmented durability indicator for barrels (Hidden per user request)
            if (false && o.type === 'obstacle_barrel') {
                const maxDur = 1;
                const dur = o.durability ?? maxDur;
                const barWidth = 40;
                const barHeight = 6;
                const startX = o.x - barWidth / 2;
                const startY = o.y - o.radius - 12;

                // Translucent background
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                ctx.fillRect(startX - 2, startY - 2, barWidth + 4, barHeight + 4);

                // Colorful segments: red indicating threat/hazard
                const pct = Math.max(0, dur / maxDur);
                const color = '#ef4444'; // Red for explosive barrel
                ctx.fillStyle = color;
                ctx.fillRect(startX, startY, barWidth * pct, barHeight);
            }
            ctx.restore();
        });
        
        // Draw Zombies
        engine.zombies.forEach(z => {
            // Draw pulsing warning range beneath the boss face
            if (z.type === 'zombie_boss' && z.bossAttackState === 'warning') {
                const boss = z as any;
                const pulse = 0.5 + 0.4 * Math.sin(Date.now() * 0.02);
                
                if (boss.bossSelectedAttack === 'bomb') {
                    // Draw 3 pulsing red warning circles at the bomb target positions
                    if (boss.bossBombTargets) {
                        boss.bossBombTargets.forEach((tg: { x: number; y: number }) => {
                            ctx.save();
                            ctx.translate(tg.x, tg.y);
                            
                            // 1. Semi-transparent pulsing red fill
                            ctx.fillStyle = `rgba(239, 68, 68, ${0.15 + pulse * 0.1})`;
                            ctx.beginPath();
                            ctx.arc(0, 0, 50, 0, Math.PI * 2);
                            ctx.fill();
                            
                            // 2. Dashed red outline
                            ctx.strokeStyle = `rgba(239, 68, 68, ${0.6 + pulse * 0.3})`;
                            ctx.lineWidth = 3;
                            ctx.setLineDash([8, 6]);
                            ctx.beginPath();
                            ctx.arc(0, 0, 50, 0, Math.PI * 2);
                            ctx.stroke();

                            // 3. Central danger crosshair
                            ctx.strokeStyle = `rgba(239, 68, 68, ${0.7 + pulse * 0.3})`;
                            ctx.lineWidth = 2;
                            ctx.setLineDash([]);
                            ctx.beginPath();
                            ctx.moveTo(-15, 0); ctx.lineTo(-5, 0);
                            ctx.moveTo(5, 0); ctx.lineTo(15, 0);
                            ctx.moveTo(0, -15); ctx.lineTo(0, -5);
                            ctx.moveTo(0, 5); ctx.lineTo(0, 15);
                            ctx.stroke();
                            
                            // Exclamation mark
                            ctx.fillStyle = `rgba(239, 68, 68, ${0.75 + pulse * 0.25})`;
                            ctx.font = 'bold 20px "Courier New"';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText("!", 0, -1);
                            
                            ctx.restore();
                        });
                    }
                } else if (boss.bossSelectedAttack === 'earthquake') {
                    // Draw pulsing red warning area centered on the boss with a radius of exactly 350px
                    ctx.save();
                    ctx.translate(z.x, z.y);
                    
                    // 1. Semi-transparent pulsing red fill with 350px radius
                    ctx.fillStyle = `rgba(239, 68, 68, ${0.16 + pulse * 0.12})`;
                    ctx.beginPath();
                    ctx.arc(0, 0, 350, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // 2. Dashed red outline
                    ctx.strokeStyle = `rgba(239, 68, 68, ${0.65 + pulse * 0.25})`;
                    ctx.lineWidth = 4;
                    ctx.setLineDash([15, 10]);
                    ctx.beginPath();
                    ctx.arc(0, 0, 350, 0, Math.PI * 2);
                    ctx.stroke();

                    // 3. Central danger crosshair (larger size matching 350px range scale)
                    ctx.strokeStyle = `rgba(239, 68, 68, ${0.7 + pulse * 0.3})`;
                    ctx.lineWidth = 3;
                    ctx.setLineDash([]);
                    ctx.beginPath();
                    ctx.moveTo(-50, 0); ctx.lineTo(-12, 0);
                    ctx.moveTo(12, 0); ctx.lineTo(50, 0);
                    ctx.moveTo(0, -50); ctx.lineTo(0, -12);
                    ctx.moveTo(0, 12); ctx.lineTo(0, 50);
                    ctx.stroke();

                    // 4. Exclamation mark at center
                    ctx.fillStyle = `rgba(239, 68, 68, ${0.75 + pulse * 0.25})`;
                    ctx.font = 'bold 36px "Courier New"';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText("!", 0, -2);
                    
                    ctx.restore();
                } else if (boss.bossSelectedAttack === 'struggle') {
                    // Draw Red Crosshair Target lock over the targeted player!
                    const targetTop = engine.tops.find(t => t.id === boss.bossWarningTargetId);
                    if (targetTop) {
                        ctx.save();
                        ctx.translate(targetTop.x, targetTop.y);
                        
                        // Animated spin angle for lock-on UI
                        const rotAngle = (Date.now() / 330) % (Math.PI * 2);
                        ctx.rotate(rotAngle);
                        
                        // Pulsing crosshair graphics: Brackets & Laser Crosshairs
                        ctx.strokeStyle = '#ef4444'; // Red!
                        ctx.lineWidth = 5.0; // Thicker brackets
                        
                        // Draw Brackets (4 corners)
                        const size = 90 + 15 * Math.sin(Date.now() * 0.02); // Pulsing size, scaled up substantially
                        const bracketLen = 24; // Larger brackets
                        
                        // Semi-transparent vibrant warning backdrop fill
                        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
                        ctx.beginPath();
                        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
                        ctx.fill();

                        // Top-Left Corner
                        ctx.beginPath();
                        ctx.moveTo(-size, -size + bracketLen);
                        ctx.lineTo(-size, -size);
                        ctx.lineTo(-size + bracketLen, -size);
                        ctx.stroke();
                        
                        // Top-Right Corner
                        ctx.beginPath();
                        ctx.moveTo(size, -size + bracketLen);
                        ctx.lineTo(size, -size);
                        ctx.lineTo(size - bracketLen, -size);
                        ctx.stroke();
                        
                        // Bottom-Left Corner
                        ctx.beginPath();
                        ctx.moveTo(-size, size - bracketLen);
                        ctx.lineTo(-size, size);
                        ctx.lineTo(-size + bracketLen, size);
                        ctx.stroke();
                        
                        // Bottom-Right Corner
                        ctx.beginPath();
                        ctx.moveTo(size, size - bracketLen);
                        ctx.lineTo(size, size);
                        ctx.lineTo(size - bracketLen, size);
                        ctx.stroke();
                        
                        // Draw spinning hazard outline dashed circle
                        ctx.setLineDash([10, 8]);
                        ctx.lineWidth = 3.0;
                        ctx.beginPath();
                        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
                        ctx.stroke();
                        
                        // Central crosshair lines
                        ctx.setLineDash([]);
                        ctx.strokeStyle = `rgba(239, 68, 68, ${0.7 + pulse * 0.3})`;
                        ctx.lineWidth = 4.0;
                        ctx.beginPath();
                        ctx.moveTo(-size * 0.5, 0); ctx.lineTo(-size * 0.2, 0);
                        ctx.moveTo(size * 0.2, 0); ctx.lineTo(size * 0.5, 0);
                        ctx.moveTo(0, -size * 0.5); ctx.lineTo(0, -size * 0.2);
                        ctx.moveTo(0, size * 0.2); ctx.lineTo(0, size * 0.5);
                        ctx.stroke();
                        
                        // Pulsing "! LOCK" Text in red monospace under target
                        ctx.rotate(-rotAngle); // rotate back for text
                        ctx.fillStyle = `rgba(239, 68, 68, ${0.85 + pulse * 0.15})`;
                        ctx.font = 'bold 20px "JetBrains Mono", "Space Grotesk", sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText("WARN: TARGET LOCK", 0, -size - 22);
                        
                        ctx.restore();
                    }
                } else {
                    // Default Dash Attack warning channel
                    ctx.save();
                    ctx.translate(z.x, z.y);
                    const angle = Math.atan2(z.bossDashDirectionY ?? 0, z.bossDashDirectionX ?? 1);
                    ctx.rotate(angle);
                    
                    // Pulsing red transparent hazard channel
                    ctx.fillStyle = `rgba(239, 68, 68, ${0.12 + pulse * 0.12})`;
                    ctx.fillRect(0, -128, 2000, 256);
                    
                    // Warn borders
                    ctx.strokeStyle = `rgba(239, 68, 68, ${0.45 + pulse * 0.35})`;
                    ctx.lineWidth = 4;
                    ctx.setLineDash([30, 20]);
                    ctx.strokeRect(0, -128, 2000, 256);
                    ctx.restore();
                }
            }
            
            // Draw bouncing zombie landing warnings
            if (z.type === 'zombie_bouncing' && ((z as any).bouncingAttackState === 'warning' || (z as any).bouncingAttackState === 'bouncing' || (z as any).bouncingAttackState === 'death_warning' || (z as any).bouncingAttackState === 'death_bouncing')) {
                const bz = z as any;
                const isDeath = bz.bouncingAttackState === 'death_warning' || bz.bouncingAttackState === 'death_bouncing';
                const pulse = 0.5 + 0.4 * Math.sin(Date.now() * 0.02);
                if (bz.bouncingTargets) {
                    bz.bouncingTargets.forEach((tg: { x: number; y: number }, idx: number) => {
                        // Highlight current target slightly more or hide completed ones
                        if (idx < (bz.bouncingCurrentTargetIndex ?? 0)) return; // already landed
                        
                        ctx.save();
                        ctx.translate(tg.x, tg.y);
                        
                        const isCurrent = idx === (bz.bouncingCurrentTargetIndex ?? 0);
                        const curPulse = isCurrent ? pulse : (0.2 + 0.1 * Math.sin(Date.now() * 0.02));
                        
                        // 1. Semi-transparent pulsing fill (120px radius!)
                        ctx.fillStyle = `rgba(239, 68, 68, ${0.15 + curPulse * 0.1})`;
                        ctx.beginPath();
                        ctx.arc(0, 0, 120, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // 2. Dashed outline
                        ctx.strokeStyle = `rgba(239, 68, 68, ${0.6 + curPulse * 0.3})`;
                        ctx.lineWidth = isCurrent ? 4 : 2;
                        ctx.setLineDash([15, 10]);
                        ctx.beginPath();
                        ctx.arc(0, 0, 120, 0, Math.PI * 2);
                        ctx.stroke();

                        // 3. Central danger crosshair
                        ctx.strokeStyle = `rgba(239, 68, 68, ${0.7 + curPulse * 0.3})`;
                        ctx.lineWidth = 3;
                        ctx.setLineDash([]);
                        ctx.beginPath();
                        ctx.moveTo(-25, 0); ctx.lineTo(-10, 0);
                        ctx.moveTo(10, 0); ctx.lineTo(25, 0);
                        ctx.moveTo(0, -25); ctx.lineTo(0, -10);
                        ctx.moveTo(0, 10); ctx.lineTo(0, 25);
                        ctx.stroke();
                        
                        // Exclamation mark
                        ctx.fillStyle = `rgba(239, 68, 68, ${0.75 + curPulse * 0.25})`;
                        ctx.font = 'bold 36px "Courier New"';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText("!", 0, -2);
                        
                        ctx.restore();
                    });
                }
            }

            // Draw pulsing warning hazard channel beneath Big Zombies in warning state (Changed to Red per request)
            if ((z.type === 'zombie_big' || z.type === 'zombie_bomb') && (z as any).bigAttackState === 'warning') {
                const big = z as any;
                const pulse = 0.5 + 0.4 * Math.sin(Date.now() * 0.02);
                
                if (z.type === 'zombie_bomb') {
                    // Draw a giant circular warning for the upcoming earthquake
                    ctx.save();
                    ctx.translate(big.x, big.y);
                    
                    ctx.fillStyle = `rgba(239, 68, 68, ${0.14 + pulse * 0.12})`;
                    ctx.beginPath();
                    ctx.arc(0, 0, 350, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.strokeStyle = `rgba(239, 68, 68, ${0.5 + pulse * 0.35})`;
                    ctx.lineWidth = 3.5;
                    ctx.setLineDash([25, 15]);
                    ctx.beginPath();
                    ctx.arc(0, 0, 350, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                } else {
                    ctx.save();
                    ctx.translate(big.x, big.y);
                    const angle = Math.atan2(big.bigDashDirectionY ?? 0, big.bigDashDirectionX ?? 1);
                    ctx.rotate(angle);
                    
                    // Pulsing red transparent hazard channel (matching 128px body diameter)
                    ctx.fillStyle = `rgba(239, 68, 68, ${0.14 + pulse * 0.12})`;
                    ctx.fillRect(0, -64, 2000, 128);
                    
                    // Warn borders
                    ctx.strokeStyle = `rgba(239, 68, 68, ${0.5 + pulse * 0.35})`;
                    ctx.lineWidth = 3.5;
                    ctx.setLineDash([25, 15]);
                    ctx.strokeRect(0, -64, 2000, 128);
                    ctx.restore();
                }
            }

            // Draw red cross warning when Purple/Bomb zombies are dying
            if ((z.type === 'zombie_big' || z.type === 'zombie_bomb') && (z as any).isDying) {
                const big = z as any;
                const pulse = 0.5 + 0.4 * Math.sin(Date.now() * 0.02);
                
                if (z.type === 'zombie_bomb') {
                    // Draw a giant circular warning for the upcoming earthquake with red color
                    ctx.save();
                    ctx.translate(big.x, big.y);
                    
                    const alphaFill = 0.14 + pulse * 0.12;
                    ctx.fillStyle = `rgba(239, 68, 68, ${alphaFill})`;
                    ctx.beginPath();
                    ctx.arc(0, 0, 350, 0, Math.PI * 2);
                    ctx.fill();
                    
                    const alphaStroke = 0.5 + pulse * 0.35;
                    ctx.strokeStyle = `rgba(239, 68, 68, ${alphaStroke})`;
                    ctx.lineWidth = 3.5;
                    ctx.setLineDash([25, 15]);
                    ctx.beginPath();
                    ctx.arc(0, 0, 350, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                } else {
                    const angle = big.deathBeamAngle ?? 0;
                    
                    ctx.save();
                    ctx.translate(big.x, big.y);
                    ctx.rotate(angle);
                    
                    // Pulsing rainbow transparent hazard channel (matching 128px beam diameter)
                    const gradFill = ctx.createLinearGradient(0, -64, 0, 64);
                    const alphaFill = 0.14 + pulse * 0.12;
                    gradFill.addColorStop(0, `rgba(255, 0, 0, ${alphaFill})`);
                    gradFill.addColorStop(0.17, `rgba(255, 127, 0, ${alphaFill})`);
                    gradFill.addColorStop(0.33, `rgba(255, 255, 0, ${alphaFill})`);
                    gradFill.addColorStop(0.5, `rgba(0, 255, 0, ${alphaFill})`);
                    gradFill.addColorStop(0.67, `rgba(0, 0, 255, ${alphaFill})`);
                    gradFill.addColorStop(0.83, `rgba(75, 0, 130, ${alphaFill})`);
                    gradFill.addColorStop(1, `rgba(148, 0, 211, ${alphaFill})`);

                    // 1. Draw a white backing fill layer first to make rainbow colors pop
                    ctx.fillStyle = `rgba(255, 255, 255, ${alphaFill * 1.5})`;
                    ctx.fillRect(0, -64, 2000, 128);

                    ctx.fillStyle = gradFill;
                    ctx.fillRect(0, -64, 2000, 128);
                    
                    // Warn borders with rainbow gradients
                    const gradStroke = ctx.createLinearGradient(0, -64, 0, 64);
                    const alphaStroke = 0.5 + pulse * 0.35;
                    gradStroke.addColorStop(0, `rgba(255, 0, 0, ${alphaStroke})`);
                    gradStroke.addColorStop(0.17, `rgba(255, 127, 0, ${alphaStroke})`);
                    gradStroke.addColorStop(0.33, `rgba(255, 255, 0, ${alphaStroke})`);
                    gradStroke.addColorStop(0.5, `rgba(0, 255, 0, ${alphaStroke})`);
                    gradStroke.addColorStop(0.67, `rgba(0, 0, 255, ${alphaStroke})`);
                    gradStroke.addColorStop(0.83, `rgba(75, 0, 130, ${alphaStroke})`);
                    gradStroke.addColorStop(1, `rgba(148, 0, 211, ${alphaStroke})`);

                    // 2. Draw a white backing stroke layer first to make rainbow borders pop
                    ctx.strokeStyle = `rgba(255, 255, 255, ${alphaStroke * 1.5})`;
                    ctx.lineWidth = 3.5;
                    ctx.setLineDash([25, 15]);
                    ctx.strokeRect(0, -64, 2000, 128);

                    ctx.strokeStyle = gradStroke;
                    ctx.lineWidth = 3.5;
                    ctx.setLineDash([25, 15]);
                    ctx.strokeRect(0, -64, 2000, 128);
                    ctx.restore();
                }
            }

            // Draw active red laser beams when Boss or Big Zombies are in 'dash' state
            if (z.type === 'zombie_boss' && (z as any).bossAttackState === 'dash') {
                const boss = z as any;
                ctx.save();
                ctx.translate(boss.x, boss.y);
                const angle = Math.atan2(boss.bossDashDirectionY ?? 0, boss.bossDashDirectionX ?? 1);
                ctx.rotate(angle);
                
                // Outer glow shadow
                // Removed shadowColor for perf
                // Removed shadowBlur for perf
                
                // Deep red outer beam (matching 256px width)
                ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
                ctx.fillRect(0, -128, 2000, 256);
                
                // Bright red neon inner beam
                ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
                ctx.fillRect(0, -60, 2000, 120);
                
                // Intense white-hot core
                ctx.fillStyle = '#ffffff';
                // Removed shadowColor for perf
                // Removed shadowBlur for perf
                ctx.fillRect(0, -15, 2000, 30);
                
                ctx.restore();
            }

            if (z.type === 'zombie_big' && (z as any).bigAttackState === 'dash') {
                const big = z as any;
                ctx.save();
                ctx.translate(big.x, big.y);
                const angle = Math.atan2(big.bigDashDirectionY ?? 0, big.bigDashDirectionX ?? 1);
                ctx.rotate(angle);
                
                // Outer glow shadow
                // Removed shadowColor for perf
                // Removed shadowBlur for perf
                
                // Red outer beam (matching 128px width)
                ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
                ctx.fillRect(0, -64, 2000, 128);
                
                // Bright red neon inner beam
                ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
                ctx.fillRect(0, -30, 2000, 60);
                
                // White-hot core
                ctx.fillStyle = '#ffffff';
                // Removed shadowColor for perf
                // Removed shadowBlur for perf
                ctx.fillRect(0, -8, 2000, 16);
                
                ctx.restore();
            }

            const spr = sprites[z.type];
            ctx.save();
            let zDrawX = z.x;
            let zDrawY = z.y;
            if (engine.zombieSiegeActive && engine.siegeStatus === 'clinging' && (z as any).isSiegeZombie) {
                zDrawX += (Math.random() - 0.5) * 16;
                zDrawY += (Math.random() - 0.5) * 16;
            }
            if (z.type === 'zombie_boss') {
                if ((z as any).struggleJitterX !== undefined) {
                    zDrawX += (z as any).struggleJitterX;
                    zDrawY += (z as any).struggleJitterY;
                }
            }
            if (z.type === 'zombie_boss' && (z as any).isDying) {
                // Violent vibration during the final death process
                zDrawX += (Math.random() - 0.5) * 24;
                zDrawY += (Math.random() - 0.5) * 24;
            }
            ctx.translate(zDrawX, zDrawY);
            
            if (z.type === 'zombie_boss' && (z as any).isDying) {
                // Boss swells dynamically based on remaining time (from 1.0 to 1.38 size)
                const elapsed = 3.0 - ((z as any).bossDyingTimer ?? 3.0);
                const swelling = 1.0 + 0.38 * (elapsed / 3.0);
                ctx.scale(swelling, swelling);
            }

            // Calculate vertical leap/jump offset during earthquake leap
            let yOffset = 0;
            let shadowScale = 1.0;
            if (z.introState === 'jumping' && (z as any).introZ !== undefined && (z as any).introZ > 0) {
                yOffset = -(z as any).introZ;
                shadowScale = Math.max(0.2, 1.0 - (z as any).introZ / 120);
            } else if (z.type === 'zombie_boss' && (z as any).introZ !== undefined && (z as any).introZ > 0) {
                yOffset = -(z as any).introZ;
                shadowScale = Math.max(0.1, 1.0 - (z as any).introZ / 1500);
            } else if (z.type === 'zombie_boss' && (z as any).bossAttackState === 'earthquake_leap') {
                const timer = (z as any).bossAttackTimer || 0;
                const duration = 0.8;
                const progress = timer / duration;
                // Parabolic trajectory: rise up, then fall down
                yOffset = -220 * 4 * progress * (1 - progress);
                shadowScale = 0.5 + 0.5 * (1.0 - (progress * 4 * (1 - progress)));
            } else if (z.type === 'zombie_bomb' && (z as any).bigAttackState === 'earthquake_leap') {
                const timer = (z as any).bigAttackTimer || 0;
                const duration = 0.8;
                const progress = timer / duration;
                yOffset = -220 * 4 * progress * (1 - progress);
                shadowScale = 0.5 + 0.5 * (1.0 - (progress * 4 * (1 - progress)));
            } else if (z.type === 'zombie_bouncing' && (z as any).introZ !== undefined && (z as any).introZ > 0) {
                yOffset = -(z as any).introZ;
                shadowScale = Math.max(0.1, 1.0 - (z as any).introZ / 300);
            } else if (z.bounceTimer !== undefined && z.bounceTimer > 0 && z.maxBounceTimer !== undefined && z.maxBounceTimer > 0) {
                const ratio = Math.max(0, Math.min(1, z.bounceTimer / z.maxBounceTimer));
                const maxJumpH = z.type === 'zombie_boss' ? 30 : ((z.type === 'zombie_big' || z.type === 'zombie_bomb') ? 55 : 80);
                const jumpH = 4 * ratio * (1 - ratio);
                yOffset -= jumpH * maxJumpH;
                shadowScale *= Math.max(0.3, 1.0 - jumpH * 0.4);
            }

            // Ground shadow under the zombie/monster (drawn before rotation)
            ctx.save();
            const zox = 8;
            const zoy = 15;
            const zShadowRadius = Math.max(z.radius * 1.5, 30) * shadowScale;
            const zGrad = ctx.createRadialGradient(zox, zoy, zShadowRadius * 0.1, zox, zoy, zShadowRadius);
            zGrad.addColorStop(0, `rgba(0, 0, 0, ${0.85 * shadowScale})`);
            zGrad.addColorStop(0.5, `rgba(0, 0, 0, ${0.4 * shadowScale})`);
            zGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = zGrad;
            ctx.beginPath();
            ctx.arc(zox, zoy, zShadowRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (yOffset !== 0) {
                ctx.translate(0, yOffset);
            }

            if (z.type === 'zombie_boss' && (z as any).introZ !== undefined && (z as any).introZ > 0) {
                const scaleUp = 1.0 + (z as any).introZ / 300;
                ctx.scale(scaleUp, scaleUp);
            }

            // Draw a glowing, flashing purple octagonal shield frame when Boss is in invincible or super armor (special poise) state
            if (z.type === 'zombie_boss' && !(z as any).isDying) {
                const bossState = (z as any).bossAttackState;
                const isInvincibleOrSpecial = (bossState === 'warning' || bossState === 'dash' || bossState === 'earthquake_leap' || ((z as any).introZ !== undefined && (z as any).introZ > 0));
                if (isInvincibleOrSpecial) {
                    ctx.save();
                    // Custom independent continuous fast rotation for the shield frame
                    const shieldRot = (Date.now() / 250) % (Math.PI * 2);
                    ctx.rotate(shieldRot);

                    // Radius just outside the boss shoulder guard/claws (around 162px)
                    // Increased radius by 25% (162 * 1.25 = 202.5, 6 * 1.25 = 7.5)
                    const shieldRad = 202.5 + 7.5 * Math.sin(Date.now() / 90);
                    // Flashing opacity (rapid but smooth energetic flashing/pulsing)
                    const shieldAlpha = 0.45 + 0.5 * Math.abs(Math.sin(Date.now() / 150));

                    // Draw 3 nested concentric hexagons (Outer is thick, inner is thin)
                    const drawHexagonFrame = (radius: number, strokeStyle: string, lineWidth: number) => {
                        ctx.strokeStyle = strokeStyle;
                        ctx.lineWidth = lineWidth;
                        ctx.beginPath();
                        for (let i = 0; i < 6; i++) {
                            const theta = (i * Math.PI) / 3;
                            const ox = radius * Math.cos(theta);
                            const oy = radius * Math.sin(theta);
                            if (i === 0) ctx.moveTo(ox, oy);
                            else ctx.lineTo(ox, oy);
                        }
                        ctx.closePath();
                        ctx.stroke();
                    };

                    // ---- Honeycomb internal fill ----
                    ctx.save();
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const theta = (i * Math.PI) / 3;
                        const ox = shieldRad * Math.cos(theta);
                        const oy = shieldRad * Math.sin(theta);
                        if (i === 0) ctx.moveTo(ox, oy);
                        else ctx.lineTo(ox, oy);
                    }
                    ctx.closePath();
                    ctx.clip(); // Clip honeycomb to inside the shield
                    
                    const hexSize = 25; // size of the small hexagons
                    ctx.strokeStyle = `rgba(168, 85, 247, ${shieldAlpha * 0.35})`;
                    ctx.lineWidth = 2.0;

                    const hexWidth = Math.sqrt(3) * hexSize;
                    const hexHeight = 2 * hexSize;
                    const xOffset = hexWidth;
                    const yOffset = 1.5 * hexSize;

                    // Compute grid size based on shield boundaries to avoid excess drawing
                    const bound = shieldRad + hexSize * 2;
                    const startX = -Math.ceil(bound / xOffset);
                    const endX = Math.ceil(bound / xOffset);
                    const startY = -Math.ceil(bound / yOffset);
                    const endY = Math.ceil(bound / yOffset);

                    ctx.beginPath();
                    for (let row = startY; row <= endY; row++) {
                        for (let col = startX; col <= endX; col++) {
                            const cx = col * xOffset + (row % 2 !== 0 ? xOffset / 2 : 0);
                            const cy = row * yOffset;

                            if (cx * cx + cy * cy <= bound * bound) {
                                for (let i = 0; i < 6; i++) {
                                    const theta = (i * Math.PI) / 3 + Math.PI / 6; // rotated 30 degrees for pointy top
                                    const px = cx + hexSize * Math.cos(theta);
                                    const py = cy + hexSize * Math.sin(theta);
                                    if (i === 0) ctx.moveTo(px, py);
                                    else ctx.lineTo(px, py);
                                }
                                ctx.closePath();
                            }
                        }
                    }
                    ctx.stroke();
                    ctx.restore();
                    // ---------------------------------

                    // 1. Outer frame: Thick and dark violet
                    drawHexagonFrame(shieldRad + 14, `rgba(126, 34, 206, ${shieldAlpha * 0.7})`, 7.5);

                    // 2. Middle frame: Medium and medium purple
                    drawHexagonFrame(shieldRad, `rgba(168, 85, 247, ${shieldAlpha * 0.85})`, 4.0);

                    // 3. Inner frame: Thinnest and bright lavender
                    drawHexagonFrame(shieldRad - 14, `rgba(243, 232, 255, ${shieldAlpha * 0.95})`, 1.8);

                    // 4. Draw small pulsing terminal nodes (circles) at the 6 corners of the middle hexagon
                    for (let i = 0; i < 6; i++) {
                        const theta = (i * Math.PI) / 3;
                        const ox = shieldRad * Math.cos(theta);
                        const oy = shieldRad * Math.sin(theta);
                        
                        // Outer node glow ring
                        ctx.fillStyle = `rgba(216, 180, 254, ${shieldAlpha * 0.9})`;
                        ctx.beginPath();
                        ctx.arc(ox, oy, 5, 0, Math.PI * 2);
                        ctx.fill();

                        // Inner white node core
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(ox, oy, 2, 0, Math.PI * 2);
                        ctx.fill();

                        if ((z as any).weakCornerIndex === i && bossState === 'warning') {
                            ctx.save();
                            ctx.translate(ox, oy);
                            ctx.rotate(-shieldRot); // keep upright relative to the screen
                            
                            ctx.beginPath();
                            ctx.moveTo(-18, -15);
                            ctx.lineTo(18, -15);
                            ctx.lineTo(0, 15);
                            ctx.closePath();
                            
                            ctx.fillStyle = '#ef4444'; // Red
                            ctx.fill();
                            ctx.lineWidth = 3.5;
                            ctx.strokeStyle = '#facc15'; // Yellow
                            ctx.stroke();
                            ctx.restore();
                        }
                    }

                    ctx.restore();
                }
            }

            ctx.rotate(z.angle);
            if (z.type === 'zombie_boss' && z.hitCooldown !== undefined && z.hitCooldown > 0) {
                // High frequency oscillation transparency for an incredible invincibility glowing/shield look
                ctx.globalAlpha = 0.4 + 0.3 * Math.sin(Date.now() / 25);
            }
            if (z.flashTimer !== undefined && z.flashTimer > 0) {
                // Modified from invert(1) to invert(0.7) to convert the solid harsh white to a soft silver-white/gray silhouette
                // Filter removed for perf
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.6;
            }
            ctx.drawImage(spr, -spr.width/2, -spr.height/2);
            ctx.restore();
            
            // Floating "20彩票" ticket icon for purple/brown/pink zombies
            if ((z.type === 'zombie_big' || z.type === 'zombie_bomb' || z.type === 'zombie_bouncing') && !(z as any).isDying) {
                ctx.save();
                
                let sf = 1.0;
                if (z.type === 'zombie_big') sf = 1.0;
                else if (z.type === 'zombie_bomb') sf = 1.5;
                else if (z.type === 'zombie_bouncing') sf = 2.0;

                const ticketW = 34 * sf;
                const ticketH = 22 * sf;
                const notchR = 3 * sf;
                const tx = zDrawX;
                const ty = zDrawY + yOffset;

                const drawTicketPath = (x: number, y: number, w: number, h: number, r: number) => {
                    ctx.beginPath();
                    ctx.moveTo(x - w / 2, y - h / 2);
                    ctx.lineTo(x + w / 2, y - h / 2);
                    ctx.lineTo(x + w / 2, y - r);
                    ctx.arc(x + w / 2, y, r, -Math.PI / 2, Math.PI / 2, true);
                    ctx.lineTo(x + w / 2, y + h / 2);
                    ctx.lineTo(x - w / 2, y + h / 2);
                    ctx.lineTo(x - w / 2, y + r);
                    ctx.arc(x - w / 2, y, r, Math.PI / 2, -Math.PI / 2, true);
                    ctx.lineTo(x - w / 2, y - h / 2);
                    ctx.closePath();
                };

                // 1. Draw Drop Shadow
                ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                drawTicketPath(tx + 2, ty + 2, ticketW, ticketH, notchR);
                ctx.fill();

                // 2. Draw Rainbow Gradient Ticket Background
                const grad = ctx.createLinearGradient(tx - ticketW / 2, 0, tx + ticketW / 2, 0);
                grad.addColorStop(0, '#ef4444');
                grad.addColorStop(0.2, '#f97316');
                grad.addColorStop(0.4, '#eab308');
                grad.addColorStop(0.6, '#22c55e');
                grad.addColorStop(0.8, '#3b82f6');
                grad.addColorStop(1, '#a855f7');
                
                ctx.fillStyle = grad;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5 * sf;
                drawTicketPath(tx, ty, ticketW, ticketH, notchR);
                ctx.fill();
                ctx.stroke();

                // 3. Draw Ticket Text
                const pm = ProbabilityManager.getInstance();
                const chance = pm.getChance();
                let ticketText = '9';
                if (z.type === 'zombie_big') {
                    ticketText = (chance.ulRopeTickets[TARGET_TYPE.GraveRobber] || 9).toString();
                } else if (z.type === 'zombie_bomb') {
                    ticketText = (chance.ulRopeTickets[TARGET_TYPE.BombMan] || 11).toString();
                } else if (z.type === 'zombie_bouncing') {
                    ticketText = (chance.ulRopeTickets[TARGET_TYPE.FootballPlayer] || 14).toString();
                }

                let fontSize = Math.round(12 * sf);
                ctx.font = `bold ${fontSize}px "Space Grotesk", "Microsoft JhengHei", sans-serif`;
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2.5 * sf;
                ctx.strokeText(ticketText, tx, ty);
                ctx.fillText(ticketText, tx, ty);

                ctx.restore();
            }
        });



        // Draw Tops
        engine.tops.forEach((top) => {
            // Draw Concentric Contracting Rings & Max Spin Expanding Halos first
            const targetCenterX = (top.state === 'standby' && top.standbyCenterX !== undefined) ? top.standbyCenterX : top.x;
            const targetCenterY = (top.state === 'standby' && top.standbyCenterY !== undefined) ? top.standbyCenterY : top.y;

            if (top.contractRings && top.contractRings.length > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                top.contractRings.forEach((ring: any) => {
                    let alpha = 0.55;
                    if (ring.radius > 175) {
                        alpha = 0.55 * (200 - ring.radius) / 25;
                    } else if (ring.radius < 65) {
                        alpha = 0.55 * (ring.radius - top.radius) / (65 - top.radius);
                        if (alpha < 0) alpha = 0;
                    }

                    ctx.beginPath();
                    ctx.arc(targetCenterX, targetCenterY, ring.radius, 0, Math.PI * 2);
                    ctx.strokeStyle = top.color;
                    ctx.lineWidth = 3.5;
                    // Removed shadowColor for perf
                    // Removed shadowBlur for perf
                    ctx.globalAlpha = alpha;
                    ctx.stroke();
                });
                ctx.restore();
            }

            if (top.maxSpinHalos && top.maxSpinHalos.length > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                top.maxSpinHalos.forEach((halo: any) => {
                    const pct = (halo.maxLife - halo.life) / halo.maxLife;
                    const alpha = Math.max(0, 1.0 - pct);

                    // Dual layered halo:
                    // Layer 1: White-hot sharp ring (doubled stroke thickness)
                    ctx.beginPath();
                    ctx.arc(targetCenterX, targetCenterY, halo.radius, 0, Math.PI * 2);
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 11.0 * (1.0 - pct);
                    // Removed shadowColor for perf
                    // Removed shadowBlur for perf
                    ctx.globalAlpha = alpha;
                    ctx.stroke();

                    // Layer 2: Wide colorful glowing rim bloom (doubled stroke thickness)
                    ctx.beginPath();
                    ctx.arc(targetCenterX, targetCenterY, halo.radius, 0, Math.PI * 2);
                    ctx.strokeStyle = top.color;
                    ctx.lineWidth = 32 * (1.0 - pct);
                    // Removed shadowColor for perf
                    // Removed shadowBlur for perf
                    ctx.globalAlpha = alpha * 0.75;
                    ctx.stroke();
                });
                ctx.restore();
            }

            const dynamicZ = (top.introZ ?? 0) + (top.zPos ?? 0);
            if (dynamicZ > 0) {
                ctx.save();
                const shadowScale = Math.max(0.2, 1.0 - dynamicZ / 1000);
                const shadowAlpha = Math.max(0.1, 0.45 * shadowScale);
                ctx.fillStyle = `rgba(2, 6, 23, ${shadowAlpha})`;
                ctx.beginPath();
                ctx.arc(top.x, top.y, top.radius * shadowScale, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            ctx.save();
            if (top.isExploding && top.explosionTimer !== undefined) {
                ctx.globalAlpha = Math.max(0, top.explosionTimer / 2.0);
            }
            if (top.flashTimer !== undefined && top.flashTimer > 0) {
                // Retro old-school sprite damage blinking/flickering effect (alternating high/low opacity)
                const blinkOn = Math.floor(Date.now() / 45) % 2 === 0;
                ctx.globalAlpha *= (blinkOn ? 0.25 : 1.0);
            }
            let topDrawX = top.x;
            let topDrawY = top.y;
            
            if ((top as any).introShake && (top as any).introShake > 0) {
                topDrawX += (Math.random() - 0.5) * (top as any).introShake;
                topDrawY += (Math.random() - 0.5) * (top as any).introShake;
            }
            
            if (top.launchPadState === 'prep_spinning') {
                // 隨著時間倒數而逐漸強烈晃動，轉速強烈加速
                const timer = top.launchPadTimer ?? 1.5;
                const progress = Math.min(1.0, Math.max(0.0, 1.0 - timer / 1.5));
                const shakeIntensity = 3.0 + Math.pow(progress, 2.0) * 22.0; // scales up to 25px
                topDrawX += (Math.random() - 0.5) * shakeIntensity;
                topDrawY += (Math.random() - 0.5) * shakeIntensity;
            } else if (top.launchPadState === 'charging') {
                // Peak charge vibration before blastoff
                const shakeIntensity = 25.0;
                topDrawX += (Math.random() - 0.5) * shakeIntensity;
                topDrawY += (Math.random() - 0.5) * shakeIntensity;
            } else if (engine.zombieSiegeActive && engine.siegeStatus === 'clinging' && top.id === engine.siegeTargetPlayerId) {
                topDrawX += (Math.random() - 0.5) * 16;
                topDrawY += (Math.random() - 0.5) * 16;
            } else if (top.state === 'standby' && top.isSpinning) {
                // 陀螺加速時，本體保持微微的上下左右晃動
                topDrawX += (Math.random() - 0.5) * 5.0;
                topDrawY += (Math.random() - 0.5) * 5.0;
            }

            if (top.struggleJitterX !== undefined) {
                topDrawX += top.struggleJitterX;
            }
            if (top.struggleJitterY !== undefined) {
                topDrawY += top.struggleJitterY;
            }
            ctx.translate(topDrawX, topDrawY);

            // Dynamically scale player and active visual effects based on Gigantification skill state
            const drawingScaleFactor = GameUtils.getTopScale(engine, top);

            const currentDynamicZ = (top.introZ ?? 0) + (top.zPos ?? 0);
            if (currentDynamicZ > 0) {
                const currentScale = 1.0 + currentDynamicZ / 250;
                ctx.scale(currentScale, currentScale);
            } else {
                let yOffset = 0;
                let shadowScale = 1.0;
                if (top.bounceTimer !== undefined && top.bounceTimer > 0 && top.maxBounceTimer !== undefined && top.maxBounceTimer > 0) {
                    const ratio = Math.max(0, Math.min(1, top.bounceTimer / top.maxBounceTimer));
                    const jumpH = 4 * ratio * (1 - ratio);
                    yOffset -= jumpH * 45; // max height 45px
                    shadowScale *= Math.max(0.4, 1.0 - jumpH * 0.5);
                }

                // Beautiful soft ground shadow under the player top
                ctx.save();
                const ox = 8;
                const oy = 15;
                const shadowRadius = Math.max(top.radius * 1.5, 30) * shadowScale;
                const grad = ctx.createRadialGradient(ox, oy, shadowRadius * 0.1, ox, oy, shadowRadius);
                grad.addColorStop(0, `rgba(0, 0, 0, ${0.85 * shadowScale})`);
                grad.addColorStop(0.5, `rgba(0, 0, 0, ${0.4 * shadowScale})`);
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(ox, oy, shadowRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                if (yOffset !== 0) {
                    ctx.translate(0, yOffset);
                }
            }
            
            // Dash / Spin Aura
            if (top.spin > 800) {
               ctx.fillStyle = `${top.color}44`; // translucent color
               ctx.beginPath(); ctx.arc(0, 0, top.radius + 10 + Math.random()*10, 0, Math.PI*2); ctx.fill();
            }

            // Draw hemispherical shield / shockwave facing the dash direction during dash state, or when spin is 5 or more
            const isShieldSpinActive = ((top.spin ?? MAX_SPIN) / (top.maxSpin || MAX_SPIN) * 10) >= 5.0;
            if (top.state === 'dash' || isShieldSpinActive) {
                let dx = 0;
                let dy = 0;
                if (top.state === 'dash') {
                    dx = top.dashDirectionX ?? 0;
                    dy = top.dashDirectionY ?? 0;
                } else {
                    dx = top.vx ?? 0;
                    dy = top.vy ?? 0;
                }
                const speed = Math.hypot(dx, dy);
                const dashAngle = speed > 5 ? Math.atan2(dy, dx) : (top.angle ?? 0);
                
                ctx.save();
                ctx.rotate(dashAngle);

                const progress = top.state === 'dash' 
                    ? Math.max(0, Math.min(1, 1.0 - ((top.dashTimer ?? 0.5) / (top.maxDashDuration || 1.0)))) 
                    : ((Date.now() / 600) % 1.0);

                const wavePhase = (Date.now() / 80) % (Math.PI * 2);
                const pulse = Math.sin(wavePhase) * 4;
                const rBase = top.radius + 8 + pulse;

                    // Layer 1: Volumetric volumetric gradient dome (combines forward linear energy & radial glow) - intensified opacity
                    const grad = ctx.createRadialGradient(0, 0, top.radius - 5, 0, 0, rBase + 5);
                    grad.addColorStop(0, 'rgba(0,0,0,0)');
                    grad.addColorStop(0.5, `${top.color}15`); // intensified soft inner fill
                    grad.addColorStop(0.9, `${top.color}56`);  // intensified medium intensity
                    grad.addColorStop(1, `${top.color}8a`);    // intensified outer shell

                    const forwardHeatGrad = ctx.createLinearGradient(0, 0, rBase, 0);
                    forwardHeatGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
                    forwardHeatGrad.addColorStop(0.4, `${top.color}0a`);
                    forwardHeatGrad.addColorStop(0.85, `${top.color}74`); // intensified compression heat
                    forwardHeatGrad.addColorStop(1, 'rgba(255, 255, 255, 0.5)'); // intensified hot leading tip

                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(0, 0, rBase, -Math.PI / 2, Math.PI / 2);
                    ctx.lineTo(0, 0);
                    ctx.closePath();
                    ctx.fill();

                    ctx.fillStyle = forwardHeatGrad;
                    ctx.beginPath();
                    ctx.arc(0, 0, rBase, -Math.PI / 2, Math.PI / 2);
                    ctx.lineTo(0, 0);
                    ctx.closePath();
                    ctx.fill();

                    // Layer 2: Magnetic energy field lines / Concentric inner rings (精緻的諧振線條) - reinforced thickness (increased by another 3x)
                    ctx.strokeStyle = `${top.color}9c`;
                    ctx.lineWidth = 6; // Tripled from 2
                    ctx.beginPath();
                    ctx.arc(0, 0, rBase - 5, -Math.PI / 2.1, Math.PI / 2.1);
                    ctx.stroke();

                    ctx.strokeStyle = `${top.color}55`;
                    ctx.lineWidth = 4.5; // Tripled from 1.5
                    ctx.beginPath();
                    ctx.arc(0, 0, rBase - 11, -Math.PI / 2.2, Math.PI / 2.2);
                    ctx.stroke();

                    // Layer 3: Dynamic Re-entry Edge-Fading Outline Stroke
                    // Stroke gradient runs from y-endpoints (x=0) to the hot leading nose (x=rBase)
                    const edgeStrokeGrad = ctx.createLinearGradient(0, 0, rBase, 0);
                    edgeStrokeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)'); // Fades out beautifully towards the flat base
                    edgeStrokeGrad.addColorStop(0.3, `${top.color}aa`); // More visible colored wingtips
                    edgeStrokeGrad.addColorStop(0.75, top.color);       // Fully saturated neon color
                    edgeStrokeGrad.addColorStop(0.95, '#ffffff');       // White-hot core leading edge
                    edgeStrokeGrad.addColorStop(1, '#ffffff');

                    // Colored outer blur glow - reinforced thickness & glow (increased by another 3x)
                    ctx.strokeStyle = edgeStrokeGrad;
                    ctx.lineWidth = 27.0; // Tripled from 9.0
                    // Removed shadowColor for perf
                    // Removed shadowBlur for perf // Tripled and enhanced from 20
                    ctx.beginPath();
                    ctx.arc(0, 0, rBase, -Math.PI / 2, Math.PI / 2);
                    ctx.stroke();
                    // Removed shadowBlur for perf // reset immediately

                    // Robust white core - reinforced thickness (increased by another 3x)
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 7.5; // Tripled from 2.5
                    ctx.beginPath();
                    ctx.arc(0, 0, rBase, -Math.PI / 2.05, Math.PI / 2.05);
                    ctx.stroke();

                    // Layer 4: Expanding shockwave wave ripple - reinforced thickness (increased by another 3x)
                    const waveR = rBase + 10 + progress * 28;
                    const waveAlpha = Math.max(0, 0.75 * (1.0 - progress));
                    if (waveAlpha > 0.01) {
                        ctx.save();
                        ctx.globalAlpha = waveAlpha;

                        const rippleStrokeGrad = ctx.createLinearGradient(0, 0, waveR, 0);
                        rippleStrokeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
                        rippleStrokeGrad.addColorStop(0.5, `${top.color}66`); // intensified
                        rippleStrokeGrad.addColorStop(1, top.color);

                        ctx.strokeStyle = rippleStrokeGrad;
                        ctx.lineWidth = 12.0; // Tripled from 4.0
                        ctx.beginPath();
                        ctx.arc(0, 0, waveR, -Math.PI / 2, Math.PI / 2);
                        ctx.stroke();

                        // Inner helper echo ripple line - reinforced thickness
                        ctx.lineWidth = 4.5; // Tripled from 1.5
                        ctx.beginPath();
                        ctx.arc(0, 0, waveR - 7, -Math.PI / 2.2, Math.PI / 2.2);
                        ctx.stroke();
                        ctx.restore();
                    }

                    ctx.restore();
                }

            // 判斷陀螺是否為待機/繞行狀態或是彈射充電與繞行狀態 (top.state === 'standby' || launchPad states)
            if (top.state === 'standby' || top.launchPadState === 'charging' || top.launchPadState === 'flying') {
                ctx.save();
                const time = Date.now();

                const isVortexActive = (top.isSpinning && top.spin >= 500) || (top.launchPadState !== undefined);
                if (isVortexActive) {
                    // ==========================================
                    // 【強力繞行氣旋特效】 (top.isSpinning === true && spin >= 5) 或特殊彈射衝鋒中
                    // ==========================================
                    // 1. 持續透明與縮放的動態漸變漸變算式 (Pulsing Factor) - 加強縮放與律動感
                    const pulseScale = 0.98 + 0.12 * Math.sin(time / 80); // 縮放更加劇烈
                    const pulseAlpha = 0.7 + 0.3 * Math.sin(time / 120);  // 透明度維持高能見度
                    
                    ctx.globalAlpha *= Math.max(0, pulseAlpha);
                    ctx.scale(pulseScale, pulseScale);
                    
                    // 2. 風旋旋轉的角度相位 (超高速旋轉)
                    const windPhase = -(time / 25) % (Math.PI * 2);
                    
                    // 繪製 6 條對稱的強力氣旋螺線
                    const numStrands = 6;
                    for (let i = 0; i < numStrands; i++) {
                        const offset = (Math.PI * 2 / numStrands) * i;
                        ctx.beginPath();
                        
                        // 氣旋螺旋算法：半徑與長度大幅提升，展現強力氣流擴散效果
                        for (let a = 0; a < Math.PI * 1.8; a += 0.08) {
                            const windRadius = top.radius + 4 + Math.pow(a, 1.55) * 14; 
                            const angle = windPhase + offset + a;
                            
                            const px = Math.cos(angle) * windRadius;
                            const py = Math.sin(angle) * windRadius;
                            
                            if (a === 0) {
                                ctx.moveTo(px, py);
                            } else {
                                ctx.lineTo(px, py);
                            }
                        }
                        
                        // 3. 放射狀漸層色 (融入玩家陀螺主題色，外側半徑自然淡出) - 範圍擴大至 +100px
                        const maxSpread = 80;
                        const grad = ctx.createRadialGradient(0, 0, top.radius, 0, 0, top.radius + maxSpread);
                        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
                        grad.addColorStop(0.3, `${top.color}dd`); // 絕美玩家代表色發光層
                        grad.addColorStop(0.6, `${top.color}55`);
                        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                        
                        ctx.strokeStyle = grad;
                        ctx.lineWidth = 4.5; // 線條更厚實
                        ctx.lineCap = 'round';
                        
                        // 增加發光陰影
                        // Removed shadowColor for perf
                        // Removed shadowBlur for perf
                        ctx.stroke();
                    }
                    // Removed shadowBlur for perf // 重置陰影
                    
                    // 4. 加密外圍高能離心環與粒子閃爍圈 (Outer Heavy Vortex Ring)
                    ctx.save();
                    ctx.strokeStyle = `${top.color}44`;
                    ctx.lineWidth = 3;
                    ctx.setLineDash([15, 20]);
                    ctx.lineDashOffset = -(time / 15) % 360;
                    ctx.beginPath();
                    ctx.arc(0, 0, top.radius + 30, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();

                    // 5. 點綴內側銳利的超高速雙軌光圈 (Speed Dual-Ring)
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.arc(0, 0, top.radius + 6 + Math.random() * 5, windPhase, windPhase + Math.PI * 1.3, false);
                    ctx.stroke();
                } else {
                    // ==========================================
                    // 【普通待機氣旋特效】 (top.isSpinning === false)
                    // ==========================================
                    // 1. 持續透明與縮放的動態漸變漸變算式 (Pulsing Factor)
                    const pulseScale = 0.95 + 0.1 * Math.sin(time / 100); 
                    const pulseAlpha = 0.6 + 0.3 * Math.sin(time / 150);  
                    
                    ctx.globalAlpha *= Math.max(0, pulseAlpha);
                    ctx.scale(pulseScale, pulseScale);
                    
                    // 2. 風旋旋轉的角度相位 (隨著時間逆時針快速旋轉)
                    const windPhase = -(time / 40) % (Math.PI * 2);
                    
                    // 繪製 4 條對稱的氣旋螺線
                    const numStrands = 4;
                    for (let i = 0; i < numStrands; i++) {
                        const offset = (Math.PI * 2 / numStrands) * i;
                        ctx.beginPath();
                        
                        // 氣旋螺旋算法：隨著角度 a 遞增，半徑 windRadius 呈指數擴大
                        for (let a = 0; a < Math.PI * 1.5; a += 0.1) {
                            const windRadius = top.radius + 2 + Math.pow(a, 1.4) * 7; // 向外擴展
                            const angle = windPhase + offset + a;
                            
                            const px = Math.cos(angle) * windRadius;
                            const py = Math.sin(angle) * windRadius;
                            
                            if (a === 0) {
                                ctx.moveTo(px, py);
                            } else {
                                ctx.lineTo(px, py);
                            }
                        }
                        
                        // 3. 放射狀漸層色 (讓氣流向外側半徑自然淡出)
                        const grad = ctx.createRadialGradient(0, 0, top.radius, 0, 0, top.radius + 35);
                        grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
                        grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
                        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                        
                        ctx.strokeStyle = grad;
                        ctx.lineWidth = 3.5;
                        ctx.lineCap = 'round';
                        ctx.stroke();
                    }
                    
                    // 4. 點綴內側銳利的超高速光圈 (Speed Ring)
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, top.radius + 4 + Math.random() * 4, windPhase, windPhase + Math.PI, false);
                    ctx.stroke();
                }

                ctx.restore();
            }

            // Draw Model 2 Ultimate Skill Orbs (6 orbiting thunder/fire/electric balls)
            if (top.model2SkillTimer !== undefined && top.model2SkillTimer > 0) {
                ctx.save();
                
                // Calculate fade-in and fade-out alpha factor
                let orbAlpha = 1.0;
                if (top.model2SkillTimer > 9.0) {
                    orbAlpha = Math.max(0, Math.min(1.0, (9.6 - top.model2SkillTimer) / 0.6));
                } else if (top.model2SkillTimer < 0.6) {
                    orbAlpha = Math.max(0, Math.min(1.0, top.model2SkillTimer / 0.6));
                }

                const orbitRadius = 135;
                const orbRadius = 28;
                const angles: number[] = [];
                for (let i = 0; i < 6; i++) {
                    angles.push((top.model2OrbAngle ?? 0) + (i * Math.PI / 3));
                }

                // 1. Draw a faint glowing electrical circuit orbit path around the top
                ctx.strokeStyle = `rgba(56, 189, 248, ${0.2 * orbAlpha})`;
                ctx.lineWidth = 1.8;
                // Removed shadowColor for perf
                // Removed shadowBlur for perf
                ctx.beginPath();
                ctx.arc(0, 0, orbitRadius, 0, Math.PI * 2);
                ctx.stroke();
                // Removed shadowBlur for perf // reset shadow immediately

                // 2. Render each orb
                angles.forEach(ang => {
                    const ox = Math.cos(ang) * orbitRadius;
                    const oy = Math.sin(ang) * orbitRadius;

                    ctx.save();
                    ctx.globalAlpha = orbAlpha;

                    // A. Create shadow glow for high energy look
                    // Removed shadowColor for perf
                    // Removed shadowBlur for perf

                    // B. Draw multi-layered radial gradient circle (white hot core -> electric cyan -> orange flame rim)
                    const orbGrad = ctx.createRadialGradient(ox, oy, 1, ox, oy, orbRadius);
                    orbGrad.addColorStop(0, '#ffffff');                     // White hot center
                    orbGrad.addColorStop(0.35, '#38bdf8');                  // Electrical neon cyan
                    orbGrad.addColorStop(0.75, 'rgba(234, 179, 8, 0.9)');   // Fiery orange/gold plasma ring
                    orbGrad.addColorStop(1, 'rgba(234, 113, 8, 0)');        // Soft fading edge

                    ctx.fillStyle = orbGrad;
                    ctx.beginPath();
                    ctx.arc(ox, oy, orbRadius, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Removed shadowBlur for perf // reset

                    // C. Render 3 crackling electric discharges (lightning branches) shooting out
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * orbAlpha})`;
                    ctx.lineWidth = 1.6;
                    for (let j = 0; j < 3; j++) {
                        const sparkAngle = Math.random() * Math.PI * 2;
                        const len = orbRadius + Math.random() * 8;
                        const sx = ox + Math.cos(sparkAngle) * len;
                        const sy = oy + Math.sin(sparkAngle) * len;
                        
                        ctx.beginPath();
                        ctx.moveTo(ox, oy);
                        // Make electric line slightly jagged
                        const mix = ox + (sx - ox) * 0.5 + (Math.random() - 0.5) * 4;
                        const miy = oy + (sy - oy) * 0.5 + (Math.random() - 0.5) * 4;
                        ctx.lineTo(mix, miy);
                        ctx.lineTo(sx, sy);
                        ctx.stroke();
                    }

                    ctx.restore();
                });

                ctx.restore();
            }

            // Render high-intensity glowing background ball (aura/corona) when at full spin (MAX_SPIN)
            const isFullEnergy = top.spin >= (top.maxSpin || MAX_SPIN);
            if (isFullEnergy && !top.isExploding) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                
                const time = Date.now();
                const orbPulse = 1.0 + 0.08 * Math.sin(time * 0.015);
                const orbRadius = (top.radius || 48) * 1.55 * orbPulse;
                
                // Layer 1: Massive soft glow
                const outerGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, orbRadius);
                outerGrad.addColorStop(0, '#ffffff');
                outerGrad.addColorStop(0.2, '#ffffff');
                outerGrad.addColorStop(0.5, top.color || '#3b82f6');
                outerGrad.addColorStop(0.8, top.color || '#3b82f6');
                outerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                
                ctx.fillStyle = outerGrad;
                ctx.globalAlpha = 0.75 + 0.15 * Math.sin(time * 0.012);
                ctx.beginPath();
                ctx.arc(0, 0, orbRadius, 0, Math.PI * 2);
                ctx.fill();

                // Layer 2: White hot high energy core ball
                const innerRadius = (top.radius || 48) * 1.05 * orbPulse;
                const innerGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, innerRadius);
                innerGrad.addColorStop(0, '#ffffff');
                innerGrad.addColorStop(0.35, '#ffffff');
                innerGrad.addColorStop(0.8, 'rgba(255, 255, 255, 0.45)');
                innerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.fillStyle = innerGrad;
                ctx.globalAlpha = 0.85;
                ctx.beginPath();
                ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            }

            // Draw drop shadow matching top's calculated radius
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            const shadowRadius = (top.radius || 48) + 4;
            ctx.arc(2, 4, shadowRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.rotate(top.angle);
            const originalIdx = parseInt(top.id.split('_')[1], 10);
            const sprMap = ['top_0', 'top_1', 'top_2', 'top_3'];
            const spr = sprites[sprMap[originalIdx] || 'top_0'];
            
            const isFlashing = top.flashTimer !== undefined && top.flashTimer > 0 && top.launchPadState === undefined;
            if (isFlashing) {
                // Same soft silver-white/gray silhouette flash as zombies (invert 0.7)
                // Filter removed for perf
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.6;
            }
            
            ctx.save();
            ctx.scale(drawingScaleFactor, drawingScaleFactor);
            ctx.drawImage(spr, -spr.width/2, -spr.height/2);
            ctx.restore();
            
            if (isFlashing) {
                // Filter reset removed
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1.0;
            }

            // Draw a shifting rainbow colored tint overlay over the top when in Super/Star State or LaunchPad process!
            const isSuperOrLaunch = (top.superTimer !== undefined && top.superTimer > 0) || top.launchPadState !== undefined;
            if (isSuperOrLaunch) {
                ctx.save();
                ctx.globalCompositeOperation = 'source-atop';
                ctx.globalAlpha = 0.5; // beautiful 50% overlay transparency
                const tColor = Date.now() * 0.18; // Speed of rainbow phase shift
                const gradOver = ctx.createRadialGradient(0, 0, 0, 0, 0, top.radius);
                gradOver.addColorStop(0, `hsl(${tColor % 360}, 100%, 75%)`);
                gradOver.addColorStop(0.5, `hsl(${(tColor + 120) % 360}, 100%, 65%)`);
                gradOver.addColorStop(1, `hsl(${(tColor + 240) % 360}, 100%, 55%)`);
                ctx.fillStyle = gradOver;
                ctx.beginPath();
                ctx.arc(0, 0, top.radius + 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // Subtle glistening lens sheen on top of the top sprite so it looks radiant but not obscured
            if (isFullEnergy && !top.isExploding) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = 0.24 + 0.06 * Math.sin(Date.now() * 0.015);
                const lensGrad = ctx.createRadialGradient(-top.radius * 0.2, -top.radius * 0.2, 1, 0, 0, top.radius);
                lensGrad.addColorStop(0, '#ffffff');
                lensGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.7)');
                lensGrad.addColorStop(0.85, top.color || '#3b82f6');
                lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = lensGrad;
                ctx.beginPath();
                ctx.arc(0, 0, top.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // 當陀螺轉速在 5 以上時（即 spin >= 500），陀螺圖像的邊框線要有該 P 位色的呼吸燈閃爍效果（不論待機、加速、衝鋒）
            if (top.spin >= 500) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                
                // 呼吸燈閃爍效果
                const breatheFreq = 180; // 呼吸週期，毫秒
                const pulse = 0.5 + 0.5 * Math.sin(Date.now() / breatheFreq);
                
                // 設定 P 位色與白光的呼吸漸變
                // Removed shadowColor for perf
                // Removed shadowBlur for perf
                
                ctx.beginPath();
                // 圓形邊框，比 radius 稍微大一點點以更好地包裹陀螺圖像
                const borderR = (top.radius || 48) + 1.5;
                ctx.arc(0, 0, borderR, 0, Math.PI * 2);
                
                ctx.strokeStyle = top.color;
                ctx.lineWidth = 2.0 + 3.0 * pulse;
                ctx.globalAlpha = 0.45 + 0.55 * pulse;
                ctx.stroke();

                // 核心亮邊 (內圈超薄亮白邊)
                ctx.beginPath();
                ctx.arc(0, 0, borderR, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.0;
                ctx.globalAlpha = 0.3 * pulse;
                ctx.stroke();
                
                ctx.restore();
            }

            // 當陀螺轉速"全滿"時，陀螺要額外顯示一圈白色的外圈環狀氣流特效 (不論陀螺是在待機、加速或衝鋒)
            // 且採用螺旋狀氣流特效形式 (尺寸減少 50%，並具有持續縮放漸變與透明度漸變)
            const isFullSpin = top.spin >= (top.maxSpin || MAX_SPIN);
            if (isFullSpin) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                
                const time = Date.now();
                // 呼吸週期：控制持續縮放與透明度的規律起伏 (調整為 25% 較快的漸變頻率)
                const pulsePhase = time * 0.00625; 
                const scalePulse = 0.90 + 0.12 * Math.sin(pulsePhase); // 縮放比例在 0.90 ~ 1.02 之間
                const alphaPulse = 0.50 + 0.50 * Math.sin(pulsePhase + Math.PI / 6); // 透明度在 0.50 ~ 1.00 之間
                
                ctx.globalAlpha = alphaPulse;
                
                // 風旋旋轉的角度相位 (隨著時間快速旋轉)
                const windPhase = -(time / 30) % (Math.PI * 2);
                
                // 繪製 4 條對稱的純白螺旋氣旋
                const numStrands = 4;
                for (let i = 0; i < numStrands; i++) {
                    const offset = (Math.PI * 2 / numStrands) * i;
                    ctx.beginPath();
                    
                    // 氣旋螺旋算法：隨著角度 a 遞增，半徑 windRadius 呈指數擴大，與加速狀態的螺旋相符 (並套用縮放百分比)
                    for (let a = 0; a < Math.PI * 1.8; a += 0.08) {
                        const baseRadius = (top.radius || 48) + 2 + Math.pow(a, 1.55) * 7.0; // 基礎螺旋半徑
                        const windRadius = baseRadius * scalePulse; // 套用動態縮放
                        const angle = windPhase + offset + a;
                        
                        const px = Math.cos(angle) * windRadius;
                        const py = Math.sin(angle) * windRadius;
                        
                        if (a === 0) {
                            ctx.moveTo(px, py);
                        } else {
                            ctx.lineTo(px, py);
                        }
                    }
                    
                    // 放射狀漸層色 (純白色與半透明白發光，外側半徑自然淡出)
                    const maxSpread = 42 * scalePulse;
                    const grad = ctx.createRadialGradient(0, 0, (top.radius || 48) * scalePulse, 0, 0, ((top.radius || 48) * scalePulse) + maxSpread);
                    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
                    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.85)');
                    grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.35)');
                    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 3.5; // 細緻微縮的氣流線
                    ctx.lineCap = 'round';
                    
                    // 增加純白發光陰影
                    // Removed shadowColor for perf
                    // Removed shadowBlur for perf
                    ctx.stroke();
                }
                // Removed shadowBlur for perf // 重置陰影
                
                // 額外點綴內側高速白色雙軌光圈 (尺寸隨 scalePulse 連動縮放)
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                const innerCircleR = ((top.radius || 48) + 4) * scalePulse + Math.random() * 2;
                ctx.arc(0, 0, innerCircleR, windPhase, windPhase + Math.PI * 1.5, false);
                ctx.stroke();
                
                ctx.restore();
            }

            // 當轉速 5 以上時，且陀螺處於加速狀態，陀螺本體要纏繞電流特效
            const isHighSpinForElectricity = (top.spin / (top.maxSpin || MAX_SPIN) * 10) >= 5.0;
            if (top.state === 'standby' && top.isSpinning && isHighSpinForElectricity) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                const numArcs = 3 + Math.floor(Math.random() * 3); // 3-5 electric lines
                for (let a = 0; a < numArcs; a++) {
                    const r = top.radius * (0.6 + Math.random() * 0.5); // wrap across the body
                    const startAngle = Math.random() * Math.PI * 2;
                    const endAngle = startAngle + (0.5 + Math.random() * 1.0) * Math.PI;

                    const startX = Math.cos(startAngle) * r;
                    const startY = Math.sin(startAngle) * r;
                    const endX = Math.cos(endAngle) * r;
                    const endY = Math.sin(endAngle) * r;

                    const midAngle = (startAngle + endAngle) / 2;
                    const midR = r + (Math.random() - 0.5) * 15; // jagged offset
                    const midX = Math.cos(midAngle) * midR;
                    const midY = Math.sin(midAngle) * midR;

                    // Layer 1: Glow color of the player's top
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(midX, midY);
                    ctx.lineTo(endX, endY);
                    ctx.strokeStyle = top.color;
                    ctx.lineWidth = 5;
                    ctx.globalAlpha = 0.6;
                    ctx.stroke();

                    // Layer 2: White core of high energy
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(midX, midY);
                    ctx.lineTo(endX, endY);
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.9;
                    ctx.stroke();
                }

                // Random electric sparks
                if (Math.random() < 0.4) {
                    const sparkAngle = Math.random() * Math.PI * 2;
                    const sx = Math.cos(sparkAngle) * top.radius * 0.2;
                    const sy = Math.sin(sparkAngle) * top.radius * 0.2;
                    const ex = Math.cos(sparkAngle) * top.radius * 1.35;
                    const ey = Math.sin(sparkAngle) * top.radius * 1.35;

                    const mx = Math.cos(sparkAngle) * (top.radius * 0.8) + (Math.random() - 0.5) * 12;
                    const my = Math.sin(sparkAngle) * (top.radius * 0.8) + (Math.random() - 0.5) * 12;

                    ctx.beginPath();
                    ctx.moveTo(sx, sy);
                    ctx.lineTo(mx, my);
                    ctx.lineTo(ex, ey);
                    ctx.strokeStyle = '#38bdf8'; // electrical neon blue
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                }

                ctx.restore();
            }

            // Draw rainbow outline for Super State!
            if ((top.superTimer !== undefined && top.superTimer > 0) || top.launchPadState !== undefined) {
                ctx.save();
                ctx.lineWidth = 6;
                const time = Date.now() * 0.015; // Fast rainbow gradient cycle
                const grad = ctx.createLinearGradient(-top.radius, -top.radius, top.radius, top.radius);
                grad.addColorStop(0, `hsl(${time % 360}, 100%, 55%)`);
                grad.addColorStop(0.2, `hsl(${(time + 60) % 360}, 100%, 55%)`);
                grad.addColorStop(0.4, `hsl(${(time + 120) % 360}, 100%, 55%)`);
                grad.addColorStop(0.6, `hsl(${(time + 180) % 360}, 100%, 55%)`);
                grad.addColorStop(0.8, `hsl(${(time + 240) % 360}, 100%, 55%)`);
                grad.addColorStop(1, `hsl(${(time + 300) % 360}, 100%, 55%)`);
                
                ctx.strokeStyle = grad;
                // Removed shadowColor for perf
                // Removed shadowBlur for perf
                 ctx.beginPath();
                ctx.arc(0, 0, top.radius + 1, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // Draw breakout spiral orbit aura when breakoutOrbitTimer is active
            if (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                const ratio = top.breakoutOrbitTimer / 1.0; // 1.0 -> 0 value
                const alpha = Math.sin(ratio * Math.PI); // peak opacity at mid-lifecycle
                
                // Pulsating breakout shockwave circle
                ctx.beginPath();
                ctx.arc(0, 0, top.radius * 2.5 * (1.0 - ratio), 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(236, 72, 153, ' + (alpha * 0.85) + ')';
                ctx.lineWidth = 4 + 8 * ratio;
                ctx.stroke();

                // Draw a majestic swirling galaxy/swort spiral trail
                ctx.beginPath();
                const totalPoints = 120;
                const maxRad = top.radius * 3.5;
                for (let i = 0; i < totalPoints; i++) {
                    const pRatio = i / totalPoints;
                    const theta = pRatio * Math.PI * 4 + (Date.now() * 0.02); // 2 full revolutions spinning fast
                    const r = top.radius + (maxRad - top.radius) * pRatio * (1.0 - ratio);
                    const sx = Math.cos(theta) * r;
                    const sy = Math.sin(theta) * r;
                    if (i === 0) {
                        ctx.moveTo(sx, sy);
                    } else {
                        ctx.lineTo(sx, sy);
                    }
                }
                ctx.strokeStyle = 'rgba(244, 114, 182, ' + (alpha * 0.7) + ')';
                ctx.lineWidth = 3.0;
                ctx.stroke();

                // Add secondary reverse-spinning inner coil to represent double-helix breakout power
                ctx.beginPath();
                for (let i = 0; i < totalPoints; i++) {
                    const pRatio = i / totalPoints;
                    const theta = -pRatio * Math.PI * 4 - (Date.now() * 0.025);
                    const r = top.radius + (maxRad * 0.7 - top.radius) * pRatio * (1.0 - ratio);
                    const sx = Math.cos(theta) * r;
                    const sy = Math.sin(theta) * r;
                    if (i === 0) {
                        ctx.moveTo(sx, sy);
                    } else {
                        ctx.lineTo(sx, sy);
                    }
                }
                ctx.strokeStyle = 'rgba(255, 255, 255, ' + (alpha * 0.9) + ')';
                ctx.lineWidth = 2.0;
                ctx.stroke();

                ctx.restore();
            }

            ctx.restore();
            
            // Label
            if (!top.isExploding) {
                ctx.save();
                if (top.flashTimer !== undefined && top.flashTimer > 0) {
                    const blinkOn = Math.floor(Date.now() / 45) % 2 === 0;
                    ctx.globalAlpha *= (blinkOn ? 0.25 : 1.0);
                }
                ctx.font = 'bold 24px "Courier New"';
                ctx.textAlign = 'center';
                ctx.fillStyle = top.color;
                
                let labelX = top.x;
                let labelY = top.y - top.radius - 30;
                
                if (top.label === 'P3' || top.label === 'P4') {
                    labelY = top.y + top.radius + 30;
                }

                if (engine.zombieSiegeActive && engine.siegeStatus === 'clinging' && top.id === engine.siegeTargetPlayerId) {
                    labelX += (Math.random() - 0.5) * 16;
                    labelY += (Math.random() - 0.5) * 16;
                }
                
                ctx.translate(labelX, labelY);
                if (top.label === 'P3' || top.label === 'P4') {
                    ctx.rotate(Math.PI);
                }
                
                ctx.fillText(top.label + (top.isAI ? " [電腦]" : ""), 0, 0);

                ctx.restore();
            }
        });

        // Draw Phantom Clones (分身幻影) with fade-in and fade-out transition
        engine.phantomClones.forEach(pc => {
            let cloneAlpha = 1.0;
            if (pc.life > pc.maxLife - 0.6) {
                cloneAlpha = Math.max(0, Math.min(1.0, (pc.maxLife - pc.life) / 0.6));
            } else if (pc.life < 0.6) {
                cloneAlpha = Math.max(0, Math.min(1.0, pc.life / 0.6));
            }

            ctx.save();
            ctx.globalAlpha = cloneAlpha;
            ctx.translate(pc.x, pc.y);

            // Ground shadow under the phantom clone
            ctx.save();
            const ox = 8;
            const oy = 15;
            const shadowRadius = Math.max(pc.radius * 1.5, 30);
            const grad = ctx.createRadialGradient(ox, oy, shadowRadius * 0.1, ox, oy, shadowRadius);
            grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
            grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(ox, oy, shadowRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            const time = Date.now();

            // 1. Vortex (Powerful cyclone standby visual effect)
            const pulseScale = 0.98 + 0.12 * Math.sin(time / 80);
            const pulseAlpha = 0.7 + 0.3 * Math.sin(time / 120);

            ctx.save();
            ctx.globalAlpha *= Math.max(0, pulseAlpha);
            ctx.scale(pulseScale, pulseScale);

            const windPhase = -(time / 25) % (Math.PI * 2);
            const numStrands = 4;
            for (let i = 0; i < numStrands; i++) {
                const offset = (Math.PI * 2 / numStrands) * i;
                ctx.beginPath();

                for (let a = 0; a < Math.PI * 1.5; a += 0.1) {
                    const windRadius = pc.radius + 2 + Math.pow(a, 1.4) * 7;
                    const angle = windPhase + offset + a;

                    const px = Math.cos(angle) * windRadius;
                    const py = Math.sin(angle) * windRadius;

                    if (a === 0) {
                        ctx.moveTo(px, py);
                    } else {
                        ctx.lineTo(px, py);
                    }
                }

                const maxSpread = 80;
                const gradv = ctx.createRadialGradient(0, 0, pc.radius, 0, 0, pc.radius + maxSpread);
                gradv.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
                gradv.addColorStop(0.3, 'rgba(56, 189, 248, 0.8)');
                gradv.addColorStop(0.6, 'rgba(56, 189, 248, 0.3)');
                gradv.addColorStop(1, 'rgba(255, 255, 255, 0)');

                ctx.strokeStyle = gradv;
                ctx.lineWidth = 4.5;
                ctx.lineCap = 'round';

                ctx.stroke();
            }
            ctx.restore();

            // 2. Dash / Spin Aura
            ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.beginPath();
            ctx.arc(0, 0, pc.radius + 10 + Math.random() * 10, 0, Math.PI * 2);
            ctx.fill();

            // 3. Draw Body
            ctx.save();
            
            // Faint colored backdrop under the sprite
            ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
            ctx.beginPath();
            ctx.arc(0, 0, pc.radius * 0.9, 0, Math.PI * 2);
            ctx.fill();

            // Switch to screen/lighter blending for that premium emitting light feel
            ctx.globalCompositeOperation = 'screen';
            
            const sprMap = ['top_0', 'top_1', 'top_2', 'top_3'];
            const spr = sprites[sprMap[pc.originalIdx] || 'top_0'];
            
            if (spr) {
                // Prepare the offscreen digital cyber overlay canvas
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = spr.width;
                tempCanvas.height = spr.height;
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                    tempCtx.drawImage(spr, 0, 0);
                    tempCtx.globalCompositeOperation = 'source-in';
                    // Cyber cyan/pale-blue fill
                    tempCtx.fillStyle = 'rgba(56, 189, 248, 0.85)';
                    tempCtx.fillRect(0, 0, spr.width, spr.height);
                    
                    // Horizontal digital lines (CRT style screen scanlines)
                    tempCtx.globalCompositeOperation = 'source-atop';
                    tempCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                    tempCtx.lineWidth = 1.5;
                    for (let y = 0; y < spr.height; y += 4) {
                        tempCtx.beginPath();
                        tempCtx.moveTo(0, y);
                        tempCtx.lineTo(spr.width, y);
                        tempCtx.stroke();
                    }
                    
                    // Vertical matrix grid lines
                    tempCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                    tempCtx.lineWidth = 1.0;
                    for (let x = 0; x < spr.width; x += 8) {
                        tempCtx.beginPath();
                        tempCtx.moveTo(x, 0);
                        tempCtx.lineTo(x, spr.height);
                        tempCtx.stroke();
                    }

                    // A dynamic shining scanner sweep
                    const scanY = (Date.now() / 15) % (spr.height + 40) - 20;
                    const scanGrad = tempCtx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
                    scanGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
                    scanGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
                    scanGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
                    tempCtx.fillStyle = scanGrad;
                    tempCtx.fillRect(0, scanY - 10, spr.width, 20);
                }

                // outer halo layer - slightly rotated and scaled up
                ctx.save();
                const drawingScaleFactor = GameUtils.getTopScale(engine, { id: pc.ownerId } as any) || 1.0;
                ctx.scale(drawingScaleFactor, drawingScaleFactor);
                ctx.rotate(pc.angle - 0.12);
                ctx.globalAlpha = cloneAlpha * 0.3;
                ctx.drawImage(tempCanvas, -(spr.width * 1.1) / 2, -(spr.height * 1.1) / 2, spr.width * 1.1, spr.height * 1.1);
                ctx.restore();

                // primary translucent layer - translucent as requested (0.65 opacity for cyber glow)
                ctx.save();
                ctx.scale(drawingScaleFactor, drawingScaleFactor);
                ctx.rotate(pc.angle);
                ctx.globalAlpha = cloneAlpha * 0.65;
                ctx.drawImage(tempCanvas, -spr.width / 2, -spr.height / 2);
                ctx.restore();

                // energetic inner core - slightly smaller and rotated
                ctx.save();
                ctx.scale(drawingScaleFactor, drawingScaleFactor);
                ctx.rotate(pc.angle + 0.18);
                ctx.globalAlpha = cloneAlpha * 0.35;
                ctx.drawImage(tempCanvas, -(spr.width * 0.9) / 2, -(spr.height * 0.9) / 2, spr.width * 0.9, spr.height * 0.9);
                ctx.restore();
            }

            ctx.restore(); // restores blend mode and shadow blur

            // 4. Subtle cyber-blue ring indicating digital cyber clone magic
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, pc.radius + 2, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();

            // Phantom Label
            ctx.save();
            ctx.globalAlpha = cloneAlpha;
            ctx.font = 'bold 20px "Courier New"';
            ctx.textAlign = 'center';
            ctx.fillStyle = pc.color;
            ctx.fillText("分身幻影", pc.x, pc.y - pc.radius - 30);
            ctx.restore();
        });


}
