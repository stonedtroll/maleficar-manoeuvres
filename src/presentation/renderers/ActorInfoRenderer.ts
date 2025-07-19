import type { OverlayRenderContext } from '../../domain/interfaces/OverlayRenderContext.js';

import * as PIXI from 'pixi.js';
import { MODULE_ID } from '../../config.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

export class ActorInfoRenderer {
  private readonly logger: FoundryLogger;
  private readonly defaultTextStyle: Partial<PIXI.ITextStyle>;
  private readonly backgroundPadding: number = 8;
  private readonly lineSpacing: number = 0.25;

  constructor() {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.ActorInfoRenderer`);

    // High-quality default text style for crisp rendering
    this.defaultTextStyle = {
      fontFamily: 'Roboto Condensed',
      fontSize: 14,
      fontWeight: '400',
      fill: 0xFFFFFF,
      align: 'left',
    };
  }

  render(graphics: PIXI.Graphics, context: OverlayRenderContext): void {
    graphics.clear();
    graphics.removeChildren();

    if (!context.actorInfo) {
      this.logger.debug('No actor info provided in context');
      return;
    }

    const { speeds } = context.actorInfo;

    if (!speeds || speeds.length === 0) {
      this.logger.debug('No movement speeds to display');
      return;
    }

    // Get styling from context or use defaults
    const speedsStyle = context.styling?.speeds || {
      font: 'Roboto Condensed',
      fontSize: 8,
      fontColour: '#D4C8B8',
      fontWeight: '400',
      fontOpacity: 1
    };

    this.logger.debug('Rendering actor info', {
      speedCount: speeds.length,
      styling: speedsStyle,
      context: context
    });

    const speedContainers: PIXI.Container[] = [];
    let totalHeight = 0;
    const iconSize = 12; // Fixed icon size
    const iconTextSpacing = 2; // Space between icon and text

    speeds.forEach((speed, index) => {
      const container = new PIXI.Container();
      
      // Build text style using context styling
      const style = this.buildTextStyle(speedsStyle);
      const text = new PIXI.Text(speed.label, style);

      text.resolution = window.devicePixelRatio * 2;
      text.updateText(true);

      text.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      text.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;

      // Apply opacity from styling
      text.alpha = speedsStyle.fontOpacity;
      text.anchor.set(0, 0.5); // Centre vertically

      if (speed.icon) {
        const iconTexture = PIXI.Texture.from(speed.icon);
        const iconSprite = new PIXI.Sprite(iconTexture);
        
        // Use the same colour as text for icon tint
        iconSprite.tint = this.transformColour(speedsStyle.fontColour);
        iconSprite.alpha = speedsStyle.fontOpacity;

        iconSprite.width = iconSize;
        iconSprite.height = iconSize;
        iconSprite.anchor.set(0, 0.5); // Centre vertically
        iconSprite.position.x = 0;
        
        text.position.x = iconSize + iconTextSpacing;
        
        container.addChild(iconSprite);
      } else {
        text.position.x = 0;
      }
      
      container.addChild(text);
      speedContainers.push(container);
      
      const containerHeight = speed.icon ? Math.max(iconSize, text.height) : text.height;
      totalHeight += containerHeight;
      
      if (index < speeds.length - 1) {
        totalHeight += this.lineSpacing;
      }
    });

    this.logger.debug('Total height for speed containers:', {
      totalHeight: totalHeight,
      containerCount: speedContainers.length
    });

    let currentY = (-totalHeight / 2) - 10;

    speedContainers.forEach((container, index) => {
      container.position.y = currentY;
      container.position.x = context.token.radius + 10;
      graphics.addChild(container);

      const hasIcon = speeds?.[index]?.icon;
      const textHeight = (container.children.find(child => child instanceof PIXI.Text) as PIXI.Text)?.height || 0;
      const containerHeight = hasIcon ? Math.max(iconSize, textHeight) : textHeight;
      
      currentY += containerHeight;
      if (index < speedContainers.length - 1) {
        currentY += this.lineSpacing;
      }
    });

    graphics.visible = true;
  }

  private drawBackground(graphics: PIXI.Graphics, totalHeight: number, textElements: PIXI.Text[]): void {
    if (textElements.length === 0) return;

    // Calculate maximum text width
    let maxWidth = 0;
    textElements.forEach(text => {
      maxWidth = Math.max(maxWidth, text.width);
    });

    const bgWidth = maxWidth + (this.backgroundPadding * 2);
    const bgHeight = totalHeight + (this.backgroundPadding * 2);
    const bgX = -bgWidth / 2;
    const bgY = -bgHeight / 2;

    // Draw background with rounded corners
    graphics.beginFill(0x000000, 0.8);
    graphics.lineStyle(1, 0xFFFFFF, 0.3);
    graphics.drawRoundedRect(bgX, bgY, bgWidth, bgHeight, 6);
    graphics.endFill();
  }

  /**
   * Calculate total height needed for all text elements.
   * Uses line height for consistent spacing.
   */
  private calculateTotalHeight(speedCount: number, fontSize: number): number {
    const lineHeight = fontSize;
    const totalSpacing = (speedCount - 1) * this.lineSpacing;
    return (lineHeight * speedCount * 1.2) + totalSpacing;
  }

  private transformColour(colour?: string | number): number {
    if (typeof colour === 'number') {
      return colour;
    }

    if (typeof colour === 'string' && colour) {
      const hexColour = colour.replace('#', '');
      return parseInt(hexColour, 16);
    }

    return 0xFFFFFF; // Default white for text
  }

  /**
   * Build text style from context styling configuration
   */
  private buildTextStyle(speedsStyle: {
    font: string;
    fontSize: number;
    fontColour: string;
    fontWeight: string;
    fontOpacity: number;
  }): PIXI.TextStyle {
    
    // Cast fontWeight to TextStyleFontWeight type
    const fontWeight = speedsStyle.fontWeight as PIXI.TextStyleFontWeight;
    
    const styleConfig: Partial<PIXI.ITextStyle> = {
      fontFamily: speedsStyle.font,
      fontSize: speedsStyle.fontSize,
      fontWeight: fontWeight,
      fill: this.transformColour(speedsStyle.fontColour),
      align: 'left'
    };

    return new PIXI.TextStyle(styleConfig);
  }
}