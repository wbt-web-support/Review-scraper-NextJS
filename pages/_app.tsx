import type { AppProps } from 'next/app';
import { SessionProvider } from "next-auth/react";
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/queryClient'; 
import '../styles/globals.css';
import { Toaster } from "@/components/ui/toaster";
import ErrorReporter from "@/components/ErrorReporter";

function MyApp({ Component, pageProps: { session, ...otherPageProps } }: AppProps) {
  return (
    <SessionProvider session={session}> 
      <QueryClientProvider client={queryClient}>
        <Component {...otherPageProps} /> 
        <Toaster />
        <ErrorReporter />
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      </QueryClientProvider>
    </SessionProvider>
  );
}

export default MyApp;