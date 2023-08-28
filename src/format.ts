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
 * 日付をyyyymmdd_hhMMss形式の文字列に変換する。
 * 
 * @param date 変換対象の日付
 * @returns yyyymmdd_hhMMss形式の文字列
 */
export function formatDate(date: Date): string {
	return date.getFullYear().toString() + ('0' + (date.getMonth() + 1).toString()).slice(-2) + ('0' + date.getDate().toString()).slice(-2) + '_' + ('0' + date.getHours().toString()).slice(-2) + ('0' + date.getMinutes().toString()).slice(-2) + ('0' + date.getSeconds().toString()).slice(-2);
}