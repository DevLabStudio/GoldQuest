
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter(); // Get router instance

  const handleLogin = () => {
    setError(''); // Clear previous errors
    // Basic validation (in a real app, use react-hook-form/zod)
    if (!username || !password) {
      setError('Please enter username and password.');
      return;
    }
    // Simulate login check (replace with actual logic)
    // For this demo, any username/password works
    console.log('Attempting login with:', username);
    try {
      login(username, password); // Call the login function from the hook
      console.log('Login successful, redirecting...');
      // No explicit redirect needed here if layout handles it based on auth state
      // router.push('/'); // Or redirect manually if layout doesn't re-render automatically
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">The Golden Game</CardTitle>
          <CardDescription>Enter your credentials to access your dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleLogin}>Login</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
