import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// VercelのRedisデータベースに接続
const redis = Redis.fromEnv();

// ルール設定: 「60秒間に5回」まで許可
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
});

export default async function handler(req, res) {
  // 1. IPアドレスを取得してアクセス制限をチェック
  const identifier = req.headers['x-forwarded-for'] || 'ip';
  const { success } = await ratelimit.limit(identifier);

  // 2. 制限オーバーならエラーを返して終了（GASには飛ばない）
  if (!success) {
    return res.status(429).json({ 
      error: 'Too Many Requests',
      message: '試行回数が多すぎます。しばらく待ってから再試行してください。'
    });
  }

  // 3. ここからGASへの通信処理
  // ブラウザからのPOSTリクエストを受け取る
  if (req.method === 'POST') {
    try {
      // Vercelの環境変数からGASのURLを取得
      const gasUrl = process.env.GAS_API_URL; 

      if (!gasUrl) {
        return res.status(500).json({ error: 'GAS_API_URL is not set' });
      }

      // GASにデータを転送
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // 必要に応じて調整
        },
        body: JSON.stringify(req.body) // ブラウザから送られたデータをそのままGASへ
      });

      const data = await response.json();
      return res.status(200).json(data);

    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // POST以外は受け付けない
  return res.status(405).json({ error: 'Method Not Allowed' });
}
