import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./authContext";
import i18n from "../i18n";

// Один проміс на застосунок: Firebase SDK + функції auth вантажаться
// лише раз і окремим чанком.
let sdkPromise = null;
function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([import("../firebase"), import("firebase/auth")]).then(([fb, authSdk]) => ({ ...fb, authSdk }));
  }
  return sdkPromise;
}

// Сесію Firebase зберігає сам (IndexedDB), тож після перезавантаження
// onAuthStateChanged одразу повертає користувача. ready=false — поки ще
// невідомо, чи хтось увійшов (щоб не мигала кнопка "Увійти").
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  // updateProfile змінює той самий об'єкт user — лічильник, щоб перемалювати.
  const [profileVersion, setProfileVersion] = useState(0);

  useEffect(() => {
    let unsubscribe = () => {};
    let alive = true;
    loadSdk()
      .then(({ auth, authSdk }) => {
        if (!alive) return;
        unsubscribe = authSdk.onAuthStateChanged(auth, (u) => {
          setUser(u);
          setReady(true);
        });
      })
      .catch(() => setReady(true));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => {
    // Листи (скидання пароля) — мовою інтерфейсу.
    const withAuth = async (fn) => {
      const { auth, authSdk } = await loadSdk();
      auth.languageCode = i18n.language;
      return fn(auth, authSdk);
    };
    return {
      user,
      ready,
      profileVersion,
      signIn: (email, password) => withAuth((auth, s) => s.signInWithEmailAndPassword(auth, email, password)),
      signUp: (email, password, name) =>
        withAuth(async (auth, s) => {
          const cred = await s.createUserWithEmailAndPassword(auth, email, password);
          if (name) {
            await s.updateProfile(cred.user, { displayName: name });
            setProfileVersion((v) => v + 1);
          }
          return cred;
        }),
      signInWithGoogle: () => withAuth((auth, s) => s.signInWithPopup(auth, new s.GoogleAuthProvider())),
      resetPassword: (email) => withAuth((auth, s) => s.sendPasswordResetEmail(auth, email)),
      signOut: () => withAuth((auth, s) => s.signOut(auth)),
    };
  }, [user, ready, profileVersion]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
