
// ================================================================================
// FILE: /api/payment/handle-webhooks.js
// FUNZIONE: EVOLUZIONE del tuo `handle-payment.js`.
//           La logica principale è la stessa, ma ora si integra con il DB.
// ================================================================================
import { Resend } from 'resend';
import Stripe from 'stripe';
// import { db } from './_lib/db'; // Esempio di import del client DB

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(request, response) {
    let event;
    try {
        const signature = request.headers['stripe-signature'];
        event = stripe.webhooks.constructEvent(request.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`⚠️ Webhook signature verification failed: ${err.message}`);
        return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { customerEmail, servicesSummary, generatedCode, prompt, hasServices } = session.metadata;

        try {
            // ---> INTEGRAZIONE DATABASE <---
            // 1. Trova o crea l'utente nel DB
            // let user = await db.findUserByEmail(customerEmail) || await db.createUser(customerEmail);
            
            // 2. Salva la transazione e il progetto nel DB
            // await db.createPurchase({
            //     userId: user.id,
            //     stripeSessionId: session.id,
            //     prompt,
            //     services: servicesSummary,
            //     amount: session.amount_total / 100,
            //     createdAt: new Date()
            // });
            // console.log('Purchase saved to database.');

            // ---> LOGICA EMAIL (invariata ma ora più affidabile) <---
            if (hasServices === 'true') {
                await resend.emails.send({
                    from: 'noreply@yourdomain.com',
                    to: 'team@yourdomain.com',
                    subject: `🚀 Nuovo Ordine con Servizi da ${customerEmail}`,
                    html: `<h1>Nuova Richiesta di Servizi</h1><p><strong>Cliente:</strong> ${customerEmail}</p><h3>Servizi Richiesti:</h3><pre>${servicesSummary}</pre><hr><h3>Prompt (riferimento):</h3><p>${prompt}</p>`,
                });
            } else {
                await resend.emails.send({
                    from: 'noreply@yourdomain.com',
                    to: customerEmail,
                    subject: 'Grazie per il tuo acquisto! Ecco il codice del tuo sito',
                    html: `<p>Grazie per aver utilizzato AI Site Wizard. Trovi il codice del tuo sito in allegato.</p>`,
                    attachments: [{ filename: 'index.html', content: generatedCode }],
                });
            }
            console.log('Email sent successfully!');

        } catch (error) {
            console.error('Error handling webhook:', error);
            return response.status(500).json({ error: 'Internal server error during webhook processing.' });
        }
    }

    response.status(200).json({ received: true });
}
