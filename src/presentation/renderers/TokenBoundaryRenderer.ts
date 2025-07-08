import type { OverlayRenderContext } from '../../domain/interfaces/OverlayRenderContext.js';

import * as PIXI from 'pixi.js';
import { MODULE_ID } from '../../config.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

/**
 * Renderer for token boundary overlays
 * Displays a visual boundary around the token to indicate its physical space
 */
export class TokenBoundaryRenderer {
  private readonly logger: FoundryLogger;

  constructor() {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.TokenBoundaryRenderer`);
  }

  /**
   * Render token boundary into the provided graphics object
   * The graphics object is already positioned by OverlayRenderingService
   */
  render(graphics: PIXI.Graphics, context: OverlayRenderContext): void {
    // Clear any existing drawings
    graphics.clear();

    // Extract all style properties from BoundaryStyle
    const borderLineWidth = context.boundary?.borderLineWidth ?? 1;
    const borderColour = this.transformBoundaryColour(context.boundary?.borderColour) ?? 0x8A6A1C;
    const borderOpacity = context.boundary?.borderOpacity ?? 0.9;
    const borderRadius = context.boundary?.borderRadius ?? 0;
    const fillColour = this.transformBoundaryColour(context.boundary?.fillColour) ?? 0x2A3A28;
    const fillOpacity = context.boundary?.fillOpacity ?? 0.7;
    const fillRadius = borderRadius - borderLineWidth / 2;
    const dashed = context.boundary?.dashed ?? false;
    const dashLength = context.boundary?.dashLength ?? 5;
    const gapLength = context.boundary?.gapLength ?? 5;

    /*     // Use token's bounds for radius calculation
        const baseRadius = Math.max(token.w, token.h) / 2;
        const fillRadius = baseRadius - borderLineWidth / 2; */

    this.logger.debug('Rendering token boundary', {
      borderLineWidth,
      borderColour,
      borderOpacity,
      borderRadius,
      fillColour,
      fillOpacity,
      fillRadius,
      dashed,
      dashLength,
      gapLength
    });

    // Draw fill with its own opacity
    graphics.beginFill(fillColour, fillOpacity);
    graphics.drawCircle(0, 0, fillRadius);
    graphics.endFill();

    // Draw border with its own opacity
    graphics.lineStyle({
      width: borderLineWidth,
      color: borderColour,
      alpha: borderOpacity,
      cap: PIXI.LINE_CAP.ROUND,
      join: PIXI.LINE_JOIN.ROUND
    });

    if (dashed) {
      this.drawDashedCircle(graphics, 0, 0, borderRadius, dashLength, gapLength);
    } else {
      graphics.drawCircle(0, 0, borderRadius);
    }

    graphics.visible = true;
  }

  private drawDashedCircle(
    graphics: PIXI.Graphics,
    x: number,
    y: number,
    radius: number,
    dashLength: number,
    gapLength: number
  ): void {
    const circumference = 2 * Math.PI * radius;
    const dashCount = Math.floor(circumference / (dashLength + gapLength));
    const angleStep = (2 * Math.PI) / dashCount;

    for (let i = 0; i < dashCount; i++) {
      const startAngle = i * angleStep;
      const endAngle = startAngle + (dashLength / circumference) * 2 * Math.PI;

      graphics.arc(x, y, radius, startAngle, endAngle, false);
      graphics.moveTo(
        x + radius * Math.cos(endAngle + (gapLength / circumference) * 2 * Math.PI),
        y + radius * Math.sin(endAngle + (gapLength / circumference) * 2 * Math.PI)
      );
    }
  }

  /**
   * Draw square boundary
   */
  private drawSquareBoundary(graphics: PIXI.Graphics, width: number, height: number): void {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    graphics.drawRect(-halfWidth, -halfHeight, width, height);
  }

  /**
   * Draw hexagonal boundary
   */
  private drawHexagonalBoundary(graphics: PIXI.Graphics, radius: number): void {
    const sides = 6;
    const angleStep = (Math.PI * 2) / sides;

    graphics.moveTo(radius, 0);

    for (let i = 1; i <= sides; i++) {
      const angle = angleStep * i;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      graphics.lineTo(x, y);
    }

    graphics.closePath();
  }

  /**
   * Apply dash pattern to graphics (simulated with multiple line segments)
   */
  private applyDashPattern(graphics: PIXI.Graphics, pattern: number[]): void {
    // Note: PIXI v7 doesn't have native dash support
    // This would need custom implementation if dashed lines are required
    this.logger.debug('Dash pattern requested but not implemented in PIXI v7', { pattern });
  }

  /**
   * Transform boundary colour from various formats to PIXI number format
   */
  private transformBoundaryColour(boundaryColour?: string | number): number {
    // Handle if boundaryColour is already a number (PIXI colour format)
    if (typeof boundaryColour === 'number') {
      return boundaryColour;
    }

    // Handle string colour values
    if (typeof boundaryColour === 'string' && boundaryColour) {
      const hexColour = boundaryColour.replace('#', '');
      return parseInt(hexColour, 16);
    }

    // Default blue colour for boundaries
    return 0x4B61D1;
  }
}