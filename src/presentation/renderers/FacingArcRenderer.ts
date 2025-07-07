import type { OverlayRenderContext } from '../../domain/interfaces/OverlayRenderContext.js';
import { MODULE_ID } from '../../config.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

export class FacingArcRenderer {
  private readonly logger: FoundryLogger;

  constructor() {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.FacingArcRenderer`);
  }

  /**
   * Render facing arc into the provided graphics object
   * The graphics object is already positioned by OverlayRenderingService
   */
  render(graphics: PIXI.Graphics, context: OverlayRenderContext): void {
    // Clear any existing drawings
    graphics.clear();

    // Get token parameters
    const tokenWidth = context.token.width;
    const tokenHeight = context.token.height;
    const radius = context.token.radius;
    const arcAngle = (context.rotation?.arcAngle ?? 20) * Math.PI / 180;

    // Determine rotation - use degrees from context or token document
    const rotation = context.rotation?.currentRotation ?? 0;

    // Calculate arc angles
    const facingAngle = ((rotation - 270) * (Math.PI / 180) + 2 * Math.PI) % (2 * Math.PI);
    const startAngle = facingAngle - arcAngle / 2;
    const endAngle = facingAngle + arcAngle / 2;
    const colour = this.transformArcColour(context.rotation?.arcColour);

    graphics.lineStyle({
      width: 2,
      color: colour,
      alpha: 0.8,
      cap: PIXI.LINE_CAP.ROUND
    });

    graphics.arc(0, 0, radius, startAngle, endAngle, false); // Draw the arc

    this.logger.debug('Rendered facing arc', {
      rotation,
      radius,
      colour: colour.toString(16),
      startAngle: startAngle * 180 / Math.PI,
      endAngle: endAngle * 180 / Math.PI,
      tokenDimensions: { width: tokenWidth, height: tokenHeight }
    });
  }

  private transformArcColour(arcColour?: string | number): number {
    // Handle if arcColour is already a number (PIXI colour format)
    if (typeof arcColour === 'number') {
      return arcColour;
    }
    
    // Handle string colour values
    if (typeof arcColour === 'string' && arcColour) {
      const hexColour = arcColour.replace('#', '');
      return parseInt(hexColour, 16);
    }
    
    // Default bronze colour
    return 0x8A6A1C;
  }
}