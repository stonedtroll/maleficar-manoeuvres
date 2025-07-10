import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

export const TokenBoundaryDefinition: OverlayDefinition = {
  id: 'token-boundary',
  name: 'Token Boundary',
  description: 'Highlights token boundaries on hover or selection',
  category: 'visual',
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
    square: false,
    hexFlat: false,
    hexPointy: false
  },

  triggers: {
    tokenHover: false,
    tokenSelect: false,
    tokenDrag: true,
    keyPress: ['m']
  },

  updateOn: {
    tokenMove: true,
    tokenRotate: false,
    tokenElevation: false,
    visionChange: true,
    wallChange: true,
    gridChange: true
  }
};
