

// ================================================================================
// FILE: /api/payment/create-checkout-session.js
// FUNZIONE: Crea una sessione di checkout Stripe. È l'endpoint che sostituisce
//           completamente la logica del form `Formspree`.
// ================================================================================
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { services, customerEmail, generatedCode, prompt } = request.body;
        // NOTA DI SICUREZZA: I prezzi non vengono MAI presi dal client.
        // Vengono definiti qui sul backend per evitare manipolazioni.
        const priceMap = {
            'service-manual': { name: 'Perfezionamento Manuale', unit_amount: 25000, type: 'one_time' },
            'service-hosting': { name: 'Dominio & Hosting Gestito', unit_amount: 4500, type: 'one_time' }, // Annuale gestito come una tantum
            'service-management': { name: 'Gestione Completa "Senza Pensieri"', unit_amount: 2000, type: 'recurring' },
        };

        const line_items = [];
        let recurringPriceId = 'YOUR_STRIPE_RECURRING_PRICE_ID'; // ID del prezzo ricorrente creato su Stripe
        let hasRecurring = false;
        let hasServices = false;
        let servicesSummary = '';

        for (const service of services) {
            if (priceMap[service.id]) {
                hasServices = true;
                const priceInfo = priceMap[service.id];
                servicesSummary += `${priceInfo.name}\n`;

                if (priceInfo.type === 'one_time') {
                    line_items.push({
                        price_data: {
                            currency: 'eur',
                            product_data: { name: priceInfo.name },
                            unit_amount: priceInfo.unit_amount,
                        },
                        quantity: 1,
                    });
                } else if (priceInfo.type === 'recurring') {
                    hasRecurring = true;
                    line_items.push({
                        price: recurringPriceId,
                        quantity: 1
                    });
                }
            }
        }
        
        // Se non ci sono servizi, si "compra" solo il codice (prezzo simbolico o zero)
        if (line_items.length === 0) {
             line_items.push({
                price_data: {
                    currency: 'eur',
                    product_data: { name: 'Codice Sorgente Sito Web AI' },
                    unit_amount: 500, // Es. 5€ per il solo codice
                },
                quantity: 1,
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'paypal'],
            mode: hasRecurring ? 'subscription' : 'payment',
            line_items,
            customer_email: customerEmail,
            success_url: `${request.headers.origin}/?payment_success=true`,
            cancel_url: `${request.headers.origin}/?payment_canceled=true`,
            // Passiamo i dati che ci serviranno nel webhook
            metadata: {
                customerEmail,
                servicesSummary,
                generatedCode, // ATTENZIONE: Limite di 500 caratteri per la metadata
                prompt,
                hasServices: hasServices.toString(),
            }
        });
        
        return response.status(200).json({ sessionId: session.id, url: session.url });

    } catch (error) {
        console.error('Error creating checkout session:', error);
        return response.status(500).json({ error: 'Failed to create payment session.' });
    }
}

