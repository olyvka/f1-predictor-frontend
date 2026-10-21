// Firebase вантажиться окремим чанком (див. AuthProvider): SDK важить
// більше за решту застосунку. Firestore — у db.js, щоб не тягнути його
// туди, де потрібна лише сесія користувача.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "./config";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
