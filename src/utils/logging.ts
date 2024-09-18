import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;

export function initializeLogging(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Flutter Lens');
    context.subscriptions.push(outputChannel);
}

export function log(message: string) {
    if (process.env.NODE_ENV === 'development' || vscode.workspace.getConfiguration('flutterLens').get('enableDebugLogging')) {
        outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
    }
}