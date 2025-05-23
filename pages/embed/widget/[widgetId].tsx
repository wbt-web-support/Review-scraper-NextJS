// pages/embed/widget/[widgetId].tsx
import { useRouter } from 'next/router';
import { useQuery, QueryClientProvider, QueryClient } from '@tanstack/react-query'; 
import WidgetPreview from '../../../components/WidgetPreview'; 
import { apiRequest } from '../../../lib/queryClient'; 
import Head from 'next/head';
import { PublicWidgetDataResponse } from '../../api/public/widget-data/[widgetId]'; 

const queryClient = new QueryClient(); 

const EmbeddedWidgetPageContent = () => {
  const router = useRouter();
  const { widgetId, ...queryParams } = router.query; 

  const { data: publicWidgetData, isLoading, error } = useQuery<PublicWidgetDataResponse>({
    queryKey: ['publicWidgetData', widgetId, queryParams],
    queryFn: () => {
      let apiUrl = `/api/public/widget-data/${widgetId}`;
      const params = new URLSearchParams();
      if (queryParams.themeColor) params.append('themeColor', queryParams.themeColor as string);
      if (queryParams.layout) params.append('layout', queryParams.layout as string);

      const queryString = params.toString();
      if (queryString) {
        apiUrl += `?${queryString}`;
      }
      return apiRequest<PublicWidgetDataResponse>('GET', apiUrl);
    },
    enabled: !!widgetId,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (!widgetId || router.isFallback) {
    return <div style={styles.message}>Loading widget identifier...</div>;
  }
  if (isLoading) {
    return <div style={styles.message}>Loading widget...</div>;
  }
  if (error || !publicWidgetData?.widgetSettings) {
    const errorMessage = error instanceof Error ? error.message : "Widget data unavailable.";
    return <div style={{ ...styles.message, color: 'red' }}>Error: {errorMessage}</div>;
  }

  return (
    <>
      <Head>
        <title>{publicWidgetData.widgetSettings.name || 'Review Widget'}</title>
        <meta name="robots" content="noindex, nofollow" />
        <style>{`
          body { margin: 0 !important; padding: 0 !important; background-color: transparent !important; overflow-x: hidden; }
          html { background-color: transparent !important; }
          * { box-sizing: border-box; }
        `}</style>
      </Head>
      <div style={{ width: '100%', height: 'auto', minHeight: '100vh' }}>
        <WidgetPreview
          widget={publicWidgetData.widgetSettings}
          reviews={publicWidgetData.reviews}
          isLoadingReviews={false}
        />
      </div>
    </>
  );
};

const EmbeddedWidgetPage = () => (
  <QueryClientProvider client={queryClient}>
    <EmbeddedWidgetPageContent />
  </QueryClientProvider>
);

const styles = {
  message: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontFamily: 'sans-serif',
    fontSize: '16px',
    color: '#555',
    textAlign: 'center',
    padding: '20px',
  } as React.CSSProperties,
};

export default EmbeddedWidgetPage;