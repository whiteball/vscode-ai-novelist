import * as vscode from 'vscode';
import fetch from 'node-fetch';

import { formatOutput, formatDate, normalizeInput } from './format';

// refer: https://ai-novel.com/account_api_help.php

class HistoryItem {
	text: string;
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

	const outputHistory = new Map<string, HistoryItem[]>();
	const outputHistoryAt = new Map<string, Date>();

	let lock = false;

	async function loadParameters(config: vscode.WorkspaceConfiguration, activeDir: vscode.WorkspaceFolder | undefined): Promise<Object> {
		let parameters = {...config.parameters};
		if (activeDir) {
			const paramJsonPath = vscode.Uri.joinPath(activeDir.uri, '.ai_novelist/param.json');
			try {
				const buf = await vscode.workspace.fs.readFile(paramJsonPath);
				parameters = {...parameters, ...JSON.parse(buf.toString())};
			} catch (e) {

			}
			const legacyPath = vscode.Uri.joinPath(activeDir.uri, '.ai_novelist_param.json');
			try {
				const buf = await vscode.workspace.fs.readFile(legacyPath);
				parameters = {...parameters, ...JSON.parse(buf.toString())};
			} catch (e) {

			}
		}

		if (parameters.badwords && Array.isArray(parameters.badwords)) {
			parameters.badwords = parameters.badwords.join('<<|>>');
		}
		// logit biasがObjectなら分解する
		if (parameters.logit_bias && typeof parameters.logit_bias === "object") {
			parameters.logit_bias_values = parameters.logit_bias.map((value: any) => (value.token ?? '') === '' ? '' : value.bias ?? 0)
				.filter((value: any) => value !== '')
				.join('|');
			parameters.logit_bias = parameters.logit_bias.map((value: any) => value.token ?? '')
				.filter((value: any) => value !== '')
				.join('<<|>>');
		}
		if (parameters.stoptokens && Array.isArray(parameters.stoptokens)) {
			parameters.stoptokens = parameters.stoptokens.join('<<|>>');
		}

		return parameters;
	}
	async function queryServer(apiKey:string, document: vscode.TextDocument, parameters: object, activeDir: vscode.WorkspaceFolder | undefined = undefined, selections: vscode.Selection[] | undefined = undefined):Promise<{output: string, input: string}> {
		let input = '';
		if (selections) {
			let selectedText: string[] = [];
			// selections.sort((x, y) => { return x.start > y.start ? 1 : (x.start < y.start ? -1 : 0); });
			for (const selection of selections) {
				selectedText.push(document.getText(selection));
			}
			input = selectedText.join('\r\n');
		} else {
			input = document.getText();
		}
		if (!input) {
			throw Error('入力文字列が空です。');
		}
		let memory = '';
		let sendLimit: number = vscode.workspace.getConfiguration('ai_novelist_api').get('send_limit') ?? 0;
		let charaBookSearchRange: number = vscode.workspace.getConfiguration('ai_novelist_api').get('chara_book_search_range') ?? 2000;
		if (activeDir) {
			const memoryPath = vscode.Uri.joinPath(activeDir.uri, '.ai_novelist/memory.txt');
			try {
				const buf = await vscode.workspace.fs.readFile(memoryPath);
				memory = buf.toString();
			} catch (e) {

			}

			let noteLine = 3;
			try {
				const settingsBuf = await vscode.workspace.fs.readFile(
					vscode.Uri.joinPath(activeDir.uri, '.ai_novelist/settings.json')
				);
				const settings = JSON.parse(settingsBuf.toString());
				if (typeof settings.note_line === 'number') {
					noteLine = Math.min(20, Math.max(1, Math.floor(settings.note_line)));
				}
				if (typeof settings.send_limit === 'number') {
					sendLimit = Math.max(0, Math.floor(settings.send_limit));
				}
				if (typeof settings.chara_book_search_range === 'number') {
					charaBookSearchRange = Math.max(0, Math.floor(settings.chara_book_search_range));
				}
			} catch (e) {

			}

			const notePath = vscode.Uri.joinPath(activeDir.uri, '.ai_novelist/note.txt');
			try {
				const noteBuf = await vscode.workspace.fs.readFile(notePath);
				const noteText = noteBuf.toString();
				const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
				const lines = input.split(/\r?\n/);
				const insertAt = Math.max(0, lines.length - noteLine);
				lines.splice(insertAt, 0, noteText);
				input = lines.join(eol);
			} catch (e) {

			}
		}
		const charaBookTexts: string[] = [];
		if (activeDir) {
			try {
				const charaBooksDir = vscode.Uri.joinPath(activeDir.uri, '.ai_novelist/chara_books');
				const entries = await vscode.workspace.fs.readDirectory(charaBooksDir);
				const searchTarget = charaBookSearchRange > 0
					? input.slice(Math.max(0, input.length - charaBookSearchRange))
					: input;
				const txtFiles = entries
					.filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.txt'))
					.map(([name]) => {
						const hasOrder = /^\d+\./.test(name);
						const order = hasOrder ? parseInt(name.split('.')[0]) : 100;
						const searchKey = hasOrder
							? name.replace(/^\d+\./, '').replace(/\.txt$/, '')
							: name.replace(/\.txt$/, '');
						return { name, order, searchKey };
					})
					.filter(f => searchTarget.includes(f.searchKey))
					.sort((a, b) => a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name));
				for (const file of txtFiles) {
					try {
						const buf = await vscode.workspace.fs.readFile(
							vscode.Uri.joinPath(charaBooksDir, file.name)
						);
						charaBookTexts.push(buf.toString());
					} catch (e) {

					}
				}
			} catch (e) {

			}
		}
		input = normalizeInput(input, memory, charaBookTexts, sendLimit);
		const res = await fetch('https://api.tringpt.com/api', {
			method: 'POST',
			headers: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'Content-Type': 'application/json',
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'Authorization': 'Bearer ' + apiKey
			},
			body: JSON.stringify({
				'text': input,
				...parameters,
			})
		});
		const body = Object(await res.json());
		return { output: formatOutput(body.data[0], input, document.eol === vscode.EndOfLine.LF), input };
	}
	async function saveLog(currentText: string, range:vscode.Range, activeDocument: vscode.TextDocument, parameters: object, input: string, activeDir: vscode.WorkspaceFolder | undefined = undefined, renewLogFile = false) {
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
			// 設定がログを保存するようになっているか確認
			const config = vscode.workspace.getConfiguration('ai_novelist_api');
			if (!config) {
				return;
			}
			let saveOutputToLogFile = config.saveOutputToLogFile;
			if (saveOutputToLogFile === undefined) {
				saveOutputToLogFile = true;
			}
			if (!saveOutputToLogFile) {
				return;
			}
			// ファイルに保存
			const dateString = formatDate(lastGenerated);

			const path = vscode.Uri.joinPath(activeDir.uri, '.ai_novelist/history/' + dateString + '.json');
			const logContent = JSON.stringify({ output: currentText, params: { text: input, ...parameters } }, null, 2);
			vscode.workspace.fs.writeFile(path, new TextEncoder().encode(logContent));
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
