import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";
import { 
  Copy, 
  CheckCircle, 
  Eye, 
  Plus, 
  Code2, 
  ExternalLink, 
  Sparkles,
  Zap,
  Settings,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Check
} from "lucide-react";
import WidgetPreview, { IWidgetSettingsFromForm, IReviewItemFromAPI } from "./WidgetPreview";

export interface IWidgetForCodeModal {
  _id: string;
  name: string;
  themeColor?: string; 
  layout?: "grid" | "carousel" | "list" | "masonry" | "badge";
}

interface WidgetCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  widget: IWidgetForCodeModal;
  onCreateWidget?: () => void;
  isCreatingWidget?: boolean;
  formData?: any;
  previewReviews?: IReviewItemFromAPI[];
}

const WidgetCodeModal = ({ 
  isOpen, 
  onClose, 
  widget, 
  onCreateWidget,
  isCreatingWidget = false,
  formData,
  previewReviews = []
}: WidgetCodeModalProps) => {
  const [activeTab, setActiveTab] = useState<"embed" | "preview" | "customize">("embed");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  const domain = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'https://your-app-domain.com';
  
  // Use temp ID for preview, but show what the actual code will look like
  const actualWidgetId = widget._id === "temp-preview-widget" ? "YOUR_WIDGET_ID" : widget._id;
  
  // Generate different embed codes
  const basicJavaScriptCode = `<div id="reviewhub-widget-${actualWidgetId}"></div>
<script src="${domain}/widget-${widget.layout || 'new'}.js" 
        data-widget-id="${actualWidgetId}"
        data-container-id="reviewhub-widget-${actualWidgetId}">
</script>`;

  const customizedJavaScriptCode = `<div id="reviewhub-widget-${actualWidgetId}"></div>
<script src="${domain}/widget-${widget.layout || 'new'}.js" 
        data-widget-id="${actualWidgetId}"
        data-container-id="reviewhub-widget-${actualWidgetId}"${widget.themeColor ? `
        data-theme-color="${widget.themeColor}"` : ''}${widget.layout ? `
        data-layout="${widget.layout}"` : ''}>
</script>`;

  const reactCode = `import { useEffect } from 'react';

export default function ReviewWidget() {
  useEffect(() => {
    // Load the widget script
    const script = document.createElement('script');
    script.src = '${domain}/widget-${widget.layout || 'new'}.js';
    script.setAttribute('data-widget-id', '${actualWidgetId}');
    script.setAttribute('data-container-id', 'reviewhub-widget-${actualWidgetId}');${widget.themeColor ? `
    script.setAttribute('data-theme-color', '${widget.themeColor}');` : ''}${widget.layout ? `
    script.setAttribute('data-layout', '${widget.layout}');` : ''}
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return <div id="reviewhub-widget-${actualWidgetId}"></div>;
}`;

  // Handle copy to clipboard with visual feedback
  const handleCopyCode = (code: string, type: string) => {
    navigator.clipboard.writeText(code)
      .then(() => {
        setCopiedCode(type);
        setTimeout(() => setCopiedCode(null), 2000);
        toast({
          title: "Copied Successfully!",
          description: `${type} code copied to clipboard.`,
          variant: "default",
        });
      })
      .catch((err) => {
        console.error("Copy failed:", err);
        toast({
          title: "Copy Failed",
          description: "Could not copy code. Please try again or copy manually.",
          variant: "destructive",
        });
      });
  };

  // Create preview widget props if formData is available
  const previewWidgetProps: IWidgetSettingsFromForm | null = formData ? {
    name: formData.name || widget.name,
    themeColor: formData.themeColor || widget.themeColor || '#3B82F6',
    layout: formData.layout || widget.layout || 'grid',
    minRating: formData.minRating || 0,
    showRatings: formData.showRatings ?? true,
    showDates: formData.showDates ?? true,
    showProfilePictures: formData.showProfilePictures ?? true,
    businessUrl: formData.businessUrl,
  } : null;

  const isPreviewMode = widget._id === "temp-preview-widget";

  const CodeBlock = ({ code, type, title, description }: { code: string; type: string; title: string; description: string }) => (
    <div className="group relative">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-blue-600" />
            {title}
          </h4>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className={`transition-all duration-200 ${
            copiedCode === type 
              ? 'bg-green-50 border-green-300 text-green-700' 
              : 'hover:bg-blue-50 hover:border-blue-300'
          }`}
          onClick={() => handleCopyCode(code, type)}
        >
          {copiedCode === type ? (
            <>
              <Check className="h-4 w-4 mr-1" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>
      <div className="relative">
        <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-sm overflow-x-auto border border-gray-200 group-hover:border-blue-200 transition-colors">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 via-white to-indigo-50 px-8 py-6 border-b border-gray-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              {isPreviewMode ? `Preview: ${widget.name}` : `Embed: ${widget.name}`}
            </DialogTitle>
            <DialogDescription className="text-lg text-gray-600 mt-2">
              {isPreviewMode 
                ? "Preview your widget and get ready-to-use embed code for your website."
                : "Copy and paste these code snippets to embed your review widget anywhere."
              }
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Tabs Navigation */}
        <div className="px-8 pt-6 pb-2 bg-white border-b border-gray-100">
          <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as any)}>
            <TabsList className="bg-gray-50 p-1 rounded-xl border border-gray-200">
              <TabsTrigger value="embed" className="flex items-center gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Code2 className="h-4 w-4" />
                Embed Code
              </TabsTrigger>
              {(isPreviewMode && previewWidgetProps) || !isPreviewMode ? (
                <TabsTrigger value="preview" className="flex items-center gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Eye className="h-4 w-4" />
                  Live Preview
                </TabsTrigger>
              ) : null}
              <TabsTrigger value="customize" className="flex items-center gap-2 rounded-lg px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Settings className="h-4 w-4" />
                Customization
              </TabsTrigger>
            </TabsList>

            {/* Content */}
            <div className="mt-6 overflow-y-auto max-h-[calc(95vh-300px)]">
              <TabsContent value="embed" className="space-y-6 px-0">
           

                <CodeBlock
                  code={basicJavaScriptCode}
                  type="basic-js"
                  title="Basic Embed"
                  description="Simplest implementation with default settings"
                />

                <CodeBlock
                  code={customizedJavaScriptCode}
                  type="custom-js"
                  title="Customized Embed"
                  description="Includes your theme color and layout preferences"
                />

             

         

                {/* Multiple Widgets Example */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                  <h4 className="font-semibold text-amber-900 text-lg mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Multiple Widgets on Same Page
                  </h4>
                  <p className="text-amber-700 mb-4">You can embed the same widget multiple times with different layouts:</p>
                  <CodeBlock
                    code={`<!-- Header carousel -->
<div id="header-reviews"></div>
<script src="${domain}/widget-carousel.js" 
        data-widget-id="${actualWidgetId}"
        data-container-id="header-reviews"
        data-layout="carousel">
</script>

<!-- Footer badge -->
<div id="footer-badge"></div>
<script src="${domain}/widget-badge.js" 
        data-widget-id="${actualWidgetId}"
        data-container-id="footer-badge"
        data-layout="badge">
</script>`}
                    type="multiple"
                    title="Multiple Layouts Example"
                    description="Same widget, different presentations"
                  />
                </div>
              </TabsContent>

              <TabsContent value="preview" className="space-y-6 px-0">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Eye className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-900 text-lg mb-2">Live Preview</h3>
                      <p className="text-blue-700">
                        This is exactly how your widget will appear on your website. It&apos;s fully responsive and interactive.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Device Preview */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <h4 className="font-semibold text-gray-900 text-lg">Device Preview</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Monitor className="w-4 h-4" />
                      <Tablet className="w-4 h-4" />
                      <Smartphone className="w-4 h-4" />
                      Responsive on all devices
                    </div>
                  </div>
                  
                  <div className="border rounded-xl p-6 bg-gray-50">
                    {previewWidgetProps ? (
                      <WidgetPreview
                        widget={previewWidgetProps}
                        reviews={previewReviews}
                        isLoadingReviews={false}
                      />
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Preview will be available after widget creation</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="customize" className="space-y-6 px-0">
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-purple-900 text-lg mb-2">Customization Options</h3>
                      <p className="text-purple-700">
                        You can customize your widget using data attributes or by editing the widget settings.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Available Data Attributes</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <code className="bg-gray-100 px-2 py-1 rounded">data-theme-color</code>
                        <span className="text-gray-600">Widget color theme</span>
                      </div>
                      <div className="flex justify-between">
                        <code className="bg-gray-100 px-2 py-1 rounded">data-layout</code>
                        <span className="text-gray-600">grid, list, carousel, badge</span>
                      </div>
                      <div className="flex justify-between">
                        <code className="bg-gray-100 px-2 py-1 rounded">data-show-ratings</code>
                        <span className="text-gray-600">true/false</span>
                      </div>
                      <div className="flex justify-between">
                        <code className="bg-gray-100 px-2 py-1 rounded">data-show-dates</code>
                        <span className="text-gray-600">true/false</span>
                      </div>
                      <div className="flex justify-between">
                        <code className="bg-gray-100 px-2 py-1 rounded">data-show-avatars</code>
                        <span className="text-gray-600">true/false</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Widget Settings</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-medium text-gray-700">Current Theme</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div 
                            className="w-4 h-4 rounded border border-gray-200" 
                            style={{ backgroundColor: widget.themeColor || '#3B82F6' }}
                          ></div>
                          <code className="text-gray-600">{widget.themeColor || '#3B82F6'}</code>
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Layout Type</p>
                        <p className="text-gray-600 capitalize">{widget.layout || 'Grid'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Auto-Updates</p>
                        <p className="text-gray-600">✅ Enabled - Changes reflect automatically</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Need Different Settings?</h4>
                  <p className="text-gray-600 mb-4">
                    You can override any widget setting using data attributes, or edit the widget settings to change the defaults.
                  </p>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={onClose}
                  >
                    <Settings className="w-4 h-4" />
                    Edit Widget Settings
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          {isPreviewMode && onCreateWidget ? (
            <div className="flex items-center gap-4 w-full">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex-1">
                <p className="text-amber-800 text-sm flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  <strong>Ready to embed?</strong> Create the widget to get your actual embed code.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={onCreateWidget}
                  disabled={isCreatingWidget}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {isCreatingWidget ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating Widget...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Widget
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-gray-500">
                Need help? <a href="#" className="text-blue-600 hover:text-blue-700">View documentation</a>
              </div>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WidgetCodeModal;
