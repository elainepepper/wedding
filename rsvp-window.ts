"use client";

import { FormEvent, useEffect, useState } from "react";
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { firebaseAuth } from "../../lib/firebase-client";
import { ManagerApp } from "./ManagerApp";

export function ManagerGate() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(firebaseAuth, async (nextUser) => {
    setUser(nextUser);
    setToken(nextUser ? await nextUser.getIdToken() : "");
    setLoading(false);
  }), []);

  const emailLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try { await signInWithEmailAndPassword(firebaseAuth, email, password); }
    catch { setError("That sign-in could not be verified. Check your email, password and manager access."); }
  };

  if (loading) return <div className="manager-loading" role="status"><p>Opening the guest book…</p></div>;
  if (user && token) return <ManagerApp initialAdminName={user.displayName || user.email || "Manager"} signedInEmail={user.email || ""} authToken={token} onSignOut={() => signOut(firebaseAuth)} />;
  return <main className="manager-login"><form onSubmit={emailLogin}><p>Elaine &amp; Haykal</p><h1>Guest Manager</h1><span>Private access for the couple and their wedding planner.</span><label><b>Email</b><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label><label><b>Password</b><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>{error ? <em role="alert">{error}</em> : null}<button type="submit">Sign in</button><i>or</i><button type="button" className="google-login" onClick={async () => { setError(""); try { await signInWithPopup(firebaseAuth, new GoogleAuthProvider()); } catch { setError("Google sign-in was not completed."); } }}>Continue with Google</button></form></main>;
}
