# Change Log

## [0.0.2] - 2026/03/29

- メモリー機能を実装。`.ai_novelist/memory.txt`が存在する場合、その内容を送信テキストの先頭に挿入します。
- 脚注機能を実装。`.ai_novelist/note.txt`が存在する場合、その内容を送信テキストの末尾から`note_line`行目の直前に挿入します。`note_line`は`.ai_novelist/settings.json`で設定可能です（デフォルト3、範囲1〜20）。
- パラメータ読み込み元に`.ai_novelist/param.json`を追加。優先順位は「拡張全体の設定 < `.ai_novelist/param.json` < `.ai_novelist_param.json`」。
- 履歴ファイルの保存先を`.ai_novelist/history/`に変更し、形式をJSON（`.json`）に変更。APIパラメータと送信テキスト全文も記録するようになりました。
- 送信テキストの正規化処理を追加。3つ以上連続する改行を2つに置き換えます。
- 出力文に改行が含まれる場合のDecorationマークが正しく適用されない問題を修正。

## [0.0.1] - 2023/08/29

- 初期バージョン。
- ファイル全体に対する続きを書く/リトライ機能を実装。
- 各パラメータはVSCode/ワークスペースの設定ファイルか、ワークスペースのルートディレクトリの".ai_novelist_param.json"で行う。
