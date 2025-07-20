import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

export const ActorInfoDefinition: OverlayDefinition = {
  id: 'actor-info',
  name: 'Actor Information',
  description: 'Displays actor statistics and status information',
  category: 'information',
  enabledByDefault: true,
  visibleOnStart: false,
  renderLayer: 'drawings',
  renderOnTokenMesh: false,
  zIndex: 500,

  styling: {
    speeds: {
      font: 'Roboto Condensed',
      fontSize: 8,
      fontColour: '#D4C8B8',
      fontWeight: '400',
      fontOpacity: 1
    },
    currentMovementMode: {
      font: 'Roboto Condensed',
      fontSize: 8,
      fontColour: '#D4C8B8',
      fontOpacity: 1,
      fontWeight: '500',
      backgroundColour: '#4B5738',
      backgroundOpacity: 0.6
    }
  },

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