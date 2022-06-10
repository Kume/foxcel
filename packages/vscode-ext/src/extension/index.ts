import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('@foxcel/vscode-ext.showsample', (a, b) => {
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

    console.log('xxxx args', a.path, a.fsPath);
    
    setTimeout(() => {
      console.log('xxxx');
      panel.webview.postMessage('hello world from ext.');
      (async () => {
        const content = new TextDecoder().decode((await vscode.workspace.fs.readFile(vscode.Uri.parse(a.path))));
        panel.webview.postMessage(content);
      })();
    }, 1000);
  });
  context.subscriptions.push(disposable);

}

export function deactivate() {}
