import type { GameEngine } from '../GameEngine';
import { drawCapsulePath } from './Utils';
import { CANVAS_W, CANVAS_H, MAX_SPIN } from '../constants';

export function drawEffects(ctx: CanvasRenderingContext2D, engine: GameEngine, sprites: Record<string, HTMLCanvasElement>) {
        // Draw Particles
        engine.particles.forEach(p => {
            const alphaHex = Math.max(0, Math.min(255, Math.floor((p.life / p.maxLife) * 255))).toString(16).padStart(2, '0');
            if ((p as any).isElectric) {
                ctx.save();
                ctx.strokeStyle = p.color;
                ctx.lineWidth = Math.max(1, p.size / 4);
                ctx.globalAlpha = p.life / p.maxLife;
                // Removed shadowColor for perf
                // Removed shadowBlur for perf
                
                // Draw a small electric arc based on its velocity
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                const angle = Math.atan2(p.vy ?? 1, p.vx ?? 1);
                const len = p.size * 2.2;
                const midX = p.x + Math.cos(angle) * (len * 0.5) + (Math.random() - 0.5) * 6;
                const midY = p.y + Math.sin(angle) * (len * 0.5) + (Math.random() - 0.5) * 6;
                const endX = p.x + Math.cos(angle) * len;
                const endY = p.y + Math.sin(angle) * len;
                ctx.lineTo(midX, midY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                ctx.restore();
            } else if ((p as any).isClawScratch) {
                ctx.save();
                const lifePct = p.life / p.maxLife; // goes from 1 down to 0
                ctx.globalAlpha = lifePct;
                
                // Add a vivid neon crimson shadow glow to highlight the claw tracks
                // Removed shadowColor for perf
                // Removed shadowBlur for perf
                
                const angle = (p as any).clawAngle ?? -Math.PI / 4;
                const len = p.size; // maximum length
                const spacing = 11;  // broader spacing between lines so they are clearly separate and distinct
                
                // Direction of the slash: (cos(angle), sin(angle))
                const dx = Math.cos(angle);
                const dy = Math.sin(angle);
                
                // Perpendicular direction to offset the three parallel lines
                const px = -Math.sin(angle);
                const py = Math.cos(angle);
                
                // Smoothly expand and contract length (wave effect)
                const currentLen = len * Math.sin(lifePct * Math.PI);
                
                // Draw 3 parallel lines: indices -1, 0, 1
                for (let i = -1; i <= 1; i++) {
                    const lineCenterX = p.x + px * i * spacing;
                    const lineCenterY = p.y + py * i * spacing;
                    
                    const xStart = lineCenterX - dx * (currentLen / 2);
                    const yStart = lineCenterY - dy * (currentLen / 2);
                    const xEnd = lineCenterX + dx * (currentLen / 2);
                    const yEnd = lineCenterY + dy * (currentLen / 2);
                    
                    // Outer neon crimson stroke glow
                    ctx.beginPath();
                    ctx.moveTo(xStart, yStart);
                    ctx.lineTo(xEnd, yEnd);
                    ctx.strokeStyle = '#dc2626';
                    ctx.lineWidth = 5.0; // wider neon outline
                    ctx.lineCap = 'round';
                    ctx.stroke();
                    
                    // Inner lighter soft-pink/white glow core
                    ctx.beginPath();
                    ctx.moveTo(xStart, yStart);
                    ctx.lineTo(xEnd, yEnd);
                    ctx.strokeStyle = '#ffffff'; // beautiful white-hot claw slice core
                    ctx.lineWidth = 1.8; // thicker stark core
                    ctx.lineCap = 'round';
                    ctx.stroke();
                }
                ctx.restore();
            } else if ((p as any).isChainsawSpark) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter'; // Brilliant high-brightness additive glow
                
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.size * (p.life / p.maxLife); // Shrinks dynamically as it burns out
                ctx.globalAlpha = Math.min(1.0, (p.life / p.maxLife) * 1.5);
                ctx.lineCap = 'round';
                
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                const lengthFactor = 0.045; // Longer, sleeker motion blur lines for chainsaw grind effect
                ctx.lineTo(p.x - p.vx * lengthFactor, p.y - p.vy * lengthFactor);
                ctx.stroke();
                
                // Overlay a white-hot core to create highly realistic glowing metal highlights (HDR aesthetic)
                if (p.color !== '#ffffff') {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x - p.vx * lengthFactor * 0.7, p.y - p.vy * lengthFactor * 0.7);
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = Math.max(0.8, p.size * 0.45 * (p.life / p.maxLife));
                    ctx.stroke();
                }
                ctx.restore();
            } else if (p.isBossStarExplosion) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const lifePct = p.life / p.maxLife;
                ctx.globalAlpha = Math.min(1.0, lifePct * 2.0);

                const currentScale = Math.sin(lifePct * Math.PI);
                const currentSize = p.size * currentScale;

                const drawIrregular12PointStar = (cx: number, cy: number, maxRadius: number, innerRadiusFactor: number, startAngle: number) => {
                    let rot = startAngle;
                    let spikes = 12;
                    let step = Math.PI / spikes;
                    ctx.beginPath();
                    
                    // A dynamic, highly stylized spiky burst with 12 distinct points of irregular lengths
                    const irregularScales = [1.0, 0.65, 0.85, 0.55, 0.95, 0.7, 1.0, 0.6, 0.9, 0.5, 0.8, 0.65];
                    
                    const r0 = maxRadius * irregularScales[0];
                    ctx.moveTo(cx + Math.cos(rot) * r0, cy + Math.sin(rot) * r0);
                    
                    for (let i = 0; i < spikes; i++) {
                        rot += step;
                        const innerR = maxRadius * innerRadiusFactor; 
                        ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
                        
                        rot += step;
                        const nextSpikeIndex = (i + 1) % spikes;
                        const rNext = maxRadius * irregularScales[nextSpikeIndex];
                        ctx.lineTo(cx + Math.cos(rot) * rNext, cy + Math.sin(rot) * rNext);
                    }
                    ctx.closePath();
                };

                const startAngle = p.angle || 0;

                // 1. Draw outer orange star (12 Points, Irregular)
                ctx.fillStyle = '#f97316'; // Vivid orange
                drawIrregular12PointStar(p.x, p.y, currentSize, 0.22, startAngle);
                ctx.fill();

                // 2. Draw middle golden star (12 Points, Irregular)
                ctx.fillStyle = '#facc15'; // Brilliant yellow
                drawIrregular12PointStar(p.x, p.y, currentSize * 0.65, 0.22, startAngle);
                ctx.fill();

                // 3. Draw inner white star (12 Points, Irregular)
                ctx.fillStyle = '#ffffff'; // White-hot core
                drawIrregular12PointStar(p.x, p.y, currentSize * 0.35, 0.22, startAngle);
                ctx.fill();

                ctx.restore();
            } else if (p.isStarSpark) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const lifePct = p.life / p.maxLife;
                ctx.globalAlpha = Math.min(1.0, lifePct * 1.5);
                ctx.fillStyle = p.color;

                const drawStarInCtx = (cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number, startAngle: number) => {
                    let rot = startAngle;
                    let step = Math.PI / spikes;
                    ctx.beginPath();
                    ctx.moveTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
                    for (let i = 0; i < spikes; i++) {
                        rot += step;
                        ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
                        rot += step;
                        ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
                    }
                    ctx.closePath();
                };

                const currentSize = p.size * lifePct;
                drawStarInCtx(p.x, p.y, 4, currentSize, currentSize * 0.25, p.angle || 0);
                ctx.fill();

                ctx.restore();
            } else if (p.isSpark) {
                ctx.save();
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.size;
                ctx.globalAlpha = p.life / p.maxLife;
                // Removed shadowColor for perf
                // Removed shadowBlur for perf
                ctx.lineCap = 'round';
                
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                // Draw a beautiful motion blur trail along the spark's velocity vector
                const lengthFactor = 0.035;
                ctx.lineTo(p.x - p.vx * lengthFactor, p.y - p.vy * lengthFactor);
                ctx.stroke();
                ctx.restore();
            } else {
                ctx.fillStyle = p.color + alphaHex; // Fading alpha
                ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
            }
        });

        // Draw Shockwaves (Red and orange ring expanding waves)
        engine.shockwaves.forEach(sw => {
            ctx.save();
            ctx.lineWidth = sw.thickness * (sw.life / sw.maxLife);
            ctx.globalAlpha = sw.life / sw.maxLife;

            if (sw.isRainbow) {
                // Draw a solid white backing stroke first to make the rainbow colors extremely vivid
                ctx.save();
                ctx.strokeStyle = `rgba(255, 255, 255, ${sw.life / sw.maxLife * 0.95})`;
                ctx.beginPath();
                ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();

                const clock = Date.now() * 0.015;
                const grad = ctx.createRadialGradient(sw.x, sw.y, Math.max(0, sw.radius - 20), sw.x, sw.y, sw.radius + 15);
                grad.addColorStop(0, `hsla(${clock % 360}, 100%, 75%, ${sw.life / sw.maxLife})`);
                grad.addColorStop(0.5, `hsla(${(clock + 120) % 360}, 100%, 65%, ${sw.life / sw.maxLife})`);
                grad.addColorStop(1, `hsla(${(clock + 240) % 360}, 100%, 55%, ${sw.life / sw.maxLife})`);
                ctx.strokeStyle = grad;
                // Removed shadowColor for perf
            } else if (sw.isDashedRed) {
                ctx.strokeStyle = '#ef4444';
                ctx.setLineDash([16, 12]);
                ctx.lineDashOffset = -(Date.now() * 0.08) % 28;
                // Removed shadowColor for perf
            } else {
                ctx.strokeStyle = sw.color;
                // Removed shadowColor for perf
            }
            
            // Neon glow matching the glowing colors
            // Removed shadowBlur for perf
            
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });

        // Draw Slash Lines (Many sword slash cutting effects with sharpened ends)
        ctx.save();
        engine.slashLines.forEach(line => {
            const dx = line.x2 - line.x1;
            const dy = line.y2 - line.y1;
            const len = Math.hypot(dx, dy);
            if (len <= 0) return;

            ctx.save();
            const alpha = line.life / line.maxLife;
            ctx.globalAlpha = alpha;
            // Removed shadowColor for perf
            // Removed shadowBlur for perf
            
            const mx = (line.x1 + line.x2) / 2;
            const my = (line.y1 + line.y2) / 2;
            const nx = -dy / len;
            const ny = dx / len;
            const halfW = line.width / 2;

            // Outer glowing blade path
            ctx.fillStyle = line.color;
            ctx.beginPath();
            ctx.moveTo(line.x1, line.y1);
            ctx.quadraticCurveTo(mx + nx * halfW, my + ny * halfW, line.x2, line.y2);
            ctx.quadraticCurveTo(mx - nx * halfW, my - ny * halfW, line.x1, line.y1);
            ctx.closePath();
            ctx.fill();

            // Inner core white slash cut (tapered as well of high-energy blade)
            ctx.fillStyle = '#ffffff';
            // Removed shadowBlur for perf
            const innerW = Math.max(1.5, halfW / 3);
            ctx.beginPath();
            ctx.moveTo(line.x1, line.y1);
            ctx.quadraticCurveTo(mx + nx * innerW, my + ny * innerW, line.x2, line.y2);
            ctx.quadraticCurveTo(mx - nx * innerW, my - ny * innerW, line.x1, line.y1);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        });
        ctx.restore();

        // Draw expanding X-slashes (閃亮且擴散的 X 型刀光特效)
        engine.xSlashes.forEach(slash => {
            ctx.save();
            const alpha = slash.life / slash.maxLife;
            ctx.globalAlpha = alpha;
            // Removed shadowColor for perf
            // Removed shadowBlur for perf
            ctx.fillStyle = slash.color;
            
            // Outer glowing blade path for each branch of the X
            for (const ang of [slash.angle + Math.PI / 4, slash.angle - Math.PI / 4]) {
                const dx = Math.cos(ang);
                const dy = Math.sin(ang);
                const halfSize = slash.size / 2;
                
                const taperW = slash.thickness * alpha;
                const nx = -dy;
                const ny = dx;
                
                ctx.beginPath();
                ctx.moveTo(slash.x - dx * halfSize, slash.y - dy * halfSize);
                ctx.quadraticCurveTo(slash.x + nx * taperW, slash.y + ny * taperW, slash.x + dx * halfSize, slash.y + dy * halfSize);
                ctx.quadraticCurveTo(slash.x - nx * taperW, slash.y - ny * taperW, slash.x - dx * halfSize, slash.y - dy * halfSize);
                ctx.closePath();
                ctx.fill();
            }
            
            // Inner core white slash cut for extra key energy shine
            // Removed shadowBlur for perf
            ctx.fillStyle = '#ffffff';
            for (const ang of [slash.angle + Math.PI / 4, slash.angle - Math.PI / 4]) {
                const dx = Math.cos(ang);
                const dy = Math.sin(ang);
                const halfSize = slash.size / 2;
                const taperW = Math.max(2, slash.thickness * alpha * 0.3);
                const nx = -dy;
                const ny = dx;
                
                ctx.beginPath();
                ctx.moveTo(slash.x - dx * halfSize, slash.y - dy * halfSize);
                ctx.quadraticCurveTo(slash.x + nx * taperW, slash.y + ny * taperW, slash.x + dx * halfSize, slash.y + dy * halfSize);
                ctx.quadraticCurveTo(slash.x - nx * taperW, slash.y - ny * taperW, slash.x - dx * halfSize, slash.y - dy * halfSize);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        });

        // Draw Projectiles (neon glowing energy bullets)
        engine.projectiles.forEach(proj => {
            if (proj.isBombBeam) {
                ctx.save();
                ctx.translate(proj.x, proj.y);
                const angle = Math.atan2(proj.vy, proj.vx);
                ctx.rotate(angle);
                
                // Draw a solid white background backing block underneath the outer laser beam to make the rainbow outer colors pop
                ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.fillRect(0, -64, 2000, 128);

                // Beautiful vertical gradient for rainbow outer beam (matching 128px width)
                // Symmetrical rainbow diffusing from axis center (0.5) to outer edges (0.0 and 1.0)
                const gradOuter = ctx.createLinearGradient(0, -64, 0, 64);
                const alphaOuter = 0.35;
                gradOuter.addColorStop(0, `rgba(255, 0, 0, ${alphaOuter})`);          // Outer (Red)
                gradOuter.addColorStop(0.08, `rgba(255, 127, 0, ${alphaOuter})`);     // Orange
                gradOuter.addColorStop(0.17, `rgba(255, 255, 0, ${alphaOuter})`);     // Yellow
                gradOuter.addColorStop(0.25, `rgba(0, 255, 0, ${alphaOuter})`);       // Green
                gradOuter.addColorStop(0.33, `rgba(0, 0, 255, ${alphaOuter})`);       // Blue
                gradOuter.addColorStop(0.42, `rgba(75, 0, 130, ${alphaOuter})`);      // Indigo
                gradOuter.addColorStop(0.5, `rgba(148, 0, 211, ${alphaOuter})`);      // Center (Violet)
                gradOuter.addColorStop(0.58, `rgba(75, 0, 130, ${alphaOuter})`);      // Indigo
                gradOuter.addColorStop(0.67, `rgba(0, 0, 255, ${alphaOuter})`);       // Blue
                gradOuter.addColorStop(0.75, `rgba(0, 255, 0, ${alphaOuter})`);       // Green
                gradOuter.addColorStop(0.83, `rgba(255, 255, 0, ${alphaOuter})`);     // Yellow
                gradOuter.addColorStop(0.92, `rgba(255, 127, 0, ${alphaOuter})`);     // Orange
                gradOuter.addColorStop(1, `rgba(255, 0, 0, ${alphaOuter})`);          // Outer (Red)
                
                ctx.fillStyle = gradOuter;
                ctx.fillRect(0, -64, 2000, 128);
                
                // Draw a bright solid white backing block underneath the inner rainbow laser beam to make it extremely vivid
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(0, -30, 2000, 60);

                // Beautiful vertical gradient for bright neon inner beam
                // Symmetrical rainbow diffusing from axis center (0.5) to outer edges (0.0 and 1.0)
                const gradInner = ctx.createLinearGradient(0, -30, 0, 30);
                const alphaInner = 0.8;
                gradInner.addColorStop(0, `rgba(255, 0, 0, ${alphaInner})`);          // Outer (Red)
                gradInner.addColorStop(0.08, `rgba(255, 127, 0, ${alphaInner})`);     // Orange
                gradInner.addColorStop(0.17, `rgba(255, 255, 0, ${alphaInner})`);     // Yellow
                gradInner.addColorStop(0.25, `rgba(0, 255, 0, ${alphaInner})`);       // Green
                gradInner.addColorStop(0.33, `rgba(0, 0, 255, ${alphaInner})`);       // Blue
                gradInner.addColorStop(0.42, `rgba(75, 0, 130, ${alphaInner})`);      // Indigo
                gradInner.addColorStop(0.5, `rgba(148, 0, 211, ${alphaInner})`);      // Center (Violet)
                gradInner.addColorStop(0.58, `rgba(75, 0, 130, ${alphaInner})`);      // Indigo
                gradInner.addColorStop(0.67, `rgba(0, 0, 255, ${alphaInner})`);       // Blue
                gradInner.addColorStop(0.75, `rgba(0, 255, 0, ${alphaInner})`);       // Green
                gradInner.addColorStop(0.83, `rgba(255, 255, 0, ${alphaInner})`);     // Yellow
                gradInner.addColorStop(0.92, `rgba(255, 127, 0, ${alphaInner})`);     // Orange
                gradInner.addColorStop(1, `rgba(255, 0, 0, ${alphaInner})`);          // Outer (Red)
                
                ctx.fillStyle = gradInner;
                ctx.fillRect(0, -30, 2000, 60);
                
                // White-hot core
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, -8, 2000, 16);
                
                ctx.restore();
                return;
            }

            // 1. Draw historical trail coordinates first (underneath/behind the bullet main body)
            if (proj.trail && proj.trail.length > 1) {
                ctx.save();
                
                // Add soft neon bloom to the trail links
                // Removed shadowColor for perf
                // Removed shadowBlur for perf
                
                for (let i = 0; i < proj.trail.length - 1; i++) {
                    const p1 = proj.trail[i];
                    const p2 = proj.trail[i + 1];
                    
                    const ratio = i / (proj.trail.length - 1); // 0.0 (oldest) to 1.0 (newest)
                    const opacity = ratio * 0.7; // older points fade out
                    const thickness = ratio * proj.radius * 0.85; // older points taper down
                    
                    ctx.strokeStyle = proj.color;
                    ctx.lineWidth = Math.max(2, thickness);
                    ctx.lineCap = 'round';
                    ctx.globalAlpha = opacity;
                    
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
                ctx.restore();
            }

            // 2. Draw bullet main body (and its close motion comet stretch)
            ctx.save();
            ctx.translate(proj.x, proj.y);

            // Calculate movement direction angle for motion tail effect
            const angle = Math.atan2(proj.vy, proj.vx);
            ctx.rotate(angle);

            const length = 48; // comet length proportion scaled up since bullet is larger
            const width = proj.radius;

            // Gradient from bullet color to white core
            const gradient = ctx.createLinearGradient(-length, 0, 0, 0);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
            gradient.addColorStop(0.3, proj.color);
            gradient.addColorStop(0.8, proj.color);
            gradient.addColorStop(1, '#ffffff');

            ctx.fillStyle = gradient;

            // Drawing high-energy comet-shaped projectile with a pointed main tip
            ctx.beginPath();
            ctx.moveTo(0, 0); // front tip
            ctx.lineTo(-length, -width / 2); // trailing top-left
            ctx.quadraticCurveTo(-length / 2, 0, -length, width / 2); // tail curve back
            ctx.closePath();
            ctx.fill();

            // Core neon glow blur
            // Removed shadowColor for perf
            // Removed shadowBlur for perf
            
            // Draw secondary outer glowing boundary aura
            ctx.strokeStyle = proj.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, width / 2.5, 0, Math.PI * 2);
            ctx.stroke();

            // Core white hot fusion center
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, width / 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });

        // Draw Afterimages (dash trails)
        ctx.save();
        engine.afterimages.forEach(img => {
            ctx.save();
            ctx.globalAlpha = (img.life / img.maxLife) * 0.45; // trail opacity multiplier
            ctx.translate(img.x, img.y);
            ctx.rotate(img.angle);
            const scaleFactor = img.scale ?? 1.0;
            if (scaleFactor !== 1.0) {
                ctx.scale(scaleFactor, scaleFactor);
            }
            const sprMap = ['top_0', 'top_1', 'top_2', 'top_3'];
            const spr = sprites[sprMap[img.spriteIdx] || 'top_0'];
            if (spr) {
                // Drawing afterimage with additive screen blending for cool neon energy effects!
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
            }
            ctx.restore();
        });
        ctx.restore();


}
