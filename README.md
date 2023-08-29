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
* `ai_novelist_api.saveOutputToLogFile`: この設定が有効の場合、AIの出力をログファイル(.history/yyyymmdd_hhMMss.txt)に保存します。
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

* `ai_novelist_api.parameters.stoptokens`: 出力生成中にここで指定したトークンが現れると、強制的に出力が打ち切られます。
* `ai_novelist_api.parameters.model`: 使用するモデルを選択できます。"supertrin"(スーパーとりんさまモデル)、または"damsel"(やみおとめモデル)があります。

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
    "model": "supertrin",
}
```

## 今後の機能追加予定

* 選択範囲の続きを書く
* メモリ/脚注
* キャラクターブック

## リリースノート

### 0.0.1

初期リリース。

## リンク

* [AIのべりすと](https://ai-novel.com/)
* [AIのべりすと APIマニュアル](https://ai-novel.com/account_api_help.php)

## クレジット

この拡張はMITライセンスで提供されている[VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)のコードを利用しています。  
VS Code Extension Samples: Copyright (c) Microsoft Corporation.
