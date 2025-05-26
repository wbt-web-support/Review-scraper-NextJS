import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";
import { Copy, CheckCircle, Eye, Plus } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"javascript" | "preview">("javascript");
  const { toast } = useToast();

  const domain = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'https://your-app-domain.com';
  
  // Use temp ID for preview, but show what the actual code will look like
  const actualWidgetId = widget._id === "temp-preview-widget" ? "YOUR_WIDGET_ID" : widget._id;
  
  const javascriptCode = `<script src="${domain}/widget.js" data-widget-id="${actualWidgetId}"${widget.themeColor ? ` data-theme-color="${widget.themeColor.replace(/"/g, '&quot;')}"` : ''}${widget.layout ? ` data-layout="${widget.layout.replace(/"/g, '&quot;')}"` : ''}></script>`;

  // Handle copy to clipboard
  const handleCopyCode = (codeType?: string) => {
    let codeToCopy = '';
    const type = codeType || activeTab;
    
    switch (type) {
      case 'javascript':
        codeToCopy = javascriptCode;
        break;
      default:
        codeToCopy = javascriptCode;
    }
    
    if (codeToCopy) {
      navigator.clipboard.writeText(codeToCopy)
        .then(() => {
          toast({
            title: "Copied!",
            description: `${type.charAt(0).toUpperCase() + type.slice(1)} code copied to clipboard.`,
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
    }
  };

  const currentCodeToShow = activeTab === 'javascript' ? javascriptCode : '';

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {isPreviewMode ? `Preview Widget: ${widget.name}` : `Embed Widget: ${widget.name}`}
          </DialogTitle>
          <DialogDescription>
            {isPreviewMode 
              ? "This is how your widget will look when embedded. Create the widget to get the actual embed code."
              : "Choose your preferred embedding method and copy the code to your website."
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="javascript" value={activeTab} onValueChange={(value: string) => setActiveTab(value as any)}>
          {isPreviewMode && previewWidgetProps ? (
            <TabsList className="grid w-[52rem] grid-cols-2">
              <TabsTrigger value="javascript" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                JavaScript (Recommended)
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Live Preview
              </TabsTrigger>
            </TabsList>
          ) : null}

          <TabsContent value="javascript" className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 w-[52rem]">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-800">JavaScript Embed</h3>
              </div>
              <p className="text-green-700 text-sm">
                Fast loading, responsive, and automatically updates when you modify your widget settings.
                {isPreviewMode && " The widget ID will be generated after you create the widget."}
              </p>
            </div>
            
            <div className="relative w-[52rem]">
              <pre className="bg-gray-50 border rounded-lg p-4 text-sm overflow-x-auto ">
                <code>{javascriptCode}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => handleCopyCode('javascript')}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">How to use:</h4>
              <ol className="text-blue-700 text-sm space-y-1 list-decimal list-inside">
                <li>Copy the JavaScript code above</li>
                <li>Paste it into your website's HTML where you want the reviews to appear</li>
                <li>The widget will automatically load and display your reviews</li>
              </ol>
            </div>
          </TabsContent>

          {isPreviewMode && previewWidgetProps && (
            <TabsContent value="preview" className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">Live Preview</h3>
                </div>
                <p className="text-blue-700 text-sm">
                  This is exactly how your widget will appear when embedded on your website.
                </p>
              </div>
              
              <div className="border rounded-lg p-4 bg-white">
                <WidgetPreview
                  widget={previewWidgetProps}
                  reviews={previewReviews}
                  isLoadingReviews={false}
                />
              </div>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          {isPreviewMode && onCreateWidget && (
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex-1">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> Create the widget to get the actual embed code with a real widget ID.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={onCreateWidget}
                  disabled={isCreatingWidget}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isCreatingWidget ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
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
          )}
          {!isPreviewMode && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WidgetCodeModal;
