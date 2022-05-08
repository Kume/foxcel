import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('@foxcel/vscode-ext.showsample', () => {
    vscode.window.showInformationMessage('foxcel extension sample');
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {}
