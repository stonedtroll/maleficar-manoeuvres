import type { OverlayRenderContext } from '../../domain/interfaces/OverlayRenderContext.js';

import * as PIXI from 'pixi.js';
import { MODULE_ID } from '../../config.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

export class TokenInfoRenderer {
    private readonly logger: FoundryLogger;

    constructor() {
        this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.TokenInfoRenderer`);
    }

    render(graphics: PIXI.Graphics, context: OverlayRenderContext): void {
        graphics.clear();
        graphics.removeChildren();

        if (!context.tokenInfo) {
            this.logger.debug('No token info provided in context');
            return;
        }

        const { range, rangeIcon } = context.tokenInfo;

        if (!range) {
            this.logger.debug('No range to display');
            return;
        }

        // Get styling from context or use defaults
        const rangeStyle = context.styling?.range || {
            font: 'Roboto Condensed',
            fontSize: 12,
            fontColour: '#FFFFFF',
            fontWeight: '700',
            fontOpacity: 1
        };

        this.logger.debug('Rendering token info', {
            range,
            hasIcon: !!rangeIcon
        });

        const container = new PIXI.Container();
        const iconSize = 10; // Icon size
        const iconTextSpacing = 2; // Space between icon and text

        // Create text
        const style = this.buildTextStyle(rangeStyle);
        const text = new PIXI.Text(range, style);

        text.resolution = window.devicePixelRatio * 2;
        text.updateText(true);

        text.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
        text.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;

        text.alpha = rangeStyle.fontOpacity;
        text.anchor.set(0, 0.5); // Center vertically

        let totalWidth = text.width;
        let iconSprite: PIXI.Sprite | null = null;

        // Add icon if provided
        if (rangeIcon) {
            const iconTexture = PIXI.Texture.from(rangeIcon);
            iconSprite = new PIXI.Sprite(iconTexture);

            iconSprite.tint = this.transformColour(rangeStyle.fontColour);
            iconSprite.alpha = rangeStyle.fontOpacity;

            iconSprite.width = iconSize;
            iconSprite.height = iconSize;
            iconSprite.anchor.set(0, 0.5); // Center vertically

            totalWidth += iconSize + iconTextSpacing;
        }

        // Position elements centered in the token
        if (iconSprite) {
            iconSprite.position.x = -totalWidth / 2;
            container.addChild(iconSprite);
            text.position.x = iconSprite.position.x + iconSize + iconTextSpacing;
        } else {
            text.anchor.set(0.5, 0.5); // Center both horizontally and vertically
            text.position.x = 0;
        }

        text.position.y = 0;
        container.addChild(text);

        // Center the container at token center (0,0 since graphics is already positioned)
        container.position.x = 0;
        container.position.y = 0;

        graphics.addChild(container);
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
    private buildTextStyle(rangeStyle: {
        font: string;
        fontSize: number;
        fontColour: string;
        fontWeight: string;
        fontOpacity: number;
    }): PIXI.TextStyle {

        // Cast fontWeight to TextStyleFontWeight type
        const fontWeight = rangeStyle.fontWeight as PIXI.TextStyleFontWeight;

        const styleConfig: Partial<PIXI.ITextStyle> = {
            fontFamily: rangeStyle.font,
            fontSize: rangeStyle.fontSize,
            fontWeight: fontWeight,
            fill: this.transformColour(rangeStyle.fontColour),
            align: 'center'
        };

        return new PIXI.TextStyle(styleConfig);
    }
}