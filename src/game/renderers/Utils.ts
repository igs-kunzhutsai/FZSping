export function drawCapsulePath(ctx: CanvasRenderingContext2D, radius: number = 480, centerY: number = 540) {
    const leftCenterX = 540;
    const rightCenterX = 1380;
    
    ctx.moveTo(leftCenterX, centerY - radius);
    ctx.lineTo(rightCenterX, centerY - radius);
    ctx.arc(rightCenterX, centerY, radius, -Math.PI / 2, Math.PI / 2, false);
    ctx.lineTo(leftCenterX, centerY + radius);
    ctx.arc(leftCenterX, centerY, radius, Math.PI / 2, (Math.PI * 3) / 2, false);
    ctx.closePath();
}