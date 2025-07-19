import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

export const FacingArcDefinition: OverlayDefinition = {
  id: 'facing-arc',
  name: 'Facing Arc',
  description: 'Visual indication of token facing direction',
  category: 'visual',
  enabledByDefault: true,
  visibleOnStart: false,
  renderLayer: 'drawings',
  renderOnTokenMesh: false,
  zIndex: 500,
  
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
    tokenDragStart: {
      scope: 'visible-and-not-hidden'
    },
    keyPress: {
      keys: ['m'],
      scope: 'visible-and-not-hidden'
    }
  },

  updateOn: {
    tokenMove: true,
    tokenRotate: true,
    visionChange: true,
    wallChange: true,
    gridChange: false
  }
};