import React from 'react';

interface LoadingButtonProps {
  onClick: () => void;
  isLoading: boolean;
  text: string;
  loadingText?: string;
  className?: string;
  disabled?: boolean;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  onClick,
  isLoading,
  text,
  loadingText = 'Processing...',
  className = '',
  disabled = false,
}) => {
  return (
    <button 
      onClick={onClick} 
      disabled={isLoading || disabled}
      className={className}
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {loadingText}
        </div>
      ) : (
        text
      )}
    </button>
  );
};

export default LoadingButton;
