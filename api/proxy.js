
あなた:
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 1. レートリミットの準備（ここだけ追加）
const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"), // 本番用設定: 60秒に5回まで
  // テストしたければここを (2, "10 s") にしてもOK
});

export default async function handler(req, res) {
  // -------------------------------------------------------
  // 1. ここでセキュリティチェック（門番）
  // -------------------------------------------------------
  try {
    const identifier = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : 'ip';
    const { success } = await ratelimit.limit(identifier);

    if (!success) {
      return res.status(429).json({ 
        error: 'Too Many Requests',
        message: '試行回数が多すぎます。しばらく待ってから再試行してください。' 
      });
    }
  } catch (err) {
    // Redisがもし落ちていても、サイト自体は使えるようにエラーを無視して通す
    console.error(err);
  }

  // -------------------------------------------------------
  // 2. ここからは「元の正常に動いていたコード」と全く同じ仕組み
  // -------------------------------------------------------
  const GAS_URL = process.env.GAS_API_URL;

  if (!GAS_URL) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // フロントエンドからのデータを受け取る
  // (GETの?key=... も、POSTのbodyも、全部まとめてURLパラメータにします)
  const params = new URLSearchParams({
    ...(req.query || {}),
    ...(req.body || {})
  });

  const targetUrl = ${GAS_URL}?${params.toString()};

  try {
    // 元のコードと同じ「GETリクエスト」でGASに問い合わせ
    const response = await fetch(targetUrl);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
