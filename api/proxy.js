import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// レートリミット設定: 10秒間に2回まで
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(2, "10 s"),
});

export default async function handler(req, res) {
  const identifier = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : 'ip';
  
  // 1. 制限チェック
  const { success } = await ratelimit.limit(identifier);
  if (!success) {
    return res.status(429).json({ error: 'Too Many Requests', message: '連打制限がかかりました。' });
  }

  if (req.method === 'POST') {
    try {
      const gasUrl = process.env.GAS_API_URL;
      
      // 【重要】データの受け取りと形式の統一
      // VercelがすでにJSON解析している場合としていない場合の両方に対応
      let bodyData = req.body;
      if (typeof bodyData === 'string') {
        try {
          bodyData = JSON.parse(bodyData);
        } catch (e) {
          // JSONパースに失敗したらそのまま使う
        }
      }

      // 【ここが修正点】GASが確実に読める「フォームデータ形式」に変換する
      // (e.parameter で受け取るタイプのGASスクリプトに対応)
      const params = new URLSearchParams();
      if (bodyData && typeof bodyData === 'object') {
        Object.keys(bodyData).forEach(key => {
          params.append(key, bodyData[key]);
        });
      }

      // GASへ送信
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded', // フォーム形式を指定
        },
        body: params.toString()
      });

      const data = await response.json();
      return res.status(200).json(data);

    } catch (error) {
      console.error("Proxy Error:", error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
