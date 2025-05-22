import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

export const FacingArcDefinition: OverlayDefinition = {
  id: 'facing-arc',
  displayName: 'Facing Arc',
  description: 'Visual indication of token facing direction',
  category: 'visual',
  enabledByDefault: true,
  visibleOnStart: true,
  usePermissionSystem: true,

  displayOn: {
    gridless: true,
    square: true,
    hexFlat: true,
    hexPointy: true
  },

  triggers: {},

  updateOn: {
    tokenMove: true,
    tokenRotate: true,
    tokenElevation: false,
    visionChange: true,
    wallChange: true,
    gridChange: false
  },
};