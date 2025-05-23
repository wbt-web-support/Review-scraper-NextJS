import { useEffect, useState } from "react";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useRouter } from 'next/router'; 
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useSession } from 'next-auth/react';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."), 
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { status: authStatus } = useSession();

  useEffect(() => {
    if (authStatus === 'authenticated') {
      const callbackUrl = router.query.callbackUrl as string || "/dashboard";
      router.push(callbackUrl);
    }
  }, [authStatus, router]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });


  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        redirect: false, 
        email: data.email,
        password: data.password,
      });
      if (result?.error) {
        throw new Error(result.error === "CredentialsSignin" ? "Invalid email or password." : result.error);
      }
      if (result?.ok) {
        toast({
          title: "Success",
          description: "You have successfully logged in!",
        });
        const callbackUrl = router.query.callbackUrl as string || "/dashboard";
        router.push(callbackUrl);
      } else if (!result?.ok && !result?.error) {
          throw new Error("Login attempt failed. Please try again.");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authStatus === 'loading' || authStatus === 'authenticated') {
    return (
      <div className="min-h-screen bg-background dark:bg-background flex items-center justify-center p-4 transition-theme">
        <p>Loading...</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background dark:bg-background flex items-center justify-center p-4 transition-theme">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <span className="text-primary text-3xl mr-2 transition-theme">
              <i className="fas fa-comment-dots"></i>
            </span>
            <h1 className="font-heading font-bold text-2xl text-foreground dark:text-foreground transition-theme">ReviewHub</h1>
          </div>
          <p className="text-muted-foreground dark:text-muted-foreground transition-theme">Sign in to your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="you@example.com" 
                          {...field} 
                          disabled={isLoading}
                          autoComplete="email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter your password" 
                          {...field} 
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <i className="fas fa-spinner fa-spin mr-2"></i> Signing in...
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <div className="text-sm text-center text-muted-foreground dark:text-muted-foreground transition-theme">
              Don&apos;t have an account?{" "}
              <Link 
                href="/register" 
                className="text-primary hover:text-primary-hover dark:text-primary dark:hover:text-primary-hover transition-theme font-medium"
              >
                  Sign up
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Login;
