// Generates a VAPID keypair for Web Push and prints .env-ready lines.
// Usage: npm run gen:vapid
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("Add these lines to server/.env (keep the private key secret!):");
console.log("");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:admin@pulse.chat");
