import * as vscode from 'vscode';

import { loadParameters, queryServer, initializeWorkspaceFiles } from './api';
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
	assistantView.onSend = async (userInput: string, writeToEditor: boolean, thinkingMode: boolean, useSelectionOnly: boolean, autoContinueThink: boolean) => {
		if (lock) {
			vscode.window.showInformationMessage('現在AIに問い合わせ中です。');
			return;
		}
		const activeDir = vscode.workspace.workspaceFolders?.[0];
		const config = vscode.workspace.getConfiguration('ai_novelist_api');
		const apiKey = config.apiKey;
		if (!apiKey) {
			vscode.window.showErrorMessage('APIキーが設定されていません。');
			return;
		}
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('エディタが選択されていません。');
			return;
		}
		const parameters = await loadParameters(config, activeDir);
		continueButton.hide();
		retryButton.hide();
		loadingButton.show();
		lock = true;
		try {
			let assistantSelections: vscode.Selection[] | undefined = undefined;
			if (useSelectionOnly) {
				const nonEmpty = editor.selections.filter(s => !s.isEmpty);
				if (nonEmpty.length > 0) {
					assistantSelections = nonEmpty;
				}
			}
			const { output, input, think, rawOutput } = await queryServer(config.apiKey, editor.document, parameters, activeDir, assistantSelections, { userInput, thinkingMode, autoContinueThink });

			assistantView.setThinking(think);
			assistantView.setOutput(output);

			const endLine = editor.document.lineCount - 1;
			const startAt = new vscode.Position(endLine, editor.document.lineAt(endLine).text.length);
			let logRange = new vscode.Range(startAt, startAt);
			if (writeToEditor && output) {
				await editor.edit(function (builder) {
					builder.replace(startAt, output);
				}, { undoStopBefore: true, undoStopAfter: true });
				const endAt = editor.document.positionAt(editor.document.offsetAt(startAt) + output.length);
				logRange = new vscode.Range(startAt, endAt);
			}
			await saveLog(rawOutput, logRange, editor.document, parameters, input, activeDir, true);
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
	};

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

	/**
	 * APIコマンドの共通処理（lock・ステータスバー表示・エディタ検証・エラーハンドリング）をまとめて実行する。
	 *
	 * @param hideRetryOnStart 開始時に `retryButton` を非表示にするかどうか（retry コマンド時は false）
	 * @param body APIコール本体。`queryServer` 呼び出しと結果の反映を行う
	 */
	async function executeApiCommand(
		hideRetryOnStart: boolean,
		body: (ctx: {
			editor: vscode.TextEditor;
			document: vscode.TextDocument;
			apiKey: string;
			parameters: object;
			activeDir: vscode.WorkspaceFolder | undefined;
		}) => Promise<void>
	): Promise<void> {
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
		if (hideRetryOnStart) {
			retryButton.hide();
		}
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
			await body({ editor, document, apiKey, parameters, activeDir });
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
	}

	/**
	 * AIの出力を指定位置に挿入し、履歴とログに記録する。
	 *
	 * @param undoStopBefore editor.edit の undoStopBefore（retry 時は直前の削除と連結するため false）
	 * @param renewLogFile saveLog のログファイル名を新規発行するかどうか（retry 時は false）
	 */
	async function insertOutputAndSaveLog(
		editor: vscode.TextEditor,
		document: vscode.TextDocument,
		position: vscode.Position,
		currentText: string,
		parameters: object,
		input: string,
		activeDir: vscode.WorkspaceFolder | undefined,
		undoStopBefore: boolean,
		renewLogFile: boolean
	): Promise<void> {
		await editor.edit(function (builder) {
			builder.replace(position, currentText);
		}, { undoStopBefore, undoStopAfter: true });
		const endAt = document.positionAt(document.offsetAt(position) + currentText.length);
		await saveLog(currentText, new vscode.Range(position, endAt), document, parameters, input, activeDir, renewLogFile);
	}

	context.subscriptions.push(vscode.commands.registerCommand('vscode-ai-novelist.getContinuation', () =>
		executeApiCommand(true, async ({ editor, document, apiKey, parameters, activeDir }) => {
			const { output: currentText, input } = await queryServer(apiKey, document, parameters, activeDir);
			const line = document.lineCount;
			const startAt = new vscode.Position(line - 1, document.lineAt(line - 1).text.length);
			await insertOutputAndSaveLog(editor, document, startAt, currentText, parameters, input, activeDir, true, true);
			retryButton.show();
		})
	));

	context.subscriptions.push(vscode.commands.registerCommand('vscode-ai-novelist.retry', () =>
		executeApiCommand(false, async ({ editor, document, apiKey, parameters, activeDir }) => {
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
			await insertOutputAndSaveLog(editor, document, startAt, currentText, parameters, input, activeDir, false, false);
			retryButton.show();
		})
	));

	context.subscriptions.push(vscode.commands.registerCommand('vscode-ai-novelist.initializeWorkspaceFiles', async () => {
		const activeDir = vscode.workspace.workspaceFolders?.[0];
		if (!activeDir) {
			vscode.window.showErrorMessage('ワークスペースが開かれていません。');
			return;
		}
		const config = vscode.workspace.getConfiguration('ai_novelist_api');
		const { created, skipped } = await initializeWorkspaceFiles(config, activeDir);
		const lines: string[] = [];
		if (created.length > 0) {
			lines.push('作成: ' + created.join(', '));
		}
		if (skipped.length > 0) {
			lines.push('スキップ: ' + skipped.join(', '));
		}
		vscode.window.showInformationMessage(lines.length > 0 ? lines.join(' / ') : '対象ファイルはありません。');
	}));

	context.subscriptions.push(vscode.commands.registerCommand('vscode-ai-novelist.getContinuationFromSelection', () =>
		executeApiCommand(true, async ({ editor, document, apiKey, parameters, activeDir }) => {
			const selections = editor.selections.filter(s => !s.isEmpty);
			if (selections.length === 0) {
				vscode.window.showErrorMessage('テキストが選択されていません。');
				return;
			}
			const { output: currentText, input } = await queryServer(apiKey, document, parameters, activeDir, selections);
			const lastEnd = selections.reduce((latest, s) =>
				s.end.isAfter(latest) ? s.end : latest,
				selections[0].end
			);
			await insertOutputAndSaveLog(editor, document, lastEnd, currentText, parameters, input, activeDir, true, true);
			retryButton.show();
		})
	));

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
