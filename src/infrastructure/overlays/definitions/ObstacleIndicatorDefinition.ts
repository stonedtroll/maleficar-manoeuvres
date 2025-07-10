import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

export const ObstacleIndicatorDefinition: OverlayDefinition = {
  id: 'obstacle-indicator',
  name: 'Obstacle Indicator',
  description: 'Displays visual indicators on tokens that act as movement blockers',
  category: 'gameplay',
  enabledByDefault: true,
  visibleOnStart: false,
  renderTarget: 'world',

  permissions: {
    requireLOS: true,
    requireGM: false,
    requireOwnership: false,
    requireControl: false
  },

  displayOn: {
    gridless: true,
    square: true,
    hexFlat: true,
    hexPointy: true
  },

  triggers: {
    tokenHover: false,
    tokenSelect: false,
    tokenDrag: false,
    keyPress: []
  },

  updateOn: {
    tokenMove: false,
    tokenRotate: false,
    tokenElevation: false,
    visionChange: false,
    wallChange: false,
    gridChange: false
  }
};