import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

export const ActorInfoDefinition: OverlayDefinition = {
  id: 'actor-info',
  name: 'Actor Information',
  description: 'Displays actor statistics and status information',
  category: 'information',
  enabledByDefault: true,
  visibleOnStart: false,
  renderTarget: 'world',

  permissions: {
    requireLOS: false,
    requireGM: false,
    requireOwnership: true,
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
      scope: 'controlled'
    },
    keyPress: {
      keys: ['m'],
      scope: 'owned'
    }
  },

  updateOn: {
    tokenMove: false,
    tokenRotate: false,
    visionChange: false,
    wallChange: false,
    gridChange: false,

  }
};