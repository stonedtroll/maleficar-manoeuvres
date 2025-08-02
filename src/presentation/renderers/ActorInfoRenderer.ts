//TODO: Don't look at me, I'm ugly.
import type { OverlayRenderContext } from '../../domain/interfaces/OverlayRenderContext.js';

import * as PIXI from 'pixi.js';
import { MODULE_ID } from '../../config.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import { RenderingUtility } from '../utils/RenderingUtility.js';

export class ActorInfoRenderer {
  private readonly logger: FoundryLogger;
  private readonly lineSpacing: number = 0.25;

  constructor() {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.ActorInfoRenderer`);
  }

  render(graphics: PIXI.Graphics, context: OverlayRenderContext): void {
    RenderingUtility.prepareGraphics(graphics);

    if (!context.actorInfo) {
      this.logger.debug('No actor info provided in context');
      return;
    }

    const { speeds, weaponRanges } = context.actorInfo;

    if ((!speeds || speeds.length === 0) && (!weaponRanges || weaponRanges.length === 0)) {
      this.logger.debug('No movement speeds or weapon ranges to display');
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

    // Get weapon ranges styling
    const weaponRangesStyle = context.styling?.weaponRanges || {
      font: 'Roboto Condensed',
      fontSize: 8,
      fontColour: '#D4C8B8',
      fontWeight: '400',
      fontOpacity: 1,
      iconShape: 'circle',
      iconSize: 10,
      iconBorderColour: '#B89A67'
    };

    // Get effective range styling
    const effectiveRangeStyle = context.styling?.effectiveRange || {
      font: 'Roboto Condensed',
      fontSize: 8,
      fontColour: '#D4C8B8',
      fontWeight: '400',
      fontOpacity: 1,
      backgroundColour: '#5D1313',
      backgroundOpacity: 0.6
    };

    // Get the current movement mode from token
    const currentMovementMode = context.token.currentMovementMode;

    // Update the allContainers to store container metadata
    interface ContainerMetadata {
      container: PIXI.Container;
      height: number;
      isWeapon: boolean;
    }

    const allContainers: ContainerMetadata[] = [];
    let totalHeight = 0;
    const speedIconSize = 8; // Fixed icon size for speeds
    const iconTextSpacing = 2; // Space between icon and text
    const backgroundPadding = { x: 1, y: 0 }; // Padding for highlight background
    const categorySpacing = 6; // Space between speed and weapon categories

    // Process speeds
    speeds?.forEach((speed, index) => {
      const container = new PIXI.Container();

      // Check if this speed matches the current movement mode
      const isCurrentMode =
        speed.label.toLowerCase() === currentMovementMode?.toLowerCase() ||
        speed.label.toLowerCase().includes(currentMovementMode?.toLowerCase() || '') ||
        currentMovementMode?.toLowerCase().includes(speed.label.toLowerCase());

      // Build text style using context styling
      const style = RenderingUtility.buildTextStyle(isCurrentMode && currentModeStyle ? currentModeStyle : speedsStyle);
      const text = RenderingUtility.createOptimisedText(
        speed.label, 
        style, 
        isCurrentMode && currentModeStyle ? currentModeStyle.fontOpacity : speedsStyle.fontOpacity
      );
      text.anchor.set(0, 0.5); // Centre vertically

      // Position icon and text first to calculate proper dimensions
      let iconSprite: PIXI.Sprite | null = null;

      if (speed.icon) {
        // Use the appropriate colour based on current mode
        const tintColour = isCurrentMode && currentModeStyle
          ? currentModeStyle.fontColour
          : speedsStyle.fontColour;
        const alpha = isCurrentMode && currentModeStyle
          ? currentModeStyle.fontOpacity
          : speedsStyle.fontOpacity;

        iconSprite = RenderingUtility.createIconSprite(speed.icon, speedIconSize, tintColour, alpha);
        iconSprite.anchor.set(0, 0.5); // Override default centre anchor
        iconSprite.position.x = 0;

        text.position.x = speedIconSize + iconTextSpacing;
      } else {
        text.position.x = 0;
      }

      // Draw background rectangle for current mode
      if (isCurrentMode && currentModeStyle) {
        const backgroundGraphics = new PIXI.Graphics();

        // Ensure text dimensions are calculated
        text.updateText(true);

        // Calculate background dimensions based on actual content
        const contentWidth = text.width + (speed.icon ? speedIconSize + iconTextSpacing : 0);
        const contentHeight = Math.max(text.height, speedIconSize);

        const bgWidth = contentWidth + (backgroundPadding.x * 2);
        const bgHeight = contentHeight + (backgroundPadding.y * 2);

        // Use the actual background colour from styling
        const bgColour = currentModeStyle.backgroundColour || '#3E352A';
        const bgOpacity = currentModeStyle.backgroundOpacity ?? 0.8;

        // Draw rectangle with actual colour
        RenderingUtility.drawBackground(
          backgroundGraphics,
          -backgroundPadding.x,
          -bgHeight / 2,
          bgWidth,
          bgHeight,
          bgColour,
          bgOpacity
        );

        // Add background FIRST
        container.addChild(backgroundGraphics);
      }

      // Add icon and text AFTER background
      if (iconSprite) {
        container.addChild(iconSprite);
      }

      container.addChild(text);
      
      const containerHeight = Math.max(speedIconSize, text.height);
      allContainers.push({
        container,
        height: containerHeight,
        isWeapon: false
      });
      
      totalHeight += containerHeight;

      if (index < speeds.length - 1) {
        totalHeight += this.lineSpacing;
      }
    });

    // Add category spacing if both speeds and weapons exist
    if (speeds?.length > 0 && weaponRanges?.length > 0) {
      totalHeight += categorySpacing;
    }

    // Process weapon ranges
    weaponRanges?.forEach((weapon, index) => {
      const container = new PIXI.Container();
      
      // Safely access iconSize with proper type checking
      const weaponIconSize = 'iconSize' in weaponRangesStyle 
        ? weaponRangesStyle.iconSize 
        : 10; // Default weapon icon size
      
      // Create sub-containers for layout
      const nameContainer = new PIXI.Container();
      const rangeContainer = new PIXI.Container();
      
      // Create weapon name text
      const nameStyle = RenderingUtility.buildTextStyle(weaponRangesStyle);
      const nameText = RenderingUtility.createOptimisedText(weapon.name, nameStyle, weaponRangesStyle.fontOpacity);
      nameText.anchor.set(0, 0.5);
      
      // Position icon and name
      let iconContainer: PIXI.Container | null = null;
      if (weapon.icon) {
        iconContainer = new PIXI.Container();
        
        const iconSprite = RenderingUtility.createIconSprite(
          weapon.icon,
          weaponIconSize,
          weaponRangesStyle.fontColour,
          weaponRangesStyle.fontOpacity
        );
        iconSprite.position.set(weaponIconSize / 2, 0);

        // Create icon mask based on shape
        const iconShape = 'iconShape' in weaponRangesStyle 
          ? weaponRangesStyle.iconShape 
          : 'circle'; // Default to circle
          
        if (iconShape === 'circle') {
          const mask = new PIXI.Graphics();
          mask.beginFill(0xFFFFFF);
          mask.drawCircle(weaponIconSize / 2, 0, weaponIconSize / 2);
          mask.endFill();
          iconSprite.mask = mask;
          iconContainer.addChild(mask);
        }

        iconContainer.addChild(iconSprite);

        // Add border if specified
        const iconBorderColour = 'iconBorderColour' in weaponRangesStyle 
          ? weaponRangesStyle.iconBorderColour 
          : null;
          
        if (iconBorderColour) {
          const border = new PIXI.Graphics();
          border.lineStyle(
            1, // Default border width
            RenderingUtility.transformColour(iconBorderColour),
            1 // Full opacity
          );
          
          if (iconShape === 'circle') {
            border.drawCircle(weaponIconSize / 2, 0, weaponIconSize / 2);
          } else {
            border.drawRect(0, -weaponIconSize / 2, weaponIconSize, weaponIconSize);
          }
          
          iconContainer.addChild(border);
        }
        
        iconContainer.position.x = 0;
        nameText.position.x = weaponIconSize + iconTextSpacing;
        nameContainer.addChild(iconContainer);
      } else {
        nameText.position.x = 0;
      }
      nameContainer.addChild(nameText);
      
      // Create range texts
      const rangeStyle = RenderingUtility.buildTextStyle({
        ...weaponRangesStyle
      });
      
      // Effective range with background
      const effectiveRangeContainer = new PIXI.Container();
      const effectiveTextStyle = RenderingUtility.buildTextStyle(effectiveRangeStyle);
      const effectiveText = RenderingUtility.createOptimisedText(
        weapon.effectiveRange,
        effectiveTextStyle,
        effectiveRangeStyle.fontOpacity
      );
      effectiveText.anchor.set(0, 0.5);
      
      // Draw background for effective range
      const effectiveBg = new PIXI.Graphics();
      const effectivePadding = { x: 1, y: 0 };
      const effectiveBgWidth = effectiveText.width + effectivePadding.x;
      const effectiveBgHeight = effectiveText.height + effectivePadding.y;
      
      RenderingUtility.drawBackground(
        effectiveBg,
        -effectivePadding.x,
        -effectiveBgHeight / 2,
        effectiveBgWidth,
        effectiveBgHeight,
        effectiveRangeStyle.backgroundColour || '#5D1313', // Provide default colour
        effectiveRangeStyle.backgroundOpacity ?? 0.6
      );
      
      effectiveRangeContainer.addChild(effectiveBg);
      effectiveRangeContainer.addChild(effectiveText); 
      
      // Only create range text if weapon.range is not null
      let rangeText: PIXI.Text | null = null;
      let rangeTextContainer: PIXI.Container | null = null;
      
      if (weapon.range !== null) {
        rangeTextContainer = new PIXI.Container();
        rangeText = RenderingUtility.createOptimisedText(weapon.range, rangeStyle, weaponRangesStyle.fontOpacity);
        rangeText.anchor.set(0, 0.5);
        
        // Draw background for range text if backgroundColour is specified
        // Use type guard to check if backgroundColour exists
        if ('backgroundColour' in weaponRangesStyle && weaponRangesStyle.backgroundColour) {
          const rangeBg = new PIXI.Graphics();
          const rangePadding = { x: 1, y: 0 };
          const rangeBgWidth = rangeText.width + rangePadding.x;
          const rangeBgHeight = rangeText.height + rangePadding.y;
          
          RenderingUtility.drawBackground(
            rangeBg,
            -rangePadding.x,
            -rangeBgHeight / 2,
            rangeBgWidth,
            rangeBgHeight,
            weaponRangesStyle.backgroundColour,
            'backgroundOpacity' in weaponRangesStyle 
              ? weaponRangesStyle.backgroundOpacity ?? 0.6 
              : 0.6
          );
          
          rangeTextContainer.addChild(rangeBg);
        }
        
        rangeTextContainer.addChild(rangeText);
      }
      
      // Position range elements
      let rangeX = 0;
      effectiveRangeContainer.position.x = rangeX;
      
      if (rangeTextContainer) {
        rangeX += effectiveBgWidth + iconTextSpacing;
        rangeTextContainer.position.x = rangeX;
      }
      
      // Add all range elements to range container
      rangeContainer.addChild(effectiveRangeContainer);
      if (rangeTextContainer) {
        rangeContainer.addChild(rangeTextContainer);
      }
      
      // Position the containers
      nameContainer.position.x = 0;
      rangeContainer.position.x = nameContainer.width + iconTextSpacing;
      
      // Add containers to main container
      container.addChild(nameContainer);
      container.addChild(rangeContainer);
      
      const containerHeight = Math.max(
        weaponIconSize,
        nameText.height,
        effectiveText.height,
        rangeText?.height ?? 0
      );
      
      // Push ContainerMetadata object, not just the container
      allContainers.push({
        container,
        height: containerHeight,
        isWeapon: true
      });
      
      totalHeight += containerHeight;
      
      if (index < weaponRanges.length - 1) {
        totalHeight += this.lineSpacing;
      }
    });

    // Position all containers
    let currentY = (-totalHeight / 2) - 10;
    let speedsRendered = 0;

    allContainers.forEach((item, index) => {
      item.container.position.y = currentY;
      item.container.position.x = context.token.radius + 10;

      graphics.addChild(item.container);

      // Use the pre-calculated height for this specific container
      currentY += item.height;
      
      // Add appropriate spacing
      if (index < allContainers.length - 1) {
        currentY += this.lineSpacing;
      }

      // Add category spacing after speeds
      if (!item.isWeapon) {
        speedsRendered++;
        if (speeds && speedsRendered === speeds.length && weaponRanges?.length > 0) {
          currentY += categorySpacing;
        }
      }
    });

    graphics.visible = true;
  }
}