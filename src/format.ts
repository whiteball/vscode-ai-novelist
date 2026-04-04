/**
 * AIからの出力を表示用に整形する。
 * 
 * @param raw AIからの出力
 * @param forwardLine 出力の直前の文
 * @returns 整形後の文字列
 */
export function formatOutput(raw: string, forwardLine: string = '', isLF = false): string {
	raw = raw.replace(/(?<!。|」)(。|」) /g, '$1' + (isLF ? '' : '\r') + '\n')
		.replace(/\!/g, '！')
		.replace(/\?/g, '？');
	if (raw.slice(0, 1) === ' ' && forwardLine && forwardLine.slice(-1).match(/。|！|？|\!|\?/)) {
		raw = (isLF ? '' : '\r') + '\n' + raw.slice(1);
	}
	return raw;
}
/**
 * APIに送信するテキストを正規化する。
 * sendLimit > 0 の場合、以下の優先順位で文字数制限内に収める。
 *   1. 入力本体の下2行（sendLimit内に収める）
 *   2. メモリー（残りスペースに収まり、かつ入力本体用スペースが残る場合のみ）
 *   3. 入力本体の残り部分（新しい方から詰める）
 *
 * @param input 送信テキスト（メモリーを含まない）
 * @param memory メモリーテキスト
 * @param sendLimit 最大文字数（0の場合は制限なし）
 * @returns 正規化後の文字列
 */
export function normalizeInput(input: string, memory: string = '', sendLimit: number = 0): string {
	const regexpReduceNewLine = /(\r?\n){3,}/g;
	input = input.replace(regexpReduceNewLine, '$1$1');
	memory = memory.replace(regexpReduceNewLine, '$1$1');

	const eol = input.includes('\r\n') ? '\r\n' : '\n';

	if (sendLimit <= 0) {
		return memory ? memory + eol + eol + input : input;
	}

	// 優先度1：入力本体の下2行（sendLimit内に収める）
	const lines = input.split(/\r?\n/);
	const bottom2Lines = lines.slice(Math.max(0, lines.length - 2));
	const restLines = lines.slice(0, Math.max(0, lines.length - 2));
	let bottom2Text = bottom2Lines.join(eol);
	if (bottom2Text.length > sendLimit) {
		bottom2Text = bottom2Text.slice(bottom2Text.length - sendLimit);
	}
	let remaining = sendLimit - bottom2Text.length;

	let memoryPart = '';
	let restPart = '';

	// 優先度2：メモリー（入力本体の残り部分用スペースを確保できる場合のみ追加）
	if (memory && remaining > 0) {
		const memWithSep = memory + eol + eol;
		if (memWithSep.length < remaining) {
			memoryPart = memWithSep;
			remaining -= memWithSep.length;
		}
	}

	// 優先度3：入力本体の残り部分（新しい方から詰める）
	if (restLines.length > 0 && remaining > eol.length) {
		const restText = restLines.join(eol);
		const restWithEol = restText + eol;
		if (restWithEol.length <= remaining) {
			restPart = restWithEol;
		} else {
			restPart = restText.slice(restText.length - (remaining - eol.length)) + eol;
		}
	}

	return memoryPart + restPart + bottom2Text;
}
/**
 * 日付をyyyymmdd_hhMMss形式の文字列に変換する。
 * 
 * @param date 変換対象の日付
 * @returns yyyymmdd_hhMMss形式の文字列
 */
export function formatDate(date: Date): string {
	return date.getFullYear().toString() + ('0' + (date.getMonth() + 1).toString()).slice(-2) + ('0' + date.getDate().toString()).slice(-2) + '_' + ('0' + date.getHours().toString()).slice(-2) + ('0' + date.getMinutes().toString()).slice(-2) + ('0' + date.getSeconds().toString()).slice(-2);
}