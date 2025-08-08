import type { OverlayRenderContext } from '../../domain/interfaces/OverlayRenderContext.js';

import * as PIXI from 'pixi.js';
import { MODULE_ID } from '../../config.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import { RenderingUtility } from '../utils/RenderingUtility.js';
import { Scaler } from '../utils/Scaler.js';

export class TokenInfoRenderer {
    private readonly logger: FoundryLogger;

    constructor() {
        this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.TokenInfoRenderer`);
    }

    render(graphics: PIXI.Graphics, context: OverlayRenderContext): void {
        RenderingUtility.prepareGraphics(graphics);

        if (!context.tokenInfo) {
            this.logger.debug('No token info provided in context');
            return;
        }

        const { 
            range, 
            rangeIcon, 
            rangeBackgroundColour,
            rangeBackgroundOpacity,
            cover, 
            coverIcon,
            coverBackgroundColour,
            coverBackgroundOpacity
        } = context.tokenInfo;

        if (!range && (cover === null || cover === undefined)) {
            this.logger.debug('No info to display');
            return;
        }

        const rangeStyle = {
            font: context.styling?.range?.font || 'Roboto Condensed',
            fontSize: Math.round(Scaler.scaleLinear(context.styling?.range?.fontSize || 9)),
            fontColour: context.styling?.range?.fontColour || '#FFFFFF',
            fontWeight: context.styling?.range?.fontWeight || '700',
            fontOpacity: context.styling?.range?.fontOpacity || 1,
            backgroundColour: rangeBackgroundColour,
            backgroundOpacity: rangeBackgroundOpacity
        };

        const coverStyle = {
            font: context.styling?.cover?.font || 'Roboto Condensed',
            fontSize: Math.round(Scaler.scaleLinear(context.styling?.cover?.fontSize || 9)),
            fontColour: context.styling?.cover?.fontColour || '#FFFFFF',
            fontWeight: context.styling?.cover?.fontWeight || '700',
            fontOpacity: context.styling?.cover?.fontOpacity || 1,
            backgroundColour: coverBackgroundColour,
            backgroundOpacity: coverBackgroundOpacity
        };

        const iconSize = Math.round(Scaler.scaleLinear(8));
        const iconTextSpacing = Math.round(Scaler.scaleLinear(2));
        const padding = { x: Math.round(Scaler.scaleLinear(1)), y: Math.round(Scaler.scaleLinear(0)) };
        const verticalSpacing = Math.round(Scaler.scaleLinear(1));

        const mainContainer = new PIXI.Container();

        let maxWidth = 0;

        let rangeContainer: PIXI.Container | null = null;
        if (range) {
            rangeContainer = this.createInfoLine(
                range,
                rangeIcon,
                rangeStyle,
                iconSize,
                iconTextSpacing,
                padding
            );
            maxWidth = Math.max(maxWidth, rangeContainer.width);
        }

        let coverContainer: PIXI.Container | null = null;
        if (cover !== null && cover !== undefined) {
            const coverText = `${cover}`;
            coverContainer = this.createInfoLine(
                coverText,
                coverIcon,
                coverStyle,
                iconSize,
                iconTextSpacing,
                padding
            );
            maxWidth = Math.max(maxWidth, coverContainer.width);
        }

        if (rangeContainer) {
            rangeContainer.position.x = (maxWidth - rangeContainer.width) / 2;
            mainContainer.addChild(rangeContainer);
        }

        if (coverContainer) {
            coverContainer.position.x = (maxWidth - coverContainer.width) / 2;

            if (rangeContainer) {
                coverContainer.position.y = rangeContainer.height + verticalSpacing;
            }
            
            mainContainer.addChild(coverContainer);
        }

        const bounds = mainContainer.getLocalBounds();
        mainContainer.pivot.set(bounds.width / 2, bounds.height / 2);
        mainContainer.position.set(0, 0);
        
        graphics.addChild(mainContainer);
        graphics.visible = true;
    }

    /**
     * Creates a single info line with optional icon and background
     */
    private createInfoLine(
        text: string,
        icon: string | undefined,
        style: any,
        iconSize: number,
        iconTextSpacing: number,
        padding: { x: number; y: number }
    ): PIXI.Container {
        const container = new PIXI.Container();
        
        const textStyle = RenderingUtility.buildTextStyle({
            ...style,
            dropShadow: false,
            stroke: false
        });
        const textElement = RenderingUtility.createOptimisedText(text, textStyle, style.fontOpacity || 1);
        
        let iconSprite: PIXI.Sprite | null = null;
        let contentWidth = textElement.width;
        let contentHeight = textElement.height;

        if (icon) {
            iconSprite = RenderingUtility.createIconSprite(
                icon,
                iconSize,
                style.fontColour,
                style.fontOpacity || 1
            );
            contentWidth += iconSize + iconTextSpacing;
            contentHeight = Math.max(contentHeight, iconSize);
        }

        if (style.backgroundColour) {
            const backgroundGraphics = new PIXI.Graphics();
            const bgOpacity = style.backgroundOpacity ?? 0.8; 
            
            const colour = new PIXI.Color(style.backgroundColour);
            
            backgroundGraphics.beginFill(colour.toNumber(), bgOpacity);
            backgroundGraphics.drawRect(
                0,
                0,
                contentWidth + padding.x, 
                contentHeight + padding.y
            );
            backgroundGraphics.endFill();
            container.addChild(backgroundGraphics);
        }

        let currentX = padding.x;
        const centreY = padding.y + contentHeight / 2;
        
        if (iconSprite) {
            iconSprite.anchor.set(0, 0.5);
            iconSprite.position.x = currentX;
            iconSprite.position.y = centreY;
            container.addChild(iconSprite);
            currentX += iconSize + iconTextSpacing;
        }
        
        textElement.anchor.set(0, 0.5);
        textElement.position.x = currentX;
        textElement.position.y = centreY;
        container.addChild(textElement);

        return container;
    }
}