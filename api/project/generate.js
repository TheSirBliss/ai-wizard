/*
=================================================================================
 AI SITE WIZARD - BACKEND UNIFICATO (FASE 2)
 Architettura: Vercel Serverless Functions (Node.js)
 Database: Vercel Postgres (o altro DB SQL/NoSQL)
 Servizi: Stripe, Resend, Google Gemini
=================================================================================
*/

/*
--- STRUTTURA DELLE CARTELLE CONSIGLIATA ---
/api
  /auth
    - register.js
    - login.js
  /project
    - generate.js  <-- NUOVA API per la generazione sicura
    - list.js      <-- NUOVA API per ottenere la cronologia
  /payment
    - create-checkout-session.js <-- NUOVA API per avviare il pagamento
    - handle-webhooks.js         <-- EVOLUZIONE del tuo handle-payment.js
*/


// ================================================================================
// FILE: /api/project/generate.js
// FUNZIONE: API sicura per generare il codice del sito.
//           Nasconde la API key di Gemini e logga le richieste.
// ================================================================================
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    // In un'app completa, qui verificheremmo il token JWT dell'utente
    // const userId = verifyUserToken(request.headers.authorization);
    // if (!userId) return response.status(401).json({ error: 'Unauthorized' });

    const { prompt } = request.body;

    if (!prompt) {
        return response.status(400).json({ error: 'Prompt is required' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return response.status(500).json({ error: 'Gemini API Key not configured on server' });
    }

    const fullPrompt = `Sei un esperto sviluppatore web full-stack. Crea una landing page completa basata sulla seguente descrizione. Il codice deve essere un singolo file HTML, usando Tailwind CSS per lo stile da un CDN. Includi sezioni pertinenti e contenuti di esempio. Il design deve essere moderno, pulito e professionale. Non includere spiegazioni o markdown, solo il codice HTML completo che inizia con <!DOCTYPE html>. Descrizione utente: "${prompt}"`;

    try {
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
        });

        if (!geminiResponse.ok) {
            throw new Error(`API Error: ${geminiResponse.status}`);
        }

        const result = await geminiResponse.json();
        const generatedHtml = result.candidates[0].content.parts[0].text;

        // QUI: Salvare il progetto nel database associato all'utente (userId)
        // const newProject = await db.collection('projects').add({ userId, prompt, generatedHtml, createdAt: new Date() });

        return response.status(200).json({ html: generatedHtml });

    } catch (error) {
        console.error('Error generating site:', error);
        return response.status(500).json({ error: 'Failed to generate site.' });
    }
}
