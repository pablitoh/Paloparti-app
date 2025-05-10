import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface TabConfig {
  label: string;
  showBadge?: boolean;
  badgeCount?: number;
}

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: TabConfig[];
  selectedTab: number;
  onTabChange: (index: number) => void;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  tabs,
  selectedTab,
  onTabChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 overflow-hidden'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity'
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className='fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-xl flex flex-col'>
        <div className='p-4 border-b border-gray-200 flex justify-between items-center'>
          <h2 className='text-lg font-medium text-gray-900'>Navegación</h2>
          <button
            onClick={onClose}
            className='rounded-md text-gray-400 hover:text-gray-500 focus:outline-none'
          >
            <XMarkIcon className='h-6 w-6' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto py-4'>
          <nav className='flex flex-col px-4 space-y-1'>
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => {
                  onTabChange(index);
                  onClose();
                }}
                className={`${
                  selectedTab === index
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                } py-3 px-4 rounded-md flex items-center justify-between transition-colors`}
              >
                <span>{tab.label}</span>
                {tab.showBadge && tab.badgeCount && tab.badgeCount > 0 && (
                  <span className='inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white rounded-full bg-red-500'>
                    {tab.badgeCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default MobileDrawer;
