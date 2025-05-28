import { useState } from "react";
import WidgetCodeModal, { IWidgetForCodeModal } from "./WidgetCodeModal";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Building2, Code, Chrome, Facebook } from "lucide-react";

interface IBusinessUrlForWidgetCard {
  _id: string;
  source: 'google' | 'facebook';
  name: string;
  url?: string;
}
export interface IWidget {
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
  businessUrl?: IBusinessUrlForWidgetCard;
  createdAt?: string | Date;
  averageRating?: number;
  isActive?: boolean;
  settings?: Record<string, any>;
  totalReviewCount?: number;
}

interface WidgetCardProps {
  widget: IWidget;
  onDelete?: () => void;
  _onEdit?: (widgetId: string) => void;
  isDeleting?: boolean;
  hideBusinessName?: boolean;
}

const WidgetCard = ({ widget, onDelete, _onEdit, isDeleting, hideBusinessName }: WidgetCardProps) => {
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const createdDate = widget.createdAt
    ? new Date(widget.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'N/A';
    
  const _getSourceIcon = (source: string) => {
    if (source === 'google') return <Chrome className="h-5 w-5" />;
    if (source === 'facebook') return <Facebook className="h-5 w-5" />;
    return <Building2 className="h-5 w-5" />;
  };
  
  const getSourceBgClass = (): string => {
    if (widget.businessUrl?.source === 'google') return 'bg-red-100';
    if (widget.businessUrl?.source === 'facebook') return 'bg-blue-100';
    return 'bg-gray-100';
  };
  
  const getSourceTextClass = (): string => {
    if (widget.businessUrl?.source === 'google') return 'text-red-600';
    if (widget.businessUrl?.source === 'facebook') return 'text-blue-600';
    return 'text-gray-600';
  };

  const _getSourceTooltip = (source: string): string => {
    if (source === 'google') return 'Google Business Reviews';
    if (source === 'facebook') return 'Facebook Reviews';
    return 'No source connected';
  };

  // Function to format layout type for display
  const getLayoutDisplayName = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'grid': return 'Grid Layout';
      case 'list': return 'List Layout';
      case 'carousel': return 'Carousel Layout';
      case 'masonry': return 'Masonry Layout';
      case 'badge': return 'Badge Layout';
      default: return 'Grid Layout';
    }
  };

  // Function to get layout icon
  const getLayoutIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'grid': return <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>;
      case 'list': return <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>;
      case 'carousel': return <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/></svg>;
      case 'masonry': return <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 000 2h4a1 1 0 100-2H3zM3 8a1 1 0 000 2h8a1 1 0 100-2H3zM3 12a1 1 0 100 2h6a1 1 0 100-2H3zM11 6a1 1 0 011-1h5a1 1 0 110 2h-5a1 1 0 01-1-1zM12 9a1 1 0 100 2h5a1 1 0 100-2h-5zM11 14a1 1 0 011-1h5a1 1 0 110 2h-5a1 1 0 01-1-1z"/></svg>;
      case 'badge': return <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>;
      default: return <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>;
    }
  };

  const widgetPropsForCodeModal: IWidgetForCodeModal = {
      _id: widget._id,
      name: widget.name,
      themeColor: widget.themeColor,
      layout: widget.type,
    };

  const ratingToDisplay = widget.averageRating ?? 0;

  return (
    <>
      <div
        className={`relative bg-white rounded-xl shadow-md p-5 flex flex-col gap-3 hover:shadow-lg transition-all duration-300 ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => setIsCodeModalOpen(true)}
        style={{ cursor: 'pointer' }}
      >
        {/* Top Row: Layout Type & Actions */}
        <div className="flex justify-between items-start mb-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
            {getLayoutIcon(widget.type)}
            {getLayoutDisplayName(widget.type)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-100"
              onClick={e => {
                e.stopPropagation();
                setIsCodeModalOpen(true);
              }}
              title="Get embed code"
            >
              <Code className="h-4 w-4" />
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-100"
                onClick={e => {
                  e.stopPropagation();
                  setIsDeleteModalOpen(true);
                }}
                disabled={isDeleting}
                title="Delete widget"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-4 w-4" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                  />
                </svg>
              </Button>
            )}
          </div>
        </div>
        {/* Status & Platform */}
        <div className="flex items-center gap-3 mb-1">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${widget.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
            {widget.isActive ? 'Active' : 'Inactive'}
          </span>
          {widget.businessUrl?.source && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className={`w-4 h-4 rounded flex items-center justify-center ${getSourceBgClass()} ${getSourceTextClass()}`}>{widget.businessUrl.source === 'google' ? <Chrome className="h-3 w-3" /> : <Facebook className="h-3 w-3" />}</span>
              {widget.businessUrl.source.charAt(0).toUpperCase() + widget.businessUrl.source.slice(1)}
            </span>
          )}
        </div>
        {/* Review Count & Date */}
        <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
          <span className="flex items-center gap-1">
            <i className="fas fa-star text-yellow-400 text-sm"></i>
            {widget.totalReviewCount} Reviews
          </span>
          <span>Created: {createdDate}</span>
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Widget</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the widget &quot;{widget.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setIsDeleteModalOpen(false);
                onDelete?.();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Deleting...
                </>
              ) : (
                <>
                  <i className="fas fa-trash-alt mr-2"></i>
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isCodeModalOpen && (
        <WidgetCodeModal
          isOpen={isCodeModalOpen}
          onClose={() => setIsCodeModalOpen(false)}
          widget={widgetPropsForCodeModal}
        />
      )}
    </>
  );
};
export default WidgetCard;