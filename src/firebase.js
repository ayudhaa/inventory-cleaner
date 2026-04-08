import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC7ssO8dvHm6Jwk0Hs7w6OOXp3-pcJ6zpM",
  authDomain: "cleaner-inventory-41ec5.firebaseapp.com",
  projectId: "cleaner-inventory-41ec5",
  storageBucket: "cleaner-inventory-41ec5.firebasestorage.app",
  messagingSenderId: "92352603938",
  appId: "1:92352603938:web:294e495cefcca44b86e77b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);