import React from 'react';
import { AlertCircle, FolderOpen, Loader2, RefreshCw } from 'lucide-react';

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'جاري تحميل البيانات...' }) => (
  <div className="flex flex-col items-center justify-center p-12 text-gray-500">
    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
    <p className="text-sm font-medium">{message}</p>
  </div>
);

export const ErrorState: React.FC<{ 
  title?: string; 
  message: string; 
  onRetry?: () => void 
}> = ({ 
  title = 'حدث خطأ غير متوقع', 
  message, 
  onRetry 
}) => (
  <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-xl text-center max-w-md mx-auto my-6">
    <AlertCircle className="w-10 h-10 text-red-600 mb-3" />
    <h3 className="text-base font-bold text-red-900 mb-1">{title}</h3>
    <p className="text-sm text-red-700 mb-4">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        إعادة المحاولة
      </button>
    )}
  </div>
);

export const EmptyState: React.FC<{
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
}> = ({
  title = 'لا توجد بيانات متاحة',
  message = 'لم يتم العثور على أي عناصر لعرضها حاليًا.',
  actionText,
  onAction,
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 my-6">
    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-3">
      <FolderOpen className="w-6 h-6" />
    </div>
    <h4 className="text-sm font-bold text-gray-800 mb-1">{title}</h4>
    <p className="text-xs text-gray-500 max-w-xs mb-4">{message}</p>
    {actionText && onAction && (
      <button
        onClick={onAction}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
      >
        {actionText}
      </button>
    )}
  </div>
);
