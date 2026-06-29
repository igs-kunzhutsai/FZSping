import { SCALE } from './common';

function shadeHexColor(color: string, percent: number) {
    if (color.startsWith('rgba') || color.startsWith('rgb')) {
        return color; // Fallback if given rgba
    }
    const hex = color.replace('#', '');
    if (hex.length !== 6) return color;
    
    let R = parseInt(hex.substring(0, 2), 16);
    let G = parseInt(hex.substring(2, 4), 16);
    let B = parseInt(hex.substring(4, 6), 16);

    R = Math.round(R * (1 + percent));
    G = Math.round(G * (1 + percent));
    B = Math.round(B * (1 + percent));

    R = (R < 255) ? R : 255;
    G = (G < 255) ? G : 255;
    B = (B < 255) ? B : 255;

    R = (R > 0) ? R : 0;
    G = (G > 0) ? G : 0;
    B = (B > 0) ? B : 0;

    const RR = ((R.toString(16).length == 1) ? "0" + R.toString(16) : R.toString(16));
    const GG = ((G.toString(16).length == 1) ? "0" + G.toString(16) : G.toString(16));
    const BB = ((B.toString(16).length == 1) ? "0" + B.toString(16) : B.toString(16));

    return "#" + RR + GG + BB;
}

export function createTop1Sprite(color: string, pilotColor: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 32 * SCALE; // 128px
    c.height = 32 * SCALE; // 128px
    const ctx = c.getContext('2d')!;
    const cx = 64;
    const cy = 64;
    ctx.clearRect(0, 0, c.width, c.height);

    // Apply color parameter to dynamically style based on player choice
    const baseColor = color || '#e91e63';
    const mainPink = baseColor;
    const darkPink = shadeHexColor(baseColor, -0.3);
    const lightPink = shadeHexColor(baseColor, 0.4);
    const accent1 = shadeHexColor(baseColor, 0.2); // Lime replacement
    const accent2 = shadeHexColor(baseColor, 0.5); // Yellow replacement
    const neonCyan = shadeHexColor(baseColor, 0.6); // Eye

    ctx.save();
    // No baked shadow to prevent rotating shadow bug

    // Rotate slightly so the initial "up" matches the image's orientation
    // We will build a 3-way symmetric blade base.
    
    // LAYER 1: Deep black/dark gray underlayer
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    
    // LAYER 2: The jagged blade wings (5 equal blades)
    for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        
        // Base angle for 5 blades.
        const baseAngle = (Math.PI * 2 / 5) * i - Math.PI / 2;
        ctx.rotate(baseAngle);

        // Drawing a single blade wing
        ctx.beginPath();
        // Normal blades
        ctx.moveTo(10, -30);
        ctx.bezierCurveTo(25, -48, 35, -43, 46, -15);
        ctx.lineTo(40, -5);
        ctx.lineTo(46, 8);
        ctx.lineTo(35, 20);
        ctx.lineTo(20, 32);
        ctx.lineTo(5, 15);
        ctx.closePath();

        const gradBase = ctx.createLinearGradient(0, -50, 50, 50);
        gradBase.addColorStop(0, '#94a3b8');
        gradBase.addColorStop(0.5, '#e2e8f0');
        gradBase.addColorStop(1, '#475569');
        ctx.fillStyle = gradBase;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#1e293b';
        ctx.stroke();

        // Inner darker grey segment details
        ctx.beginPath();
        ctx.moveTo(15, -22);
        ctx.lineTo(35, -10);
        ctx.lineTo(30, 5);
        ctx.lineTo(15, 18);
        ctx.closePath();
        ctx.fillStyle = '#334155';
        ctx.fill();
        ctx.stroke();

        // Dark grey cutouts
        ctx.beginPath();
        ctx.moveTo(18, -18);
        ctx.lineTo(30, -8);
        ctx.lineTo(22, 0);
        ctx.closePath();
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        // Pink Accent Swoosh on each blade
        ctx.beginPath();
        ctx.moveTo(28, -35);
        ctx.lineTo(42, -12);
        ctx.lineTo(35, -5);
        ctx.bezierCurveTo(38, -18, 25, -28, 15, -22);
        ctx.closePath();
        ctx.fillStyle = mainPink;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    // Secondary jagged pieces filling the gaps
    for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((Math.PI * 2 / 5) * i - Math.PI / 2 + Math.PI / 5);

        ctx.beginPath();
        ctx.moveTo(25, 0);
        ctx.lineTo(45, 0);
        ctx.lineTo(35, 15);
        ctx.lineTo(25, 18);
        ctx.closePath();
        const silverGrad = ctx.createLinearGradient(25, 0, 45, 18);
        silverGrad.addColorStop(0, '#cbd5e1');
        silverGrad.addColorStop(1, '#64748b');
        ctx.fillStyle = silverGrad;
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    // Main inner black ring
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#555';
    ctx.stroke();

    // The central pink shield (Target's Rachet / Bit outer frame)
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const ang = (Math.PI * 2 / 5) * i - Math.PI / 2;
        const outR = 34;
        const curveR = 20;
        
        const px = cx + Math.cos(ang) * outR;
        const py = cy + Math.sin(ang) * outR;

        const nextAng = (Math.PI * 2 / 5) * (i + 1) - Math.PI / 2;
        const cxCont = cx + Math.cos(ang + Math.PI/5) * curveR;
        const cyCont = cy + Math.sin(ang + Math.PI/5) * curveR;

        if (i === 0) ctx.moveTo(px, py);
        ctx.quadraticCurveTo(cxCont, cyCont, cx + Math.cos(nextAng)*outR, cy + Math.sin(nextAng)*outR);
    }
    ctx.closePath();
    ctx.fillStyle = mainPink;
    ctx.fill();
    
    // Add shading and highlights to pink triangle
    ctx.lineWidth = 3;
    ctx.strokeStyle = darkPink;
    ctx.stroke();
    
    // Small inner black cutouts on the pink triangle
    ctx.beginPath();
    ctx.arc(cx, cy, 27, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    // Inner pink ring
    ctx.beginPath();
    ctx.arc(cx, cy, 21, 0, Math.PI * 2);
    ctx.fillStyle = mainPink;
    ctx.fill();

    // Center Avatar Area
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0a';
    ctx.fill();

    // Restrict drawing to center circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.clip();

    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i - Math.PI / 8;
        const x = cx + Math.cos(angle) * 12;
        const y = cy + Math.sin(angle) * 12;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = mainPink;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore(); // Restore clip

    // Finish
    ctx.restore(); // Restore main save

    return c;
}

export function createTop2Sprite(color: string, pilotColor: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 32 * SCALE;
    c.height = 32 * SCALE;
    const ctx = c.getContext('2d')!;
    const cx = 64;
    const cy = 64;
    ctx.clearRect(0, 0, c.width, c.height);

    const baseColor = color || '#0ea5e9';
    const mainColor = baseColor;
    const darkColor = shadeHexColor(mainColor, -0.4);
    const deepBlue = shadeHexColor(mainColor, -0.6);
    const lightBlue = shadeHexColor(mainColor, 0.3);
    const accentOrange1 = shadeHexColor(mainColor, -0.2); // Flame 1
    const accentOrange2 = shadeHexColor(mainColor, 0.2);  // Flame 2
    const neonCyan = shadeHexColor(mainColor, 0.5);       // Eyes
    const silverBase = '#cbd5e1';

    ctx.save();
    // No baked shadow

    // Scale to match Top 1 radius 48 (currently max ~60)
    ctx.translate(cx, cy);
    ctx.scale(0.8, 0.8);
    ctx.translate(-cx, -cy);

    // Base background dark layer
    ctx.beginPath();
    ctx.arc(cx, cy, 46, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    // LAYER 1: The wide translucent blue plastic wings
    // They stick out further than the inner ring but slightly under metal blades
    for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((Math.PI * 2 / 3) * i);
        
        ctx.beginPath();
        // Base of wing
        ctx.moveTo(15, -20);
        // Scoop out
        ctx.bezierCurveTo(45, -55, 60, -10, 50, 15);
        ctx.lineTo(35, 10);
        ctx.lineTo(25, 25);
        ctx.lineTo(0, 15);
        ctx.closePath();

        const wingGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 55);
        wingGrad.addColorStop(0, lightBlue);
        wingGrad.addColorStop(0.5, mainColor);
        wingGrad.addColorStop(1, deepBlue); // darker blue tips
        ctx.fillStyle = wingGrad;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = darkColor;
        ctx.stroke();

        // Inner blue plastic details / white decals
        ctx.beginPath();
        ctx.moveTo(25, -20);
        ctx.lineTo(40, -40);
        ctx.lineTo(45, -15);
        ctx.lineTo(30, -10);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
        
        // Polka dots/halftone effect representation
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.arc(35, -25, 1, 0, Math.PI*2);
        ctx.arc(38, -25, 1, 0, Math.PI*2);
        ctx.arc(36, -28, 1, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }

    // Inner bright blue plastic core
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    const coreGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 38);
    coreGrad.addColorStop(0, mainColor);
    coreGrad.addColorStop(1, darkColor);
    ctx.fillStyle = coreGrad;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = darkColor;
    ctx.stroke();

    // Transparent layer lines to imply depth
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // LAYER 2: 3 Heavy Silver Metal Blades
    for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((Math.PI * 2 / 3) * i - Math.PI / 18);

        ctx.beginPath();
        ctx.moveTo(20, -15);
        // Smooth outer curve
        ctx.bezierCurveTo(40, -45, 55, -45, 60, -25);
        // Sharp point back
        ctx.lineTo(50, -5);
        ctx.lineTo(55, 5);
        ctx.lineTo(40, 0);
        ctx.lineTo(30, 15);
        ctx.lineTo(15, 20);
        ctx.closePath();

        const metalGrad = ctx.createLinearGradient(15, -45, 60, 20);
        metalGrad.addColorStop(0, '#f8fafc'); // bright edge
        metalGrad.addColorStop(0.3, '#94a3b8');
        metalGrad.addColorStop(0.7, '#cbd5e1'); // core metal
        metalGrad.addColorStop(1, '#475569'); // shadowed back edge
        
        ctx.fillStyle = metalGrad;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#334155';
        ctx.stroke();

        // Inner bevel highlight
        ctx.beginPath();
        ctx.moveTo(25, -20);
        ctx.bezierCurveTo(35, -40, 50, -35, 52, -22);
        ctx.lineTo(45, -12);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();

        ctx.restore();
    }

    // Wrap the central shield and avatar in an inverse scale to match Top 1 size
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.25, 1.25); // Undo the 0.8 scale from earlier
    ctx.translate(-cx, -cy);

    // LAYER 3: Target center white bit/shield
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        // Rotate so the white points line up correctly (adjust angle offset)
        const ang = (Math.PI * 2 / 3) * i + Math.PI / 6;
        const radius = 32; // Expanded to accommodate larger center
        const outerX = cx + Math.cos(ang) * radius;
        const outerY = cy + Math.sin(ang) * radius;
        
        // The scooped indentations
        const controlAng = ang + Math.PI / 3;
        const controlR = 21; // Increased to clear the 18 radius avatar
        const controlX = cx + Math.cos(controlAng) * controlR;
        const controlY = cy + Math.sin(controlAng) * controlR;
        
        if (i === 0) ctx.moveTo(outerX, outerY);
        const nextAng = (Math.PI * 2 / 3) * (i + 1) + Math.PI / 6;
        ctx.quadraticCurveTo(controlX, controlY, cx + Math.cos(nextAng)*radius, cy + Math.sin(nextAng)*radius);
    }
    ctx.closePath();
    ctx.fillStyle = '#f8fafc'; // White frame
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    // Inner ring to match Top 1
    ctx.beginPath();
    ctx.arc(cx, cy, 21, 0, Math.PI * 2);
    ctx.fillStyle = mainColor;
    ctx.fill();

    // Center avatar circle Base
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#111'; // Dark background for avatar
    ctx.fill();

    // Restrict drawing to center circle for Avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.clip();

    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i - Math.PI / 8;
        const x = cx + Math.cos(angle) * 12;
        const y = cy + Math.sin(angle) * 12;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = mainColor;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore(); // Exit avatar clip

    ctx.restore(); // Undo the 1.25 center scale save

    ctx.restore(); // Exit main top save
    return c;
}

export function createTop3Sprite(color: string, pilotColor: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 32 * SCALE;
    c.height = 32 * SCALE;
    const ctx = c.getContext('2d')!;
    const cx = 64;
    const cy = 64;
    ctx.clearRect(0, 0, c.width, c.height);

    const baseColor = color || '#fde047'; // Bright base
    const mainYellow = baseColor;
    const darkYellow = shadeHexColor(mainYellow, -0.3);
    const darkerYellow = shadeHexColor(mainYellow, -0.5);
    const lightYellow = shadeHexColor(mainYellow, 0.3);
    const neonOrange = shadeHexColor(mainYellow, -0.15);
    const accentDark = shadeHexColor(mainYellow, -0.6);
    const accentRed = shadeHexColor(mainYellow, -0.4);

    ctx.save();
    // No baked shadow

    // Scale to match Top 1 radius 48 (currently max ~60)
    ctx.translate(cx, cy);
    ctx.scale(0.8, 0.8);
    ctx.translate(-cx, -cy);

    // 1. Base Layer (Outer Yellow Blades - 4 of them)
    for(let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((Math.PI * 2 / 4) * i);
        
        ctx.beginPath();
        ctx.moveTo(30, -30);
        // Outer wavy sweep
        ctx.bezierCurveTo(45, -55, 60, -35, 50, -5);
        // Inner tuck back
        ctx.bezierCurveTo(55, 5, 55, 15, 30, 30);
        ctx.lineTo(0, 30);
        ctx.closePath();

        const wingGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, 55);
        wingGrad.addColorStop(0, lightYellow); // soft bright yellow
        wingGrad.addColorStop(0.7, mainYellow);
        wingGrad.addColorStop(1, darkYellow); // deeper yellow edge
        
        ctx.fillStyle = wingGrad;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = darkerYellow; // amber dark yellow
        ctx.stroke();

        // Inner ridge detail line
        ctx.beginPath();
        ctx.moveTo(35, -25);
        ctx.bezierCurveTo(40, -40, 50, -30, 45, -5);
        ctx.strokeStyle = lightYellow;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    }

    // 2. Translucent Orange Under-Disc Layer
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = darkYellow; // Vivid translucent orange
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = accentDark;
    ctx.stroke();

    // Inner detail inside orange disc
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = accentDark;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // 3. Hexagon Track Ring (24 hexagons forming a circular gear-like path)
    const hexTrackRadius = 40;
    const hexRadius = 6.5; 
    
    // Draw a single hexagon centered at (0,0)
    const drawHex = (hr: number) => {
        ctx.beginPath();
        for(let j = 0; j < 6; j++) {
            const hang = (Math.PI / 3) * j + Math.PI / 6; 
            const px = Math.cos(hang) * hr;
            const py = Math.sin(hang) * hr;
            if(j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    };

    for(let i = 0; i < 24; i++) {
        const mod = i % 6;
        // Create 4 clusters of 3 orange hexes at the corners
        const isOrange = (mod >= 1 && mod <= 3); 
        
        const ang = (Math.PI * 2 / 24) * i - Math.PI / 2 + (Math.PI / 24);
        const hx = cx + Math.cos(ang) * hexTrackRadius;
        const hy = cy + Math.sin(ang) * hexTrackRadius;
        
        ctx.save();
        ctx.translate(hx, hy);
        // Align hexagon flats along the tangent of the ring
        ctx.rotate(ang + Math.PI / 2);

        drawHex(hexRadius);
        
        if (isOrange) {
            ctx.fillStyle = neonOrange;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = accentDark; // darker orange edge
            ctx.stroke();
            
            // Add intersecting white technological lines for geometric pattern
            ctx.beginPath();
            ctx.moveTo(-4, -4);
            ctx.lineTo(4, 4);
            ctx.moveTo(4, -2);
            ctx.lineTo(-2, 5);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 0.8;
            ctx.stroke();
        } else {
            // White hex elements
            ctx.fillStyle = '#f8fafc';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#cbd5e1';
            ctx.stroke();
            
            // Inner bevel highlight
            ctx.beginPath();
            ctx.moveTo(-3, -3);
            ctx.lineTo(3, -3);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
        ctx.restore();
    }

    // Wrap the central shield and avatar in an inverse scale to match Top 1 size
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.25, 1.25); // Undo the 0.8 scale from earlier
    ctx.translate(-cx, -cy);

    // 4. Central Yellow 4-point Star Shield
    ctx.beginPath();
    const startAng = -Math.PI / 4;
    ctx.moveTo(cx + Math.cos(startAng) * 33, cy + Math.sin(startAng) * 33);
    for (let i = 0; i < 4; i++) {
        const ang = (Math.PI * 2 / 4) * i - Math.PI / 4;
        const nextAng = (Math.PI * 2 / 4) * (i + 1) - Math.PI / 4;
        const controlAng = ang + Math.PI / 4;
        
        // Curve inward to center, then outward to next prong tip
        ctx.quadraticCurveTo(
            cx + Math.cos(controlAng) * 22, cy + Math.sin(controlAng) * 22,
            cx + Math.cos(nextAng) * 33, cy + Math.sin(nextAng) * 33
        );
    }
    ctx.closePath();
    
    // Add shading gradient to the yellow shield
    const shieldGrad = ctx.createLinearGradient(cx - 20, cy - 20, cx + 20, cy + 20);
    shieldGrad.addColorStop(0, lightYellow);
    shieldGrad.addColorStop(0.5, mainYellow);
    shieldGrad.addColorStop(1, darkYellow);
    ctx.fillStyle = shieldGrad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = darkerYellow;
    ctx.stroke();

    // Inner orange ring
    ctx.beginPath();
    ctx.arc(cx, cy, 21, 0, Math.PI * 2);
    ctx.fillStyle = neonOrange;
    ctx.fill();

    // Inner heavy black rim for Avatar
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    
    // 5. The Avatar (Wasp/Hornet Emblem)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.clip(); // Restrict everything inside the circular emblem
    
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i - Math.PI / 8;
        const x = cx + Math.cos(angle) * 12;
        const y = cy + Math.sin(angle) * 12;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = neonOrange;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore(); // End Avatar clip
    
    ctx.restore(); // Undo the 1.25 center scale save

    ctx.restore(); // End main canvas save
    return c;
}

export function createTop4Sprite(color: string, pilotColor: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 32 * SCALE;
    c.height = 32 * SCALE;
    const ctx = c.getContext('2d')!;
    const cx = 64;
    const cy = 64;
    ctx.clearRect(0, 0, c.width, c.height);

    const baseColor = color || '#0f766e'; // Base color
    const mainTeal = baseColor;
    const neonLime = shadeHexColor(mainTeal, 0.4); // Bright variation
    const darkTeal = shadeHexColor(mainTeal, -0.4);
    const darkerTeal = shadeHexColor(mainTeal, -0.6);
    const lightTeal = shadeHexColor(mainTeal, 0.2);
    const accentGreen = shadeHexColor(mainTeal, 0.3);

    ctx.save();
    // No baked shadow

    // Scale to match Top 1 radius 48 (currently max ~54)
    ctx.translate(cx, cy);
    ctx.scale(0.89, 0.89);
    ctx.translate(-cx, -cy);

    // 1. Base Layer (Thick Silver Metallic Ring, mildly 3-lobed (rounded triangle))
    ctx.beginPath();
    for (let i = 0; i <= 360; i+= 5) {
        const rad = i * Math.PI / 180;
        // Super smooth rounded triangle math:
        // R = Base_R + subtle_variance * cos(3 * theta)
        const radius = 50 + 4 * Math.cos(3 * rad);
        const x = cx + Math.cos(rad) * radius;
        const y = cy + Math.sin(rad) * radius;
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const baseGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 55);
    baseGrad.addColorStop(0, '#64748b');
    baseGrad.addColorStop(0.8, '#cbd5e1');
    baseGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = baseGrad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#475569';
    ctx.stroke();

    // Inner contour line for the metallic rim to show depth
    ctx.beginPath();
    for (let i = 0; i <= 360; i+= 5) {
        const rad = i * Math.PI / 180;
        const radius = 46 + 3 * Math.cos(3 * rad);
        const x = cx + Math.cos(rad) * radius;
        const y = cy + Math.sin(rad) * radius;
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2. Yellow hazard stripes and inner indentations (3 segments)
    for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((Math.PI * 2 / 3) * i + Math.PI / 6); // offset so points are at 0, 120, 240
        
        // Hazard stripe area on the indented flat edges
        ctx.beginPath();
        ctx.arc(0, 0, 44, -Math.PI/6, Math.PI/6);
        ctx.lineTo(Math.cos(Math.PI/6)*38, Math.sin(Math.PI/6)*38);
        ctx.arc(0, 0, 38, Math.PI/6, -Math.PI/6, true);
        ctx.closePath();
        ctx.fillStyle = neonLime;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#475569';
        ctx.stroke();

        // Draw diagonal hazard lines
        ctx.save();
        ctx.clip(); // clip to the stripe area
        ctx.beginPath();
        for(let j = -40; j <= 40; j += 8) {
            ctx.moveTo(35, j);
            ctx.lineTo(50, j - 15);
        }
        ctx.strokeStyle = '#334155'; // Dark grey stripes
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        // Mechanical indent detail near the hazard region
        ctx.beginPath();
        ctx.moveTo(32, -15);
        ctx.lineTo(39, -15);
        ctx.lineTo(39, 15);
        ctx.lineTo(32, 15);
        ctx.closePath();
        ctx.fillStyle = '#1e293b';
        ctx.fill();

        ctx.restore();
    }

    // 3. Central metallic structure (3 pointed star)
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        const ang = (Math.PI * 2 / 3) * i - Math.PI / 2;
        const outR = 40; 
        const inR = 18;  
        // Point
        const px = cx + Math.cos(ang) * outR;
        const py = cy + Math.sin(ang) * outR;
        
        // Inner curve
        const nextAng = (Math.PI * 2 / 3) * (i + 1) - Math.PI / 2;
        const cAng = ang + Math.PI / 3;
        const cxCont = cx + Math.cos(cAng) * inR;
        const cyCont = cy + Math.sin(cAng) * inR;

        if (i === 0) ctx.moveTo(px, py);
        ctx.quadraticCurveTo(cxCont, cyCont, cx + Math.cos(nextAng)*outR, cy + Math.sin(nextAng)*outR);
    }
    ctx.closePath();
    const starGrad = ctx.createLinearGradient(cx - 30, cy - 30, cx + 30, cy + 30);
    starGrad.addColorStop(0, '#f1f5f9');
    starGrad.addColorStop(0.5, '#94a3b8');
    starGrad.addColorStop(1, '#475569');
    ctx.fillStyle = starGrad;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    // 4. Three Teal Transparent Axe-like Bumpers
    for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((Math.PI * 2 / 3) * i - Math.PI / 2); // Center on top point

        // Draw the main axe wedge shape
        ctx.beginPath();
        ctx.moveTo(-15, 25); // inner left
        ctx.lineTo(-25, 45); // outer left
        ctx.lineTo(0, 52);   // tip point outer
        ctx.lineTo(25, 45);  // outer right
        ctx.lineTo(15, 25);  // inner right
        ctx.lineTo(0, 20);   // inner center
        ctx.closePath();

        const axeGrad = ctx.createRadialGradient(0, 35, 5, 0, 35, 30);
        axeGrad.addColorStop(0, neonLime); // bright center
        axeGrad.addColorStop(0.6, mainTeal); // core
        axeGrad.addColorStop(1, darkerTeal); // dark edge
        
        // Making them transparent to match the reference
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = axeGrad;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = darkerTeal;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Metal rivet / bolt on each axe
        ctx.beginPath();
        ctx.arc(0, 38, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#64748b';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();

        // White dot pattern half-tone decal (Left side of axe wing)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.moveTo(-12, 30);
        ctx.lineTo(-20, 42);
        ctx.lineTo(-5, 46);
        ctx.lineTo(0, 35);
        ctx.closePath();
        ctx.fill();
        
        // Polka dots representing the pattern
        ctx.fillStyle = darkTeal;
        ctx.beginPath();
        ctx.arc(-10, 38, 0.8, 0, Math.PI*2);
        ctx.arc(-7, 40, 0.8, 0, Math.PI*2);
        ctx.arc(-13, 40, 0.8, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }

    // 5. Connective translucent teal ring segment uniting the axes
    ctx.beginPath();
    for(let i=0; i<3; i++) {
        const ang1 = (Math.PI * 2 / 3) * i - Math.PI / 2 + 0.3; // Right side of a bump
        const ang2 = (Math.PI * 2 / 3) * ((i+1)%3) - Math.PI / 2 - 0.3; // Left side of next bump
        ctx.arc(cx, cy, 32, ang1, ang2);
    }
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = mainTeal; // Translucent teal framework
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Wrap the central shield and avatar in an inverse scale to match Top 1 size
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.1236, 1.1236); // Undo the 0.89 scale from earlier
    ctx.translate(-cx, -cy);

    // 6. Central Shield Frame (Black outer, white inner ring)
    ctx.beginPath();
    ctx.arc(cx, cy, 21, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#f8fafc';
    ctx.stroke();

    // Outer white shield tabs (3 pieces grasping the ring)
    for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((Math.PI * 2 / 3) * i - Math.PI / 2);
        
        ctx.beginPath();
        ctx.moveTo(-6, 21);
        ctx.lineTo(6, 21);
        ctx.lineTo(8, 27);
        ctx.lineTo(0, 29);
        ctx.lineTo(-8, 27);
        ctx.closePath();
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#94a3b8';
        ctx.stroke();
        ctx.restore();
    }

    // 7. Avatar - The Knight Helm & Lightning motif
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.clip(); // Restrict drawing to center

    // Dark grey base inside
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i - Math.PI / 8;
        const x = cx + Math.cos(angle) * 12;
        const y = cy + Math.sin(angle) * 12;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = mainTeal;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore(); // End Avatar clip
    
    ctx.restore(); // Undo the 1.1236 center scale save

    ctx.restore(); // End main canvas save
    return c;
}


export function createTopSprite(color: string, pilotColor: string, modelType: number = 1): HTMLCanvasElement {
    if (modelType === 2) return createTop2Sprite(color, pilotColor);
    if (modelType === 3) return createTop3Sprite(color, pilotColor);
    if (modelType === 4) return createTop4Sprite(color, pilotColor);
    return createTop1Sprite(color, pilotColor);
}


