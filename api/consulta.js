export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

    const { dni } = req.body;
    const TOKEN_DECOLECTA = 'sk_12872.tVZkhVY0sLN5F35x3MAW8etgYIHNV0tZ'; 

    try {
        const response = await fetch(`https://api.decolecta.com/v1/reniec/dni?numero=${dni}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN_DECOLECTA}`
            }
        });

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}