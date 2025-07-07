# Maleficar Manoeuvres

A movement and positioning system for Foundry VTT that enhances tactical gameplay with collision detection, snapping, and visual feedback. 

To follow the module’s development, you can read the series here: https://hashnode.stonedtroll.com/series/maleficar-manoeuvres

## Here Be Dragons

“I endeavoured to turn the ocean to steam by my will alone—only to find its waves dragging me down into oblivion.”

- Only compatible with gridless scenes.
- Limited testing performed.
- Slightly over-engineered.
- Cartful of technical debt.

## Features

### Movement System
- **Collision Detection**: 3D collision detection.
- **Movement Validation**: Path validation with obstacle detection and boundary checking.
- **Snap-to-Position**: Positioning that snaps tokens to valid locations when movement is blocked.
- **Elevation Support**: 3D movement with height-based collision detection.
- **Respects Disposition**:
    - Allows movement through tokens of the same or neutral disposition.
    - Never permits a token to end its move overlapping another token, regardless of disposition.

### Visual Feedback
- **Facing Arcs**: Display token facing direction and field of view.
- **Token Boundaries**: Visual representation of token collision boundaries.

## Usage

- Hold 'm' to display token boundaries and facing arcs.
- The facing-arc colour indicates each token’s disposition.
- Selecting a token changes its facing-arc to your user colour.
- Selection and hover default boundaries are disabled.
**Note:** Overlays only appear for tokens visible to your currently selected token. If no token is selected, it default to your controlled token(s).

## Suggested Module
- Enhances token vision detection and assists in identifying which tokens should display an overlay: https://github.com/dev7355608/vision-5e


