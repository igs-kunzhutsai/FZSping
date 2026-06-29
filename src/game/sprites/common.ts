export const SCALE = 4; // To make 1920x1080 look pixelated

export function drawPixelCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
    ctx.fillStyle = color;
    for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
            if (x * x + y * y <= r * r) {
                ctx.fillRect(Math.floor((cx + x) * SCALE), Math.floor((cy + y) * SCALE), SCALE, SCALE);
            }
        }
    }
}

export function drawPixelRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x * SCALE), Math.floor(y * SCALE), Math.floor(w * SCALE), Math.floor(h * SCALE));
}
