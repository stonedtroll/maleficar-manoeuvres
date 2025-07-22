import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

export const TokenInfoDefinition: OverlayDefinition = {
  id: 'token-info',
  name: 'Token Information',
  description: 'Displays token statistics and status information',
  category: 'information',
  enabledByDefault: true,
  visibleOnStart: false,
  renderLayer: 'drawings',
  renderOnTokenMesh: false,
  zIndex: 500,

  styling: {
    range: {
      font: 'Roboto Condensed',
      fontSize: 10,
      fontColour: '#D4C8B8',
      fontWeight: '400',
      fontOpacity: 1
    },
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
      scope: 'non-controlled'
    },
    tokenDragMove: {
      scope: 'non-controlled'
    },
    keyPress: {
      keys: ['m'],
      scope: 'non-controlled'
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