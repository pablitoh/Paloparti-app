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

  // Manejar el cambio de pestaña y cerrar el drawer
  const handleTabClick = (index: number) => {
    console.log('MobileDrawer - handleTabClick:', index);
    // Llamar al callback de cambio de pestaña
    onTabChange(index);
    // Cerrar el drawer después de cambiar la pestaña
    onClose();
  };

  return (
    <div className='fixed inset-0 z-50 overflow-hidden'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm transition-opacity'
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className='fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-green-lg flex flex-col border-r border-primary-100'>
        <div className='p-6 border-b border-primary-100 flex justify-between items-center bg-gradient-green-soft'>
          <h2 className='text-lg font-semibold text-gray-900'>Navegación</h2>
          <button
            onClick={onClose}
            className='rounded-xl text-gray-400 hover:text-primary-600 hover:bg-primary-50 p-2 transition-colors focus:outline-none'
          >
            <XMarkIcon className='h-6 w-6' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto py-4'>
          <nav className='flex flex-col px-4 space-y-1'>
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => handleTabClick(index)}
                className={`${
                  selectedTab === index
                    ? 'bg-gradient-green text-white shadow-green font-medium'
                    : 'text-gray-600 hover:bg-primary-50 hover:text-primary-700'
                } py-4 px-4 rounded-xl flex items-center justify-between transition-all duration-200 active:scale-95`}
              >
                <span className='font-medium'>{tab.label}</span>
                {tab.showBadge && tab.badgeCount && tab.badgeCount > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[20px] h-5 px-2 text-xs font-bold rounded-full ${
                      selectedTab === index
                        ? 'bg-white bg-opacity-20 text-white'
                        : 'bg-gradient-green text-white shadow-green'
                    }`}
                  >
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
