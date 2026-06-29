import { SCALE, drawPixelCircle } from './common';

export function createBarrelSprite(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 24 * SCALE; // 96px
    c.height = 24 * SCALE; // 96px
    const ctx = c.getContext('2d')!;
    
    const cx = c.width / 2;
    const cy = c.height / 2;
    
    // Clear
    ctx.clearRect(0, 0, c.width, c.height);
    
    // Outer shadow/glow for a sci-fi emission feel
    ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
    ctx.shadowBlur = 12;
    
    // 1. High-tech heavy metal hexagonal/octagonal base frame
    ctx.beginPath();
    const sides = 8;
    const rBase = 11.5 * SCALE; // 46 pixels rad
    for (let i = 0; i < sides; i++) {
        const ang = (Math.PI * 2 / sides) * i;
        const x = cx + Math.cos(ang) * rBase;
        const y = cy + Math.sin(ang) * rBase;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    
    const rimGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, rBase);
    rimGrad.addColorStop(0, '#1e293b'); // grey slate
    rimGrad.addColorStop(0.5, '#0f172a'); // deep dark slate
    rimGrad.addColorStop(1, '#020617'); // obsidian edge
    ctx.fillStyle = rimGrad;
    ctx.fill();
    
    // Heavy metallic outer frame stroke
    ctx.shadowBlur = 0; // reset shadow
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    
    // Inner bevel ring
    ctx.beginPath();
    ctx.arc(cx, cy, 33, 0, Math.PI * 2);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. High-contrast yellow/orange dynamic hazard caution sectors
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#eab308'; // hazard warning yellow
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, 31, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 3. Symmetric external mechanical clamp attachments / Stabilizers
    for (let i = 0; i < 4; i++) {
        const ang = (Math.PI / 2) * i + Math.PI / 4;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        
        // Stabilizer body
        ctx.fillStyle = '#64748b';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(26, -7);
        ctx.lineTo(41, -4);
        ctx.lineTo(41, 4);
        ctx.lineTo(26, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Rivet on stabilizer
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(30, 0, 1.8, 0, Math.PI * 2);
        ctx.fill();
        
        // High-brightness blinking alarm laser indicator diode/led
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(38, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    // 4. Central reactor chamber well
    ctx.beginPath();
    ctx.arc(cx, cy, 21, 0, Math.PI * 2);
    ctx.fillStyle = '#090d16'; // ultra dark core
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();

    // 5. Red warning pulsing reactor neon light
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // 6. Cybernetic Circuitry connections running into the core
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
        const ang = (Math.PI / 2) * i;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(22, 0);
        ctx.stroke();
        
        // Micro resistor dot
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(22, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // 7. Core Energy Cell (Fusion Plasma Core)
    const plasmaGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 11);
    plasmaGrad.addColorStop(0, '#ffffff');      // hyper-state superheated plasma core
    plasmaGrad.addColorStop(0.35, '#fca5a5');    // pulsing amber/red glow
    plasmaGrad.addColorStop(0.75, '#dc2626');    // deep burning crimson
    plasmaGrad.addColorStop(1, '#450a0a');       // cold iron edge decay
    
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fillStyle = plasmaGrad;
    ctx.fill();

    // Core glass lens reflection line
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fill();
    
    return c;
}

export function createGearSprite(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 24 * SCALE;
    c.height = 24 * SCALE;
    const ctx = c.getContext('2d')!;
    
    drawPixelCircle(ctx, 12, 12, 10, '#f59e0b');
    drawPixelCircle(ctx, 12, 12, 6, '#fbbf24');
    
    // Clear center hole
    ctx.globalCompositeOperation = 'destination-out';
    drawPixelCircle(ctx, 12, 12, 3, '#000');
    
    return c;
}

export function createCrateSprite(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 24 * SCALE;
    c.height = 24 * SCALE;
    const ctx = c.getContext('2d')!;
    
    const cx = c.width / 2;
    const cy = c.height / 2;
    const outerRadius = 11 * SCALE;
    const innerRadius = 5 * SCALE;
    const spikes = 5;
    
    // Draw outer glowing aura shadow for high-brightness feel
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 10;
    
    let rot = Math.PI / 2 * 3;
    let step = Math.PI / spikes;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outerRadius;
        let y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;
        
        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    
    // Beautiful rainbow linear gradient fill (Red, Orange, Yellow, Green, Blue, Violet)
    const grad = ctx.createLinearGradient(cx - outerRadius, cy - outerRadius, cx + outerRadius, cy + outerRadius);
    grad.addColorStop(0, '#ff3333');   // Red
    grad.addColorStop(0.2, '#ff9933');  // Orange
    grad.addColorStop(0.4, '#ffff33');  // Yellow
    grad.addColorStop(0.6, '#33cc33');  // Green
    grad.addColorStop(0.8, '#3399ff');  // Blue
    grad.addColorStop(1, '#9933ff');    // Violet
    
    ctx.fillStyle = grad;
    ctx.fill();
    
    // Smooth, clean white border
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    
    return c;
}

