import * as vscode from 'vscode';

export class AssistantViewProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'vscode-ai-novelist.assistantView';

	private _view?: vscode.WebviewView;

	public onSend: CallableFunction | undefined = undefined;

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

	resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'send':
					{
						this.onSend?.(data.text, data.writeToEditor ?? false, data.thinkingMode ?? false, data.useSelectionOnly ?? false);
					}
			}
		});
	}

	public setOutput(text: string): void {
		this._view?.webview.postMessage({
			type: 'setOutput',
			text: text
		});
	}

	public setThinking(text: string): void {
		this._view?.webview.postMessage({
			type: 'setThinking',
			text: text
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="ja">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleMainUri}" rel="stylesheet">
				<title>AIのべりすと アシスタント</title>
			</head>
			<body>
				<h3>指示</h3>
				<textarea id="input"></textarea><br>
				<div class="option-area">
					<input type="checkbox" id="write-to-editor">
					<label for="write-to-editor">エディタに出力</label>
					<input type="checkbox" id="thinking-mode" checked>
					<label for="thinking-mode">思考モード</label>
					<input type="checkbox" id="use-selection-only">
					<label for="use-selection-only">選択中はそのテキストのみ</label>
				</div>
				<div class="button-area">
					<button id="send-button">送信</button>
				</div>
				<details id="thinking-details">
					<summary>思考内容</summary>
					<textarea id="thinking" readonly="readonly"></textarea>
				</details>
				<h3>出力</h3>
				<textarea id="output" readonly="readonly"></textarea>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

/**
 * scriptのnonceに指定するランダムな文字列を取得する
 * @returns ランダムな文字列
 */
function getNonce():string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
