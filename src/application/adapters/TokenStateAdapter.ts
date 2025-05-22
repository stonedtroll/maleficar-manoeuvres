/**
 * Provides transformation services between TokenState data structure
 * and the domain model.
*/

import type { TokenState } from '../../infrastructure/events/FoundryEvents.js';
import { Vector2 } from '../../domain/value-objects/Vector2.js';
import { Rotation } from '../../domain/value-objects/Rotation.js';
import { GridlessToken } from '../../domain/entities/GridlessToken.js';

export class TokenStateAdapter {
    /**
     * Default elevation value when not specified in the token state
     */
    private readonly DEFAULT_ELEVATION = 0;

    /**
     * Transforms a TokenState into a domain GridlessToken entity.
     */
    toGridlessToken(tokenState: TokenState): GridlessToken {
        this.validateTokenState(tokenState);

        const token = this.createBaseToken(tokenState);
        this.applyOptionalProperties(token, tokenState);

        return token;
    }

    /**
     * Transforms multiple TokenStates into GridlessToken entities.
     */
    toGridlessTokens(tokenStates: TokenState[]): GridlessToken[] {
        if (!Array.isArray(tokenStates)) {
            throw new TypeError('Token states must be provided as an array');
        }

        return tokenStates.map(state => this.toGridlessToken(state));
    }

    /**
     * Validates that a token state contains all required properties.
     */
    private validateTokenState(tokenState: TokenState): void {
        if (!tokenState) {
            throw new Error('Token state cannot be null or undefined');
        }

        if (!tokenState.id || typeof tokenState.id !== 'string') {
            throw new Error(`Token state must have a valid string ID, received: ${tokenState.id}`);
        }

        if (typeof tokenState.x !== 'number' || typeof tokenState.y !== 'number') {
            throw new Error('Token state must have valid numeric x and y coordinates');
        }

        if (typeof tokenState.width !== 'number' || typeof tokenState.height !== 'number') {
            throw new Error('Token state must have valid numeric width and height');
        }
    }

    /**
     * Creates the base GridlessToken entity with required properties.
     */
    private createBaseToken(tokenState: TokenState): GridlessToken {
        const position = new Vector2(tokenState.x, tokenState.y);
        const rotation = new Rotation(tokenState.rotation ?? 0);

        return new GridlessToken(
            tokenState.id,
            tokenState.name || 'Unnamed Token',
            position,
            rotation,
            tokenState.width,
            tokenState.height,
            tokenState.scale ?? 1
        );
    }

    /**
     * Applies optional properties to a GridlessToken instance.
     */
    private applyOptionalProperties(token: GridlessToken, tokenState: TokenState): void {
        // Apply control state
        if (typeof tokenState.controlled === 'boolean') {
            token.controlled = tokenState.controlled;
        }

        // Apply disposition
        if (typeof tokenState.disposition === 'number') {
            token.disposition = tokenState.disposition;
        }

        // Apply elevation with fallback
        token.elevation = tokenState.elevation ?? this.DEFAULT_ELEVATION;
    }

    /**
     * Transforms a GridlessToken back to a partial TokenState.
     * Useful for updates and synchronisation.
     */
    toTokenState(token: GridlessToken): Partial<TokenState> {
        return {
            id: token.id,
            name: token.name,
            x: token.position.x,
            y: token.position.y,
            rotation: token.rotation.degrees,
            width: token.width,
            height: token.height,
            scale: token.scale,
            elevation: token.elevation,
            controlled: token.controlled,
            disposition: token.disposition
        };
    }
}