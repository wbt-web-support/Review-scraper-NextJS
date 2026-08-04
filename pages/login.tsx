import { useEffect, useState } from "react";
import { useToast } from "../hooks/use-toast";
import { Card, CardContent, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useRouter } from 'next/router'; 
import Link from 'next/link';
import { signIn, getSession } from 'next-auth/react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';

import type { GetServerSideProps } from "next";
import { getTenantBrandingByHost } from "../lib/tenantByHost";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface Brand {
  name: string;
  logoUrl: string | null;
  brandColor: string;
}

const Login = ({ brand }: { brand: Brand | null }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  useEffect(() => {
    if (authStatus === 'authenticated') {
      if (session?.user?.role === 'client') {
        router.push('/my-reviews');
        return;
      }
      const callbackUrl = router.query.callbackUrl as string || "/dashboard";
      router.push(callbackUrl);
    }
  }, [authStatus, session, router]);

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
        // Route by role: video-business clients get their own review dashboard;
        // operators go to the app (honouring any callbackUrl they were sent from).
        const freshSession = await getSession();
        if (freshSession?.user?.role === "client") {
          router.push("/my-reviews");
        } else {
          const callbackUrl = router.query.callbackUrl as string || "/dashboard";
          router.push(callbackUrl);
        }
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
          {brand ? (
            <>
              <div className="flex justify-center mb-6">
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt={brand.name} className="h-14 max-w-[220px] object-contain" />
                ) : (
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white"
                    style={{ backgroundColor: brand.brandColor }}
                  >
                    {brand.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{brand.name}</h1>
              <p className="text-gray-600 text-sm">Sign in to manage your video reviews.</p>
            </>
          ) : (
            <>
              {/* Logo */}
              <div className="flex justify-center">
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
            </>
          )}
        </div>

        {/* Login Form Card */}
        <Card className="bg-white shadow-lg border-0 rounded-xl">
          <CardContent className="px-6 pt-8">
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
            <div className="w-full">
              {/* Forgot Password */}
              <div className="text-center">
                <Link
                  href="#"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>
          </CardFooter>
        </Card>
        
        {/* Footer -- our name only on our own domain, never on a client's. */}
        {!brand && (
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Powered by We Build Trades 2026
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * When /login is served on a client's own custom domain, brand it with their logo and
 * name instead of ReviewHub. On our own hosts no custom_domain matches, so `brand` is
 * null and the default look shows.
 */
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const host = (ctx.req.headers["x-forwarded-host"] as string) || ctx.req.headers.host || "";
  const brand = await getTenantBrandingByHost(host).catch(() => null);
  return { props: { brand } };
};

export default Login;