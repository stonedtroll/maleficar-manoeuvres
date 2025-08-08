import type { OverlayContextBuilder } from '../../../domain/interfaces/OverlayContextBuilder.js';
import type { Token } from '../../../domain/entities/Token.js';
import type { OverlayRenderContext } from '../../../domain/interfaces/OverlayRenderContext.js';
import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

interface TokenInfoContextOptions {
    rangeIcon: string;
    displayRange: string;
    rangeBackgroundColour: string;
    rangeBackgroundOpacity: number;
    coverIcon: string;
    displayCover: string;
    coverBackgroundColour: string;
    coverBackgroundOpacity: number; 
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
        return {
            overlayTypeId: 'token-info',
            renderLayer: overlayDefinition.renderLayer,
            renderOnTokenMesh: overlayDefinition.renderOnTokenMesh,
            zIndex: overlayDefinition.zIndex,
            ...(overlayDefinition.styling && { styling: overlayDefinition.styling }),
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
                rangeIcon: options.rangeIcon,
                range: options.displayRange,
                rangeBackgroundColour: options.rangeBackgroundColour,
                rangeBackgroundOpacity: options.rangeBackgroundOpacity,
                coverIcon: options.coverIcon,
                cover: options.displayCover,
                coverBackgroundColour: options.coverBackgroundColour,
                coverBackgroundOpacity: options.coverBackgroundOpacity
            }
        };
    }
}