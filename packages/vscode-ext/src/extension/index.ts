import * as vscode from 'vscode';
import {BackToFrontMessage, FrontToBackMessage} from '@foxcel/core/dist/messages';
import {loadFile} from './loadFile';
import {saveFile} from './saveFile';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('@foxcel/vscode-ext.showsample', (a: vscode.Uri, b) => {
    const panel = vscode.window.createWebviewPanel('@foxcel/vscode-ext.view', 'foxcel', vscode.ViewColumn.One, {
      enableScripts: true,
    });
    const scriptUrl = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist/view.js'));
    const sendMessage = (message: BackToFrontMessage) => {
      panel.webview.postMessage(message);
    };

    panel.webview.html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Webview</title>
    <script defer src="${scriptUrl}"></script>
    </head>
    <body><div id="root" /></body>
    </html>
    `;

    (async () => {
      const result = await loadFile(a);
      // console.log(result);
      sendMessage(result);
    })();

    panel.webview.onDidReceiveMessage(async (message: FrontToBackMessage) => {
      // console.log(message)
      switch (message.type) {
        case 'saveFile':
          await saveFile(a, message);
          break;
      }
    });
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {}
