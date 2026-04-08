import * as vscode from 'vscode';

import { loadParameters, queryServer } from './api';
import { writeLogFile } from './logger';
import { AssistantViewProvider } from './assistantViewProvider';

/** AI生成テキストの1件分の履歴。リトライおよびDecoration更新に使用する。 */
class HistoryItem {
	/** 生成されたテキスト */
	text: string;
	/** ドキュメント上の挿入範囲 */
	range: vscode.Range;

	constructor (text: string, range: vscode.Range) {
		this.text = text;
		this.range = range;
	}
}

export function activate(context: vscode.ExtensionContext) {

	// console.log('Congratulations, your extension "vscode-ai-novelist" is now active!');
	let timeout: NodeJS.Timer | undefined = undefined;

	// create a decorator type that we use to decorate small numbers
	const outputDecorationType = vscode.window.createTextEditorDecorationType({
		borderWidth: '1px',
		borderStyle: 'solid',
		overviewRulerColor: 'blue',
		overviewRulerLane: vscode.OverviewRulerLane.Right,
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
		light: {
			// this color will be used in light color themes
			borderColor: 'darkblue'
		},
		dark: {
			// this color will be used in dark color themes
			borderColor: 'lightblue'
		}
	});

	const continueButton = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		0
	);
	continueButton.command = 'vscode-ai-novelist.getContinuation';
	continueButton.text = '🖊️続きを書く';
	context.subscriptions.push(continueButton);
	continueButton.show();

	const retryButton = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		0
	);
	retryButton.command = 'vscode-ai-novelist.retry';
	retryButton.text = '🔃️リトライ';
	context.subscriptions.push(retryButton);
	retryButton.hide();

	const loadingButton = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		0
	);
	loadingButton.text = 'AI接続中……';
	context.subscriptions.push(loadingButton);
	loadingButton.hide();

	const assistantView = new AssistantViewProvider(context.extensionUri);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(
		AssistantViewProvider.viewType, assistantView
	));

	const outputHistory = new Map<string, HistoryItem[]>();
	const outputHistoryAt = new Map<string, Date>();

	let lock = false;

	/**
	 * AI出力を `outputHistory` / `outputHistoryAt` に記録し、ログファイルへの書き出しを行う。
	 *
	 * @param currentText 生成されたテキスト
	 * @param range ドキュメント上の挿入範囲
	 * @param activeDocument 対象ドキュメント
	 * @param parameters APIに渡したパラメータオブジェクト
	 * @param input APIに実際に送信したテキスト
	 * @param activeDir ログ保存先となるワークスペースフォルダ（undefined の場合はファイル保存をスキップ）
	 * @param renewLogFile true の場合はログファイル名を新規発行する（続きを書くコマンド用）
	 */
	async function saveLog(currentText: string, range: vscode.Range, activeDocument: vscode.TextDocument, parameters: object, input: string, activeDir: vscode.WorkspaceFolder | undefined = undefined, renewLogFile = false) {
		const uri = activeDocument.uri.toString();
		let lastGenerated: Date;
		if (outputHistory.has(uri)) {
			let tempArray = outputHistory.get(uri);
			if (tempArray) {
				tempArray.unshift(new HistoryItem(currentText, range));
			} else {
				tempArray = [new HistoryItem(currentText, range)];
			}
			outputHistory.set(uri, tempArray);
			if (renewLogFile || !outputHistoryAt.has(uri)) {
				lastGenerated = new Date();
				outputHistoryAt.set(uri, lastGenerated);
			} else {
				lastGenerated = outputHistoryAt.get(uri) ?? new Date();
			}
		} else {
			outputHistory.set(uri, [new HistoryItem(currentText, range)]);
			lastGenerated = new Date();
			outputHistoryAt.set(uri, lastGenerated);
		}

		if (activeDir) {
			await writeLogFile(activeDir, lastGenerated, currentText, parameters, input);
		}
	}

	context.subscriptions.push(vscode.commands.registerCommand('vscode-ai-novelist.getContinuation', async () => {
		if (lock) {
			vscode.window.showInformationMessage('現在AIに問い合わせ中です。');
			return;
		}

		const activeDir = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : undefined;

		const config = vscode.workspace.getConfiguration('ai_novelist_api');
		if (!config) {
			return;
		}
		const apiKey = config.apiKey;
		if (!apiKey) {
			return;
		}

		continueButton.hide();
		retryButton.hide();
		loadingButton.show();
		lock = true;

		const parameters = await loadParameters(config, activeDir);
		try {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage('エディタが選択されていません。');
				return;
			}
			const document = editor.document;
			if (!document) {
				vscode.window.showErrorMessage('ドキュメントが開かれていません。');
				return;
			}
			const { output: currentText, input } = await queryServer(apiKey, document, parameters, activeDir);

			const line = document.lineCount;
			const startAt = new vscode.Position(line - 1, document.lineAt(line - 1).text.length);
			await editor.edit(function (builder) {
				builder.replace(startAt, currentText);
			}, { undoStopBefore: true, undoStopAfter: true });

			// 履歴に追加
			const endAt = document.positionAt(document.offsetAt(startAt) + currentText.length);
			await saveLog(currentText, new vscode.Range(startAt, endAt), document, parameters, input, activeDir, true);
			retryButton.show();
		} catch (error) {
			let message = '';
			if (error instanceof Error) {
				message = error.message;
			} else if (typeof error === 'string') {
				message = error;
			}
			vscode.window.showErrorMessage('接続エラー:' + message);
		} finally {
			loadingButton.hide();
			continueButton.show();
			lock = false;
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-ai-novelist.retry', async () => {
		if (lock) {
			vscode.window.showInformationMessage('現在AIに問い合わせ中です。');
			return;
		}

		const activeDir = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : undefined;

		const config = vscode.workspace.getConfiguration('ai_novelist_api');
		if (!config) {
			return;
		}
		const apiKey = config.apiKey;
		if (!apiKey) {
			return;
		}

		continueButton.hide();
		loadingButton.show();
		lock = true;

		const parameters = await loadParameters(config, activeDir);
		try {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage('エディタが選択されていません。');
				return;
			}
			const document = editor.document;
			if (!document) {
				vscode.window.showErrorMessage('ドキュメントが開かれていません。');
				return;
			}
			const last = outputHistory.get(document.uri.toString());
			if (!last || last.length === 0) {
				vscode.window.showErrorMessage('履歴がないのでリトライできません。');
				return;
			}

			let isDelete = false;
			for (const output of last) {
				if (document.getText(output.range) === output.text) {
					await editor.edit(function (builder) {
						builder.delete(output.range);
					}, { undoStopBefore: true, undoStopAfter: false });
					isDelete = true;
					break;
				}
			}
			if (!isDelete) {
				vscode.window.showErrorMessage('過去の出力文がファイル内に見つかりませんでした。');
				return;
			}

			const { output: currentText, input } = await queryServer(apiKey, document, parameters, activeDir);

			const line = document.lineCount;
			const startAt = new vscode.Position(line - 1, document.lineAt(line - 1).text.length);
			await editor.edit(function (builder) {
				builder.replace(startAt, currentText);
			}, { undoStopBefore: false, undoStopAfter: true });

			// 履歴に追加
			const endAt = document.positionAt(document.offsetAt(startAt) + currentText.length);
			await saveLog(currentText, new vscode.Range(startAt, endAt), document, parameters, input, activeDir);
			retryButton.show();
		} catch (error) {
			let message = '';
			if (error instanceof Error) {
				message = error.message;
			} else if (typeof error === 'string') {
				message = error;
			}
			vscode.window.showErrorMessage('接続エラー:' + message);
		} finally {
			loadingButton.hide();
			continueButton.show();
			lock = false;
		}
	}));

	let activeEditor = vscode.window.activeTextEditor;

	/**
	 * アクティブエディタの `outputHistory` を参照し、最新の有効な出力範囲に青枠Decorationを適用する。
	 * 出力テキストが変更済み・削除済みの場合は Decoration を外す。
	 */
	function updateDecorations() {
		if (!activeEditor) {
			return;
		}
		const document = activeEditor.document;
		if (!document) {
			return;
		}
		const last = outputHistory.get(document.uri.toString());
		if (!last || last.length === 0) {
			return;
		}

		const decoratedOutput: vscode.DecorationOptions[] = [];
		for (const output of last) {
			if (document.getText(output.range).replace(/\r\n/g, '\n').trimEnd() === output.text.replace(/\r\n/g, '\n').trimEnd()) {
				const decoration: vscode.DecorationOptions = { range: output.range, hoverMessage: 'AI出力文' };
				decoratedOutput.push(decoration);
				break;
			}
		}
		activeEditor.setDecorations(outputDecorationType, decoratedOutput);
	}

	/**
	 * `updateDecorations` の呼び出しをスロットル制御する。
	 * テキスト変更イベントなど高頻度で発火する場合は throttle=true を指定する。
	 *
	 * @param throttle true の場合は 300ms のデバウンスを挟む
	 */
	function triggerUpdateDecorations(throttle = false) {
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		if (throttle) {
			timeout = setTimeout(updateDecorations, 300);
		} else {
			updateDecorations();
		}
	}

	if (activeEditor) {
		triggerUpdateDecorations();
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (editor) {
			retryButton.hide();
			triggerUpdateDecorations();
			const document = editor.document;
			if (!document) {
				return;
			}
			const last = outputHistory.get(document.uri.toString());
			if (!last || last.length === 0) {
				return;
			}
			for (const output of last) {
				if (document.getText(output.range) === output.text) {
					continueButton.hide();
					retryButton.show();
					continueButton.show();
					break;
				}
			}
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
			if (event.reason === undefined) {
				outputHistory.set(event.document.uri.toString(), []);
				retryButton.hide();
			}
			triggerUpdateDecorations(true);
		}
	}, null, context.subscriptions);
}

export function deactivate() {}
