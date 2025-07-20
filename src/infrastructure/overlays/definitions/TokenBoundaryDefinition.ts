import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

export const TokenBoundaryDefinition: OverlayDefinition = {
  id: 'token-boundary',
  name: 'Token Boundary',
  description: 'Highlights token boundaries on hover or selection',
  category: 'visual',
  enabledByDefault: true,
  visibleOnStart: false,
  renderLayer: 'tokens',
  renderOnTokenMesh: false,
  zIndex: 190,

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
    tokenDragStart: {
      scope: 'visible-and-not-hidden'
    },
    tokenDragMove: {
      scope: 'preview'
    },
    keyPress: {
      keys: ['m'],
      scope: 'visible-and-not-hidden'
    }
  },

  updateOn: {
    tokenMove: true,
    tokenRotate: false,
    visionChange: true,
    wallChange: true,
    gridChange: true
  }
};
