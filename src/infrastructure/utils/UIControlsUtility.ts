/**
 * Static utility class for accessing Foundry VTT UI controls.
 */
export class UIControlsUtility {
  private constructor() {
    throw new Error('UIControlsUtility is a static utility class and cannot be instantiated');
  }

  static isUnconstrainedMovementEnabled(): boolean {
    const unconstrainedMovementTool = ui.controls?.tools?.unconstrainedMovement;

    if (!unconstrainedMovementTool) {
      return false;
    }

    return unconstrainedMovementTool.active ?? false;
  }

  static isRulerToolActive(): boolean {
    return ui.controls?.tools?.ruler?.active ?? false;
  }

  static isSelectionToolActive(): boolean {
    return ui.controls?.tools?.select?.active ?? false;
  }


  static getActiveControlTool(): string | null {
    const tools = ui.controls?.tools;
    if (!tools) return null;

    for (const [toolName, tool] of Object.entries(tools)) {
      if (tool?.active) {
        return toolName;
      }
    }

    return null;
  }

  static isToolAvailable(toolName: string): boolean {
    return !!(ui.controls?.tools?.[toolName]);
  }

  static getActiveLayerName(): string | null {
    return ui.controls?.activeControl ?? null;
  }

  static isTokenLayerActive(): boolean {
    return canvas?.activeLayer?.name === 'tokens';
  }

  static canUseTool(toolName: string): boolean {
    const tool = ui.controls?.tools?.[toolName];
    if (!tool) return false;

    if (tool.permission) {
      return game.user?.hasRole(tool.permission) ?? false;
    }

    return true;
  }

  static getAvailableTools(): string[] {
    const tools = ui.controls?.tools;
    if (!tools) return [];

    return Object.keys(tools).filter(toolName => UIControlsUtility.canUseTool(toolName));
  }

  static areControlsReady(): boolean {
    return !!(canvas?.ready && ui?.controls);
  }
}