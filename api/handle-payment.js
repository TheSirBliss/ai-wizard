// Importa le librerie necessarie
import { Resend } from 'resend';
import Stripe from 'stripe';

// Inizializza Stripe e Resend con le tue API keys
// Le prenderemo dagli "Environment Variables" di Vercel per sicurezza
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// Questa è la funzione serverless che Vercel eseguirà
export default async function handler(request, response) {
  // 1. Estrai l'evento di Stripe dalla richiesta
  let event;
  try {
    const signature = request.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(
      request.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`⚠️ Errore nella verifica della firma del webhook: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2. Gestisci solo l'evento di pagamento completato
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Estrai le informazioni che abbiamo passato durante la creazione del checkout
    const customerEmail = session.customer_details.email;
    const servicesSummary = session.metadata.services_summary;
    const generatedCode = session.metadata.generated_code;
    const hasServices = session.metadata.has_services === 'true';

    try {
      // **Logica di Automazione**
      if (hasServices) {
        // SCENARIO B: Acquisto con servizi. Invia notifica al team.
        await resend.emails.send({
          from: 'tua_email@tuodominio.com', // Configura un dominio su Resend
          to: 'email_del_tuo_team@esempio.com', // La TUA email
          subject: `🚀 Nuovo Ordine con Servizi da ${customerEmail}`,
          html: `
            <h1>Nuova Richiesta di Servizi</h1>
            <p><strong>Cliente:</strong> ${customerEmail}</p>
            <h3>Servizi Richiesti:</h3>
            <pre>${servicesSummary}</pre>
            <hr>
            <h3>Codice Generato (riferimento):</h3>
            <pre>${generatedCode}</pre>
          `,
        });
      } else {
        // SCENARIO A: Acquisto solo codice. Invia codice al cliente.
        await resend.emails.send({
          from: 'tua_email@tuodominio.com',
          to: customerEmail,
          subject: 'Grazie per il tuo acquisto! Ecco il codice del tuo sito',
          html: `<p>Grazie per aver utilizzato AI Site Wizard. Trovi il codice del tuo sito in allegato.</p>`,
          attachments: [
            {
              filename: 'index.html',
              content: generatedCode,
            },
          ],
        });
      }
      console.log('Email inviata con successo!');
    } catch (error) {
      console.error('Errore durante l\'invio dell\'email:', error);
      return response.status(500).json({ error: 'Errore nell\'invio dell\'email' });
    }
  }

  // 3. Rispondi a Stripe che tutto è andato bene
  response.status(200).json({ received: true });
}
