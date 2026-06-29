import { SCALE, drawPixelCircle, drawPixelRect } from './common';

export function createZombieSprite(isBig: boolean): HTMLCanvasElement {
    const size = isBig ? 48 : 24;
    const c = document.createElement('canvas');
    c.width = size * SCALE;
    c.height = size * SCALE;
    const ctx = c.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;
    const r = isBig ? 14 : 7;
    
    // Choose colors based on size
    const bodyColor = isBig ? '#4c1d95' : '#166534'; // Dark purple vs dark green
    const armColor = isBig ? '#3b0764' : '#14532d'; // Deeper purple vs deeper green
    const headColor = isBig ? '#7e22ce' : '#22c55e'; // Vibrant purple vs vibrant green
    
    // Body
    drawPixelCircle(ctx, cx, cy, r, bodyColor); 
    
    // Arms reaching forward
    const armW = isBig ? 6 : 3;
    const armH = isBig ? 10 : 5;
    drawPixelRect(ctx, cx - r - armW/2, cy - armH, armW, armH, armColor);
    drawPixelRect(ctx, cx + r - armW/2, cy - armH, armW, armH, armColor);
    
    // Head
    drawPixelCircle(ctx, cx, cy - (isBig?6:3), isBig?8:4, headColor);
    
    // Eyes
    const eyeSize = isBig ? 2 : 1;
    const eyeOff = isBig ? 3 : 2;
    drawPixelRect(ctx, cx - eyeOff, cy - (isBig?8:4), eyeSize, eyeSize, '#ef4444');
    drawPixelRect(ctx, cx + eyeOff - eyeSize, cy - (isBig?8:4), eyeSize, eyeSize, '#ef4444');
    
    return c;
}


export function createZombieBossSprite(): HTMLCanvasElement {
    const size = 96;
    const c = document.createElement('canvas');
    c.width = size * SCALE; // 384px
    c.height = size * SCALE; // 384px
    const ctx = c.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;
    const r = 28;

    // Deep heavy cyber obsidian body armor
    drawPixelCircle(ctx, cx, cy, r, '#18181b'); // base obsidian
    drawPixelCircle(ctx, cx, cy, r - 3, '#27272a'); // inner carbon highlights

    // Spiky shoulders (back spikes)
    // Left shoulder spikes - shifted out relative to r=28
    drawPixelRect(ctx, cx - r - 4, cy - 8, 6, 16, '#dc2626'); // fire red shoulder guard
    drawPixelRect(ctx, cx - r - 8, cy - 4, 6, 8, '#991b1b');  // outer spike
    // Right shoulder spikes
    drawPixelRect(ctx, cx + r - 2, cy - 8, 6, 16, '#dc2626');
    drawPixelRect(ctx, cx + r + 2, cy - 4, 6, 8, '#991b1b');

    // Giant arm claws reaching forward
    const armW = 12;
    const armH = 20;
    // Left arm
    drawPixelRect(ctx, cx - r - 6, cy - armH + 6, armW, armH, '#090d16');
    drawPixelRect(ctx, cx - r - 6, cy - armH - 4, armW, 10, '#ea580c'); // glowing orange fists
    // Right arm
    drawPixelRect(ctx, cx + r - 6, cy - armH + 6, armW, armH, '#090d16');
    drawPixelRect(ctx, cx + r - 6, cy - armH - 4, armW, 10, '#ea580c');

    // Huge scary skull head
    drawPixelCircle(ctx, cx, cy - 12, 16, '#dc2626'); // Red face
    drawPixelCircle(ctx, cx, cy - 12, 13, '#f97316'); // Orange highlights

    // Golden / yellow warning horns/crown
    drawPixelRect(ctx, cx - 8, cy - 30, 4, 8, '#eab308');
    drawPixelRect(ctx, cx + 4, cy - 30, 4, 8, '#eab308');
    drawPixelRect(ctx, cx - 2, cy - 32, 4, 6, '#fbbf24'); // Center horn

    // Glowing vicious neon red eyes
    drawPixelRect(ctx, cx - 6, cy - 16, 4, 4, '#ffffff'); // bright iris
    drawPixelRect(ctx, cx + 2, cy - 16, 4, 4, '#ffffff');
    drawPixelRect(ctx, cx - 7, cy - 17, 6, 6, '#ef4444'); // glowing red surround
    drawPixelRect(ctx, cx + 1, cy - 17, 6, 6, '#ef4444');

    return c;
}

export function createZombieBombSprite(): HTMLCanvasElement {
    const scaleFactor = 1.5;
    const size = Math.round(48 * scaleFactor); 
    const c = document.createElement('canvas');
    c.width = size * SCALE;
    c.height = size * SCALE;
    const ctx = c.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;
    const r = Math.round(14 * scaleFactor);
    
    // Choose colors: orange and brown
    const bodyColor = '#78350f'; // Dark brown
    const armColor = '#451a03'; // Deeper brown
    const headColor = '#f97316'; // Vibrant orange
    
    // Body
    drawPixelCircle(ctx, cx, cy, r, bodyColor); 
    
    // Arms reaching forward
    const armW = Math.round(6 * scaleFactor);
    const armH = Math.round(10 * scaleFactor);
    drawPixelRect(ctx, cx - r - armW/2, cy - armH, armW, armH, armColor);
    drawPixelRect(ctx, cx + r - armW/2, cy - armH, armW, armH, armColor);
    
    // Head
    drawPixelCircle(ctx, cx, cy - Math.round(6 * scaleFactor), Math.round(8 * scaleFactor), headColor);
    
    // Eyes
    const eyeSize = Math.round(2 * scaleFactor);
    const eyeOff = Math.round(3 * scaleFactor);
    drawPixelRect(ctx, cx - eyeOff, cy - Math.round(8 * scaleFactor), eyeSize, eyeSize, '#ef4444');
    drawPixelRect(ctx, cx + eyeOff - eyeSize, cy - Math.round(8 * scaleFactor), eyeSize, eyeSize, '#ef4444');
    
    return c;
}

export function createZombieBouncingSprite(): HTMLCanvasElement {
    const scaleFactor = 2.0;
    const size = Math.round(48 * scaleFactor);
    const c = document.createElement('canvas');
    c.width = size * SCALE;
    c.height = size * SCALE;
    const ctx = c.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;
    const r = Math.round(14 * scaleFactor);
    
    // Choose colors: pink
    const bodyColor = '#be185d'; // Dark pink
    const armColor = '#831843'; // Deeper pink
    const headColor = '#f472b6'; // Vibrant pink
    
    // Body
    drawPixelCircle(ctx, cx, cy, r, bodyColor); 
    
    // Arms reaching forward
    const armW = Math.round(6 * scaleFactor);
    const armH = Math.round(10 * scaleFactor);
    drawPixelRect(ctx, cx - r - armW/2, cy - armH, armW, armH, armColor);
    drawPixelRect(ctx, cx + r - armW/2, cy - armH, armW, armH, armColor);
    
    // Head
    drawPixelCircle(ctx, cx, cy - Math.round(6 * scaleFactor), Math.round(8 * scaleFactor), headColor);
    
    // Eyes
    const eyeSize = Math.round(2 * scaleFactor);
    const eyeOff = Math.round(3 * scaleFactor);
    drawPixelRect(ctx, cx - eyeOff, cy - Math.round(8 * scaleFactor), eyeSize, eyeSize, '#ffffff'); // White eyes for contrast
    drawPixelRect(ctx, cx + eyeOff - eyeSize, cy - Math.round(8 * scaleFactor), eyeSize, eyeSize, '#ffffff');
    
    return c;
}
