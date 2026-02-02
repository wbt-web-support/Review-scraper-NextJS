import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/use-toast";
import { apiRequest } from "../lib/queryClient";
import { IBusinessUrlDisplay } from "@/lib/storage";
import { IWidget } from "./WidgetCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import {
  Plus,
  Edit3,
  Eye,
  Code2,
  Sparkles,
  Settings,
  Grid3X3,
  List,
  LayoutGrid,
  RectangleGoggles,
  Columns,
  Star,
  Copy,
  Check,
  Monitor,
  Smartphone,
  Tablet,
  RectangleEllipsis
} from "lucide-react";

interface CreateWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWidgetCreated: (widget: IWidget) => void;
  businessUrls: IBusinessUrlDisplay[];
  isLoadingBusinessUrls: boolean;
  widget?: IWidget | null;
  mode: 'create' | 'edit';
  initialTab?: 'create' | 'preview' | 'embed';
}

export interface FormValues {
  name: string;
  businessUrlId: string;
  layout: "grid" | "carousel" | "list" | "masonry" | "badge" | "bar";
  minRating: number;
  showRatings: boolean;
  showDates: boolean;
  showProfilePictures: boolean;
  themeColor: string;
  initialReviewCount: number;
}

const CreateWidgetModal = ({
  isOpen,
  onClose,
  onWidgetCreated,
  businessUrls,
  isLoadingBusinessUrls,
  widget,
  mode,
  initialTab = 'create'
}: CreateWidgetModalProps) => {
  const [activeTab, setActiveTab] = useState<"create" | "preview" | "embed">("create");
  const [selectedLayout, setSelectedLayout] = useState<"grid" | "carousel" | "list" | "masonry" | "badge" | "bar">("grid");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormValues>({
    name: "",
    businessUrlId: "",
    minRating: 1,
    showRatings: true,
    showDates: true,
    showProfilePictures: true,
    themeColor: "#000000", // Default to black
    initialReviewCount: 12,
    layout: "grid",
  });

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && widget) {
        setFormData({
          name: widget.name,
          businessUrlId: widget.businessUrlId?.toString() || "",
          minRating: widget.minRating || 1,
          showRatings: widget.showRatings ?? true,
          showDates: widget.showDates ?? true,
          showProfilePictures: widget.showProfilePictures ?? true,
          themeColor: widget.themeColor || "#000000",
          initialReviewCount: widget.initialReviewCount || 12,
          layout: widget.type || "grid",
        });
        setSelectedLayout(widget.type || "grid");
      } else {
        setFormData({
          name: "",
          businessUrlId: "",
          minRating: 2, // Default to "recommended only" which works for both Google (2+ stars) and Facebook
          showRatings: true,
          showDates: true,
          showProfilePictures: true,
          themeColor: "#000000",
          initialReviewCount: 12,
          layout: "grid",
        });
        setSelectedLayout("grid");
      }
      setActiveTab(initialTab);
    }
  }, [isOpen, mode, widget, initialTab]);

  const createMutation = useMutation<IWidget, Error, any>({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        type: selectedLayout, // Use the selected layout from preview/embed tabs
      };
      return apiRequest<IWidget>("POST", "/api/widgets", payload);
    },
    onSuccess: (createdWidget) => {
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      toast({
        title: "Widget Created Successfully!",
        description: `${createdWidget.name} has been created and is ready to embed.`,
        variant: "default",
      });
      onWidgetCreated(createdWidget);
      setActiveTab("embed"); // Automatically switch to embed tab
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create widget.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation<IWidget, Error, any>({
    mutationFn: async (data) => {
      if (!widget?._id) throw new Error("Widget ID is required for update");
      const payload = {
        ...data,
        type: selectedLayout, // Use the selected layout from preview/embed tabs
      };
      return apiRequest<IWidget>("PUT", `/api/widgets/${widget._id}`, payload);
    },
    onSuccess: (updatedWidget) => {
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      toast({
        title: "Widget Updated Successfully!",
        description: `${updatedWidget.name} has been updated.`,
        variant: "default",
      });
      onWidgetCreated(updatedWidget);
      setActiveTab("preview"); // Switch to preview to see changes
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update widget.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    console.log('Form submission started', { formData, businessUrls });

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Widget name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.businessUrlId) {
      toast({
        title: "Validation Error",
        description: "Please select a business URL.",
        variant: "destructive",
      });
      return;
    }

    // Check selected business URL details
    const selectedBusinessUrl = businessUrls.find(url => url._id === formData.businessUrlId);
    console.log('Selected business URL:', selectedBusinessUrl);
    console.log('Form minRating:', formData.minRating);

    const submitData = {
      name: formData.name.trim(),
      businessUrlId: formData.businessUrlId,
      minRating: formData.minRating,
      showRatings: formData.showRatings,
      showDates: formData.showDates,
      showProfilePictures: formData.showProfilePictures,
      themeColor: formData.themeColor,
      initialReviewCount: formData.initialReviewCount,
    };

    console.log('Submitting data:', submitData);

    if (mode === 'edit') {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Generate embed codes
  const domain = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'https://your-app-domain.com';

  const widgetId = mode === 'edit' && widget ? widget._id : "YOUR_WIDGET_ID";

  const generateEmbedCode = (layout: string) => {
    // Use different attribute for carousel to avoid conflicts with other widgets
    const widgetIdAttribute = layout === 'carousel' ? 'data-reviewhub-widget-id' : 'data-widget-id';

    // Map layout to the correct widget file
    const getWidgetFile = (layout: string) => {
      switch (layout) {
        case 'bar':
          return 'widget-bar.js';
        case 'grid':
          return 'widget-grid.js';
        case 'list':
          return 'widget-list.js';
        case 'masonry':
          return 'widget-masonry.js';
        case 'badge':
          return 'widget-badge.js';
        case 'carousel':
        default:
          return 'widget.js';
      }
    };

    return `<div id="reviewhub-widget"></div>
<script src="${domain}/${getWidgetFile(layout)}" 
        ${widgetIdAttribute}="${widgetId}"
        data-layout="${layout}"
        data-container-id="reviewhub-widget">
</script>`;
  };

  // Handle copy to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
      .then(() => {
        setCopiedCode(selectedLayout);
        setTimeout(() => setCopiedCode(null), 2000);
        toast({
          title: "Copied Successfully!",
          description: "Embed code copied to clipboard.",
          variant: "default",
        });
      })
      .catch((err) => {
        console.error("Copy failed:", err);
        toast({
          title: "Copy Failed",
          description: "Could not copy code. Please try again.",
          variant: "destructive",
        });
      });
  };

  const layoutOptions = [
    { value: "grid", label: "Grid", icon: Grid3X3, description: "Responsive grid layout" },
    { value: "list", label: "List", icon: List, description: "Vertical list layout" },
    { value: "carousel", label: "Carousel", icon: LayoutGrid, description: "Horizontal scrolling" },
    { value: "masonry", label: "Masonry", icon: Columns, description: "Pinterest-style layout" },
    { value: "badge", label: "Badge", icon: Star, description: "Compact rating badge" },
    { value: "bar", label: "Bar", icon: RectangleEllipsis, description: "Horizontal rating bar" },
  ];

  const LayoutSelector = () => (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-4 mb-4">
        <h4 className="font-semibold text-gray-900">Layout Type</h4>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Monitor className="w-4 h-4" />
          <Tablet className="w-4 h-4" />
          <Smartphone className="w-4 h-4" />
          Responsive on all devices
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {layoutOptions.map((option) => {
          const IconComponent = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedLayout(option.value as any)}
              className={`p-4 rounded-xl border-2 transition-all duration-200 text-center group ${selectedLayout === option.value
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 hover:border-blue-200 hover:bg-blue-25'
                }`}
            >
              <div className={`w-8 h-8 mx-auto mb-2 ${selectedLayout === option.value ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'
                }`}>
                <IconComponent className="w-full h-full" />
              </div>
              <div className={`font-medium text-sm ${selectedLayout === option.value ? 'text-blue-900' : 'text-gray-700'
                }`}>
                {option.label}
              </div>
              <div className={`text-xs mt-1 ${selectedLayout === option.value ? 'text-blue-600' : 'text-gray-500'
                }`}>
                {option.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const PreviewFrame = () => {
    const embedCode = generateEmbedCode(selectedLayout);

    if (mode === 'create') {
      // For create mode, show a placeholder with layout info
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4 min-h-[400px] flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h4 className="font-semibold text-lg mb-2">Live Preview</h4>
              <p className="text-sm mb-4">
                Create the widget to see the live preview with your reviews.
              </p>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200 max-w-md mx-auto">
                <p className="text-blue-700 text-sm">
                  <strong>Preview will show:</strong> Your actual reviews from {formData.businessUrlId ? businessUrls.find(url => url._id === formData.businessUrlId)?.name || 'selected business' : 'your business'} in the {selectedLayout} layout.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // For edit mode, show actual preview using embed code
    const previewHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Widget Preview</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background-color: #f9fafb;
          }
          
        </style>
      </head>
      <body>
        <div class="preview-container">
          ${embedCode}
        </div>
      </body>
      </html>
    `;

    return (
      <div className="">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center gap-2 text-sm text-gray-600">
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <span className="ml-2">Widget Preview - {layoutOptions.find(opt => opt.value === selectedLayout)?.label}</span>
          </div>
          <iframe
            srcDoc={previewHtml}
            className="w-full h-[400px] border-0"
            title={`Widget Preview - ${selectedLayout}`}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl overflow-hidden p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 via-white to-indigo-50 px-8 py-6 border-b border-gray-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                {mode === 'edit' ? <Edit3 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
              </div>
              {mode === 'edit' ? `Edit: ${widget?.name || 'Widget'}` : 'Create New Widget'}
            </DialogTitle>

          </DialogHeader>
        </div>

        {/* Tabs Navigation */}
        <div className="pt-4 p-8 bg-white border-b border-gray-100 max-h-[86vh] overflow-y-auto">
          <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as any)}>
            <TabsList className="bg-gray-50 p-1 rounded-xl border border-gray-200">
              <TabsTrigger value="create" className="flex items-center gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                {mode === 'edit' ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {mode === 'edit' ? 'Edit Widget' : 'Create Widget'}
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="embed" className="flex items-center gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Code2 className="h-4 w-4" />
                Embed Code
              </TabsTrigger>
            </TabsList>

            {/* Content */}
            <div className="mt-6 overflow-y-auto">
              <TabsContent value="create" className="space-y-6 px-0">
                {/* Basic Information */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-600" />
                    Basic Information
                  </h3>
                  <div className="space-y-4 flex gap-4">
                    <div className="w-1/2">
                      <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                        Widget Name *
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Homepage Reviews, Product Reviews"
                        className="mt-1"
                      />
                    </div>

                    <div className="w-1/2">
                      <Label htmlFor="businessUrl" className="text-sm font-medium text-gray-700">
                        Business URL *
                      </Label>
                      <Select
                        value={formData.businessUrlId}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, businessUrlId: value }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={isLoadingBusinessUrls ? "Loading..." : "Select a business URL"} />
                        </SelectTrigger>
                        <SelectContent>
                          {businessUrls.map((url) => (
                            <SelectItem key={url._id} value={url._id}>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{url.name}</span>
                                <span className="text-xs text-gray-500 capitalize">({url.source})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Display Options */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-blue-600" />
                    Display Options
                  </h3>
                  <div className="space-y-6 flex gap-4">
                    {/* Theme Color */}
                    <div className="hidden">
                      <Label className="text-sm font-medium text-gray-700 mb-3 block">
                        Theme Color
                      </Label>
                      <div className="flex flex-col gap-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, themeColor: "#000000" }))}
                            className={`w-12 h-12 rounded-xl border-2 transition-all duration-200 ${formData.themeColor === "#000000"
                              ? 'border-blue-500 shadow-lg'
                              : 'border-gray-200 hover:border-gray-300'
                              }`}
                            style={{ backgroundColor: "#000000" }}
                            title="Black Theme"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, themeColor: "#FFFFFF" }))}
                            className={`w-12 h-12 rounded-xl border-2 transition-all duration-200 ${formData.themeColor === "#FFFFFF"
                              ? 'border-blue-500 shadow-lg'
                              : 'border-gray-200 hover:border-gray-300'
                              }`}
                            style={{ backgroundColor: "#FFFFFF" }}
                            title="White Theme"
                          />
                        </div>
                        <div className="ml-0">
                          <p className="text-sm font-medium text-gray-700">
                            {formData.themeColor === "#000000" ? "Black Theme" : "White Theme"}
                          </p>
                          <p className="text-xs text-gray-500">
                            Clean, professional look for any website
                          </p>
                        </div>

                      </div>
                    </div>

                    {/* Display Toggles */}
                    <div className="flex flex-col gap-6 w-full">
                      <div className="flex gap-4">
                        <div className="flex items-center justify-between w-1/2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                          <div>
                            <Label className="text-sm font-medium text-gray-700">Show Ratings</Label>
                            <p className="text-xs text-gray-500">Display star ratings</p>
                          </div>
                          <Switch
                            checked={formData.showRatings}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showRatings: checked }))}
                          />
                        </div>
                        <div className="flex items-center justify-between w-1/2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                          <div>
                            <Label className="text-sm font-medium text-gray-700">Show Dates</Label>
                            <p className="text-xs text-gray-500">Display review dates</p>
                          </div>
                          <Switch
                            checked={formData.showDates}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showDates: checked }))}
                          />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex items-center justify-between w-1/2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                          <div>
                            <Label className="text-sm font-medium text-gray-700">Show Profile Pictures</Label>
                            <p className="text-xs text-gray-500">Display reviewer avatars</p>
                          </div>
                          <Switch
                            checked={formData.showProfilePictures}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showProfilePictures: checked }))}
                          />
                        </div>

                        {/* Minimum Rating - Only show for Google business URLs */}
                        {(() => {
                          const selectedBusinessUrl = businessUrls.find(url => url._id === formData.businessUrlId);
                          const isGoogleBusiness = selectedBusinessUrl?.source === 'google';
                          const isFacebookBusiness = selectedBusinessUrl?.source === 'facebook';

                          if (isGoogleBusiness) {
                            return (
                              <div>
                                <Label className="text-sm font-medium text-gray-700">Minimum Rating</Label>
                                <Select
                                  value={formData.minRating.toString()}
                                  onValueChange={(value) => setFormData(prev => ({ ...prev, minRating: parseInt(value) }))}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 4, 5].map((rating) => (
                                      <SelectItem key={rating} value={rating.toString()}>
                                        {rating} Star{rating > 1 ? 's' : ''} and above
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          } else if (isFacebookBusiness) {
                            return (
                              <div>
                                <Label className="text-sm font-medium text-gray-700">Review Filter</Label>
                                <Select
                                  value={formData.minRating.toString()}
                                  onValueChange={(value) => setFormData(prev => ({ ...prev, minRating: parseInt(value) }))}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="2">Recommended only</SelectItem>
                                    <SelectItem value="1">All reviews (recommended + not recommended)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                                  <div className="flex items-start gap-2">
                                    <Star className="w-4 h-4 text-blue-600 mt-0.5" />
                                    <div>
                                      <p className="text-sm font-medium text-blue-900">Facebook Reviews</p>
                                      <p className="text-xs text-blue-700 mt-1">
                                        Facebook reviews use "recommended" vs "not recommended" instead of star ratings.
                                        {formData.minRating === 2
                                          ? " Only positive (recommended) reviews will be shown."
                                          : " Both positive and negative reviews will be displayed."
                                        }
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          } else if (formData.businessUrlId) {
                            // Fallback for when business URL is selected but source is unknown
                            return (
                              <div>
                                <Label className="text-sm font-medium text-gray-700">Minimum Rating</Label>
                                <Select
                                  value={formData.minRating.toString()}
                                  onValueChange={(value) => setFormData(prev => ({ ...prev, minRating: parseInt(value) }))}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 4, 5].map((rating) => (
                                      <SelectItem key={rating} value={rating.toString()}>
                                        {rating} Star{rating > 1 ? 's' : ''} and above
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          }

                          return null; // Don't show anything if no business URL is selected
                        })()}
                      </div>

                      {selectedLayout === 'grid' && (
                        <div className="flex gap-4 items-end">
                          <div className="w-1/2">
                            <Label htmlFor="initialReviewCount" className="text-sm font-medium text-gray-700">Initial Reviews to Show</Label>
                            <p className="text-xs text-gray-500 mb-1">Number of reviews displayed on page load</p>
                            <Input
                              id="initialReviewCount"
                              type="number"
                              min={1}
                              max={50}
                              value={formData.initialReviewCount}
                              onChange={(e) => setFormData(prev => ({ ...prev, initialReviewCount: parseInt(e.target.value) || 12 }))}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <Button
                    onClick={() => {
                      console.log('Create Widget button clicked');
                      handleSubmit();
                    }}
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-3"
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {mode === 'edit' ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      <>
                        {mode === 'edit' ? <Edit3 className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                        {mode === 'edit' ? 'Update Widget' : 'Create Widget'}
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="space-y-6 px-0">
                <LayoutSelector />
                <PreviewFrame />
              </TabsContent>

              <TabsContent value="embed" className="space-y-6 px-0">
                <LayoutSelector />

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Code2 className="w-5 h-5 text-blue-600" />
                        Embed Code - {layoutOptions.find(opt => opt.value === selectedLayout)?.label}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {layoutOptions.find(opt => opt.value === selectedLayout)?.description}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`transition-all duration-200 ${copiedCode === selectedLayout
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'hover:bg-blue-50 hover:border-blue-300'
                        }`}
                      onClick={() => handleCopyCode(generateEmbedCode(selectedLayout))}
                    >
                      {copiedCode === selectedLayout ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy Code
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-sm overflow-x-auto border border-gray-200">
                      <code>{generateEmbedCode(selectedLayout)}</code>
                    </pre>
                  </div>
                </div>

                {/* Multiple Widgets Instructions */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Grid3X3 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-2">Using Multiple Widgets on the Same Page</h4>
                      <p className="text-blue-700 text-sm mb-4">
                        Want to display multiple review widgets on the same page? Each widget needs a unique container ID.
                        Here's how to set it up:
                      </p>

                      <div className="space-y-4">
                        <div className="bg-white rounded-lg border border-blue-200 p-4">
                          <h5 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                            <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                            First Widget (Homepage Reviews)
                          </h5>
                          <pre className="bg-gray-50 text-gray-800 rounded-lg p-3 text-xs overflow-x-auto border">
                            <code>{`<div id="homepage-reviews"></div>
<script src="${domain}/${selectedLayout === 'bar' ? 'widget-bar.js' : selectedLayout === 'grid' ? 'widget-grid.js' : selectedLayout === 'list' ? 'widget-list.js' : selectedLayout === 'masonry' ? 'widget-masonry.js' : selectedLayout === 'badge' ? 'widget-badge.js' : 'widget.js'}" 
        ${selectedLayout === 'carousel' ? 'data-reviewhub-widget-id' : 'data-widget-id'}="${widgetId}"
        data-layout="${selectedLayout}"
        data-container-id="homepage-reviews">
</script>`}</code>
                          </pre>
                        </div>

                        <div className="bg-white rounded-lg border border-blue-200 p-4">
                          <h5 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                            <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                            Second Widget (Footer Reviews)
                          </h5>
                          <pre className="bg-gray-50 text-gray-800 rounded-lg p-3 text-xs overflow-x-auto border">
                            <code>{`<div id="footer-reviews"></div>
<script src="${domain}/widget-badge.js" 
        data-widget-id="ANOTHER_WIDGET_ID"
        data-layout="badge"
        data-container-id="footer-reviews">
</script>`}</code>
                          </pre>
                        </div>
                      </div>

                      <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-2">
                          <Settings className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-blue-800 text-sm font-medium">Key Points:</p>
                            <ul className="text-blue-700 text-xs mt-1 space-y-1 list-disc list-inside">
                              <li>Each widget must have a unique <code className="bg-blue-200 px-1 rounded">data-container-id</code></li>
                              <li>The container div ID must match the <code className="bg-blue-200 px-1 rounded">data-container-id</code></li>
                              <li>Carousel widgets use <code className="bg-blue-200 px-1 rounded">data-reviewhub-widget-id</code>, other layouts use <code className="bg-blue-200 px-1 rounded">data-widget-id</code></li>
                              <li>You can use the same widget ID for multiple instances or different ones for different content</li>
                              <li>Mix and match different layouts (grid, list, badge, etc.) on the same page</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {mode === 'create' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                      <Sparkles className="w-6 h-6 text-amber-600 mt-1" />
                      <div>
                        <h4 className="font-semibold text-amber-900 mb-2">Ready to Embed?</h4>
                        <p className="text-amber-700 text-sm mb-4">
                          Create your widget first to get the actual embed code with a real widget ID.
                          The code above shows the structure but needs to be generated after widget creation.
                        </p>
                        <Button
                          onClick={() => setActiveTab("create")}
                          variant="outline"
                          size="sm"
                          className="border-amber-300 text-amber-800 hover:bg-amber-100"
                        >
                          ← Back to Create Widget
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>


      </DialogContent>
    </Dialog>
  );
};

export default CreateWidgetModal;