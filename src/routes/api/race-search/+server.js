import { json } from '@sveltejs/kit';
import { getEnv } from '$lib/env.js';

export async function POST({ request, platform }) {
	const env = getEnv(platform);

	const anthropicKey = env.ANTHROPIC_API_KEY;
	if (!anthropicKey) {
		return json({ error: 'Clé API Anthropic non configurée' }, { status: 500 });
	}

	const { query } = await request.json();
	if (!query || query.length < 3) {
		return json({ error: 'Requête trop courte' }, { status: 400 });
	}

	try {
		const response = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': anthropicKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 1000,
				tools: [
					{
						type: 'web_search_20250305',
						name: 'web_search'
					}
				],
				messages: [
					{
						role: 'user',
						content: `Recherche des informations sur cette course à pied : "${query}"

Trouve les informations suivantes et retourne UNIQUEMENT un JSON valide (sans markdown, sans backticks) avec cette structure exacte :
{
  "found": true/false,
  "name": "nom officiel de la course",
  "date": "YYYY-MM-DD" (prochaine édition),
  "distance_km": nombre (distance principale en km),
  "distances": ["5K", "10K", "Semi", etc.] (toutes les distances proposées),
  "location": "ville, pays",
  "elevation_gain": nombre ou null (dénivelé positif en mètres si disponible),
  "profile": "plat" / "vallonné" / "montagneux" / null,
  "url": "site officiel de la course",
  "description": "courte description en 1-2 phrases"
}

Si tu ne trouves pas la course, retourne : {"found": false}
Retourne UNIQUEMENT le JSON, rien d'autre.`
					}
				]
			})
		});

		if (!response.ok) {
			const errorData = await response.text();
			console.error('Anthropic API error:', errorData);
			return json({ error: 'Erreur API Anthropic' }, { status: 502 });
		}

		const data = await response.json();

		// Extract text from response content blocks
		const textContent = data.content
			.filter(block => block.type === 'text')
			.map(block => block.text)
			.join('');

		// Parse JSON from response
		const cleaned = textContent.replace(/```json|```/g, '').trim();

		try {
			const raceInfo = JSON.parse(cleaned);
			return json(raceInfo);
		} catch (parseErr) {
			console.error('Failed to parse race info:', cleaned);
			return json({ found: false, error: 'Impossible de parser la réponse' });
		}
	} catch (err) {
		console.error('Race search error:', err);
		return json({ error: `Erreur: ${err.message}` }, { status: 500 });
	}
}
