# vscode-ai-novelist README

AIのべりすとのAPIを呼び出し、指定のテキストの続きを生成する拡張機能です。

**※利用にはAIのべりすとのユーザー登録と、そのユーザーに使用可能なルミナ(ポイント)が残っていること必要です。**

## 機能

* 任意のファイルで、そのファイル全体を入力としてAIのべりすとAPIに問い合わせ、続きを書くことができます。
  * ステータスバーの「続きを書く」ボタン、またはコマンド「続きを書く(AIのべりすと)」から利用可能です。
  * 出力結果はファイル末尾に追加され、四角で囲って強調されます。
  * **そのテキストファイルに出力文が残っている状態**、かつ、**Undo/Redo以外の編集をしていない場合**、ステータスバーの「リトライ」ボタンから、その出力結果を消して、再びAIのべりすとに問い合わせて続きを書くことができます。
* APIに渡す各種パラメータを設定可能です。
* 出力結果を別途ログファイルに記録します(VSCodeの設定から有効/無効を切り替え可能です)。

## 必要条件

AIのべりすとのユーザー登録と、そのユーザーに使用可能なルミナ(ポイント)が残っていること必要です。
事前に[AIのべりすと](https://ai-novel.com/)のサイト上で新規ユーザー登録をしてください。

登録ができたら[AIのべりすと 開発者向けAPIページ](https://ai-novel.com/account_api.php)でAPIキーを取得し、この拡張に設定(" ai_novelist_api.apiKey")してください。

なお、AIのべりすとAPIの利用にはルミナを消費します。ルミナを所持していない場合は、あらかじめ購入しておいてください。

## 設定

* `ai_novelist_api.apiKey`: AIのべりすとの開発者向けAPIページのAPIキーを設定してください。設定しないとAPIは利用できません。
* `ai_novelist_api.saveOutputToLogFile`: この設定が有効の場合、AIの出力をログファイル(`.ai_novelist/history/yyyymmdd_hhMMss.json`)に保存します。パラメータと送信テキスト全文も記録されます。
* `ai_novelist_api.parameters.length`: 出力トークン数の長さ(1～300)。出力に時間がかかる場合、この長さにかかわらず出力が短くなる場合があります
* `ai_novelist_api.parameters.temperature`: ランダム度(0～2.5)。語彙が単調に感じる場合は上げてみてください。上げすぎると支離滅裂な出力なります。
* `ai_novelist_api.parameters.top_p`: Top Pサンプリング(0.01～1.0)。低いほど出現確率の低いトークンが除外されます。極端に関係のない語彙が出ることを防ぎます。
* `ai_novelist_api.parameters.rep_pen`: 繰り返しペナルティ(1.0～2.0)。同じトークンが出力されにくさの度合いを指定します。数字を大きくすると、同じトークンが出力されにくくなります。値が高すぎると出力が突飛になりすぎる可能性があります。
* `ai_novelist_api.parameters.top_k`: Top Kサンプリング(1～500)。出力が確率上位nトークンのみから選択されるようにします。
* `ai_novelist_api.parameters.top_a`: Top Aサンプリング(0～1.0)。確率が(一番確率の高いトークン^2 * Top A)以下のトークンを除外します。
* `ai_novelist_api.parameters.rep_pen_range`: 繰り返しペナルティを適用する範囲(0～2048)。この範囲にあるトークンが出力される可能性があるときにペナルティがかかります。
* `ai_novelist_api.parameters.rep_pen_slope`: 繰り返しペナルティの傾斜(0.01～10)。この値を大きくすると、入力文章末尾から離れた位置にあるトークンほど、より大きなペナルティがかかるようになります。
* `ai_novelist_api.parameters.rep_pen_pres`: コンテキスト中に単語が出た回数に依存する繰り返しペナルティ(0～100)
* `ai_novelist_api.parameters.typical_p`: Typicalサンプリング(0.01～1.0)。出力確率の下位n%のトークンのみを採用します。
* `ai_novelist_api.parameters.badwords`: 禁止ワードを設定します。
* `ai_novelist_api.parameters.logit_bias`: 個別のトークンの出現率を調整します。バイアス確率はlogit spaceに作用します。基本的には-5から+5程度が適正です。下記のように配列で指定してください。

```json
{
  "ai_novelist_api.parameters.logit_bias": [
    {
      "token": "【",
      "bias": -2
    },
    {
      "token": "_",
      "bias": -0.1
    }
  ]
}
```

* `ai_novelist_api.send_limit`: APIに送信するテキストの最大文字数。0の場合は制限なし。制限超過時は「入力本体の下2行 > メモリー > キャラクターブック > 入力本体の残り」の優先順位で収めます。`.ai_novelist/settings.json`の`send_limit`キーで上書き可能です。
* `ai_novelist_api.chara_book_search_range`: キャラクターブックのファイル名を検索する範囲（送信テキスト末尾からの文字数）。0の場合はテキスト全体を検索します。デフォルト2000。`.ai_novelist/settings.json`の`chara_book_search_range`キーで上書き可能です。
* `ai_novelist_api.parameters.stoptokens`: 出力生成中にここで指定したトークンが現れると、強制的に出力が打ち切られます。
* `ai_novelist_api.parameters.model`: 使用するモデルを選択できます。利用可能なモデルは以下の通りです。(2026/03/29現在)
  * 現行モデル
    * derrida_03
    * spiko_max
    * spiko
    * spiko_solid
    * damsel_ray
  * レガシーモデル
    * supertrin_highpres
    * supertrin_maxpres
    * supertrin
    * damsel

パラメータの読み込み優先順位は「拡張全体の設定 < `.ai_novelist/param.json` < `.ai_novelist_param.json`」です。後から読まれるファイルの値が優先されます。

`.ai_novelist_param.json`に設定を書く場合は、下記の例のように設定してください。

```json
{
    "length": 15,
    "temperature": 0.7,
    "top_p": 0.7,
    "rep_pen": 1.15,
    "top_k": 140,
    "top_a": 0.1,
    "rep_pen_range": 1024,
    "rep_pen_slope": 3.00,
    "rep_pen_pres": null,
    "typical_p": 1.0,
    "badwords": "<unk>",
    "logit_bias": "【<<|>>_",
    "logit_bias_values": "-2.0|-0.1",
    "stoptokens": "トマト<<|>>りんご",
    "model": "spiko",
}
```

## ワークスペースファイル

`.ai_novelist/`ディレクトリにワークスペースごとの設定ファイルを置くことができます。

| ファイル | 内容 |
| --- | --- |
| `param.json` | APIパラメータ（`.ai_novelist_param.json`より低優先） |
| `settings.json` | 拡張の動作設定（`note_line` / `send_limit` / `chara_book_search_range`） |
| `memory.txt` | メモリー：送信テキストの**先頭**に常に挿入されるテキスト |
| `note.txt` | 脚注：送信テキストの末尾から`note_line`行目の直前に挿入されるテキスト |
| `chara_books/*.txt` | キャラクターブック：ファイル名が本文内に存在する場合にメモリーの直後に挿入されるテキスト |

## キャラクターブック

`.ai_novelist/chara_books/`ディレクトリに`*.txt`ファイルを置くことで、ファイル名に一致するキーワードが本文中に存在する場合のみ、そのテキストをメモリーの直後に挿入できます。

ファイル名の先頭に`数値.`を付けることで挿入順を制御できます（例: `1.田中太郎.txt`）。数値なしのファイルは順序値100として扱われ、同値の場合はアルファベット順で処理されます。検索は拡張子と数値プレフィックスを除いたファイル名で行われます。

## 今後の機能追加予定

* 選択範囲の続きを書く

## リリースノート

[CHANGELOG.md](CHANGELOG.md) を参照してください。

## リンク

* [AIのべりすと](https://ai-novel.com/)
* [AIのべりすと APIマニュアル](https://ai-novel.com/account_api_help.php)

## クレジット

この拡張はMITライセンスで提供されている[VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)のコードを利用しています。  
VS Code Extension Samples: Copyright (c) Microsoft Corporation.
