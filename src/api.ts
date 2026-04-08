import * as vscode from 'vscode';
import fetch from 'node-fetch';

import { formatOutput, normalizeInput } from './format';

// refer: https://ai-novel.com/account_api_help.php

/**
 * VS Code設定・`.ai_novelist/param.json`・`.ai_novelist_param.json` からAPIパラメータを読み込む。
 * 優先順位は「VS Code設定 < param.json < .ai_novelist_param.json」（後から読むほど優先）。
 * badwords / logit_bias / stoptokens は APIが受け付ける文字列形式に変換される。
 *
 * @param config VS Codeのワークスペース設定（`ai_novelist_api` スコープ）
 * @param activeDir アクティブなワークスペースフォルダ（undefined の場合はファイル読み込みをスキップ）
 * @returns APIに渡すパラメータオブジェクト
 */
export async function loadParameters(config: vscode.WorkspaceConfiguration, activeDir: vscode.WorkspaceFolder | undefined): Promise<Object> {
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

/**
 * AIのべりすとAPIにテキストを送信し、続きのテキストを取得する。
 * メモリー・脚注・キャラクターブックの挿入、および `normalizeInput` による正規化と文字数制限を適用したうえで送信する。
 *
 * @param apiKey AIのべりすとAPIキー
 * @param document 送信対象のドキュメント
 * @param parameters APIパラメータ（`loadParameters` で構築したもの）
 * @param activeDir アクティブなワークスペースフォルダ（undefined の場合は補助ファイルの読み込みをスキップ）
 * @param selections 選択範囲（undefined の場合はドキュメント全体を送信）
 * @returns `output`（AI出力テキスト）と `input`（実際に送信したテキスト）のペア
 */
export async function queryServer(apiKey: string, document: vscode.TextDocument, parameters: object, activeDir: vscode.WorkspaceFolder | undefined = undefined, selections: vscode.Selection[] | undefined = undefined): Promise<{output: string, input: string}> {
	let input = '';
	if (selections) {
		let selectedText: string[] = [];
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
