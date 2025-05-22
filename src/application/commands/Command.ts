export interface Command<TResult> {
    execute(): Promise<TResult>;
    undo?(): Promise<void>;
    canExecute?(): boolean;
}