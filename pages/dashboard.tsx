import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";
import Layout from "../components/Layout";
import { Briefing, Issues, LatestReviews, TopClients, VideoReviews, timeAgo } from "../components/DashboardSections";
import type { DashboardOverview } from "../lib/dashboard";

/**
 * The operator dashboard: a briefing of the numbers that matter, the clients with
 * the most reviews, the newest reviews (each with the business it came from), and
 * the video reviews. One request feeds all of it (/api/dashboard/overview); the
 * old page made four, two of them for data it never showed.
 */
async function fetchOverview(fresh = false): Promise<DashboardOverview> {
  const res = await fetch(`/api/dashboard/overview${fresh ? "?fresh=1" : ""}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Could not load the dashboard (${res.status}).`);
  }
  return res.json();
}

const Dashboard = () => {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login?callbackUrl=/dashboard");
  }, [authStatus, router]);

  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = () => {
    // Skips the server's one-minute copy.
    setRefreshing(true);
    fetchOverview(true)
      .then((fresh) => queryClient.setQueryData(["dashboardOverview"], fresh))
      .catch(() => refetch())
      .finally(() => setRefreshing(false));
  };
  const { data, error, isFetching, refetch } = useQuery<DashboardOverview, Error>({
    queryKey: ["dashboardOverview"],
    queryFn: () => fetchOverview(),
    enabled: !!session,
    staleTime: 60_000,
  });

  if (authStatus === "loading" || !session) {
    return (
      <Layout>
        <div className="flex h-screen items-center justify-center">
          <p className="text-lg text-gray-600">Loading Dashboard...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Welcome back, {session.user?.name || "User"}!</h1>
            <p className="mt-1 text-sm text-gray-500">How your clients&apos; reviews are doing, across every business.</p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={isFetching || refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching || refreshing ? "animate-spin" : ""}`} />
            {data ? `Updated ${timeAgo(data.generatedAt)}` : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error.message}{" "}
            <button type="button" onClick={() => refetch()} className="font-medium underline">Try again</button>
          </div>
        )}

        <Briefing data={data?.briefing} />

        <Issues issues={data?.issues} />

        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <TopClients businesses={data?.topBusinesses} />
            <VideoReviews video={data?.video} />
          </div>
          <div className="min-w-0">
            <LatestReviews reviews={data?.latestReviews} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
