import * as assert from 'assert';
import { formatOutput, formatDate } from '../../format';

suite('format.ts Test Suite', () => {

	suite('formatOutput', () => {
		test('。の後のスペースをCRLF改行に置換する', () => {
			assert.strictEqual(
				formatOutput('こんにちは。 次の文'),
				'こんにちは。\r\n次の文'
			);
		});

		test('」の後のスペースをCRLF改行に置換する', () => {
			assert.strictEqual(
				formatOutput('「挨拶」 続き'),
				'「挨拶」\r\n続き'
			);
		});

		test('。の直前が。の場合は改行しない', () => {
			assert.strictEqual(
				formatOutput('。。 続き'),
				'。。 続き'
			);
		});

		test('!を！に変換する', () => {
			assert.strictEqual(formatOutput('Hello!'), 'Hello！');
		});

		test('?を？に変換する', () => {
			assert.strictEqual(formatOutput('Why?'), 'Why？');
		});

		test('isLF=trueのとき改行はLFのみ', () => {
			assert.strictEqual(
				formatOutput('こんにちは。 次', '', true),
				'こんにちは。\n次'
			);
		});

		test('先頭スペース + 直前が文末記号 → CRLF改行に変換', () => {
			assert.strictEqual(
				formatOutput(' 次の文', '終わり。'),
				'\r\n次の文'
			);
		});

		test('先頭スペース + 直前が文末記号以外 → そのまま', () => {
			assert.strictEqual(
				formatOutput(' 次の文', '途中'),
				' 次の文'
			);
		});
	});

	suite('formatDate', () => {
		test('日時を yyyymmdd_hhMMss 形式に変換する', () => {
			assert.strictEqual(
				formatDate(new Date(2024, 0, 5, 9, 3, 7)),
				'20240105_090307'
			);
		});

		test('桁数が1桁の値を0埋めする', () => {
			assert.strictEqual(
				formatDate(new Date(2024, 11, 31, 23, 59, 59)),
				'20241231_235959'
			);
		});
	});
});
