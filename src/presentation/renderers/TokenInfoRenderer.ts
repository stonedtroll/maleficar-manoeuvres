import type { OverlayRenderContext } from '../../domain/interfaces/OverlayRenderContext.js';

import * as PIXI from 'pixi.js';
import { MODULE_ID } from '../../config.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import { RenderingUtils } from '../utils/RenderingUtils.js';

export class TokenInfoRenderer {
    private readonly logger: FoundryLogger;

    constructor() {
        this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.TokenInfoRenderer`);
    }

    render(graphics: PIXI.Graphics, context: OverlayRenderContext): void {
        RenderingUtils.prepareGraphics(graphics);

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

        const iconSize = 10;
        const iconTextSpacing = 2;
        const padding = { x: 1, y: 0 };

        // Create text with optimised settings
        const style = RenderingUtils.buildTextStyle({
            ...rangeStyle,
            dropShadow: false,
            stroke: false
        });
        const text = RenderingUtils.createOptimisedText(range, style, rangeStyle.fontOpacity);
        text.anchor.set(0, 0.5); 

        let totalWidth = text.width;
        let iconSprite: PIXI.Sprite | null = null;

        // Add icon if provided
        if (rangeIcon) {
            iconSprite = RenderingUtils.createIconSprite(
                rangeIcon,
                iconSize,
                rangeStyle.fontColour,
                rangeStyle.fontOpacity
            );
            iconSprite.anchor.set(0, 0.5); 
            totalWidth += iconSize + iconTextSpacing;
        }

        // Create container with background
        const bgHeight = Math.max(text.height, iconSize);
        const container = RenderingUtils.createBackgroundContainer(
            totalWidth,
            bgHeight,
            rangeStyle.backgroundColour,
            rangeStyle.backgroundOpacity,
            padding
        );

        // Position elements
        if (iconSprite) {
            iconSprite.position.x = -totalWidth / 2;
            container.addChild(iconSprite);
            text.position.x = iconSprite.position.x + iconSize + iconTextSpacing;
        } else {
            text.anchor.set(0.5, 0.5);
            text.position.x = 0;
        }

        text.position.y = 0;
        container.addChild(text);

        container.position.set(0, 0);
        graphics.addChild(container);
        graphics.visible = true;
    }
}