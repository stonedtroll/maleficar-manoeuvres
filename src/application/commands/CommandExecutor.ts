import { Command } from '../commands/Command';
import { EventBus } from '../../infrastructure/events/EventBus';

export class CommandExecutor {
    private undoStack: Command<any>[] = [];
    private redoStack: Command<any>[] = [];
    private readonly maxStackSize = 50;
    private commandCounter = 0;
    
    constructor(
        private readonly eventBus: EventBus
    ) {}
    
    private generateCommandId(): string {
        return `cmd_${Date.now()}_${++this.commandCounter}`;
    }
    
    async execute<T>(command: Command<T>): Promise<T> {
        if (command.canExecute && !command.canExecute()) {
            throw new Error('Command cannot be executed');
        }
        
        const commandId = this.generateCommandId();
        const result = await command.execute();
        
        // Add to undo stack if command supports undo
        if (command.undo) {
            this.undoStack.push(command);
            if (this.undoStack.length > this.maxStackSize) {
                this.undoStack.shift();
            }
            
            // Clear redo stack on new command
            this.redoStack = [];
        }
        
        await this.eventBus.emit('command.executed', {
            commandId,
            commandType: command.constructor.name,
            timestamp: Date.now(),
            canUndo: !!command.undo,
            undoStackSize: this.undoStack.length,
            redoStackSize: this.redoStack.length
        });
        
        return result;
    }
    
    async undo(): Promise<void> {
        const command = this.undoStack.pop();
        if (!command || !command.undo) return;
        
        try {
            await command.undo();
            this.redoStack.push(command);
            
            await this.eventBus.emit('command.undone', {
                commandId: this.generateCommandId(),
                commandType: command.constructor.name,
                timestamp: Date.now(),
                canUndo: this.undoStack.length > 0,
                undoStackSize: this.undoStack.length,
                redoStackSize: this.redoStack.length
            });
        } catch (error) {
            // Restore the command to the undo stack if undo fails
            this.undoStack.push(command);
            throw new Error(`Failed to undo command: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    async redo(): Promise<void> {
        const command = this.redoStack.pop();
        if (!command) return;
        
        try {
            await command.execute();
            this.undoStack.push(command);
            
            await this.eventBus.emit('command.redone', {
                commandId: this.generateCommandId(),
                commandType: command.constructor.name,
                timestamp: Date.now(),
                canUndo: this.undoStack.length > 0,
                undoStackSize: this.undoStack.length,
                redoStackSize: this.redoStack.length
            });
        } catch (error) {
            // Restore the command to the redo stack if redo fails
            this.redoStack.push(command);
            throw new Error(`Failed to redo command: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    canUndo(): boolean {
        return this.undoStack.length > 0;
    }
    
    canRedo(): boolean {
        return this.redoStack.length > 0;
    }
}