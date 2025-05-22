/**
 * Foundry Infrastructure Events
 * 
 * Events that originate from Foundry VTT hooks and system interactions.
 * These are low-level events that capture raw Foundry state changes.
 * All infrastructure events use colon notation (e.g., token:update).
 */
import type { DispositionValue } from '../../domain/constants/TokenDisposition.js';

// Canvas Events
export interface CanvasInitEvent {
  canvas: Canvas;
}

export interface CanvasReadyEvent {
  canvas: Canvas;
}

export interface CanvasTeardownEvent {
  canvas: Canvas;
}

export interface CanvasPanEvent {
  position: { x: number; y: number; scale: number };
}

export interface TokensReadyEvent {
  placeableTokens: TokenState[];
  user: {
    id: string;
    colour: string;
    isGM: boolean;
  }
}

// Token Events
export interface TokenControlEvent {
  token: TokenState;
  user: {
    id: string;
    colour: string;
    isGM: boolean;
  }
}

export interface TokenState {
  // Core identification
  id: string;
  name: string;
  
  // Position and dimensions
  x: number;
  y: number;
  rotation: number;
  elevation: number;
  width: number;
  height: number;
  scale: number;
  
  // Visibility and control
  hidden: boolean;
  visible: boolean;
  controlled: boolean;
  ownedByCurrentUser: boolean;
  
  // Game mechanics
  disposition: DispositionValue;
}

export interface TokenPreUpdateEvent {
  tokenId: string;
  tokenName: string;
  currentState: TokenState;
  proposedState: Partial<TokenState>;
  updateOptions: {
    animate: boolean;
    isUndo: boolean;
    noHook: boolean;
    diff: boolean;
    recursive: boolean;
    render?: {
      renderSheet: boolean;
      renderFlags: Record<string, any>;
    };
  };
  userId: string;
}

export interface TokenUpdateEvent {
  id: string;
  currentState: TokenState;
  changedState: Partial<TokenState>;
  updateOptions: {
    animate: boolean;
    isUndo: boolean;
    noHook: boolean;
    diff: boolean;
    recursive: boolean;
    render?: {
      renderSheet: boolean;
      renderFlags: Record<string, any>;
    };
    maleficarManoeuvresValidatedMove: boolean;
  };
  placeableTokens: TokenState[];
  user: {
    id: string;
    colour: string;
    isGM: boolean;
  }
}

export interface TokenRefreshEvent {
  token: Token;
  flags: Record<string, any>;
}

export interface TokenCreateEvent {
  token: Token;
}

export interface TokenDeleteEvent {
  documentId: string;
  userId: string;
}

// Token Drag Events
export interface TokenDragStartEvent {
  id: string
  currentState: TokenState;
  position: { x: number; y: number };
  worldPosition: { x: number; y: number };
  screenPosition: { x: number; y: number };
  prevented: boolean;
  placeableTokens: TokenState[];
  user: {
    isGM: boolean;
  }
}

export interface TokenDraggingEvent {
  id: string
  currentState: TokenState;
  worldPosition: { x: number; y: number };
  screenPosition: { x: number; y: number };
  startPosition: {
    x: number;
    y: number;
    worldX: number;
    worldY: number;
  };
  prevented: boolean;
  placeableTokens: TokenState[];
  user: {
    isGM: boolean;
  }
}

export interface TokenDragEndEvent {
  id: string;
  position: { x: number; y: number };
  worldPosition: { x: number; y: number };
  screenPosition: { x: number; y: number };
  totalDelta: { x: number; y: number };
  prevented: boolean;
}

export interface TokenDragCancelEvent {
  id: string;
  position: { x: number; y: number };
  reason: string;
}

// Token Selection Events
export interface TokenSelectedEvent {
  token: TokenState;
  userId?: string;
}

export interface TokenDeselectedEvent {
  token: TokenState;
  userId?: string;
}

// Token Hover Events
export interface TokenHoverEvent {
  tokenId: string;
  token: TokenState;
  userId: string;
}

export interface TokenHoverEndEvent {
  tokenId: string;
  token: TokenState;
  userId: string;
}

// Scene Events
export interface ScenePreUpdateEvent {
  sceneId: string;
  sceneName: string;
  currentState: {
    width: number;
    height: number;
    gridSize: number;
  };
  proposedChanges: Record<string, any>;
  updateOptions: Record<string, any>;
  userId: string;
}

export interface SceneUpdateEvent {
  sceneId: string;
  sceneName: string;
  changes: Record<string, any>;
  updateOptions: Record<string, any>;
  userId: string;
}

// Wall Events
export interface WallUpdateEvent {
  type: 'create' | 'update' | 'delete';
  wallId: string;
  wallData: {
    c: number[];
    move: number;
    sense: number;
    dir: number;
    door: number;
    ds: number;
    flags: Record<string, any>;
  };
  changes?: Record<string, any>;
  userId: string;
}

// Keyboard Events
export interface KeyboardKeyDownEvent {
  key: string;
  code: string;
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta?: boolean;
  };
  repeat?: boolean;
  timestamp?: number;
  placeableTokens: TokenState[];
  user: {
    isGM: boolean;
  }
}

export interface KeyboardKeyUpEvent {
  key: string;
  code: string;
  modifiers?: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta?: boolean;
  };
  timestamp?: number;
  placeableTokens: TokenState[];
    user: {
    isGM: boolean;
  }
}

// Settings Events
export interface SettingsCloseEvent {
  // Empty event
}