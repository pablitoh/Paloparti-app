import React from 'react';
import Header from './Header';
import ProfileCompletionBanner from './ProfileCompletionBanner';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className='min-h-screen bg-gradient-green-soft'>
      <Header />
      <main>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <ProfileCompletionBanner />
        </div>
        {children}
      </main>
    </div>
  );
}
