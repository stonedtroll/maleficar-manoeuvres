import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

export const FacingArcDefinition: OverlayDefinition = {
  id: 'facing-arc',
  name: 'Facing Arc',
  description: 'Visual indication of token facing direction',
  category: 'visual',
  enabledByDefault: true,
  visibleOnStart: false,
  renderTarget: 'canvas',
  
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
    tokenDrag: true,
    keyPress: ['m']
  },

  updateOn: {
    tokenMove: true,
    tokenRotate: true,
    tokenElevation: false,
    visionChange: true,
    wallChange: true,
    gridChange: false
  }
};