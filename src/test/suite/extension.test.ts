import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	test('拡張機能が登録されている', async () => {
		const ext = vscode.extensions.getExtension('whiteball.vscode-ai-novelist');
		assert.ok(ext, '拡張機能が見つかりません');
	});

	test('getContinuationコマンドが登録されている', async () => {
		const commands = await vscode.commands.getCommands();
		assert.ok(commands.includes('vscode-ai-novelist.getContinuation'));
	});

	test('retryコマンドが登録されている', async () => {
		const commands = await vscode.commands.getCommands();
		assert.ok(commands.includes('vscode-ai-novelist.retry'));
	});
});
