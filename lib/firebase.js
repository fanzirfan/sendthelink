// lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAlIww7KiZ5y0wXyRhX2FOhKbN3Xwl-gOA",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sendthelink-fanz.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sendthelink-fanz",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sendthelink-fanz.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "769135895346",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:769135895346:web:47161efc5adc9c4f416d2b"
};

// Initialize Firebase only once
let app;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApps()[0];
}

export const db = getFirestore(app);
