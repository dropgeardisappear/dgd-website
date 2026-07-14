"use client";

export default function TestEmail() {
  async function sendEmail() {
    const res = await fetch("/api/send-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    body: JSON.stringify({
  email: "dropgeardisappeardgd@gmail.com",
  subject: "DGD Test",
  message: "Your DGD notifications are working!",
}),
    });

    const data = await res.json();
    alert(JSON.stringify(data));
  }

  return (
    <main style={{ padding: 40 }}>
      <button onClick={sendEmail}>Send Test Email</button>
    </main>
  );
}