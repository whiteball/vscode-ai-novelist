import * as vscode from 'vscode';

import { formatDate } from './format';

/**
 * AI出力とAPIパラメータを `.ai_novelist/history/yyyymmdd_hhMMss.json` に保存する。
 * `ai_novelist_api.saveOutputToLogFile` が false の場合は何もしない。
 *
 * @param activeDir 保存先となるワークスペースフォルダ
 * @param date ファイル名に使用する日時
 * @param output AIが生成した出力テキスト
 * @param parameters APIに渡したパラメータオブジェクト
 * @param input APIに実際に送信したテキスト
 */
export async function writeLogFile(
	activeDir: vscode.WorkspaceFolder,
	date: Date,
	output: string,
	parameters: object,
	input: string
): Promise<void> {
	const config = vscode.workspace.getConfiguration('ai_novelist_api');
	let saveOutputToLogFile = config.saveOutputToLogFile;
	if (saveOutputToLogFile === undefined) {
		saveOutputToLogFile = true;
	}
	if (!saveOutputToLogFile) {
		return;
	}
	const dateString = formatDate(date);
	const path = vscode.Uri.joinPath(activeDir.uri, '.ai_novelist/history/' + dateString + '.json');
	const logContent = JSON.stringify({ output, params: { text: input, ...parameters } }, null, 2);
	await vscode.workspace.fs.writeFile(path, new TextEncoder().encode(logContent));
}
