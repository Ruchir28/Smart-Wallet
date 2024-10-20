import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

export interface NotificationProps {
  id: string;
  message: string;
  type: 'success' | 'error';
  onClose: (id: string) => void;
}

const Notification: React.FC<NotificationProps> = ({ id, message, type, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (contentRef.current) {
      setIsOverflowing(contentRef.current.scrollHeight > contentRef.current.clientHeight);
    }
  }, [message]);

  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  const icon = type === 'success' ? (
    <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
    </svg>
  ) : (
    <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
    </svg>
  );

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-start space-x-3 mb-2 max-w-sm`}
    >
      <div className="flex-shrink-0 mt-1">{icon}</div>
      <div className="flex-grow overflow-hidden">
        <p 
          ref={contentRef}
          className={`text-sm font-medium ${isExpanded ? 'max-h-none' : 'max-h-12'} overflow-y-auto transition-all duration-300 ease-in-out`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {message}
        </p>
        {isOverflowing && (
          <button 
            onClick={toggleExpand}
            className="text-xs text-white/80 hover:text-white mt-1"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
      <button onClick={() => onClose(id)} className="flex-shrink-0 ml-2 focus:outline-none">
        <svg className="w-5 h-5 text-white hover:text-gray-200 transition-colors duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </motion.div>
  );
};

export default Notification;
