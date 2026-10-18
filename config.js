// config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAF82ejc4ZUA_lHgnGlXMjpqKJgscHJTeo",
    authDomain: "bakhshish-karaya.firebaseapp.com",
    projectId: "bakhshish-karaya",
    storageBucket: "bakhshish-karaya.firebasestorage.app",
    messagingSenderId: "515253414064",
    appId: "1:515253414064:web:4568a8dd73e3e9cfd77375"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Collections
export const propertiesCol = collection(db, 'properties');
export const requestsCol = collection(db, 'property_requests');

// Cloudinary Config
export const CLOUDINARY_CLOUD_NAME = 'djg3hv9gl';
export const CLOUDINARY_UPLOAD_PRESET = 'bk_karaya';

// Common Helper Functions
export function formatPKR(val) {
    return 'PKR ' + Number(val || 0).toLocaleString('en-PK');
}