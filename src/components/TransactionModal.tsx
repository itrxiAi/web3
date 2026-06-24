import React from 'react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error';
  message?: string | null;
  txSignature?: string | null;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  type,
  message,
  txSignature
}) => {
  if (!isOpen) return null;

  const borderColor = type === 'error' ? 'border-red-500/20' : 'border-purple-500/20';
  const title = type === 'error' ? 'Transaction Failed' : 'Transaction Submitted';
  const messageColor = type === 'error' ? 'text-red-400' : 'text-gray-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className={`relative w-11/12 max-w-md p-6 bg-gray-900 ${borderColor} rounded-xl`}>
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h3 className="text-xl font-semibold text-white mb-4">{title}</h3>
        {type === 'error' ? (
          <div className="mb-4">
            <p className={`${messageColor} mb-2 max-w-[500px] break-words`}>
              {message || 'An error occurred'}
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <p className={`${messageColor} mb-2`}>
              Transaction Signature:
            </p>
            <div className="p-3 bg-gray-800 rounded-lg break-all max-w-[500px]">
              <p className="text-purple-400 text-sm break-words">
                {txSignature ? (
                  <a 
                    href={`https://bscscan.com/tx/${txSignature}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline hover:text-purple-300 transition-colors"
                  >
                    {txSignature}
                  </a>
                ) : (
                  'No signature available'
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
