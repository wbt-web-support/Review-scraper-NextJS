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
}

const WidgetCodeModal = ({ isOpen, onClose, widget }: WidgetCodeModalProps) => {
  const [activeTab, setActiveTab] = useState<"javascript" | "iframe">("javascript");
  const { toast } = useToast();

  const domain = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'https://your-app-domain.com';
  
    const javascriptCode = `<div id="reviewhub-widget-${widget._id}"></div>
    <script>
      (function() {
        var config = {
          containerId: 'reviewhub-widget-${widget._id}',
          widgetId: '${widget._id}'
          ${widget.themeColor ? `, themeColor: '${widget.themeColor.replace(/'/g, "\\'")}'` : ''}
          ${widget.layout ? `, layout: '${widget.layout.replace(/'/g, "\\'")}'` : ''}
        };
    
        if (window.ReviewHub && typeof window.ReviewHub.initWidget === 'function') {
          window.ReviewHub.initWidget(config);
        } else {
          window.ReviewHubPendingWidgets = window.ReviewHubPendingWidgets || [];
          window.ReviewHubPendingWidgets.push(config);
    
          if (!document.querySelector('script[src="${domain}/widget.js"]')) {
            var script = document.createElement('script');
            script.src = '${domain}/widget.js';
            script.async = true;
            script.defer = true;
            script.onerror = function() {
              console.error('ReviewHub: Failed to load widget.js from ${domain}/widget.js. Ensure the main ReviewHub application is running and accessible.');
              var el = document.getElementById(config.containerId);
              if(el) el.innerHTML = '<p style="color:red; text-align:center;">Error loading review widget.</p>';
            };
            document.head.appendChild(script);
          }
        }
      })();
    </script>`;

  const iframeCode = `
  <iframe
    src="${domain}/embed/widget/${widget._id}"
    style="width: 100%; min-height: 400px; border: none; overflow: hidden;"
    title="${widget.name || 'Review Widget'}"
    loading="lazy"
    allowtransparency="true"
    frameborder="0" 
  ></iframe>`;

  // Handle copy to clipboard
  const handleCopyCode = () => {
    const codeToCopy = activeTab === "javascript" ? javascriptCode : iframeCode;
    if (codeToCopy) {
      navigator.clipboard.writeText(codeToCopy)
        .then(() => {
          toast({
            title: "Copied!",
            description: `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} code copied to clipboard.`,
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

  const currentCodeToShow = activeTab === 'javascript' ? javascriptCode : iframeCode;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg min-w-[320px] rounded-lg p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Embed Widget on Your Website</DialogTitle>
          <DialogDescription>
            Copy the code below and paste it into your website where you want the widget to appear.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          <Tabs defaultValue="javascript" value={activeTab} onValueChange={(value: string) => setActiveTab(value as "javascript" | "iframe")}>
            <TabsList className="grid w-full grid-cols-2 mb-2">
              <TabsTrigger value="javascript">JavaScript (Recommended)</TabsTrigger>
              <TabsTrigger value="iframe">iFrame</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="py-2">
              <div className="bg-slate-800 rounded-md overflow-hidden shadow-inner">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-700 border-b border-slate-600">
                  <span className="text-sm font-medium text-slate-200">
                    {activeTab === 'javascript' ? 'JavaScript Embed Code' : 'iFrame Embed Code'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm" 
                    className="text-slate-300 hover:text-white hover:bg-slate-600"
                    onClick={handleCopyCode}
                  >
                    <i className="fas fa-copy mr-2 h-4 w-4"></i>
                    Copy
                  </Button>
                </div>
                <pre className="p-4 text-sm text-slate-100 overflow-auto max-h-48 min-h-[100px] bg-slate-900 rounded-b-md">
                  <code>{currentCodeToShow}</code> 
                </pre>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {activeTab === 'javascript'
                  ? "Dynamically loads the widget. Recommended for most integrations."
                  : "Simpler to embed, but offers less flexibility and might affect SEO or page speed."}
              </p>
            </TabsContent>
          </Tabs>
        </div>
        <div className="px-6 pt-4 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="bg-slate-100 rounded px-3 py-2 text-xs text-slate-700 w-full sm:w-auto text-center sm:text-left">
            Widget ID: <code className="font-mono">{widget._id}</code>
          </div>
          <div className="flex justify-end gap-2 w-full sm:w-auto">
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            <Button type="button" onClick={handleCopyCode}>
              <i className="fas fa-copy mr-2 h-4 w-4"></i>Copy Active Code
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WidgetCodeModal;
