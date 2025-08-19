import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { apiRequest } from "../lib/queryClient";
import Layout from "../components/Layout";
import WidgetCard, { IWidget } from "../components/WidgetCard";
import CreateWidgetModal from "../components/CreateWidgetModal";
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
  MoreVertical
} from "lucide-react";

interface _IBusinessUrlForWidget {
  _id: string;
  name: string;
  source: string;
  url?: string;
}

type WidgetTab = "all" | "google" | "facebook";
type ViewMode = "grid" | "list";

const Widgets = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<IWidget | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalInitialTab, setModalInitialTab] = useState<'create' | 'preview' | 'embed'>('create');

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

  const renderWidgetInList = (widget: IWidget) => (
    <div key={widget._id} className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 transition-all duration-300 hover:shadow-md group cursor-pointer">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          {/* Widget Icon & Type */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center border border-blue-100">
            <div className="w-6 h-6 text-blue-600">
              {widget.type === 'grid' && <Grid3X3 className="w-6 h-6" />}
              {widget.type === 'list' && <List className="w-6 h-6" />}
              {widget.type === 'carousel' && <TrendingUp className="w-6 h-6" />}
              {widget.type === 'masonry' && <Filter className="w-6 h-6" />}
              {widget.type === 'badge' && <Sparkles className="w-6 h-6" />}
            </div>
          </div>

          {/* Widget Details */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-semibold text-gray-900 text-lg">{widget.name}</h3>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                {widget.type}
              </span>
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                widget.isActive 
                  ? 'bg-green-50 text-green-700' 
                  : 'bg-gray-50 text-gray-600'
              }`}>
                {widget.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              {widget.businessUrl?.source && (
                <span className="flex items-center gap-1">
                  {widget.businessUrl.source === 'google' ? 
                    <Chrome className="w-4 h-4 text-red-500" /> : 
                    <Facebook className="w-4 h-4 text-blue-500" />
                  }
                  {widget.businessUrl.source.charAt(0).toUpperCase() + widget.businessUrl.source.slice(1)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {widget.totalReviewCount || 0} Reviews
              </span>
              <span>
                Created {widget.createdAt ? new Date(widget.createdAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                }) : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
            onClick={() => handleEditWidget(widget._id)}
            title="Edit widget"
          >
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-green-600 hover:bg-green-50"
            onClick={() => handleGetEmbedCode(widget)}
            title="Get embed code"
          >
            <Code className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => deleteMutation.mutate(widget._id)}
            disabled={deleteMutation.isPending && deleteMutation.variables === widget._id}
            title="Delete widget"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="flex flex-row-reverse justify-between">
      {/* Hero Section */}
     
      <div className="mb-6">
        <div className="p-0 ">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* <div className="flex-1">
              
              <div className="flex items-center gap-6 mt-6 text-sm text-gray-500">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  {allWidgets.filter((w: IWidget) => w.isActive).length} Active Widgets
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  {allWidgets.reduce((acc: number, w: IWidget) => acc + (w.totalReviewCount || 0), 0)} Total Reviews
                </span>
                {pagination && (
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </span>
                )}
              </div>
            </div> */}
            <div className="flex flex-col sm:flex-row gap-3">
          <Button
                onClick={() => handleCreateWidget()}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-6 py-3 rounded-xl"
                size="lg"
          >
                <Plus className="mr-2 w-5 h-5" />
            Create Widget
          </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className=" mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        {/* Search Bar */}
        <div className="flex flex-col lg:flex-row gap-4 mr-4">
          
      
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
                className="pl-11 pr-12 py-3 border border-gray-200 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Search widgets by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {isSearchPending && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </div>
        {/* View Mode Toggle */}
        <div className="flex items-center bg-gray-50 rounded-xl p-1 border w-fit border-gray-200">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className={`rounded-lg px-3 py-2 ${
                viewMode === "grid" 
                  ? "bg-white shadow-sm text-gray-900" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={`rounded-lg px-3 py-2 ${
                viewMode === "list" 
                  ? "bg-white shadow-sm text-gray-900" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
          
        </div>
      </div>
      </div>
      {/* Content Section */}
      <div className="">
        {/* Filter Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as WidgetTab)}
            className="w-full"
          >
          <TabsList className="bg-gray-50 p-1 rounded-xl border border-gray-200 mb-6">
            <TabsTrigger 
              value="all" 
              className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              All Widgets
            </TabsTrigger>
            <TabsTrigger 
              value="google"
              className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Chrome className="w-4 h-4 mr-2 text-red-500" />
              Google
            </TabsTrigger>
            <TabsTrigger 
              value="facebook"
              className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Facebook className="w-4 h-4 mr-2 text-blue-500" />
              Facebook
            </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              {isWidgetsLoading ? (
                <WidgetSkeleton viewMode={viewMode} count={limit} />
              ) : groupedWidgets.length > 0 ? (
              viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Create Widget Card */}
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-300 transition-all duration-300 group cursor-pointer"
                       onClick={() => handleCreateWidget()}>
                    <div className="flex flex-col items-center justify-center p-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border border-blue-100">
                        <Plus className="w-8 h-8 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 text-lg mb-2">Create New Widget</h3>
                      <p className="text-gray-500 text-xs text-center leading-relaxed">
                        Connect to Google or Facebook and start displaying your reviews beautifully
                      </p>
                    </div>
                  </div>

                  {/* Widget Cards */}
                  {groupedWidgets.map(([businessName, widgets]) => (
                    <div key={businessName} className="bg-white rounded-2xl border hover:border-gray-200 transition-all duration-300 hover:shadow-lg group overflow-hidden cursor-pointer">
                      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                        <h3 className="font-semibold text-gray-900 truncate text-lg" title={businessName}>
                          {businessName}
                        </h3>
                      </div>
                      <Tabs defaultValue={widgets[0].type} className="w-full">
                      
                        {widgets.map(widget => (
                          <TabsContent key={widget._id} value={widget.type} className="p-0">
                            <div className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                                    widget.isActive 
                                      ? 'bg-green-50 text-green-700' 
                                      : 'bg-gray-50 text-gray-600'
                                  }`}>
                                    {widget.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                  {widget.businessUrl?.source && (
                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                      {widget.businessUrl.source === 'google' ? 
                                        <Chrome className="w-3 h-3 text-red-500" /> : 
                                        <Facebook className="w-3 h-3 text-blue-500" />
                                      }
                                      {widget.businessUrl.source}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="w-4 h-4" />
                                  {widget.totalReviewCount || 0} Reviews
                                </span>
                                <span>
                                  {widget.createdAt ? new Date(widget.createdAt).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric' 
                                  }) : 'N/A'}
                                </span>
                              </div>

                              <div className="flex gap-2 transition-opacity duration-200">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-gray-600 hover:text-blue-600 hover:border-blue-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditWidget(widget._id);
                                  }}
                                >
                                  <Edit3 className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-gray-600 hover:text-green-600 hover:border-green-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGetEmbedCode(widget);
                                  }}
                                >
                                  <Code className="w-3 h-3 mr-1" />
                                  Code
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-gray-600 hover:text-red-600 hover:border-red-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                deleteMutation.mutate(widget._id);
                              }}
                                  disabled={deleteMutation.isPending && deleteMutation.variables === widget._id}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>
                    </div>
                  ))}
                </div>
              ) : (
                /* List View */
                <div className="space-y-3">
                  {/* Create Widget Card in List View */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-dashed border-blue-200 hover:border-blue-300 transition-all duration-300 group cursor-pointer"
                       onClick={() => handleCreateWidget()}>
                    <div className="p-6 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Plus className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg mb-1">Create New Widget</h3>
                        <p className="text-gray-600 text-sm">Connect to Google or Facebook and start displaying your reviews</p>
                      </div>
                    </div>
                  </div>

                  {/* Widget List Items */}
                  {groupedWidgets.flatMap(([businessName, widgets]) => 
                    widgets.map(widget => renderWidgetInList(widget))
                  )}
                </div>
              )
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center mb-6 border border-gray-200">
                  <Sparkles className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    No Widgets Found
                  </h3>
                <p className="text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">
                    {activeTab === "all"
                    ? "You haven't created any widgets yet. Create your first widget to start showcasing your reviews beautifully."
                    : `You haven't created any ${activeTab} widgets yet. Try switching to a different filter or create a new widget.`}
                  </p>
                  <Button
                  onClick={() => handleCreateWidget()}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-6 py-3 rounded-xl"
                  size="lg"
                  >
                  <Plus className="mr-2 w-5 h-5" />
                    Create First Widget
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

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
    </Layout>
  );
};

export default Widgets;
