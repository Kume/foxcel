import * as vscode from 'vscode';
import {dirUri, fileNameOfUri, VSCodeStorage} from './VSCodeStorage';
import {loadFile} from '@foxcel/core/dist/FileLoader';
import YamlDataFormatter from '@foxcel/core/dist/Storage/YamlDataFormatter';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('@foxcel/vscode-ext.showsample', (a: vscode.Uri, b) => {
    const panel = vscode.window.createWebviewPanel('@foxcel/vscode-ext.view', 'foxcel', vscode.ViewColumn.One, {
      enableScripts: true,
    });
    const scriptUrl = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist/view.js'));

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

    const storage = new VSCodeStorage(dirUri(a));
    (async () => {
      const result = await loadFile(storage, [fileNameOfUri(a)], new YamlDataFormatter());
      console.log(result);
      panel.webview.postMessage({t: 'loadFull', result});
    })();
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {}
