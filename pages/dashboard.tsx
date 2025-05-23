import { useState, useEffect } from "react";
import { useQuery, useQueryClient  } from "@tanstack/react-query";
import Link from "next/link";
import Layout from "../components/Layout";
import StatisticsCard from "../components/StatisticsCard";
import WidgetCard from "../components/WidgetCard";
import ReviewTable from "../components/ReviewTable";
import CreateWidgetModal from "../components/CreateWidgetModal";
import { useToast } from "../hooks/use-toast";
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

interface IStats {
  totalWidgets: number;
  totalReviews: number;
  averageRating: number;
  totalViews: number;
  reviewsBySource?: { 
    google: number;
    facebook: number;
  };
}

interface IWidget {
  _id: string;
  name: string;
  themeColor: string;
  type: "grid" | "carousel" | "list" | "masonry" | "badge";
  minRating: number;
  maxReviews?: number;
  showRatings: boolean;
  showDates: boolean;
  showProfilePictures: boolean;
  businessUrlId: string;
  businessUrl?: {
    _id: string;
    source: 'google' | 'facebook';
    name: string;
    url?: string;
  };
  createdAt?: string | Date;
  averageRating?: number;
  isActive?: boolean;
  settings?: Record<string, any>;
  views?: number;
}

interface IReviewItem {
  _id?: string;
  reviewId?: string;
  author: string;
  content: string;
  rating?: number;
  postedAt: string;
  profilePicture?: string;
  businessName?: string;
  source?: 'google' | 'facebook';
}

interface IBusinessUrl {
  _id: string;
  name: string;
  url: string;
  source: 'google' | 'facebook';
}

export interface StatisticsCardProps {
  title: string;
  value: string;
  icon: string;
  iconBgClass: string;
  iconTextClass: string;
  isLoading: boolean;
  change?: { 
    value: string;
    isPositive: boolean;
    label: string;
  } | null;
}

const fetcher = async <T = unknown>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: `Request to ${url} failed with status ${res.status}` }));
    throw new Error(errorData.message || `An error occurred while fetching ${url}`);
  }
  return res.json() as Promise<T>;
};

const Dashboard = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { toast } = useToast();

  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  useEffect(() => {
    if (authStatus === 'loading') return; 
    if (authStatus === 'unauthenticated') {
      router.push('/login?callbackUrl=/dashboard');
    }
  }, [session, authStatus, router]);

  const { data: stats, isLoading: isStatsLoading, error: statsError } = useQuery<IStats>({
    queryKey: ['dashboardStats'],
    queryFn: () => fetcher<IStats>('/api/dashboard/stats'),
    enabled: !!session, 
  });

  const { data: widgetsData, isLoading: isWidgetsLoading, error: widgetsError } = useQuery<{ widgets: IWidget[] }>({
    queryKey: ['widgets'],
    queryFn: () => fetcher<{ widgets: IWidget[] }>('/api/widgets'), 
    enabled: !!session,
  });
  const widgets = widgetsData?.widgets || []; 

  const { data: latestReviewsData, isLoading: isReviewsLoading, error: reviewsError } = useQuery<{ reviews: IReviewItem[] }>({
    queryKey: ['latestReviews'],
    queryFn: () => fetcher<{ reviews: IReviewItem[] }>('/api/dashboard/latest-reviews?limit=5'), 
    enabled: !!session,
  });
  const latestReviews = latestReviewsData?.reviews || [];

  const { data: businessUrlsData, isLoading: isBusinessUrlsLoading, error: businessUrlsError } = useQuery<{ businessUrls: IBusinessUrl[] }>({
    queryKey: ['businessUrls'],
    queryFn: () => fetcher<{ businessUrls: IBusinessUrl[] }>('/api/business-urls'),
    enabled: !!session,
  });
  const businessUrls = businessUrlsData?.businessUrls || [];

  useEffect(() => {
    if (statsError) toast({ title: "Error Loading Stats", description: (statsError as Error).message, variant: "destructive" });
    if (widgetsError) toast({ title: "Error Loading Widgets", description: (widgetsError as Error).message, variant: "destructive" });
    if (reviewsError) toast({ title: "Error Loading Reviews", description: (reviewsError as Error).message, variant: "destructive" });
    if (businessUrlsError) toast({ title: "Error Loading Sources", description: (businessUrlsError as Error).message, variant: "destructive" });
  }, [statsError, widgetsError, reviewsError, businessUrlsError, toast]);

  const handleWidgetCreated = () => {
    setIsCreateModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['widgets'] });
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    toast({ title: "Success", description: "Widget created successfully!" });
  };

  if (authStatus === 'loading' || !session) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <p className="text-lg text-gray-600">Loading Dashboard...</p>
        </div>
      </Layout>
    );
  }
  const totalWidgetsDisplay = stats?.totalWidgets ?? 0;
  const totalReviewsDisplay = stats?.totalReviews ?? 0;
  const averageRatingDisplay = stats?.averageRating ? stats.averageRating.toFixed(1) : '0.0';
  const totalViewsDisplay = stats?.totalViews ?? 0;

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-gray-800 mb-1">
          Welcome back, {session.user?.name || 'User'}!
        </h1>
        <p className="text-gray-600">
          Here&apos;s an overview of your review widgets and performance
        </p>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      <StatisticsCard
        title="Total Widgets"
        value={isStatsLoading ? "..." : totalWidgetsDisplay.toString()}
        icon="th-large"
        iconBgClass="bg-primary-100"
        iconTextClass="text-primary-500"
        isLoading={isStatsLoading}
        change={null} 
      />
        <StatisticsCard
          title="Total Reviews"
          value={isStatsLoading ? "..." : totalReviewsDisplay.toString()}
          icon="star"
          iconBgClass="bg-secondary-100 "
          iconTextClass="text-secondary-500"
          isLoading={isStatsLoading}
          change={null} 
        />
        <StatisticsCard
          title="Avg. Rating"
          value={isStatsLoading ? "..." : averageRatingDisplay}
          icon="star-half-alt"
          iconBgClass="bg-warning-100"
          iconTextClass="text-warning-500"
          isLoading={isStatsLoading}
          change={null} 
        />
        <StatisticsCard
          title="Widget Views"
          value={isStatsLoading ? "..." : totalViewsDisplay.toLocaleString()}
          icon="eye"
          iconBgClass="bg-success-100"
          iconTextClass="text-success-500"
          isLoading={isStatsLoading}
          change={null} 
        />
      </div>

      {/* Widgets Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-heading font-semibold text-gray-800">
            Your Review Widgets
          </h2>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition duration-150"
          >
            <i className="fas fa-plus mr-2"></i>
            Create Widget
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {isWidgetsLoading && !widgetsError ? (
            // Loading state
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="bg-white  rounded-xl shadow-sm border border-gray-100 p-5 h-48 animate-pulse">
                <div className="w-full h-full bg-gray-200 rounded-lg"></div>
              </div>
            ))
          ) : widgets.length > 0 ? (
            // Display widgets
            <>
              {widgets.map((widget) => (
                <WidgetCard key={widget._id} widget={widget} />
              ))}
              {/* Add Widget Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden widget-card flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-5">
                    <i className="fas fa-plus text-xl"></i>
                  </div>
                  <h3 className="text-center font-medium text-gray-800 mb-2">Create a New Widget</h3>
                  <p className="text-center text-gray-500 text-sm mb-4">
                    Connect to Google or Facebook and start displaying your reviews
                  </p>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition duration-150"
                  >
                    <i className="fas fa-plus mr-2"></i>
                    Create Widget
                  </button>
                </div>
              </div>
            </>
          ) : (
            // No widgets state
            <div className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-5">
                <i className="fas fa-th-large text-xl"></i>
              </div>
              <h3 className="font-medium text-gray-800 mb-2">No Widgets Found</h3>
              <p className="text-gray-500 text-sm mb-4">
                Create your first widget to start showcasing your reviews
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-primary-500 rounded-lg text-sm font-medium hover:bg-primary-600 transition duration-150"
              >
                <i className="fas fa-plus mr-2"></i>
                Create First Widget
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Latest Reviews Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-heading font-semibold text-gray-800">
            Latest Reviews
          </h2>
          <Link href="/reviews" className="text-primary-500 hover:text-primary-600 text-sm font-medium transition duration-150">
            View All
            <i className="fas fa-arrow-right ml-1 text-xs"></i>
          </Link>
        </div>

        <ReviewTable reviews={latestReviews} isLoading={isReviewsLoading} />
      </div>

      {/* Create Widget Modal */}
      {isCreateModalOpen && (
        <CreateWidgetModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onWidgetCreated={handleWidgetCreated}
          businessUrls={businessUrls || []}     
          isLoadingBusinessUrls={isBusinessUrlsLoading} 
        />
      )}
    </Layout>
  );
};

export default Dashboard;
