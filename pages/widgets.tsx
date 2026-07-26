import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { apiRequest } from "../lib/queryClient";
import Layout from "../components/Layout";
import WidgetCard, { IWidget } from "../components/WidgetCard";
import CreateWidgetModal from "../components/CreateWidgetModal";
import DeleteWidgetModal from "../components/DeleteWidgetModal";
import { useToast } from "../hooks/use-toast";
import { usePaginatedWidgets } from "../hooks/use-paginated-widgets";
import { Button } from "../components/ui/button";
import { Pagination } from "../components/ui/pagination";
import { WidgetSkeleton } from "../components/ui/widget-skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { IBusinessUrlDisplay as IBusinessUrlForDropdown } from "@/lib/storage";
import { 
  Plus, 
  Search, 
  Grid3X3, 
  List, 
  Filter,
  Sparkles,
  TrendingUp,
  Eye,
  Edit3,
  Code,
  Trash2,
  Chrome,
  Facebook,
  MoreVertical,
  Video
} from "lucide-react";

interface _IBusinessUrlForWidget {
  _id: string;
  name: string;
  source: string;
  url?: string;
}

// Video review widgets are managed under Businesses (/reviews), not here, so this
// page filters only the scraped-review sources.
type WidgetTab = "all" | "google" | "facebook";
type ViewMode = "grid" | "list";

const Widgets = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<IWidget | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalInitialTab, setModalInitialTab] = useState<'create' | 'preview' | 'embed'>('create');
  
  // Delete confirmation modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [widgetToDelete, setWidgetToDelete] = useState<IWidget | null>(null);

  const [activeTab, setActiveTab] = useState<WidgetTab>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (authStatus === "loading") return;
    if (authStatus === "unauthenticated") {
      router.push("/login?callbackUrl=/widgets");
    }
  }, [authStatus, router]);

  // Use paginated widgets hook
  const {
    widgets: allWidgets,
    pagination,
    isLoading: isWidgetsLoading,
    isSearchPending,
    currentPage,
    setCurrentPage,
    limit,
    setLimit,
    source,
    setSource,
    search,
    setSearch,
    invalidateQueries,
  } = usePaginatedWidgets({
    limit: 12,
    source: activeTab === 'all' ? 'all' : activeTab,
    search: searchQuery,
  });

  // Get business URLs for the modal
  const { data: businessUrlsData, isLoading: isBusinessUrlsLoading } =
    useQuery<{ businessUrls: IBusinessUrlForDropdown[] }>({
      queryKey: ["businessUrls"],
      queryFn: () =>
        apiRequest<{ businessUrls: IBusinessUrlForDropdown[] }>(
          "GET",
          "/api/business-urls/all"
        ),
      enabled: true, // Removed authentication requirement since data is not user-specific
    });
  console.log(
    `[${router.pathname}] businessUrlsData from useQuery:`,
    businessUrlsData
  );
  const derivedBusinessUrls = useMemo(
    () => businessUrlsData?.businessUrls || [],
    [businessUrlsData]
  );
  console.log(`[${router.pathname}] derivedBusinessUrls:`, derivedBusinessUrls);
  const deleteMutation = useMutation<unknown, Error, string>({
    mutationFn: async (widgetId: string) => {
      return apiRequest("DELETE", `/api/widgets/${widgetId}`);
    },
    onSuccess: () => {
      invalidateQueries();
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });

      toast({
        title: "Widget Deleted",
        description: "The widget has been successfully deleted.",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete widget.",
        variant: "destructive",
      });
    },
  });
  // Update source filter when activeTab changes
  useEffect(() => {
    setSource(activeTab === 'all' ? 'all' : activeTab);
  }, [activeTab, setSource]);

  // Update search when searchQuery changes
  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery, setSearch]);

  // Group widgets by business name
  const groupedWidgets = useMemo(() => {
    const map = new Map<string, IWidget[]>();
    for (const widget of allWidgets) {
      const businessName = widget.businessUrl?.name || widget.name;
      if (!map.has(businessName)) map.set(businessName, []);
      map.get(businessName)!.push(widget);
    }
    return Array.from(map.entries()); // [businessName, widgets[]]
  }, [allWidgets]);

  const handleWidgetSaved = (widget: IWidget) => {
    setIsCreateModalOpen(false);
    setEditingWidget(null);
    setModalMode('create');
    setModalInitialTab('create');
    // Invalidate paginated queries to refresh the list
    invalidateQueries();
  };

  const handleEditWidget = (widgetId: string) => {
    const widget = allWidgets.find(w => w._id === widgetId);
    if (widget) {
      setEditingWidget(widget);
      setModalMode('edit');
      setModalInitialTab('create');
      setIsCreateModalOpen(true);
    } else {
      toast({
        title: "Widget Not Found",
        description: "Could not find the widget to edit.",
        variant: "destructive",
      });
    }
  };

  const handleCreateWidget = () => {
    setEditingWidget(null);
    setModalMode('create');
    setModalInitialTab('create');
    setIsCreateModalOpen(true);
  };

  const handleGetEmbedCode = (widget: IWidget) => {
    setEditingWidget(widget);
    setModalMode('edit');
    setModalInitialTab('embed'); // Open directly to embed tab
    setIsCreateModalOpen(true);
  };

  const handleDeleteClick = (widget: IWidget) => {
    setWidgetToDelete(widget);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (widgetToDelete) {
      deleteMutation.mutate(widgetToDelete._id);
      setIsDeleteModalOpen(false);
      setWidgetToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setWidgetToDelete(null);
  };

  if (authStatus === "loading" || authStatus === "unauthenticated") {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Loading widgets...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const widgetName = (w: IWidget) => w.businessUrl?.name || w.name;
  const syncedDate = (w: IWidget) =>
    w.createdAt ? new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A";

  const SourceBadge = ({ widget }: { widget: IWidget }) => {
    if (widget.type === "video") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500" /> Video
        </span>
      );
    }
    if (!widget.businessUrl?.source) return null;
    const g = widget.businessUrl.source === "google";
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
        <span className={`h-1.5 w-1.5 rounded-full ${g ? "bg-red-500" : "bg-blue-500"}`} />
        {g ? "Google" : "Facebook"}
      </span>
    );
  };

  const StatusBadge = ({ widget }: { widget: IWidget }) => (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${widget.isActive ? "text-green-700" : "text-gray-500"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${widget.isActive ? "bg-green-500" : "bg-gray-400"}`} />
      {widget.isActive ? "Active" : "Inactive"}
    </span>
  );

  const WidgetActionsMenu = ({ widget }: { widget: IWidget }) => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700" title="Actions">
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => handleEditWidget(widget._id)} className="cursor-pointer">
          <Edit3 className="mr-2 h-4 w-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleGetEmbedCode(widget)} className="cursor-pointer">
          <Code className="mr-2 h-4 w-4" /> Get code
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleDeleteClick(widget)} className="cursor-pointer text-red-600 focus:text-red-700">
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Card (grid view) -- one per widget, matching the reference design.
  const renderWidgetCard = (widget: IWidget) => (
    <div key={widget._id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate font-semibold text-gray-900" title={widgetName(widget)}>{widgetName(widget)}</h3>
        <WidgetActionsMenu widget={widget} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusBadge widget={widget} />
        <SourceBadge widget={widget} />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 px-3.5 py-3">
        <div>
          <div className="text-2xl font-bold leading-none text-gray-900">{widget.totalReviewCount || 0}</div>
          <div className="mt-1 text-xs text-gray-500">Reviews</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-700">{syncedDate(widget)}</div>
          <div className="mt-0.5 text-xs text-gray-400">Last synced</div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditWidget(widget._id)}>
          <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleGetEmbedCode(widget)}>
          <Code className="mr-1.5 h-3.5 w-3.5" /> Code
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="px-2.5 text-gray-500 hover:text-red-600 hover:border-red-200"
          onClick={() => handleDeleteClick(widget)}
          disabled={deleteMutation.isPending && deleteMutation.variables === widget._id}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  // Row (list view) -- the same card content laid out as a compact bar.
  const renderWidgetInList = (widget: IWidget) => (
    <div key={widget._id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50/70">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold text-gray-900">{widgetName(widget)}</h3>
        </div>
        <div className="mt-1 flex items-center gap-x-3">
          <StatusBadge widget={widget} />
          <SourceBadge widget={widget} />
        </div>
      </div>
      <div className="hidden items-center gap-1.5 text-sm text-gray-600 sm:flex">
        <TrendingUp className="h-4 w-4 text-gray-400" /> {widget.totalReviewCount || 0} reviews
      </div>
      <div className="hidden text-xs text-gray-400 md:block">Last synced {syncedDate(widget)}</div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => handleEditWidget(widget._id)}>
          <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleGetEmbedCode(widget)}>
          <Code className="mr-1.5 h-3.5 w-3.5" /> Code
        </Button>
        <WidgetActionsMenu widget={widget} />
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Widgets</h1>
            <p className="mt-1 text-sm text-gray-500">Create and embed review widgets on your website.</p>
          </div>
          <Button onClick={() => handleCreateWidget()} className="bg-gray-900 hover:bg-gray-800 text-white shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Create Widget
          </Button>
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Search widgets by name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearchPending && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as WidgetTab)}>
              <TabsList className="rounded-lg bg-gray-100 p-1">
                <TabsTrigger value="all" className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">All</TabsTrigger>
                <TabsTrigger value="google" className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" /> Google
                </TabsTrigger>
                <TabsTrigger value="facebook" className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-500 align-middle" /> Facebook
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
              <button onClick={() => setViewMode("grid")} title="Card view" className={`rounded-md p-1.5 ${viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700"}`}>
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode("list")} title="List view" className={`rounded-md p-1.5 ${viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700"}`}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-6">
          {isWidgetsLoading ? (
            <WidgetSkeleton viewMode={viewMode} count={limit} />
          ) : allWidgets.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {allWidgets.map(renderWidgetCard)}
                {/* Create new widget */}
                <button
                  type="button"
                  onClick={() => handleCreateWidget()}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-6 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/30"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Plus className="h-5 w-5" />
                  </span>
                  <span className="font-medium text-gray-900">Create new widget</span>
                  <span className="max-w-[16rem] text-xs text-gray-500">Connect Google or Facebook and start displaying reviews</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {allWidgets.map(renderWidgetInList)}
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No widgets found</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                {activeTab === "all"
                  ? "You haven't created any widgets yet. Create your first widget to start showcasing your reviews."
                  : `You haven't created any ${activeTab} widgets yet. Try a different filter or create a new one.`}
              </p>
              <Button onClick={() => handleCreateWidget()} className="mt-6 bg-gray-900 text-white hover:bg-gray-800">
                <Plus className="mr-2 h-4 w-4" /> Create Widget
              </Button>
            </div>
          )}

          {/* Pagination */}
          {pagination && (
            <div className="mt-8">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={setCurrentPage}
                showPageSize={true}
                pageSize={limit}
                onPageSizeChange={setLimit}
                className="mb-4"
              />
            </div>
          )}
        </div>
      </div>

      {/* Unified Modal */}
      {isCreateModalOpen && (
        <CreateWidgetModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingWidget(null);
            setModalMode('create');
            setModalInitialTab('create');
          }}
          onWidgetCreated={handleWidgetSaved}
          businessUrls={derivedBusinessUrls}
          isLoadingBusinessUrls={isBusinessUrlsLoading}
          widget={editingWidget}
          mode={modalMode}
          initialTab={modalInitialTab}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteWidgetModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        widgetName={widgetToDelete?.name || widgetToDelete?.businessUrl?.name}
        isLoading={deleteMutation.isPending}
      />
    </Layout>
  );
};

export default Widgets;
