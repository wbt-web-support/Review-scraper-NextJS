import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Trash2, AlertTriangle } from "lucide-react";

interface DeleteWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  widgetName?: string;
  isLoading?: boolean;
}

const DeleteWidgetModal = ({
  isOpen,
  onClose,
  onConfirm,
  widgetName,
  isLoading = false,
}: DeleteWidgetModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-white rounded-2xl">
        <DialogHeader className="space-y-4">
          <div className="flex items-center justify-center w-12 h-12 bg-red-50 rounded-full mx-auto">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <DialogTitle className="text-xl font-semibold text-slate-900 text-center">
            Delete Widget
          </DialogTitle>
          <DialogDescription className="text-slate-600 text-center leading-relaxed">
            {widgetName ? (
              <>
                Are you sure you want to delete <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-1 rounded-md">"{widgetName}"</span>? 
                <br />
                <span className="text-sm text-slate-500 mt-2 block">
                  This action cannot be undone and will permanently remove the widget and all its associated data.
                </span>
              </>
            ) : (
              <>
                Are you sure you want to delete this widget?
                <br />
                <span className="text-sm text-slate-500 mt-2 block">
                  This action cannot be undone and will permanently remove the widget and all its associated data.
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-2 justify-end pt-6">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors duration-200"
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white border-0 shadow-sm hover:shadow-md transition-all duration-200"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Widget
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteWidgetModal;
