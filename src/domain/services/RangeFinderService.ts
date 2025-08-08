/**
 * Service for calculating 3D distances between tokens
 */

import type { Token } from '../entities/Token.js';

import { GridRepository } from '../../infrastructure/repositories/GridRepository.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';


export interface RangeResult {
    distance: number;
    units: string;
}

export class RangeFinderService {
    private readonly logger: FoundryLogger;
    private readonly gridRepository: GridRepository;

    constructor() {
        this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.RangeFinderService`);
        this.gridRepository = new GridRepository();
    }

    /**
     * Calculate the shortest 3D distance between two tokens
     * Takes into account their spatial volumes and vertical extents
     */
    distanceTo(fromToken: Token, toToken: Token): RangeResult {
        const fromVolume = fromToken.getSpatialVolume();
        const toVolume = toToken.getSpatialVolume();

        if (fromVolume.type === 'cylinder' && toVolume.type === 'cylinder') {
            // Get grid for unit conversion
            const grid = this.gridRepository.getCurrentGrid();

            // Calculate horizontal distance between cylinder centers (in pixels)
            const dx = toVolume.centre.x - fromVolume.centre.x;
            const dy = toVolume.centre.y - fromVolume.centre.y;
            const horizontalCentreDistance = Math.sqrt(dx * dx + dy * dy);

            // Calculate horizontal gap in pixels
            const horizontalGapPixels = Math.max(0, horizontalCentreDistance - fromVolume.radius - toVolume.radius);

            // Calculate vertical bounds (already in world units)
            const fromBottom = fromVolume.centre.z - fromVolume.height / 2;
            const fromTop = fromVolume.centre.z + fromVolume.height / 2;
            const toBottom = toVolume.centre.z - toVolume.height / 2;
            const toTop = toVolume.centre.z + toVolume.height / 2;

            // Calculate vertical gap (already in world units)
            const verticalGapUnits = Math.max(0,
                Math.max(fromBottom - toTop, toBottom - fromTop)
            );

            if (!grid) {
                this.logger.warn('No grid available for distance calculation');
                // Can't properly calculate without knowing the pixel-to-unit conversion
                // Just return horizontal gap in pixels as a fallback
                return {
                    distance: horizontalGapPixels,
                    units: 'px'
                };
            }

            // Convert horizontal gap to world units
            const horizontalGapUnits = grid.pixelsToUnits(horizontalGapPixels);

            // If both gaps are 0, volumes are intersecting
            if (horizontalGapUnits === 0 && verticalGapUnits === 0) {
                return {
                    distance: 0,
                    units: grid.units
                };
            }

            // Calculate 3D distance in world units
            const distance = Math.sqrt(
                horizontalGapUnits * horizontalGapUnits +
                verticalGapUnits * verticalGapUnits
            );

            return {
                distance: distance,
                units: grid.units
            };
        }

        // Fallback for other volume types
        const grid = this.gridRepository.getCurrentGrid();
        return {
            distance: 0,
            units: grid?.units ?? 'm'
        };
    }
}