import { serve } from "https://deno.land/std/http/server.ts";

// Barber emails. Keys can be barber IDs (UUIDs) or names.
// Add the UUIDs as extra keys later if you want strict ID-based routing.
const BARBER_EMAILS: Record<string, string> = {
  ziko: "mohamedjlaiel.pro@gmail.com",
  yassine: "mohamedjlaiel5000@gmail.com",
  // "paste-ziko-uuid-here": "mohamedjlaiel.pro@gmail.com",
  // "paste-yassine-uuid-here": "mohamedjlaiel5000@gmail.com",
};

const SHOP_NAME = "Ziko Barbershop";
const TIMEZONE = "Africa/Tunis";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM");

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: TIMEZONE,
  });
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "En attente",
    accepted: "Acceptée",
    denied: "Refusée",
    cancelled: "Annulée",
    completed: "Terminée",
    no_show: "Absence",
  };
  return labels[status] || status;
}

function barberEmailFor(barberId: string, barberName: string): string {
  const id = barberId.toLowerCase();
  const name = barberName.toLowerCase();

  if (BARBER_EMAILS[id]) return BARBER_EMAILS[id];
  if (name.includes("ziko")) return BARBER_EMAILS.ziko;
  if (name.includes("yassine") || name.includes("yacine")) return BARBER_EMAILS.yassine;
  return "";
}

function shell(content: string): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#0f0f0f;padding:24px 10px;">
      <div style="max-width:600px;margin:0 auto;background:#1c1c1c;border:1px solid #3a3a3a;border-radius:10px;">
        <div style="padding:20px 26px;border-bottom:1px solid #3a3a3a;">
          <h1 style="margin:0;color:#d4af37;font-size:20px;">${SHOP_NAME}</h1>
        </div>
        <div style="padding:26px;color:#eeeeee;font-size:15px;line-height:1.6;">
          ${content}
        </div>
      </div>
    </div>
  `;
}

serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record || {};
    const oldRecord = body.old_record || {};
    const eventType = body.type || body.event || "";

    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "Missing RESEND_API_KEY secret" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!EMAIL_FROM) {
      return new Response(
        JSON.stringify({ error: "Missing EMAIL_FROM secret" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const customerEmail = record.customer_email || record.email || "";
    const customerName = record.customer_name || record.guest_name || "Client";
    const phone = record.phone || record.guest_phone || "";
    const barberId = record.barber_id || "";
    const barberName = record.barber_name || "votre coiffeur";
    const serviceName = record.service_name || "Prestation";
    const bookingDate = formatDate(record.starts_at || "");
    const price = record.price_at_booking ?? "";
    const notes = record.notes || "";
    const status = record.status || "pending";
    const denialReason = record.denial_reason || "";

    // 1) Email to the selected barber (new booking)
    let ownerEmailSent = null;

    if (eventType === "INSERT" || eventType === "booking.created") {
      const barberEmail = barberEmailFor(barberId, barberName);

      if (!barberEmail) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Aucun email configuré pour le coiffeur : " + barberName,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const ownerResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [barberEmail],
          subject: "Nouvelle réservation reçue",
          html: shell(`
            <h2 style="margin:0 0 14px;color:#ffffff;">Nouvelle réservation</h2>
            <p>Vous avez une nouvelle réservation. Connectez-vous à votre tableau de bord pour l'accepter ou la refuser.</p>
            <p><b>Coiffeur :</b> ${esc(barberName)}</p>
            <p><b>Client :</b> ${esc(customerName)}</p>
            <p><b>Email :</b> ${esc(customerEmail)}</p>
            <p><b>Téléphone :</b> ${esc(phone)}</p>
            <p><b>Prestation :</b> ${esc(serviceName)}</p>
            <p><b>Date et heure :</b> ${esc(bookingDate)}</p>
            <p><b>Prix :</b> ${esc(price)}</p>
            ${notes ? `<p><b>Notes :</b> ${esc(notes)}</p>` : ""}
            <p><b>Statut :</b> ${esc(statusLabel(status))}</p>
          `),
        }),
      });

      ownerEmailSent = await ownerResponse.json();
    }

    // 2) Email to the customer (accepted or declined)
    let customerEmailSent = null;

    const decided =
      (eventType === "UPDATE" || eventType === "booking.decided") &&
      (status === "accepted" || status === "denied") &&
      oldRecord.status !== status;

    if (decided && customerEmail) {
      const accepted = status === "accepted";

      const customerResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [customerEmail],
          subject: accepted
            ? "Votre réservation est confirmée"
            : "Votre réservation a été refusée",
          html: shell(`
            <h2 style="margin:0 0 14px;color:#ffffff;">
              ${accepted ? "Votre réservation est confirmée !" : "Votre réservation a été refusée"}
            </h2>
            <p>Bonjour ${esc(customerName)},</p>
            <p>
              ${
                accepted
                  ? `${esc(barberName)} a accepté votre réservation. Nous avons hâte de vous voir !`
                  : `Malheureusement ${esc(barberName)} n'a pas pu prendre votre réservation. Vous pouvez réserver un autre créneau à tout moment.`
              }
            </p>
            <p><b>Prestation :</b> ${esc(serviceName)}</p>
            <p><b>Coiffeur :</b> ${esc(barberName)}</p>
            <p><b>Date et heure :</b> ${esc(bookingDate)}</p>
            <p><b>Prix :</b> ${esc(price)}</p>
            ${denialReason ? `<p><b>Motif :</b> ${esc(denialReason)}</p>` : ""}
            <p>Merci de votre confiance.</p>
          `),
        }),
      });

      customerEmailSent = await customerResponse.json();
    }

    return new Response(
      JSON.stringify({
        success: true,
        ownerEmailSent,
        customerEmailSent,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
