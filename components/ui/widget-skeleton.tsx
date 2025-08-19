import React from 'react';

interface WidgetSkeletonProps {
  viewMode: 'grid' | 'list';
  count?: number;
}

export const WidgetSkeleton: React.FC<WidgetSkeletonProps> = ({ 
  viewMode, 
  count = 6 
}) => {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse"
          >
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="h-6 bg-gray-200 rounded-lg mb-2"></div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-16 bg-gray-200 rounded-md"></div>
                <div className="h-5 w-20 bg-gray-200 rounded-md"></div>
              </div>
              
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
                <div className="h-4 w-16 bg-gray-200 rounded"></div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 h-8 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 h-8 bg-gray-200 rounded-lg"></div>
                <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-2xl border border-gray-100 animate-pulse"
        >
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-xl bg-gray-200"></div>
              <div className="flex-1">
                <div className="h-6 bg-gray-200 rounded-lg mb-2 w-48"></div>
                <div className="flex items-center gap-4">
                  <div className="h-4 w-20 bg-gray-200 rounded"></div>
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
                  <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
              <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
              <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
