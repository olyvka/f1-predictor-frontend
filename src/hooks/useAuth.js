import { useContext } from "react";
import { AuthContext } from "../context/authContext";

/** { user, ready, signIn, signUp, signInWithGoogle, resetPassword, signOut } */
export function useAuth() {
  return useContext(AuthContext);
}
