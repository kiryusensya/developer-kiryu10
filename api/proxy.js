export default async function handler(req, res) {
  const GAS_URL = process.env.GAS_API_URL;

  if (!GAS_URL) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // フロントエンドからのパラメータ(?key=...&lang=...)を取得してGASへ渡す
  const queryParams = new URLSearchParams(req.query).toString();
  const targetUrl = `${GAS_URL}?${queryParams}`;

  try {
    const response = await fetch(targetUrl);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
