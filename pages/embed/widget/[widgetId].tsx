// pages/embed/widget/[widgetId].tsx
import { GetServerSideProps } from 'next';
import { useEffect, useState } from 'react';
import WidgetPreview, { IWidgetSettingsFromForm, IReviewItemFromAPI } from '../../../components/WidgetPreview';

interface EmbedPageProps {
  widgetId: string;
  themeColor?: string;
  layout?: string;
}

interface WidgetData {
  widgetSettings: IWidgetSettingsFromForm;
  reviews: IReviewItemFromAPI[];
}

export default function EmbedWidget({ widgetId, themeColor, layout }: EmbedPageProps) {
  const [widgetData, setWidgetData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWidgetData = async () => {
      try {
        const params = new URLSearchParams();
        if (themeColor) params.append('themeColor', themeColor);
        if (layout) params.append('layout', layout);
        
        const queryString = params.toString();
        const url = `/api/public/widget-data/${widgetId}${queryString ? '?' + queryString : ''}`;
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch widget data: ${response.status}`);
        }
        
        const data = await response.json();
        setWidgetData(data);
      } catch (err) {
        console.error('Error fetching widget data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load widget');
      } finally {
        setLoading(false);
      }
    };

    fetchWidgetData();
  }, [widgetId, themeColor, layout]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '200px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#666', margin: 0 }}>Loading reviews...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          color: '#e74c3c',
          fontSize: '16px',
          marginBottom: '8px'
        }}>
          ⚠️ Widget Error
        </div>
        <div style={{ color: '#666', fontSize: '14px' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!widgetData) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ color: '#666' }}>Widget not found</div>
      </div>
    );
  }

  // Apply customizations from URL parameters
  const customizedSettings = {
    ...widgetData.widgetSettings,
    ...(themeColor && { themeColor }),
    ...(layout && { layout: layout as any })
  };

  return (
    <div style={{ 
      margin: 0, 
      padding: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: 'transparent'
    }}>
      <WidgetPreview
        widget={customizedSettings}
        reviews={widgetData.reviews}
        isLoadingReviews={false}
      />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { widgetId } = context.params!;
  const { themeColor, layout } = context.query;

  return {
    props: {
      widgetId: widgetId as string,
      themeColor: (themeColor as string) || null,
      layout: (layout as string) || null,
    },
  };
};