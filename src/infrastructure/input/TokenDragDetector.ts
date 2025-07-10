import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';
import type { EventBus } from '../events/EventBus.js';
import type { TokenState } from '../events/FoundryEvents.js';

export interface TokenDragState {
  token: Token;
  isDragging: boolean;
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
  dragStartTime: number;
  lastUpdate: number;
}

export interface TokenDragEvent {
  token: Token;
  state: TokenDragState;
  deltaX: number;
  deltaY: number;
  duration: number;
}

export class TokenDragDetector {
  private readonly logger: FoundryLogger;
  private readonly eventBus: EventBus;
  private readonly dragStates = new Map<string, TokenDragState>();
  private readonly dragThreshold = 5; // pixels
  private pollInterval: number | null = null;
  private isPolling = false;
  private currentlyDragging = false;
  private lastDragPosition: { x: number; y: number } | null = null;

  // Properly typed hook handlers
  private boundHandlePreUpdateToken: (
    document: TokenDocument,
    change: any,
    options: any,
    userId: string
  ) => void;
  private boundHandleUpdateToken: (
    document: TokenDocument,
    change: any,
    options: any,
    userId: string
  ) => void;
  private boundHandleRefreshToken: (
    token: Token,
    flags: any
  ) => void;
  private boundHandleControlToken: (
    token: Token,
    controlled: boolean
  ) => void;

  constructor(eventBus: EventBus) {
    // this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.TokenDragDetector`);
    // this.eventBus = eventBus;

    // // Bind hook handlers once with proper typing
    // this.boundHandlePreUpdateToken = this.handlePreUpdateToken.bind(this);
    // this.boundHandleUpdateToken = this.handleUpdateToken.bind(this);
    // this.boundHandleRefreshToken = this.handleRefreshToken.bind(this);
    // this.boundHandleControlToken = this.handleControlToken.bind(this);
  }

//   /**
//    * Initialise the drag detector
//    */
//   initialise(): void {
//     // Hook into Foundry v13's token events
//     Hooks.on('preUpdateToken', this.boundHandlePreUpdateToken);
//     Hooks.on('updateToken', this.boundHandleUpdateToken);
//     Hooks.on('refreshToken', this.boundHandleRefreshToken);
//     Hooks.on('controlToken', this.boundHandleControlToken);

//     // Check if we should start polling immediately
//     this.checkPollingState();

//     this.logger.debug('Token drag detector initialised');
// }

//   /**
//    * Check if polling should be active based on controlled tokens
//    */
//   private checkPollingState(): void {
//     const hasControlledTokens = canvas?.ready && (canvas.tokens?.controlled?.length ?? 0) > 0;

//     if (hasControlledTokens && !this.isPolling) {
//       this.startPolling();
//     } else if (!hasControlledTokens && this.isPolling) {
//       this.stopPolling();
//     }
//   }

//   /**
//    * Handle token control changes - start/stop polling as needed
//    */
//   private handleControlToken(token: Token, controlled: boolean): void {


//     // Clean up drag state if token was deselected during drag
//     if (!controlled && this.dragStates.has(token.id)) {
//       const state = this.dragStates.get(token.id);
//       if (state) {
//         this.eventBus.emit('token:dragCancel', {
//           id: state.token.id,
//           position: state.currentPosition,
//           reason: 'Token deselected'
//         });
//       }
//       this.dragStates.delete(token.id);
//     }
//     // Check if we need to start/stop polling
//     this.checkPollingState();
//   }

//   /**
//    * Start polling for drag state using mouseInteractionManager
//    */
//   private startPolling(): void {
//     if (this.isPolling) return;

//     this.isPolling = true;
//     this.logger.debug('Started drag state polling');

//     const checkDragState = () => {
//       try {
//         if (!canvas?.ready || !this.isPolling) {
//           this.pollInterval = null;
//           return;
//         }

//         const controlledTokens = canvas.tokens?.controlled || [];

//         // No controlled tokens - stop polling
//         if (controlledTokens.length === 0) {
//           this.stopPolling();
//           return;
//         }

//         if (controlledTokens[0]?.mouseInteractionManager) {
//           const token = controlledTokens[0];
//           const isDragging = token.mouseInteractionManager.isDragging;
//           // Drag just started
//           if (isDragging && !this.currentlyDragging) {
//             this.logger.debug('Drag detected starting', {
//               tokenId: token.id,
//               tokenName: token.name
//             });
//             this.currentlyDragging = true;
//             this.handlePolledDragStart(token);
//           }

//           // Handle ongoing drag movement
//           if (isDragging && this.currentlyDragging) {
//             this.handlePolledDragMove(token);
//           }

//           // Drag just ended
//           if (!isDragging && this.currentlyDragging) {
//             this.logger.debug('Drag detected ending', {
//               tokenId: token.id,
//               tokenName: token.name
//             });
//             this.currentlyDragging = false;
//             this.handlePolledDragEnd(token);
//           }
//         } else {
//           // Only warn once, not every poll
//           if (!this._warnedAboutManager) {
//             this.logger.warn('No mouseInteractionManager on token', {
//               tokenId: controlledTokens[0]?.id,
//               tokenName: controlledTokens[0]?.name
//             });
//             this._warnedAboutManager = true;
//           }
//         }
//       } catch (error) {
//         this.logger.error('Error in drag state polling', error as Error);
//       }

//       // Continue polling if we still have controlled tokens
//       if (this.isPolling && canvas?.tokens?.controlled.length > 0) {
//         this.pollInterval = window.setTimeout(checkDragState, 50);
//       } else {
//         this.stopPolling();
//       }
//     };

//     // Start the polling loop
//     checkDragState();
//   }

//   /**
//    * Stop polling
//    */
//   private stopPolling(): void {
//     if (!this.isPolling) return;

//     this.isPolling = false;
//     if (this.pollInterval) {
//       window.clearTimeout(this.pollInterval);
//       this.pollInterval = null;
//     }

//     // Clean up any active drag states
//     if (this.currentlyDragging) {
//       this.currentlyDragging = false;
//       this.cleanupAllDragStates();
//     }

//     this.logger.debug('Stopped drag state polling');
//   }

//   /**
//    * Handle drag start detected by polling
//    */
//   private handlePolledDragStart(token: Token): void {
//     const state: TokenDragState = {
//       token,
//       isDragging: true,
//       startPosition: { x: token.document.x, y: token.document.y },
//       currentPosition: { x: token.document.x, y: token.document.y },
//       dragStartTime: Date.now(),
//       lastUpdate: Date.now()
//     };

//     this.dragStates.set(token.id, state);
//     this.lastDragPosition = { x: token.document.x, y: token.document.y };

//     // Emit drag start event
//     const worldPos = canvas.mousePosition || state.startPosition;

//     // Extract token info with proper null checks
//     const placeableTokens: TokenState[] = [];
//     if (canvas?.ready && canvas.tokens?.placeables) {
//       for (const t of canvas.tokens.placeables) {
//         if (t && t.id) { // Ensure token exists and has an id
//           try {
//             placeableTokens.push(this.extractTokenState(t));
//           } catch (error) {
//             this.logger.warn('Failed to extract token info', {
//               tokenId: t.id,
//               error: error as Error
//             });
//           }
//         }
//       }
//     }

//     this.logger.debug('Emitting token:dragStart event', {
//       tokenId: token.id,
//       tokenName: token.name,
//       startPosition: state.startPosition,
//       worldPosition: worldPos,
//       placeableTokens: placeableTokens,
//       tokenMesh: token.mesh
//     });

//     this.eventBus.emit('token:dragStart', {
//       id: token.id,
//       currentState: {
//         id: token.id,
//         name: token.name,
//         x: token.document.x,
//         y: token.document.y,
//         rotation: token.document.rotation,
//         elevation: token.document.elevation,
//         hidden: token.document.hidden,
//         width: token.document.width,
//         height: token.document.height,
//         controlled: token.controlled,
//         scale: token.document.scale,
//         visible: token.visible ?? true,
//         ownedByCurrentUser: token.isOwner ?? false,
//         disposition: token.document.disposition
//       },
//       position: state.startPosition,
//       worldPosition: { x: worldPos.x, y: worldPos.y },
//       screenPosition: { x: 0, y: 0 },
//       prevented: false,
//       placeableTokens: placeableTokens,
//       user: {
//         id: game.user?.id ?? '',
//         colour: game.user?.colour ?? '',  
//         isGM: game.user?.isGM ?? false
//       }
//     });
//   }

//   private extractTokenState(token: Token): TokenState {
//     // Add defensive checks for token properties
//     if (!token || !token.id) {
//       throw new Error('Invalid token: missing id');
//     }

//     return {
//       id: token.id,
//       name: token.name || 'Eldritch',
//       ownedByCurrentUser: token.isOwner ?? false,
//       controlled: token.controlled ?? false,
//       visible: token.visible ?? true,
//       x: token.x ?? 0,
//       y: token.y ?? 0,
//       width: token.w ?? token.width ?? 1,
//       height: token.h ?? token.height ?? 1,
//       rotation: token.document?.rotation ?? 0, 
//       scale: token.document?.scale ?? 1,
//       elevation: token.document?.elevation ?? 0,
//       hidden: token.document?.hidden ?? false,
//       disposition: token.document?.disposition
//     };
//   }

//   /**
//    * Handle drag movement detected by polling
//    */
//   private handlePolledDragMove(token: Token): void {
//     const state = this.dragStates.get(token.id);
//     if (!state) return;

//     try {
//       // Get mouse position
//       let currentPos: { x: number; y: number };
      
//       if (canvas.mousePosition) {
//         // Use canvas.mousePosition
//         currentPos = {
//           x: canvas.mousePosition.x,
//           y: canvas.mousePosition.y
//         };
//       } else if (game.mouse) {
//         // Fallback to game.mouse
//         const worldPos = game.mouse.getLocalPosition(canvas.stage);
//         currentPos = {
//           x: worldPos.x,
//           y: worldPos.y
//         };
//       } else {
//         // Final fallback: use token's current position
//         currentPos = {
//           x: token.x,
//           y: token.y
//         };
//       }

//       const snapped = canvas.grid.getSnappedPoint(currentPos);
//       currentPos = {
//         x: snapped.x,
//         y: snapped.y
//       };

//       // Check if position actually changed
//       if (this.lastDragPosition &&
//         (currentPos.x !== this.lastDragPosition.x ||
//           currentPos.y !== this.lastDragPosition.y)) {

//         state.currentPosition = currentPos;
//         state.lastUpdate = Date.now();
//         this.lastDragPosition = currentPos;

//         const placeableTokens: TokenState[] = [];
//         placeableTokens.push(this.extractTokenState(token));

//         this.logger.debug('Emitting token:dragging event', {
//           tokenId: token.id,
//           tokenName: token.name,
//           currentPosition: state.currentPosition,
//           worldPosition: currentPos
//         });

//         // Emit drag move event with all required properties
//         this.eventBus.emit('token:dragging', {
//           id: token.id,
//           currentState: {
//             id: token.id,
//             name: token.name,
//             x: currentPos.x,
//             y: currentPos.y,
//             rotation: token.document.rotation,
//             elevation: token.document.elevation,
//             hidden: token.document.hidden,
//             width: token.document.width,
//             height: token.document.height,
//             controlled: token.controlled,
//             scale: token.document.scale,
//             visible: token.visible ?? true,
//             ownedByCurrentUser: token.isOwner ?? false,
//             disposition: token.document.disposition 
//           },
//           worldPosition: { x: currentPos.x, y: currentPos.y },
//           screenPosition: { x: 0, y: 0 },
//           startPosition: {
//             x: state.startPosition.x,
//             y: state.startPosition.y,
//             worldX: state.startPosition.x,
//             worldY: state.startPosition.y
//           },
//           prevented: false,
//           placeableTokens: placeableTokens,
//           user: {
//             id: game.user?.id ?? '',
//             colour: game.user?.colour ?? '',
//             isGM: game.user?.isGM ?? false
//           }
//         });
//       }
//     } catch (error) {
//       this.logger.error('Error in drag state polling', { 
//         error: error instanceof Error ? error.message : String(error) 
//       });
//     }
//   }

//   /**
//    * Handle drag end detected by polling
//    */
//   private handlePolledDragEnd(token: Token): void {
//     const state = this.dragStates.get(token.id);
//     if (!state) return;

//     // At drag end, use token.x/y for the final rendered position
//     const finalPosition = { x: token.x, y: token.y };
//     const worldPos = canvas.mousePosition || finalPosition;

//     this.eventBus.emit('token:dragEnd', {
//       id: token.id,
//       position: finalPosition,
//       worldPosition: { x: worldPos.x, y: worldPos.y },
//       screenPosition: { x: 0, y: 0 },
//       totalDelta: {
//         x: finalPosition.x - state.startPosition.x,
//         y: finalPosition.y - state.startPosition.y
//       },
//       prevented: false
//     });

//     this.dragStates.delete(token.id);
//     this.lastDragPosition = null;
//   }

//   /**
//    * Clean up all drag states
//    */
//   private cleanupAllDragStates(): void {
//     for (const [tokenId, state] of this.dragStates) {

//       this.eventBus.emit('token:dragCancel', {
//         id: tokenId,
//         position: state.currentPosition,
//         reason: 'Token deselected or canvas state changed'
//       });
//     }
//     this.dragStates.clear();
//     this.lastDragPosition = null;
//   }

//   /**
//    * Clean up resources
//    */
//   tearDown(): void {
//     this.stopPolling();
//     this.dragStates.clear();
//     Hooks.off('preUpdateToken', this.boundHandlePreUpdateToken);
//     Hooks.off('updateToken', this.boundHandleUpdateToken);
//     Hooks.off('refreshToken', this.boundHandleRefreshToken);
//     Hooks.off('controlToken', this.boundHandleControlToken);
//     this.logger.debug('Token drag detector torn down'); // Changed from info to debug
//   }

//   private _warnedAboutManager = false;
//   private _refreshCount = 0;

//   // Implement the hook handlers with proper signatures
//   private handlePreUpdateToken(
//     document: TokenDocument,
//     change: any,
//     options: any,
//     userId: string
//   ): void {
//     // Check if this is a position update
//     if ((change.x !== undefined || change.y !== undefined) && userId === (game as any).user?.id) {
//       // Get the token from the canvas
//       const token = canvas.tokens?.get(document.id);
//       if (!token) return;

//       // If we're tracking this token's drag, update its state
//       const state = this.dragStates.get(token.id);
//       if (state && state.isDragging) {
//         this.logger.debug('Token position updating during drag', {
//           tokenId: token.id,
//           newPosition: { x: change.x ?? document.x, y: change.y ?? document.y }
//         });
//       }
//     }
//   }

//   private handleUpdateToken(
//     document: TokenDocument,
//     change: any,
//     options: any,
//     userId: string
//   ): void {
//     // Handle token position updates
//     if ((change.x !== undefined || change.y !== undefined) && userId === (game as any).user?.id) {
//       // Get the token from the canvas
//       const token = canvas.tokens?.get(document.id);
//       if (!token) return;

//       const state = this.dragStates.get(token.id);
//       if (state && state.isDragging) {
//         this.logger.debug('Token position updated during drag', {
//           tokenId: token.id,
//           finalPosition: { x: document.x, y: document.y }
//         });
//       }
//     }
//   }

//   private handleRefreshToken(token: Token, flags: any): void {
//     const dragState = this.dragStates.get(token.id);

//     if (dragState?.isDragging) {
//       // Only log every 10th refresh to reduce noise
//       if (!this._refreshCount) this._refreshCount = 0;
//       this._refreshCount++;

//       if (this._refreshCount % 10 === 0) {
//         this.logger.debug('Token refreshed during drag', {
//           tokenId: token.id,
//           refreshCount: this._refreshCount
//         });
//       }

//       // Update current position using the rendered position (token.x, token.y)
//       // This gives us the live position during drag
//       if (token.x !== dragState.currentPosition.x || token.y !== dragState.currentPosition.y) {
//         dragState.currentPosition = { x: token.x, y: token.y };
//         dragState.lastUpdate = Date.now();
//       }
//     }
//   }

//   /**
//    * Check if a token is currently being dragged
//    */
//   isDragging(tokenId: string): boolean {
//     return this.dragStates.get(tokenId)?.isDragging ?? false;
//   }

//   /**
//    * Get drag state for a token
//    */
//   getDragState(tokenId: string): TokenDragState | undefined {
//     return this.dragStates.get(tokenId);
//   }

//   /**
//    * Get all active drag states
//    */
//   getActiveDrags(): TokenDragState[] {
//     return Array.from(this.dragStates.values()).filter(state => state.isDragging);
//   }
}