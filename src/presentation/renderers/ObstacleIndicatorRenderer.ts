import type { OverlayRenderContext } from '../../domain/interfaces/OverlayRenderContext.js';

import * as PIXI from 'pixi.js';
import { MODULE_ID } from '../../config.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

/**
 * Renderer for obstacle indicator overlays
 * Displays a WebP image on tokens to indicate they are blockers
 */
export class ObstacleIndicatorRenderer {
    private readonly logger: FoundryLogger;
    private readonly textureCache: Map<string, PIXI.Texture> = new Map();

    constructor() {
        this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.ObstacleIndicatorRenderer`);
    }

    /**
     * Render obstacle indicator into the provided graphics object
     * The graphics object is already positioned by OverlayRenderingService
     */
    async render(graphics: PIXI.Graphics, context: OverlayRenderContext): Promise<void> {
        // Clear any existing drawings
        graphics.clear();
        graphics.removeChildren();

        // Extract obstacle indicator properties
        const imagePath = context.obstacle?.imagePath ?? `modules/${MODULE_ID}/assets/images/obstacle-indicator.webp`;
        const width = context.obstacle?.width ?? 32;
        const height = context.obstacle?.height ?? 32;
        const opacity = context.obstacle?.opacity ?? 0.8;
        const tintColour = this.transformObstacleColour(context.obstacle?.tintColour) ?? 0xFFFFFF;
        const rotation = context.obstacle?.rotation ?? 0;
        const blendMode = this.getBlendMode(context.obstacle?.blendMode) ?? PIXI.BLEND_MODES.NORMAL;
        const maintainAspectRatio = context.obstacle?.maintainAspectRatio ?? true;

        graphics.zIndex = 600;

        this.logger.debug('Rendering obstacle indicator', {
            imagePath,
            width,
            height,
            opacity,
            tintColour,
            rotation,
            blendMode,
            maintainAspectRatio
        });

        try {
            // Load or retrieve cached texture
            const texture = await this.loadTexture(imagePath);

            // Create sprite from texture
            const sprite = new PIXI.Sprite(texture);

            // Configure sprite properties
            sprite.anchor.set(0.5, 0.5); // Centre anchor point

            // Set dimensions - use scale for better performance
            if (maintainAspectRatio) {
                // Uniform scaling to fit within bounds
                const scale = Math.min(width / texture.width, height / texture.height);
                sprite.scale.set(scale);
            } else {
                // Stretch to exact dimensions
                sprite.scale.x = width / texture.width;
                sprite.scale.y = height / texture.height;
            }

            sprite.alpha = opacity;
            sprite.position.set(0, 0);
            sprite.tint = tintColour;
            sprite.rotation = rotation;
            sprite.blendMode = blendMode;

            // Add sprite to graphics container
            graphics.addChild(sprite);
            graphics.visible = true;

            this.logger.debug('Obstacle indicator rendered successfully', {
                spriteWidth: sprite.width,
                spriteHeight: sprite.height,
                textureWidth: texture.width,
                textureHeight: texture.height,
                scaleX: sprite.scale.x,
                scaleY: sprite.scale.y,
                position: sprite.position
            });

        } catch (error) {
            this.logger.error('Failed to render obstacle indicator', {
                error: error instanceof Error ? error.message : String(error),
                imagePath
            });

            // Fallback to simple graphics if image fails
            this.renderFallbackIndicator(graphics, context);
        }
    }

    /**
     * Load texture from path with caching
     */
    private async loadTexture(imagePath: string): Promise<PIXI.Texture> {
        // Check cache first
        if (this.textureCache.has(imagePath)) {
            const cachedTexture = this.textureCache.get(imagePath)!;
            if (!cachedTexture.destroyed) {
                return cachedTexture;
            }
            // Remove destroyed texture from cache
            this.textureCache.delete(imagePath);
        }

        // Load new texture
        const texture = await PIXI.Assets.load(imagePath);

        // Cache the texture
        this.textureCache.set(imagePath, texture);

        this.logger.debug('Texture loaded and cached', { imagePath });

        return texture;
    }

    /**
     * Render fallback indicator if image loading fails
     */
    private renderFallbackIndicator(graphics: PIXI.Graphics, context: OverlayRenderContext): void {
        // Calculate size relative to context dimensions
        const baseSize = Math.min(context.obstacle?.width ?? 0, context.obstacle?.height ?? 0, 45);
        const size = baseSize * 0.3;

        const colour = this.transformObstacleColour(context.obstacle?.tintColour) ?? 0xFF4444;
        const opacity = context.obstacle?.opacity ?? 0.8;

        this.logger.debug('Rendering fallback obstacle indicator with relative sizing', {
            baseSize,
            calculatedSize: size,
            contextDimensions: { width: context.obstacle?.width, height: context.obstacle?.height }
        });

        // Draw warning triangle scaled to token size
        graphics.beginFill(colour, opacity);
        graphics.lineStyle(Math.max(1, size * 0.1), 0x000000, 1); // Stroke width relative to size

        // Triangle vertices scaled to calculated size
        graphics.moveTo(0, -size);
        graphics.lineTo(-size * 0.866, size * 0.5);
        graphics.lineTo(size * 0.866, size * 0.5);
        graphics.closePath();

        graphics.endFill();

        // Add exclamation mark scaled to triangle size
        const markWidth = Math.max(2, size * 0.2);
        const markHeight = Math.max(4, size * 0.8);
        const dotRadius = Math.max(1, size * 0.15);

        graphics.beginFill(0xFFFFFF, 1);
        graphics.drawRect(-markWidth / 2, -markHeight / 2, markWidth, markHeight * 0.6);
        graphics.drawCircle(0, markHeight * 0.25, dotRadius);
        graphics.endFill();

        graphics.visible = true;

        this.logger.debug('Fallback obstacle indicator rendered with relative sizing', {
            triangleSize: size,
            markDimensions: { width: markWidth, height: markHeight },
            dotRadius
        });
    }

    /**
     * Transform obstacle colour from various formats to PIXI number format
     */
    private transformObstacleColour(obstacleColour?: string | number): number {
        // Handle if obstacleColour is already a number (PIXI colour format)
        if (typeof obstacleColour === 'number') {
            return obstacleColour;
        }

        // Handle string colour values
        if (typeof obstacleColour === 'string' && obstacleColour) {
            const hexColour = obstacleColour.replace('#', '');
            return parseInt(hexColour, 16);
        }

        // Default white tint for obstacles
        return 0xFFFFFF;
    }

    /**
     * Get PIXI blend mode from string
     */
    private getBlendMode(blendMode?: string): PIXI.BLEND_MODES {
        if (!blendMode) return PIXI.BLEND_MODES.NORMAL;

        switch (blendMode.toLowerCase()) {
            case 'add':
            case 'additive':
                return PIXI.BLEND_MODES.ADD;
            case 'multiply':
                return PIXI.BLEND_MODES.MULTIPLY;
            case 'screen':
                return PIXI.BLEND_MODES.SCREEN;
            case 'overlay':
                return PIXI.BLEND_MODES.OVERLAY;
            case 'darken':
                return PIXI.BLEND_MODES.DARKEN;
            case 'lighten':
                return PIXI.BLEND_MODES.LIGHTEN;
            case 'difference':
                return PIXI.BLEND_MODES.DIFFERENCE;
            case 'exclusion':
                return PIXI.BLEND_MODES.EXCLUSION;
            case 'hue':
                return PIXI.BLEND_MODES.HUE;
            case 'saturation':
                return PIXI.BLEND_MODES.SATURATION;
            case 'color':
                return PIXI.BLEND_MODES.COLOR;
            case 'luminosity':
                return PIXI.BLEND_MODES.LUMINOSITY;
            default:
                return PIXI.BLEND_MODES.NORMAL;
        }
    }

    /**
     * Preload obstacle indicator texture
     */
    async preloadTexture(imagePath: string): Promise<void> {
        try {
            await this.loadTexture(imagePath);
            this.logger.debug('Obstacle indicator texture preloaded', { imagePath });
        } catch (error) {
            this.logger.warn('Failed to preload obstacle indicator texture', {
                error: error instanceof Error ? error.message : String(error),
                imagePath
            });
        }
    }

    /**
     * Clear texture cache
     */
    clearCache(): void {
        for (const [path, texture] of this.textureCache) {
            if (!texture.destroyed) {
                texture.destroy();
            }
        }
        this.textureCache.clear();
        this.logger.debug('Obstacle indicator texture cache cleared');
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        this.clearCache();
        this.logger.debug('ObstacleIndicatorRenderer destroyed');
    }
}