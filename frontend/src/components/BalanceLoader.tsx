import React from 'react';

const BalanceLoader: React.FC = () => {
  return (
    <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((item) => (
        <div key={item} className="flex items-center justify-between p-2 border-b border-gray-700 last:border-b-0">
          <div className="flex items-center space-x-3 flex-grow">
            <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
            <div className="h-4 bg-gray-700 rounded w-20"></div>
          </div>
          <div className="h-4 bg-gray-700 rounded w-16"></div>
        </div>
      ))}
    </div>
  );
};

export default BalanceLoader;
