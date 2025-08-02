import type { OverlayContextBuilder } from '../../../domain/interfaces/OverlayContextBuilder.js';
import type { Token } from '../../../domain/entities/Token.js';
import type { OverlayRenderContext } from '../../../domain/interfaces/OverlayRenderContext.js';
import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

import { MODULE_ID } from '../../../config.js';

interface TokenInfoContextOptions {
    range?: number;
    rangeUnit?: string;
    rangeBackgroundColour?: string;
}

/**
 * Context builder for token information overlays.
 */
export class TokenInfoContextBuilder implements OverlayContextBuilder<TokenInfoContextOptions> {
    buildContext(
        targetToken: Token,
        overlayDefinition: OverlayDefinition,
        options: TokenInfoContextOptions
    ): OverlayRenderContext {

        const displayRange = options.range !== undefined && options.rangeUnit !== undefined
            ? `${options.range.toFixed(1)} ${options.rangeUnit}`
            : null;

        let styling = overlayDefinition.styling;

        if (overlayDefinition.styling?.range && options.rangeBackgroundColour !== undefined) {
            // Create a new range object with all existing properties plus the background colour
            const updatedRange = {
                ...overlayDefinition.styling.range,
                backgroundColour: options.rangeBackgroundColour,
                backgroundOpacity: 0.6
            };

            styling = {
                ...overlayDefinition.styling,
                range: updatedRange
            };
        }

        return {
            overlayTypeId: 'token-info',
            renderLayer: overlayDefinition.renderLayer,
            renderOnTokenMesh: overlayDefinition.renderOnTokenMesh,
            zIndex: overlayDefinition.zIndex,
            ...(styling && { styling }),
            overlayCentre: {
                x: targetToken.centre.x,
                y: targetToken.centre.y
            },
            token: {
                id: targetToken.id,
                name: targetToken.name,
                position: {
                    x: targetToken.position.x,
                    y: targetToken.position.y
                },
                width: targetToken.width,
                height: targetToken.height,
                centre: {
                    x: targetToken.centre.x,
                    y: targetToken.centre.y
                },
                radius: targetToken.radius,
                currentMovementMode: targetToken.currentMovementMode
            },
            tokenInfo: {
                rangeIcon: `modules/${MODULE_ID}/assets/images/icons/range.webp`,
                range: displayRange,
            }
        };
    }
}