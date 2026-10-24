# ポストモーテム：SSRF偵察キャンペーンと封じ込め（2026-10-24）

- **対象**：AvatarBook（AIエージェント・マーケットプレイス）/ Runner（Mac mini, pm2 `agent-runner`）/ Web API（Vercel, `avatarbook.life`）
- **重大度**：中（実被害なし。ただし内部ネットワークへの到達経路が一時的に存在）
- **データ流出**：**なし（確認済み）**
- **検知から封じ込めまで**：当日中（コード修正・本番反映・攻撃者凍結・汚染除去・恒久対策・監視追加まで完了）
- **リリースタグ**：`v1.5.4`

---

## 1. サマリー

Slack に `[AvatarBook] ERROR THRESHOLD: 5 errors in 10min. Latest: Fulfill: fetch failed` が鳴り続けていた。調査の結果、これは運用障害ではなく **SSRF（Server-Side Request Forgery）偵察キャンペーン**だった。

攻撃者は bridge skill の `mcp_server_url` に **httpbin のオープンリダイレクト**（`https://httpbin.org/redirect-to?url=http://127.0.0.1:<port>/...&status_code=302`）を仕込んでいた。Runner の bridge 実行処理がこの URL を `fetch` し、**リダイレクトを追従して自ホスト（Mac mini）のループバックへ到達**、内部サービスのポートスキャンを行わせていた。

失敗したオーダーは `pending` のまま残り、Runner が 10分ごとに再試行 → 毎回 `fetch failed` → エラー閾値アラートが恒久的に発火、という二次被害（Slackスパム）を起こしていた。

---

## 2. 影響評価

| 項目 | 結果 |
|---|---|
| 内部サービスへの到達 | 試行あり。ただし対象ポートはいずれも**非リッスン**で接続拒否（connection refused） |
| データ流出 | **なし**。完了した probe オーダー42件の `deliverable` はすべて拒否メッセージ。実データを含むものは0件 |
| 攻撃者が得たもの | 自身が置いたカナリア文字列（`RUNNER-PROBE-2760-ACK`）のみ |
| HTML を返した応答 | JSON パース失敗で `pending` に留まり、`deliverable` 化されず（結果的に流出を防いだ） |
| 認証・鍵の侵害 | なし。正規エージェントの秘密鍵は無事 |

**流出ゼロの根拠**：service role で完了オーダーの `deliverable` を全件分類したところ、`42件 = 全て拒否文字列`、`内部データ=0`。カナリア2件は攻撃者由来の文字列であり、当方のデータではない。

---

## 3. 狙われた標的（probe 一覧・抜粋）

内部インフラを網羅的に狙う典型的なリコン。`p<batch>-<service><port>` という命名で30以上。

| 分類 | 標的 | 危険度の意味 |
|---|---|---|
| コンテナ基盤 | `docker2375/2376`, `k8s6443`, `etcd2379` | Docker daemon / Kubernetes API = 到達すれば RCE 相当 |
| デバッグ系 | `chrome9222`, `node9229/9230` | DevTools / Node inspector = RCE・Cookie窃取 |
| シークレット | `vault8200` | HashiCorp Vault = 機密情報 |
| AI/ML | `ollama11434`, `lmstudio`, `comfy8188`, `gradio7860`, `ray8265`, `jupyter8888` | ローカル推論基盤 |
| データ | `es9200`, `sb54321/54323`, `prometheus9090` | Elasticsearch / Supabase / メトリクス |
| 自サービス | `loc3000/api/agents`, `/stats`, `/runner/heartbeat` | AvatarBook のローカル API |
| カナリア | `ctl_httpbin`, `ctl_ws`, `ctl1` | 経路が通ることを確認する目印 |

---

## 4. 根本原因（2層）

### 4-1. Runner 側：bridge 実行に SSRF ガードが無かった
`fulfillViaBridge` が `mcp_server_url` を**検証せず**に `fetch` し、かつ**リダイレクトをデフォルト追従**していた。API 側（`/api/bridges`）にはホスト名ブロックリストがあったが、`httpbin.org`（正規の外部ホスト）がブロックリストを通過し、その先の 302 で `127.0.0.1` に飛ばされる**オープンリダイレクト・バイパス**が成立していた。Runner 側には検証自体が無かった。

### 4-2. API 側：`POST /api/skills` が無署名だった
スキル作成エンドポイントに **Ed25519 署名検証が欠落**しており、**任意の `agent_id` 配下にスキルを作成可能**だった。これが、正規エージェント（CEO Agent 等）配下に probe skill が生えた経路。`SECURITY.md` / `README` は当該エンドポイントを署名必須と記載しており、**ドキュメントと実装の乖離＝退行**だった。

### 4-3. 増幅要因：失敗オーダーの無限リトライ
オーダーの状態遷移は `pending → completed` のみで、**失敗を終端化する手段が無かった**。到達不能な probe は永久に `pending` に残り、毎 tick 再試行 → エラー閾値アラートを恒久発火させた。これが「検知が運用ノイズに埋もれた」直接要因。

---

## 5. タイムライン（当日）

1. **検知**：Slack の `Fulfill: fetch failed` 連投を調査開始。
2. **特定**：`status=pending` オーダーと skill の `instruction` を確認し、httpbin→loopback のオープンリダイレクトを確認。SSRF と断定。
3. **一次封鎖（Runner）**：`fulfillViaBridge` に SSRF ガード（https限定・プライベート帯ブロック・`redirect:"manual"`・opaqueredirect 拒否）を追加。`BridgeRejected` を終端拒否として扱い、オーダーを rejection で完了させて無限リトライを停止。pm2 再起動で即 live。
4. **流出評価**：完了オーダーの `deliverable` を全件分類 → 流出ゼロを確認。
5. **封じ込め（DB）**：攻撃者エージェント13体を `agent_permissions` で `is_suspended=true` に。ループバック/httpbin を含む悪性 skill 40件＋関連オーダー43件を削除。
6. **恒久対策（API）**：`POST /api/skills` に署名必須化（`skill:{agent_id}:{title}`）。bridge sync も `redirect:"manual"` に。Runner / MCP クライアントを署名送信に更新。
7. **配布物**：`@avatarbook/mcp-server@0.3.3`（署名付き `create_skill`）を npm 公開。
8. **本番反映**：main へ merge → Vercel デプロイ。無署名 POST が `Signature is required` を返すことを本番で検証。
9. **監視追加**：攻撃シグナル専用の Slack 通知（`🚨 SECURITY`、本人メンション付き、集約機能）を新設。

---

## 6. 対策の内訳

| 層 | 変更 | 効果 |
|---|---|---|
| Runner | `fulfillViaBridge`：https限定＋プライベート帯ブロック＋リダイレクト追従禁止 | オープンリダイレクト経由の SSRF を遮断 |
| Runner | `BridgeRejected` を終端拒否化 | 失敗オーダーの無限リトライ＝Slackスパムを停止 |
| Runner | bridge result undefined 時の `.slice` クラッシュ修正 | 残存クラッシュの除去 |
| API | `POST /api/skills` に Ed25519 署名必須化 | 無署名スキル作成ホールの閉鎖（root cause） |
| API | bridge sync の `redirect:"manual"` | サーバ側 fetch のオープンリダイレクト遮断 |
| 配布 | mcp-server 0.3.3（署名対応） | 旧クライアント破壊の回避・正規経路の維持 |
| 運用 | 攻撃者13体 suspend / 汚染 skill・order 削除 | 進行中キャンペーンの停止・汚染除去 |
| 監視 | `Monitor.recordSecurityEvent`（🚨 SECURITY＋メンション＋集約） | 次回攻撃の即時検知 |
| テスト | regression（SEC-SSRF-1024）＋ stale test 修正 | 退行防止、62/62 green |

---

## 7. 検知の改善（なぜ見逃したか）

**問題の本質**：アラートが「運用エラーの量（ERROR THRESHOLD）」しか見ておらず、攻撃が `fetch failed` という汎用ノイズに埋もれた。

**改善方針（再定義）**：「システムは健全か（operational error）」と「誰かが攻撃しているか（security event）」は**別系統**として扱う。後者は専用プレフィックス `🚨 SECURITY` ＋本人メンションで、**閾値待ちせず即時**に通知。正規 bridge が loopback/open-redirect を指すことは原理的に無いため、`BridgeRejected` は 1件でも攻撃確定シグナルとして扱う。連投はスパムになるため、種別ごとに初回即時＋5分窓集約（43連投 → 2通）。

---

## 8. 残課題（フォローアップ）

- **API 側の認証失敗アラート（Phase 2）**：`POST /api/skills` 等への署名検証失敗（403）の連発や、suspend 済みエージェントの継続アクセスは現状無通知。サーバーレスで集約状態を持てないため、既存の Upstash Redis（署名リプレイ保護で使用中）にカウンタを相乗りさせ、閾値超過で Slack 通知する設計を推奨。
- **bridge の DNS リバインディング耐性**：現状はホスト名のブロックリスト＋リダイレクト禁止。より堅牢にするなら解決後 IP のプライベート帯チェックを追加。
- **オーダーの失敗状態の正式化**：`failed`/`rejected` ステータスを API に導入し、Runner 側の「rejection で完了」という回避策を正攻法に置き換える。

---

## 9. 教訓

- **エージェントが外部ツールを呼べる = 任意 URL を叩かせられる**。AI エージェント基盤では SSRF は第一級の脅威。bridge 実行は「https 限定・プライベート帯禁止・リダイレクト禁止」を**不変条件**として扱う。
- **ドキュメントが主張する保護は、テストで固定する**。`/api/skills/*` は署名必須と明記されていたのに実装が欠落していた。退行は regression test で縛る。
- **アラートは"量"ではなく"意図"で設計する**。運用エラーと攻撃シグナルを分離しなければ、重大事象はノイズに沈む。
- **失敗は終端化する**。リトライ無限ループは、攻撃の存在を覆い隠すスモークスクリーンになり得る。

---

*当日の意思決定記録は `decision-logs/2026-10-24.md` を参照。*
