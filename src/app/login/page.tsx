'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthContext } from "@/contexts/AuthContext"; // Use new AuthContext
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { Chrome } from "lucide-react"; // For Google icon
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';


export default function LoginPage() {
  const { signIn, signInWithGoogle, isFirebaseActive, firebaseError } = useAuthContext(); // Get Firebase methods and status
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFirebaseActive) {
      setError(firebaseError || "Login service is currently unavailable. Please try again later.");
      return;
    }
    setError('');
    setIsLoading(true);
    if (!email || !password) {
      setError('Please enter email and password.');
      setIsLoading(false);
      return;
    }
    try {
      await signIn(email, password);
      router.push('/'); // Redirect to dashboard or home on successful login
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Login failed. Invalid credentials or user not found.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isFirebaseActive) {
      setError(firebaseError || "Google login service is currently unavailable. Please try again later.");
      return;
    }
    setError('');
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push('/'); // Redirect on successful Google login
    } catch (err: any) {
      console.error('Google login failed:', err);
      setError(err.message || 'Google login failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">The Golden Game</CardTitle>
          <CardDescription>Enter your credentials to access your dashboard</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {firebaseError && !isFirebaseActive && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Service Unavailable</AlertTitle>
                <AlertDescription>
                  {firebaseError} Please ensure your Firebase environment variables are correctly set.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || isGoogleLoading || !isFirebaseActive}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading || isGoogleLoading || !isFirebaseActive}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading || !isFirebaseActive}>
              {isLoading ? 'Logging In...' : 'Login'}
            </Button>
            <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={isLoading || isGoogleLoading || !isFirebaseActive}>
              <Chrome className="mr-2 h-4 w-4" />
              {isGoogleLoading ? 'Connecting...' : 'Login with Google'}
            </Button>
            <Link href="/signup" className="text-sm text-muted-foreground hover:text-primary">
                Don't have an account? Sign Up
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

