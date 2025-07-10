/**
 * Defines the context data structure passed to overlay rendering functions. This interface provides
 * information about the rendering environment, token state, and various contextual
 * data needed for dynamic overlay visualisation.
 */

/**
 * Token information for overlay rendering.
 */
interface TokenInfo {
  /** Unique identifier of the token */
  id: string;
  
  /** Display name of the token */
  name: string;
  
  /** Optional token type classification */
  type?: string;
  
  /** Top-left position of the token */
  position: { x: number; y: number };
  
  /** Centre point of the token */
  centre: { x: number; y: number };
  
  /** Width of the token in pixels */
  width: number;
  
  /** Height of the token in pixels */
  height: number;
  
  /** Radius for circular tokens */
  radius: number;
}

/**
 * Rotation context for rotation-based overlays.
 */
interface RotationContext {
  /** Current rotation angle in degrees (0-360) */
  currentRotation: number;
  
  /** User-requested rotation before processing */
  proposedRotation?: number;
  
  /** Final rotation after snapping/processing */
  newRotation?: number;
  
  /** Change in rotation from current to new */
  deltaRotation?: number;
  
  /** Direction of rotation */
  isClockwise?: boolean;
  
  /** Whether rotation was snapped to a segment */
  isSnapped: boolean;
  
  /** Segment index if snapped (0-based) */
  snappedSegment?: number;
  
  /** Colour of the rotation arc indicator */
  arcColour: string;
  
  /** Angle of the arc to display in degrees */
  arcAngle: number;
}

/**
 * Boundary visualisation context.
 */
interface BoundaryContext {
  /** Border line width in pixels */
  borderLineWidth: number;
  
  /** Border colour in hex format */
  borderColour: string;
  
  /** Border opacity (0.0 to 1.0) */
  borderOpacity: number;
  
  /** Border radius from centre */
  borderRadius: number;
  
  /** Fill colour in hex format */
  fillColour: string;
  
  /** Fill opacity (0.0 to 1.0) */
  fillOpacity: number;
  
  /** Fill radius from centre */
  fillRadius: number;
  
  /** Shape style for the boundary */
  boundaryStyle: 'circle' | 'square' | 'hex';
  
  /** Whether to use dashed lines */
  dashed: boolean;
  
  /** Length of dash segments in pixels */
  dashLength: number;
  
  /** Length of gaps between dashes in pixels */
  gapLength: number;
}

interface ObstacleContext {
  /** Image path for the obstacle indicator */
  imagePath: string;

  /** Opacity of the obstacle indicator */
  opacity: number;

  /** Tint colour applied to the obstacle indicator */
  tintColour: string;

  /** Rotation angle of the obstacle indicator in degrees */
  rotation: number;

  /** Blend mode for rendering the obstacle indicator */
  blendMode: string;

  width: number;

  height: number;

  maintainAspectRatio: boolean;
}

/**
 * Movement context for movement-based overlays.
 */
interface MovementContext {
  /** Starting position of movement */
  from: { x: number; y: number };
  
  /** Target position of movement */
  to: { x: number; y: number };
  
  /** Optional waypoints along the movement path */
  path?: { x: number; y: number }[];

  /** Total distance of movement in pixels */
  distance: number;
}

/**
 * Visibility context for visibility-based overlays.
 */
interface VisibilityContext {
  /** Previous visibility state */
  wasVisible: boolean;
  
  /** Current visibility state */
  isVisible: boolean;
}

/**
 * User information for permission and styling.
 */
interface UserInfo {
  /** Unique identifier of the user */
  id?: string;
  
  /** User's assigned colour in hex format */
  colour?: string;
  
  /** Whether user has GM privileges */
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
  /** Unique identifier for the overlay type */
  overlayTypeId: string;
  
  /** Centre point for overlay rendering */
  overlayCentre: { x: number; y: number };
  
  /** Target container for rendering */
  renderTarget: RenderTarget;

  zIndex?: number;
  
  /** Token information */
  token: TokenInfo;
  
  /** Rotation context for rotation-based overlays */
  rotation?: RotationContext;
  
  /** Boundary visualisation context */
  boundary?: BoundaryContext;

  obstacle?: ObstacleContext;
  
  /** Movement context for movement-based overlays */
  movement?: MovementContext;
  
  /** Visibility context for visibility-based overlays */
  visibility?: VisibilityContext;
  
  /** User information for permissions and styling */
  user: UserInfo;
  
  /** Whether this is a preview render (not final) */
  isPreview?: boolean;
  
  /** Whether to animate transitions */
  animate?: boolean;
  
  /** Rendering priority for performance optimisation */
  priority?: RenderPriority;
}