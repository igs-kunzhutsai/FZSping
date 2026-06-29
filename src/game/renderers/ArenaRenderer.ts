import * as CollisionSystem from '../systems/CollisionSystem';
import type { GameEngine } from '../GameEngine';
import { drawCapsulePath } from './Utils';
import { CANVAS_W, CANVAS_H, MAX_SPIN } from '../constants';
import groundImageSrc from '../../PIC/ChatGPT Image 2026年6月21日 下午01_13_45.png';
import stage2GroundImageSrc from '../../PIC/Gemini_Generated_Image_hkbptohkbptohkbp.png';

const groundImage = new Image();
groundImage.src = groundImageSrc;
const stage2GroundImage = new Image();
stage2GroundImage.src = stage2GroundImageSrc;

interface DecorativeStone {
    x: number;
    y: number;
    points: {x: number, y: number}[];
    baseColor: string;
    highlightColor: string;
    shadowColor: string;
    scale: number;
    rotation: number;
}

const decorativeStones: DecorativeStone[] = [];

function initDecorativeStones() {
    if (decorativeStones.length > 0) return;
    
    const radius = 480;
    const centers = [540, 1620];
    const leftCenterX = 540;
    const rightCenterX = 1380;
    
    // Perimeter sections
    const topEdgeLen = rightCenterX - leftCenterX;
    const rightArcLen = Math.PI * radius;
    const bottomEdgeLen = rightCenterX - leftCenterX;
    const leftArcLen = Math.PI * radius;
    const totalCircumference = topEdgeLen + rightArcLen + bottomEdgeLen + leftArcLen;
    // One stone every ~65 pixels for a dense rocky ring
    const numStones = Math.floor(totalCircumference / 65);
    
    centers.forEach(centerY => {
        for (let i = 0; i < numStones; i++) {
            // Vary the spacing slightly
            const d = ((i + (Math.random() * 0.4 - 0.2)) / numStones) * totalCircumference;
            let x = 0, y = 0;
            
            if (d < topEdgeLen) {
                x = leftCenterX + d;
                y = centerY - radius;
            } else if (d < topEdgeLen + rightArcLen) {
                const arcD = d - topEdgeLen;
                const theta = -Math.PI / 2 + (arcD / rightArcLen) * Math.PI;
                x = rightCenterX + Math.cos(theta) * radius;
                y = centerY + Math.sin(theta) * radius;
            } else if (d < topEdgeLen + rightArcLen + bottomEdgeLen) {
                const edgeD = d - (topEdgeLen + rightArcLen);
                x = rightCenterX - edgeD;
                y = centerY + radius;
            } else {
                const arcD = d - (topEdgeLen + rightArcLen + bottomEdgeLen);
                const theta = Math.PI / 2 + (arcD / leftArcLen) * Math.PI;
                x = leftCenterX + Math.cos(theta) * radius;
                y = centerY + Math.sin(theta) * radius;
            }
            
            // Add jitter to make it imperfectly aligned along the line
            // We push them slightly outward from the border so they cradle the play area
            const distFromCenterSegment = Math.random() * 15 + 10;
            
            // calculate normal vector at this point
            let nx = 0, ny = 0;
            if (d < topEdgeLen) { nx = 0; ny = -1; }
            else if (d < topEdgeLen + rightArcLen) {
                const theta = -Math.PI / 2 + ((d - topEdgeLen) / rightArcLen) * Math.PI;
                nx = Math.cos(theta); ny = Math.sin(theta);
            } else if (d < topEdgeLen + rightArcLen + bottomEdgeLen) { nx = 0; ny = 1; }
            else {
                const theta = Math.PI / 2 + ((d - (topEdgeLen + rightArcLen + bottomEdgeLen)) / leftArcLen) * Math.PI;
                nx = Math.cos(theta); ny = Math.sin(theta);
            }
            
            x += nx * distFromCenterSegment;
            y += ny * distFromCenterSegment;
            
            // Generate irregular points for the stone
            const points = [];
            const numPoints = 6 + Math.floor(Math.random() * 4); // 6 to 9 vertices
            for (let j = 0; j < numPoints; j++) {
                const pTheta = (j / numPoints) * Math.PI * 2;
                // Radius of stone varies, 18 to 35 base
                const pRad = 18 + Math.random() * 17; 
                // Add irregularity to shape
                const jitterR = pRad * (0.8 + Math.random() * 0.4);
                points.push({
                    x: Math.cos(pTheta) * jitterR,
                    y: Math.sin(pTheta) * jitterR
                });
            }
            
            // Color variation (slate / cool gray)
            const hue = 210 + (Math.random() - 0.5) * 15;
            const sat = 10 + Math.random() * 15; // 10% to 25% saturation
            const lig = 25 + Math.random() * 20; // 25% to 45% lightness
            
            const isBigStone = Math.random() < 0.25; // 25% chance of being twice as large
            const scale = (0.5 + Math.random() * 1.0) * (isBigStone ? 2.0 : 1.0);
            
            decorativeStones.push({
                x, y, points,
                baseColor: `hsl(${hue}, ${sat}%, ${lig}%)`,
                highlightColor: `hsl(${hue}, ${sat}%, ${lig + 15}%)`,
                shadowColor: `hsl(${hue}, ${sat}%, ${lig - 15}%)`,
                scale,
                rotation: Math.random() * Math.PI * 2
            });
        }
    });
}
initDecorativeStones();

export function drawArena(ctx: CanvasRenderingContext2D, engine: GameEngine) {
        ctx.save();
        if (engine.screenShakeTimer > 0) {
            const intensity = engine.screenShakeIntensity > 0 ? engine.screenShakeIntensity : 12;
            const currentIntensity = intensity * (engine.screenShakeTimer / (engine.screenShakeMaxDuration || 0.9));
            const dx = (Math.random() - 0.5) * currentIntensity;
            const dy = (Math.random() - 0.5) * currentIntensity;
            (engine as any).lastShakeX = dx;
            (engine as any).lastShakeY = dy;
            ctx.translate(dx, dy);
        } else {
            (engine as any).lastShakeX = 0;
            (engine as any).lastShakeY = 0;
        }
        
        // Apply camera zoom/pan matrix transformation centered around viewport center
        ctx.save();
        ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
        ctx.scale(engine.camera.zoom, engine.camera.zoom);
        ctx.translate(-engine.camera.x, -engine.camera.y);
        
        // Draw the ground image to cover the entire background viewport
        const currentActiveBg = engine.transitionBgChanged ? stage2GroundImage : groundImage;
        const isBgReady = currentActiveBg.complete && currentActiveBg.naturalWidth > 0;
        
        if (isBgReady) {
            if (!engine.transitionBgChanged) {
                // Focus on the upper half region of the ground (first stage) image
                const sW = currentActiveBg.naturalWidth;
                const sH = currentActiveBg.naturalHeight / 2;
                ctx.drawImage(currentActiveBg, 0, 0, sW, sH, 0, 0, CANVAS_W, CANVAS_H);
                // Also draw the lower half of the ChatGPT image at the lower coordinates (y: 1080 to 2160)
                ctx.drawImage(currentActiveBg, 0, sH, sW, sH, 0, CANVAS_H, CANVAS_W, CANVAS_H);
            } else {
                ctx.drawImage(currentActiveBg, 0, 1080, CANVAS_W, CANVAS_H);
            }
        } else {
            // Fallback: If stage2GroundImage is not ready, draw the lower half of groundImage (ChatGPT image)
            // which is 100% already loaded from stage 1 gameplay.
            if (groundImage.complete && groundImage.naturalWidth > 0) {
                const sW = groundImage.naturalWidth;
                const sH = groundImage.naturalHeight / 2;
                ctx.drawImage(groundImage, 0, sH, sW, sH, 0, 1080, CANVAS_W, CANVAS_H);
            }
        }
        
        // Darken the ground image slightly for better contrast if needed
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        if (!engine.transitionBgChanged) {
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H * 2);
        } else {
            ctx.fillRect(0, 1080, CANVAS_W, CANVAS_H);
        }

        ctx.save();

        // Draw a glowing blue border to maintain the visual boundary of the arena
        // ctx.strokeStyle = '#3b82f6';
        // ctx.lineWidth = 8;
        // ctx.beginPath();
        // drawCapsulePath(ctx, 480);
        // ctx.stroke();

        // ctx.strokeStyle = '#60a5fa';
        // ctx.lineWidth = 2;
        // ctx.beginPath();
        // drawCapsulePath(ctx, 480);
        // ctx.stroke();

        // 3.5 Draw decorative stones surrounding the capsule border
        decorativeStones.forEach(stone => {

            ctx.save();
            ctx.translate(stone.x, stone.y);
            ctx.rotate(stone.rotation);
            ctx.scale(stone.scale, stone.scale);

            // Draw shadow beneath stone
            ctx.beginPath();
            stone.points.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x + 8, p.y + 8);
                else ctx.lineTo(p.x + 8, p.y + 8);
            });
            ctx.closePath();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fill();

            // Draw base shape
            ctx.beginPath();
            stone.points.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.closePath();
            ctx.fillStyle = stone.baseColor;
            ctx.fill();

            // Draw thick border for rock texture
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = stone.shadowColor;
            ctx.stroke();

            // Draw some inner texture highlights to make it look like a 3D rock
            ctx.beginPath();
            stone.points[0] && ctx.moveTo(stone.points[0].x * 0.7, stone.points[0].y * 0.7);
            stone.points[1] && ctx.lineTo(stone.points[1].x * 0.7, stone.points[1].y * 0.7);
            ctx.lineWidth = 2;
            ctx.strokeStyle = stone.highlightColor;
            ctx.stroke();

            ctx.restore();
        });

        // 4. Inner Bezel Deep Shadow (Simulates towering walls blocking light and casting a smooth drop shadow inside)
        // (Removed to avoid unwanted black band now that clipping and black backdrop are gone)

        // 5. Glossy Refraction Sheens (Specular reflections on polished stadium polycarbonate materials)
        // Two diagonal glossy sheen streams cutting across the playfield
        const activeCenterY = engine.activeArenaCenterY ?? 540;
        const sheen = ctx.createLinearGradient(300, activeCenterY - 540, 1600, activeCenterY + 540);
        sheen.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
        sheen.addColorStop(0.35, 'rgba(255, 255, 255, 0.0)');
        sheen.addColorStop(0.38, 'rgba(255, 255, 255, 0.03)');
        sheen.addColorStop(0.40, 'rgba(255, 255, 255, 0.075)'); // bright glossy band
        sheen.addColorStop(0.42, 'rgba(255, 255, 255, 0.02)');
        sheen.addColorStop(0.55, 'rgba(255, 255, 255, 0.0)');
        sheen.addColorStop(0.57, 'rgba(255, 255, 255, 0.03)');
        sheen.addColorStop(0.59, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = sheen;
        ctx.beginPath();
        drawCapsulePath(ctx, 480, activeCenterY);
        ctx.fill();

        // Draw Zombie Siege Warning Zone if active
        if (engine.siegeWarningZone) {
            const wz = engine.siegeWarningZone;
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.005);
            
            // Calculate alpha based on timer.
            // Active for 5 seconds, disappears at 6 seconds.
            // So from 5.0 to 6.0 seconds, alpha goes from 1.0 down to 0.0
            let alpha = 1.0;
            if (wz.timer > 5.0) {
                alpha = Math.max(0, 1.0 - (wz.timer - 5.0));
            }
            
            if (alpha > 0) {
                ctx.save();
                ctx.translate(wz.x, wz.y);
                
                // 1. Draw glowing outer threat boundaries
                const gradient = ctx.createRadialGradient(0, 0, 50, 0, 0, wz.radius);
                gradient.addColorStop(0, `rgba(239, 68, 68, ${0.1 * alpha})`);
                gradient.addColorStop(0.5, `rgba(239, 68, 68, ${(0.15 + pulse * 0.1) * alpha})`);
                gradient.addColorStop(1, `rgba(239, 68, 68, ${0.35 * alpha})`);
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(0, 0, wz.radius, 0, Math.PI * 2);
                ctx.fill();
                
                // 2. Thick dashed red border with premium spinning transition
                ctx.strokeStyle = `rgba(239, 68, 68, ${(0.8 + pulse * 0.2) * alpha})`;
                ctx.lineWidth = 4;
                ctx.setLineDash([12, 8]);
                const rot = (Date.now() / 1000) % (Math.PI * 2);
                ctx.rotate(rot);
                ctx.beginPath();
                ctx.arc(0, 0, wz.radius, 0, Math.PI * 2);
                ctx.stroke();
                
                ctx.restore();
                
                ctx.save();
                ctx.translate(wz.x, wz.y);
                
                // Draw a large, rapid-flashing exclamation mark
                const flash = 0.4 + 0.6 * Math.sin(Date.now() * 0.012); // high frequency pulsing
                ctx.fillStyle = `rgba(239, 68, 68, ${flash * alpha})`;
                ctx.font = "bold 110px 'Space Grotesk', 'JetBrains Mono', 'Inter', sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("!", 0, 4); // small offset to perfectly center
                
                ctx.restore();
            }
        }

        // Restore the clipping path saved at the beginning of the draw routine
        ctx.restore();

        // 5.5 Draw Flashing Arrow guidance for interactive waiting_to_move phase
        if (engine.oneMinuteTransitionState === 'waiting_to_move') {
            ctx.save();
            const x = 960;
            // Bounce the arrow up and down gently using sine wave
            const bounce = Math.sin(Date.now() * 0.007) * 15;
            const y = 985 + bounce;
            
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.007);
            
            // Draw glowing background circle/aura
            ctx.shadowBlur = 25;
            ctx.shadowColor = `rgba(34, 197, 94, ${0.5 + pulse * 0.5})`; // vibrant green aura
            
            // Draw arrow shapes and head pointing down
            ctx.fillStyle = `rgba(34, 197, 94, ${0.75 + pulse * 0.25})`;
            
            ctx.beginPath();
            ctx.moveTo(x - 22, y - 30);
            ctx.lineTo(x + 22, y - 30);
            ctx.lineTo(x + 22, y + 10);
            ctx.lineTo(x + 44, y + 10);
            ctx.lineTo(x, y + 55);
            ctx.lineTo(x - 44, y + 10);
            ctx.lineTo(x - 22, y + 10);
            ctx.closePath();
            ctx.fill();
            
            // Draw text caption "往缺口移動" / "MOVE DOWN"
            ctx.shadowBlur = 0;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + pulse * 0.2})`;
            ctx.font = "bold 26px 'Space Grotesk', 'Inter', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("往缺口移動", x, y - 55);
            ctx.fillText("MOVE DOWN", x, y - 85);
            
            ctx.restore();
        }

        // Draw Launch Pads (彈射區)
        ctx.save();
        ctx.globalCompositeOperation = 'screen'; // Use screen blend capability to make lines and shadows incredibly vibrant
        const padRadius = 48; // base dimension
        const currentHue = (Date.now() / 15) % 360;

        engine.activeLaunchPads.forEach(pad => {
            const timeFactor = Date.now() / 150;
            const flicker = Math.sin(timeFactor) * 0.25 + 0.75; // dynamic neon pulsing
            const shadowColor = `hsl(${currentHue}, 100%, 60%)`;

            // Rotating gradient angle 1
            const gradAngle = (Date.now() / 800) % (Math.PI * 2);
            const cosG = Math.cos(gradAngle) * (padRadius + 12);
            const sinG = Math.sin(gradAngle) * (padRadius + 12);
            const rainbowGrad = ctx.createLinearGradient(pad.x - cosG, pad.y - sinG, pad.x + cosG, pad.y + sinG);
            rainbowGrad.addColorStop(0, '#ef4444');    // Red
            rainbowGrad.addColorStop(0.17, '#f97316'); // Orange
            rainbowGrad.addColorStop(0.33, '#eab308'); // Yellow
            rainbowGrad.addColorStop(0.5, '#22c55e');  // Green
            rainbowGrad.addColorStop(0.67, '#3b82f6'); // Blue
            rainbowGrad.addColorStop(0.83, '#6366f1'); // Indigo
            rainbowGrad.addColorStop(1, '#a855f7');    // Violet

            // Rotating gradient angle 2 (reverse direction for cool effect)
            const gradAngle2 = -(Date.now() / 500) % (Math.PI * 2);
            const cosG2 = Math.cos(gradAngle2) * (padRadius - 3);
            const sinG2 = Math.sin(gradAngle2) * (padRadius - 3);
            const rainbowGrad2 = ctx.createLinearGradient(pad.x - cosG2, pad.y - sinG2, pad.x + cosG2, pad.y + sinG2);
            rainbowGrad2.addColorStop(0, '#a855f7');    // Violet
            rainbowGrad2.addColorStop(0.17, '#6366f1'); // Indigo
            rainbowGrad2.addColorStop(0.33, '#3b82f6'); // Blue
            rainbowGrad2.addColorStop(0.5, '#22c55e');  // Green
            rainbowGrad2.addColorStop(0.67, '#eab308'); // Yellow
            rainbowGrad2.addColorStop(0.83, '#f97316'); // Orange
            rainbowGrad2.addColorStop(1, '#ef4444');    // Red
            
            // Draw a high-tech glowing background fill inside the pad
            const pulseGlow = Math.sin(Date.now() / 250) * 0.08 + 0.16;
            const innerGlow = ctx.createRadialGradient(pad.x, pad.y, 0, pad.x, pad.y, padRadius + 12);
            innerGlow.addColorStop(0, `hsla(${currentHue}, 100%, 65%, ${pulseGlow + 0.15})`);
            innerGlow.addColorStop(0.6, `hsla(${(currentHue + 120) % 360}, 100%, 55%, ${pulseGlow})`);
            innerGlow.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(pad.x, pad.y, padRadius + 12, 0, Math.PI * 2);
            ctx.fillStyle = innerGlow;
            ctx.fill();
            ctx.restore();

            // ================= 1. THREE-LAYERED HIGH-LUMINANCE OUTER RINGS =================
            // Outermost extra ring (Layer 1) - Subtle neon line
            ctx.save();
            ctx.strokeStyle = rainbowGrad2;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pad.x, pad.y, padRadius + 14, 0, Math.PI * 2); // Radius 62
            ctx.stroke();
            ctx.restore();

            // Middle ring (Layer 2) - Shifting rainbow neon bloom
            ctx.save();
            ctx.strokeStyle = rainbowGrad; // Rainbow gradient
            ctx.lineWidth = 4.5; // Thicker stroke
            ctx.beginPath();
            ctx.arc(pad.x, pad.y, padRadius + 6, 0, Math.PI * 2); // Radius 54
            ctx.stroke();
            ctx.restore();

            // Inner most outer ring (Layer 3) - High intensity reverse rainbow wire
            ctx.save();
            ctx.strokeStyle = rainbowGrad2;
            ctx.lineWidth = 2.0; // Sharp inner neon wire
            ctx.beginPath();
            ctx.arc(pad.x, pad.y, padRadius - 3, 0, Math.PI * 2); // Radius 45
            ctx.stroke();
            ctx.restore();

            // ================= 2. SELF-ROTATING HIGH-BRIGHTNESS RAINBOW STAR SYMBOL =================
            ctx.save();
            ctx.translate(pad.x, pad.y);
            
            // Auto rotation for star
            const starRotation = (Date.now() / 600) % (Math.PI * 2);
            ctx.rotate(starRotation);
            
            // Dynamic rainbow gradient for the star fill
            const starAngleRange = (Date.now() / 350) % (Math.PI * 2);
            const rCos = Math.cos(starAngleRange) * 26;
            const rSin = Math.sin(starAngleRange) * 26;
            const starRainbow = ctx.createLinearGradient(-rCos, -rSin, rCos, rSin);
            starRainbow.addColorStop(0, '#ef4444');
            starRainbow.addColorStop(0.17, '#f97316');
            starRainbow.addColorStop(0.33, '#eab308');
            starRainbow.addColorStop(0.5, '#22c55e');
            starRainbow.addColorStop(0.67, '#3b82f6');
            starRainbow.addColorStop(0.83, '#6366f1');
            starRainbow.addColorStop(1, '#a855f7');

            const spikes = 5;
            const outerR = 24;
            const innerR = 10;
            
            // Draw larger glowing white path for premium glow
            ctx.beginPath();
            let rot = -Math.PI / 2;
            ctx.moveTo(0, -outerR);
            for (let i = 0; i < spikes; i++) {
                const x1 = Math.cos(rot) * outerR;
                const y1 = Math.sin(rot) * outerR;
                ctx.lineTo(x1, y1);
                rot += Math.PI / spikes;

                const x2 = Math.cos(rot) * innerR;
                const y2 = Math.sin(rot) * innerR;
                ctx.lineTo(x2, y2);
                rot += Math.PI / spikes;
            }
            ctx.closePath();
            
            // Draw a high white outline glow
            ctx.lineWidth = 5.5;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.stroke();
            
            // Fill with high saturation rainbow
            ctx.fillStyle = starRainbow;
            ctx.fill();

            // Draw smaller center white star for white-hot brightness effect
            const smallOuterR = 11;
            const smallInnerR = 4.5;
            ctx.beginPath();
            let rotSmall = -Math.PI / 2;
            ctx.moveTo(0, -smallOuterR);
            for (let i = 0; i < spikes; i++) {
                const x1 = Math.cos(rotSmall) * smallOuterR;
                const y1 = Math.sin(rotSmall) * smallOuterR;
                ctx.lineTo(x1, y1);
                rotSmall += Math.PI / spikes;

                const x2 = Math.cos(rotSmall) * smallInnerR;
                const y2 = Math.sin(rotSmall) * smallInnerR;
                ctx.lineTo(x2, y2);
                rotSmall += Math.PI / spikes;
            }
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            ctx.restore();
        });
        ctx.restore();

        // Draw High-brightness Axis Trails on the Ground
        engine.tops.forEach(top => {
            if (top.axisTrail && top.axisTrail.length >= 2) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen'; // 設定濾色混色，使亮色疊加發光
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                for (let i = 1; i < top.axisTrail.length; i++) {
                    const p1 = top.axisTrail[i - 1];
                    const p2 = top.axisTrail[i];
                    
                    const pMaxLife = p2.isDash ? 0.525 : 0.35;
                    const lifePct = (p1.life + p2.life) / (2 * pMaxLife);
                    if (lifePct <= 0) continue;

                    const widthMultiplier = (p2.isDash ? 1.5 : 1.0) * 1.3 * (p2.isSpecialDash ? 2.0 : 1.0);

                    // ---- 軌跡發光三層堆疊工法 ----
                    // Layer 1: 最外圍的大範圍霓虹暈光
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = top.color;
                    ctx.lineWidth = 14 * lifePct * widthMultiplier;
                    ctx.globalAlpha = 0.25 * lifePct;
                    ctx.stroke();

                    // Layer 2: 飽和色彩的中層核心
                    ctx.lineWidth = 6 * lifePct * widthMultiplier;
                    ctx.globalAlpha = 0.65 * lifePct;
                    ctx.stroke();

                    // Layer 3: 白熱化 (White-hot) 的中心光亮小實線
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2.0 * lifePct * widthMultiplier;
                    ctx.globalAlpha = 0.9 * lifePct;
                    ctx.stroke();
                    
                    // ---- 高頻電擊/閃電鏈渲染 (密度減半: 0.6 -> 0.3) ----
                    if (p2.isDash && Math.random() < 0.3) {
                        const numSparks = Math.floor(Math.random() * 3) + 1; // 隨機渲染 1-3 道電弧入
                        for (let s = 0; s < numSparks; s++) {
                            ctx.beginPath();
                            
                            // 隨機在點 1 半徑 45px 圈內找出電光起點
                            const startRad = Math.random() * 45;
                            const startAng = Math.random() * Math.PI * 2;
                            const startX = p1.x + Math.cos(startAng) * startRad;
                            const startY = p1.y + Math.sin(startAng) * startRad;

                            // 隨機在點 2 半徑 45px 圈內找出電光終點
                            const endRad = Math.random() * 45;
                            const endAng = Math.random() * Math.PI * 2;
                            const endX = p2.x + Math.cos(endAng) * endRad;
                            const endY = p2.y + Math.sin(endAng) * endRad;

                            // 對中點施加一組大幅度隨機橫移 (Jump Offset)，創造不規則鋸齒銳角
                            const jumpX = (Math.random() - 0.5) * 80;
                            const jumpY = (Math.random() - 0.5) * 80;
                            const midX = (startX + endX) / 2 + jumpX;
                            const midY = (startY + endY) / 2 + jumpY;
                            
                            // 繪製三角形折線 (起點 -> 鋸齒中點 -> 終點)
                            ctx.moveTo(startX, startY);
                            ctx.lineTo(midX, midY);
                            ctx.lineTo(endX, endY);
                            
                            // 閃電配色：白黃/金（#fde047）與亮藍（#60a5fa）高頻閃爍交替
                            ctx.strokeStyle = Math.random() > 0.5 ? '#fde047' : '#60a5fa';
                            ctx.lineWidth = 3.9 * lifePct;
                            ctx.globalAlpha = 0.9 * lifePct;
                            ctx.stroke();
                        }
                    }
                }
                ctx.restore();
            }
        });

        // Draw Spike Obstacles (North, South, West, East)
        const spikesToDraw = CollisionSystem.getSpikeTriangles(engine);
        spikesToDraw.forEach(spike => {
            if (spike.height <= 5) return; // Skip if retracted or barely visible
            
            ctx.save();
            
            const baseMidX = (spike.x1 + spike.x2) / 2;
            const baseMidY = (spike.y1 + spike.y2) / 2;

            const activeCenterY = engine.activeArenaCenterY || 540;
            const borderTop = activeCenterY - 540;
            const borderBottom = activeCenterY + 540;

            // Draw square base sticking to rectangular screen border
            ctx.fillStyle = '#1e3a8a'; // dark slate/navy base color
            ctx.beginPath();
            const spikeName = (spike as any).name || '';
            if (spikeName.includes('North')) {
                ctx.rect(spike.x1, spike.y1 - 100, spike.x2 - spike.x1, 100);
            } else if (spikeName.includes('South')) {
                ctx.rect(spike.x1, spike.y1, spike.x2 - spike.x1, 100);
            } else if (spikeName.includes('West')) {
                ctx.rect(spike.x1 - 100, spike.y1, 100, spike.y2 - spike.y1);
            } else if (spikeName.includes('East')) {
                ctx.rect(spike.x1, spike.y1, 100, spike.y2 - spike.y1);
            }
            ctx.fill();
            ctx.strokeStyle = '#020617';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // 1. Soft deep cobalt blue background shadow for a solid 3D depth look
            // Removed shadowColor for perf // Solid blue shadow
            // Removed shadowBlur for perf
            
            // 2. Left Facet - Brushed Steel Blue (High contrast 3D metal look)
            const leftGrad = ctx.createLinearGradient(spike.x3, spike.y3, spike.x1, spike.y1);
            leftGrad.addColorStop(0, '#eff6ff'); // Polished steel tip
            leftGrad.addColorStop(0.35, '#93c5fd'); // Reflected light blue
            leftGrad.addColorStop(0.7, '#3b82f6'); // Base stadium blue
            leftGrad.addColorStop(1, '#1e3a8a'); // Heavy navy metal base
            
            ctx.fillStyle = leftGrad;
            ctx.beginPath();
            ctx.moveTo(spike.x1, spike.y1);
            ctx.lineTo(baseMidX, baseMidY);
            ctx.lineTo(spike.x3, spike.y3);
            ctx.closePath();
            ctx.fill();
            
            // 3. Right Facet - Shaded Steel Blue (Darker side)
            const rightGrad = ctx.createLinearGradient(spike.x3, spike.y3, spike.x2, spike.y2);
            rightGrad.addColorStop(0, '#3b82f6'); // Medium navy
            rightGrad.addColorStop(0.4, '#1d4ed8'); // Royal cobalt shadow
            rightGrad.addColorStop(0.8, '#172554'); // Very dark steel base
            rightGrad.addColorStop(1, '#020617'); // Pitch black bottom
            
            ctx.fillStyle = rightGrad;
            ctx.beginPath();
            ctx.moveTo(spike.x2, spike.y2);
            ctx.lineTo(baseMidX, baseMidY);
            ctx.lineTo(spike.x3, spike.y3);
            ctx.closePath();
            ctx.fill();
            
            // Disable shadow blur for ultra-crisp interior lines
            // Removed shadowBlur for perf
            
            // 4. Draw engraved physical steel horizontal grooves (with 3D shadow & light highlights)
            const grooves = 3;
            for (let g = 1; g <= grooves; g++) {
                const ratio = g / (grooves + 1);
                const lx = spike.x1 + (spike.x3 - spike.x1) * ratio;
                const ly = spike.y1 + (spike.y3 - spike.y1) * ratio;
                const rx = spike.x2 + (spike.x3 - spike.x2) * ratio;
                const ry = spike.y2 + (spike.y3 - spike.y2) * ratio;
                const mx = baseMidX + (spike.x3 - baseMidX) * ratio;
                const my = baseMidY + (spike.y3 - baseMidY) * ratio;
                
                // Deep dark groove line (shadow)
                ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.moveTo(lx, ly);
                ctx.lineTo(mx, my);
                ctx.lineTo(rx, ry);
                ctx.stroke();
                
                // Beveled metallic highlight line right beneath/above the groove for a real cut look
                ctx.strokeStyle = 'rgba(239, 246, 255, 0.25)';
                ctx.lineWidth = 1.0;
                ctx.beginPath();
                ctx.moveTo(lx, ly + 1);
                ctx.lineTo(mx, my + 1);
                ctx.lineTo(rx, ry + 1);
                ctx.stroke();
            }
            
            // 5. Draw center dividing ridge (The heavy sharp front edge line)
            ctx.strokeStyle = '#f8fafc'; // Brushed titanium edge
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(spike.x3, spike.y3);
            ctx.lineTo(baseMidX, baseMidY);
            ctx.stroke();
            
            // 6. Draw clean form-fitting structural borders for a heavy machinery finish
            ctx.strokeStyle = '#60a5fa'; // Saturated steel outline matching stadium borders
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(spike.x1, spike.y1);
            ctx.lineTo(spike.x2, spike.y2);
            ctx.lineTo(spike.x3, spike.y3);
            ctx.closePath();
            ctx.stroke();

            // 7. Small solid rivet/screw cap at the base center to represent robust physical construction
            ctx.beginPath();
            ctx.arc(baseMidX, baseMidY, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#475569';
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();
            
            ctx.restore();
        });


}
