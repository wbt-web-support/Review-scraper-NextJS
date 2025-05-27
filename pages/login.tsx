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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="animate-pulse">
          <div className="w-8 h-8 bg-primary rounded-full animate-bounce"></div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-blue-400/10 to-purple-600/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header section with logo and improved styling */}
          <div className="text-center mb-8 animate-fade-in">
            {/* Logo Section */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-lg opacity-30 animate-pulse"></div>
                <div className="relative bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-white/40">
                  <Image
                    src="https://webuildtrades.com/wp-content/uploads/WeBuildTrades-logo-1.png"
                    alt="We Build Trades Logo"
                    width={150}
                    height={75}
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            </div>
            
            {/* Brand Titles */}
            <div className="mb-4">
              <h1 className="font-bold text-4xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Review Hub
              </h1>
              <p className="text-gray-600 text-lg font-medium leading-relaxed max-w-sm mx-auto">
                Easily collect Google & Facebook reviews with one click.
              </p>
            </div>
          </div>

          {/* Enhanced card with glassmorphism effect */}
          <div className="relative group">
            {/* Card glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            
            <Card className="relative bg-white/80 backdrop-blur-xl border-white/20 shadow-2xl rounded-2xl overflow-hidden">
              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-white/30 pointer-events-none"></div>
              
              <CardHeader className="relative pb-8 pt-8">
                <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Sign In
                </CardTitle>
                <CardDescription className="text-center text-gray-600 text-base">
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              
              <CardContent className="relative px-8 pb-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-sm font-semibold text-gray-700">Email Address</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i className="fas fa-envelope text-gray-400"></i>
                              </div>
                              <Input 
                                type="email"
                                placeholder="you@example.com" 
                                {...field} 
                                disabled={isLoading}
                                autoComplete="email"
                                className="pl-10 h-12 bg-white/50 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl transition-all duration-200 hover:bg-white/70 focus:bg-white/90"
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-sm font-semibold text-gray-700">Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i className="fas fa-lock text-gray-400"></i>
                              </div>
                              <Input 
                                type="password" 
                                placeholder="Enter your password" 
                                {...field} 
                                disabled={isLoading}
                                className="pl-10 h-12 bg-white/50 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl transition-all duration-200 hover:bg-white/70 focus:bg-white/90"
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 mt-8" 
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                          Signing in...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center">
                          <i className="fas fa-sign-in-alt mr-2"></i>
                          Sign In
                        </span>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
              
              <CardFooter className="relative px-8 pb-8">
                <div className="w-full text-center">
                  <div className="text-sm text-gray-600">
                    Don&apos;t have an account?{" "}
                    <Link 
                      href="/register" 
                      className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
                    >
                      Create one now
                    </Link>
                  </div>
                  
                  {/* Optional: Add "Forgot Password" link */}
                  <div className="mt-4">
                    <Link 
                      href="#" 
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                </div>
              </CardFooter>
            </Card>
          </div>
          
          {/* Optional: Add some additional info or features */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Secure login powered by We Build Trades Review Hub</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;