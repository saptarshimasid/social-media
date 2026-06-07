"use client";

import React, { useState } from "react";
import { Mail, Key, User, Calendar, ArrowLeft, Loader2 } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  const supabase = createClient();
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (!email || !password) {
      setErrorMsg("Please enter both email address and password.");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;

      if (data?.session) {
        setSuccessMsg("Logged in successfully! Redirecting...");
        router.push("/");
        router.refresh();
      } else {
        throw new Error("Unable to establish session. Please try again.");
      }
    } catch (error) {
      const err = error as Error;
      setErrorMsg(err.message || "Failed to sign in. Verify your credentials.");
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (!email || !fullName || !age || !password || !confirmPassword) {
      setErrorMsg("Please fill in all fields.");
      setLoading(false);
      return;
    }

    const parsedAge = parseInt(age);
    if (isNaN(parsedAge) || parsedAge <= 0) {
      setErrorMsg("Please enter a valid age.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName.trim(),
            age: parsedAge,
          },
        },
      });

      if (error) throw error;

      // Case A: User logged in immediately (Email confirmation disabled in Supabase)
      if (data?.session) {
        setSuccessMsg("Account created and logged in! Redirecting...");
        router.push("/");
        router.refresh();
      } 
      // Case B: Confirmation email sent (Email confirmation enabled in Supabase)
      else if (data?.user) {
        setSuccessMsg("Registration successful! Please check your email inbox to confirm your account.");
        // Clear inputs
        setEmail("");
        setFullName("");
        setAge("");
        setPassword("");
        setConfirmPassword("");
      } else {
        throw new Error("Registration failed. Please try again.");
      }
    } catch (error) {
      const err = error as Error;
      setErrorMsg(err.message || "Failed to sign up.");
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (!email) {
      setErrorMsg("Please enter your email address.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
      });

      if (error) throw error;

      setSuccessMsg("Password reset link sent! Please check your email inbox.");
      setEmail("");
    } catch (error) {
      const err = error as Error;
      setErrorMsg(err.message || "Failed to send reset link. Verify the email.");
      setLoading(false);
    }
  };

  const switchMode = (newMode: typeof mode) => {
    setMode(newMode);
    setErrorMsg("");
    setSuccessMsg("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-background to-background">
      {/* Theme Toggle Top Right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md p-8 rounded-3xl bg-card border border-border/40 shadow-xl glass relative overflow-hidden transition-all duration-300">
        {/* Glow decoration */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-6 select-none">
          <div className="w-16 h-16 rounded-full bg-white border border-border/30 flex items-center justify-center shadow-md mx-auto mb-3">
            <span className="text-3xl font-black bg-gradient-to-br from-blue-500 to-indigo-600 bg-clip-text text-transparent leading-none" style={{fontFamily:'Inter,system-ui,sans-serif'}}>S</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">
            SocialConnect
          </h1>
          <p className="text-xs text-muted font-medium">
            {mode === "signin" && "Sign in with your email address and password"}
            {mode === "signup" && "Create your social profile in seconds"}
            {mode === "forgot" && "Receive a secure password reset link"}
          </p>
        </div>

        {/* Notification Banners */}
        {errorMsg && (
          <div className="p-3 mb-4 rounded-xl text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 animate-in fade-in duration-200">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 mb-4 rounded-xl text-xs font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 animate-in fade-in duration-200">
            {successMsg}
          </div>
        )}

        {/* MODE A: SIGN IN */}
        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-2">
                Email Address
              </label>
              <div className="flex border border-border rounded-2xl bg-secondary overflow-hidden focus-within:border-primary transition-colors px-3 items-center">
                <Mail size={16} className="text-muted mr-2.5" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 bg-transparent text-sm focus:outline-none text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-2 flex items-center justify-between">
                <span>Password</span>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-primary hover:underline font-bold"
                >
                  Forgot Password?
                </button>
              </label>
              <div className="flex border border-border rounded-2xl bg-secondary overflow-hidden focus-within:border-primary transition-colors px-3 items-center">
                <Key size={16} className="text-muted mr-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 bg-transparent text-sm focus:outline-none text-foreground"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-2xl transition-all hover:bg-primary/95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <span>Sign In</span>}
            </button>

            <p className="text-center text-xs text-muted mt-4">
              {"Don't have an account?"}{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="text-primary font-bold hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </p>
          </form>
        )}

        {/* MODE B: SIGN UP */}
        {mode === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-4 animate-in fade-in duration-200">
            <div>
              <label className="block text-xs font-semibold text-muted mb-2">
                Email Address
              </label>
              <div className="flex border border-border rounded-2xl bg-secondary overflow-hidden focus-within:border-primary transition-colors px-3 items-center">
                <Mail size={16} className="text-muted mr-2.5" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 bg-transparent text-sm focus:outline-none text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-muted mb-2 flex items-center gap-1">
                  <User size={12} /> Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-12 px-4 bg-secondary border border-border focus:border-primary focus:outline-none rounded-2xl text-sm text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-2 flex items-center gap-1">
                  <Calendar size={12} /> Age
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={120}
                  placeholder="21"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full h-12 px-4 bg-secondary border border-border focus:border-primary focus:outline-none rounded-2xl text-sm text-foreground text-center"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-2">
                Password
              </label>
              <div className="flex border border-border rounded-2xl bg-secondary overflow-hidden focus-within:border-primary transition-colors px-3 items-center">
                <Key size={16} className="text-muted mr-2.5" />
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 bg-transparent text-sm focus:outline-none text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-2">
                Re-enter Password
              </label>
              <div className="flex border border-border rounded-2xl bg-secondary overflow-hidden focus-within:border-primary transition-colors px-3 items-center">
                <Key size={16} className="text-muted mr-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-12 bg-transparent text-sm focus:outline-none text-foreground"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-2xl transition-all hover:bg-primary/95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <span>Sign Up</span>}
            </button>

            <p className="text-center text-xs text-muted mt-2">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="text-primary font-bold hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </p>
          </form>
        )}

        {/* MODE C: FORGOT PASSWORD */}
        {mode === "forgot" && (
          <form onSubmit={handleForgotPassword} className="space-y-4 animate-in fade-in duration-200">
            <p className="text-xs text-muted text-center max-w-xs mx-auto leading-relaxed mb-2">
              Enter your registered email address. We will send you a secure link to reset your account password.
            </p>
            <div>
              <label className="block text-xs font-semibold text-muted mb-2">
                Email Address
              </label>
              <div className="flex border border-border rounded-2xl bg-secondary overflow-hidden focus-within:border-primary transition-colors px-3 items-center">
                <Mail size={16} className="text-muted mr-2.5" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 bg-transparent text-sm focus:outline-none text-foreground"
                />
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="flex-1 h-12 border border-border rounded-2xl hover:bg-secondary transition-colors text-xs font-semibold cursor-pointer flex items-center justify-center gap-1"
              >
                <ArrowLeft size={12} />
                <span>Back</span>
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold rounded-2xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <span>Send Reset Link</span>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
