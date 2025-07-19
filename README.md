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
- **Snap-to-Position**: Positioning that snaps tokens to valid locations when movement is blocked.
- **Elevation Support**: 3D movement with height-based collision detection.
- **Respects Disposition**:
    - Allows movement through tokens of the same or neutral disposition.
    - Never permits a token to end its move overlapping another token, regardless of disposition.
- **Unconstrained Movement**: When the unconstrained movement toggle is active, tokens may move through and occupy spaces containing obstacles, ignoring normal collision checks.

### Visual Feedback
- **Facing Arcs**: Display token facing direction and field of view.
- **Token Boundaries**: Visual representation of token collision boundaries.
- **Obstacle Indicator**: While dragging, highlight the first token that would obstruct movement in real time.
- **Actor Info**: Displays each actor’s movement speed, providing at‑a‑glance speed information during play.
  
<p align=center>
    <img width="256" height="256" alt="obstacle-indicator" src="https://github.com/user-attachments/assets/da71d0d1-5990-4387-b5f1-94e840ca3a4f" />
</p>

## Usage
- Hold 'm' to display token boundaries and facing arcs.
- The facing-arc colour indicates each token’s disposition.
- Selecting a token changes its facing-arc to your user colour.
- By default, selection and hover borders are turned off, but you can enable them again in the Settings menu.

## Suggested Module
- Enhances token vision detection and assists in identifying which tokens should display an overlay: https://github.com/dev7355608/vision-5e

## Attribution

<p align=right>
    <img alt="GitHub Downloads (specific asset, all releases)" src="https://img.shields.io/github/downloads/stonedtroll/maleficar-manoeuvres/module.zip?style=for-the-badge&labelColor=2A2D34&color=8C2E2E">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img alt="GitHub Downloads (specific asset, latest release)" src="https://img.shields.io/github/downloads/stonedtroll/maleficar-manoeuvres/latest/module.zip?style=for-the-badge&labelColor=2A2D34&color=D97D26">
</p>

