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
import Image from 'next/image';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce delay-75"></div>
          <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce delay-150"></div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Header Section */}
        <div className="text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="p-3">
              <Image
                src="/logo.png"
                alt="We Build Trades Logo"
                width={230}
                height={60}
                className="object-contain"
                priority
              />
            </div>
          </div>
          
          {/* Brand Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Review Hub
          </h1>
          <p className="text-gray-600 text-sm">
          Easily collect Google & Facebook reviews with one click.
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="bg-white shadow-lg border-0 rounded-xl">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-xl font-semibold text-gray-900">
              Welcome back
            </CardTitle>
            <CardDescription className="text-gray-600">
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          
          <CardContent className="px-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Email address
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="Enter your email" 
                          {...field} 
                          disabled={isLoading}
                          autoComplete="email"
                          className="h-11 border-gray-300 focus:border-gray-900 focus:ring-gray-900 rounded-lg bg-white placeholder:text-gray-400"
                        />
                      </FormControl>
                      <FormMessage className="text-sm text-red-600" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Password
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter your password" 
                          {...field} 
                          disabled={isLoading}
                          className="h-11 border-gray-300 focus:border-gray-900 focus:ring-gray-900 rounded-lg bg-white placeholder:text-gray-400"
                        />
                      </FormControl>
                      <FormMessage className="text-sm text-red-600" />
                    </FormItem>
                  )}
                />

                <div className="pt-2">
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Signing in...
                      </div>
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
          
          <CardFooter className="px-6 pb-6">
            <div className="w-full space-y-4">
              {/* Forgot Password */}
              <div className="text-center">
                <Link 
                  href="#" 
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200"
                >
                  Forgot your password?
                </Link>
              </div>
              
              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">New to Review Hub?</span>
                </div>
              </div>
              
              {/* Sign Up Link */}
              <div className="text-center">
                <Link 
                  href="/register" 
                  className="text-sm font-medium text-gray-900 hover:text-gray-700 transition-colors duration-200"
                >
                  Create an account
                </Link>
              </div>
            </div>
          </CardFooter>
        </Card>
        
        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            © 2024 We Build Trades. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;