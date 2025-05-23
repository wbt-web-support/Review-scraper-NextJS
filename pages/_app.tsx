import type { AppProps } from 'next/app';
import { SessionProvider } from "next-auth/react";
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/queryClient'; 
import '../styles/globals.css';
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";

function MyApp({ Component, pageProps: { session, ...otherPageProps } }: AppProps) {
  return (
<SessionProvider session={session}> 
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange 
        >
          <Component {...otherPageProps} /> 
          <Toaster />
          <ReactQueryDevtools initialIsOpen={false} position="bottom" />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

export default MyApp;