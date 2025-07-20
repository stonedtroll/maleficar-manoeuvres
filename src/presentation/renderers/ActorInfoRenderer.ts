import type { OverlayRenderContext } from '../../domain/interfaces/OverlayRenderContext.js';

import * as PIXI from 'pixi.js';
import { MODULE_ID } from '../../config.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

export class ActorInfoRenderer {
  private readonly logger: FoundryLogger;
  private readonly lineSpacing: number = 0.25;

  constructor() {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.ActorInfoRenderer`);
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

    // Get current movement mode styling
    const currentModeStyle = context.styling?.currentMovementMode || {
      font: 'Roboto Condensed',
      fontSize: 8,
      fontColour: '#D4C8B8',
      fontWeight: '400',
      fontOpacity: 1,
      backgroundColour: '#D4C8B8',
      backgroundOpacity: 0.3
    };

    // Get the current movement mode from token
    const currentMovementMode = context.token.currentMovementMode;

    this.logger.debug('Rendering actor info', {
      speedCount: speeds.length,
      styling: speedsStyle,
      currentMovementMode,
      context: context
    });

    const speedContainers: PIXI.Container[] = [];
    let totalHeight = 0;
    const iconSize = 8; // Fixed icon size
    const iconTextSpacing = 2; // Space between icon and text
    const backgroundPadding = { x: 1, y: 0 }; // Padding for highlight background

    speeds.forEach((speed, index) => {
      const container = new PIXI.Container();

      // Debug: Log the comparison
      this.logger.debug('Speed comparison', {
        speedLabel: speed.label,
        speedLabelLower: speed.label.toLowerCase(),
        currentMovementMode: currentMovementMode,
        currentMovementModeLower: currentMovementMode?.toLowerCase(),
        willMatch: speed.label.toLowerCase() === currentMovementMode?.toLowerCase()
      });

      // Check if this speed matches the current movement mode
      const isCurrentMode =
        speed.label.toLowerCase() === currentMovementMode?.toLowerCase() ||
        speed.label.toLowerCase().includes(currentMovementMode?.toLowerCase() || '') ||
        currentMovementMode?.toLowerCase().includes(speed.label.toLowerCase());

      // Build text style using context styling
      const style = this.buildTextStyle(isCurrentMode && currentModeStyle ? currentModeStyle : speedsStyle);
      const text = new PIXI.Text(speed.label, style);

      text.resolution = window.devicePixelRatio * 2;
      text.updateText(true);

      text.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
      text.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;

      // Apply opacity from styling
      text.alpha = isCurrentMode && currentModeStyle ? currentModeStyle.fontOpacity : speedsStyle.fontOpacity;
      text.anchor.set(0, 0.5); // Centre vertically

      // Position icon and text first to calculate proper dimensions
      let iconSprite: PIXI.Sprite | null = null;

      if (speed.icon) {
        const iconTexture = PIXI.Texture.from(speed.icon);
        iconSprite = new PIXI.Sprite(iconTexture);

        // Use the appropriate colour based on current mode
        const tintColour = isCurrentMode && currentModeStyle
          ? currentModeStyle.fontColour
          : speedsStyle.fontColour;
        iconSprite.tint = this.transformColour(tintColour);
        iconSprite.alpha = isCurrentMode && currentModeStyle
          ? currentModeStyle.fontOpacity
          : speedsStyle.fontOpacity;

        iconSprite.width = iconSize;
        iconSprite.height = iconSize;
        iconSprite.anchor.set(0, 0.5); // Centre vertically
        iconSprite.position.x = 0;

        text.position.x = iconSize + iconTextSpacing;
      } else {
        text.position.x = 0;
      }

      // Draw background rectangle for current mode
      if (isCurrentMode && currentModeStyle) {
        const backgroundGraphics = new PIXI.Graphics();

        // Ensure text dimensions are calculated
        text.updateText(true);

        // Calculate background dimensions based on actual content
        const contentWidth = text.width + (speed.icon ? iconSize + iconTextSpacing : 0);
        const contentHeight = Math.max(text.height, iconSize);

        const bgWidth = contentWidth + (backgroundPadding.x * 2);
        const bgHeight = contentHeight + (backgroundPadding.y * 2);

        // Use the actual background colour from styling
        const bgColour = this.transformColour(currentModeStyle.backgroundColour || '#3E352A');
        const bgOpacity = currentModeStyle.backgroundOpacity ?? 0.8;

        this.logger.debug('Drawing background for current mode', {
          mode: speed.label,
          colour: currentModeStyle.backgroundColour,
          transformedColour: bgColour,
          opacity: bgOpacity
        });

        // Draw rectangle with actual colour
        backgroundGraphics.beginFill(bgColour, bgOpacity);
        backgroundGraphics.drawRect(
          -backgroundPadding.x,
          -bgHeight / 2,
          bgWidth,
          bgHeight
        );
        backgroundGraphics.endFill();

        // Add background FIRST
        container.addChild(backgroundGraphics);
      }

      // Add icon and text AFTER background (only if not already added)
      if (iconSprite) {
        container.addChild(iconSprite);
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

  private transformColour(colour?: string | number): number {
    // Fast path for numeric values
    if (typeof colour === 'number') {
      return colour;
    }

    // Handle string hex colours
    if (typeof colour === 'string' && colour) {
      // Remove # prefix if present
      const hex = colour.charAt(0) === '#' ? colour.slice(1) : colour;

      // Validate hex length
      if (hex.length !== 3 && hex.length !== 6) {
        this.logger.error('Invalid hex colour format:', colour);
        return 0xFFFFFF; // Default white
      }

      // Expand shorthand hex (e.g., 'F0A' -> 'FF00AA')
      const fullHex = hex.length === 3
        ? hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2)
        : hex;

      // Parse hex to number
      const parsed = parseInt(fullHex, 16);

      // Validate parsed result
      if (isNaN(parsed)) {
        this.logger.error('Failed to parse hex colour:', colour);
        return 0xFFFFFF; // Default white
      }

      return parsed;
    }

    // Default fallback
    return 0xFFFFFF; // Default white
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