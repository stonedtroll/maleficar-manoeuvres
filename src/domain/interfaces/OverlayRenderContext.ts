/**
 * Defines the context data structure passed to overlay rendering functions. This interface provides
 * information about the rendering environment, token state, and various contextual
 * data needed for dynamic overlay visualisation.
 */

/**
 * Token information for overlay rendering.
 */
interface TokenInfo {

  id: string;
  name: string;
  type?: string;
  position: { x: number; y: number };
  centre: { x: number; y: number };
  width: number;
  height: number;
  radius: number;
}

/**
 * Rotation context for rotation-based overlays.
 */
interface RotationContext {

  currentRotation: number;
  proposedRotation?: number;
  newRotation?: number;
  deltaRotation?: number;
  isClockwise?: boolean;
  isSnapped: boolean;
  snappedSegment?: number;
  arcColour: string;
  arcAngle: number;
}

/**
 * Boundary visualisation context.
 */
interface BoundaryContext {

  borderLineWidth: number;
  borderColour: string;
  borderOpacity: number;
  borderRadius: number;
  fillColour: string;
  fillOpacity: number;
  fillRadius: number;
  boundaryStyle: 'circle' | 'square' | 'hex';
  dashed: boolean;
  dashLength: number;
  gapLength: number;
}

interface ObstacleContext {

  imagePath: string;
  opacity: number;
  tintColour: string;
  rotation: number;
  blendMode: string;
  width: number;
  height: number;
  maintainAspectRatio: boolean;
}

/**
 * Movement context for movement-based overlays.
 */
interface MovementContext {

  from: { x: number; y: number };
  to: { x: number; y: number };
  path?: { x: number; y: number }[];
  distance: number;
}

/**
 * Visibility context for visibility-based overlays.
 */
interface VisibilityContext {

  wasVisible: boolean;
  isVisible: boolean;
}

interface actorInfoContext {

  speeds: SpeedContext[];
  weaponRange: number;
}

interface SpeedContext {

  icon: string;
  label: string;
  font: string;
  fontSize: number;
  fontColour: string;
  fontOpacity: number;
  backgroundColour?: string;
  backgroundOpacity?: number;
}

interface UserInfo {

  id?: string;
  colour?: string;
  isGM: boolean;
}

/**
 * Render priority levels.
 */
type RenderPriority = 'low' | 'normal' | 'high';

/**
 * Render target types.
 */
export type RenderTarget = 'world' | 'mesh';

/**
 * Context data passed to overlay render functions.
 * Provides information about the rendering environment
 * and token state for dynamic overlay visualisation.
 */
export interface OverlayRenderContext {

  overlayTypeId: string;
  overlayCentre: { x: number; y: number };
  renderTarget: RenderTarget;
  zIndex?: number;
  token: TokenInfo;
  actorInfo?: actorInfoContext;
  rotation?: RotationContext;
  boundary?: BoundaryContext;
  obstacle?: ObstacleContext;
  movement?: MovementContext;
  visibility?: VisibilityContext;
  user: UserInfo;
  isPreview?: boolean;
  animate?: boolean;
  priority?: RenderPriority;
}