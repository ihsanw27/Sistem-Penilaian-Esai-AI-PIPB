
import React from 'react';
import { AppFeature } from '../types';

/**
 * Props for the NavBar component.
 */
interface NavBarProps {
  /** The currently active feature. */
  activeFeature: AppFeature;
  /** Function to set the active feature. */
  setActiveFeature: (feature: AppFeature) => void;
}

/**
 * A navigation bar component to switch between different application features.
 * @param {NavBarProps} props - The component props.
 * @returns {React.ReactElement} The rendered navigation bar.
 */
const NavBar: React.FC<NavBarProps> = ({ activeFeature, setActiveFeature }) => {
  const features = Object.values(AppFeature);

  return (
    <nav className="flex flex-wrap justify-center gap-2 sm:gap-3 p-2 rounded-lg bg-gray-800 border border-gray-700 shadow-md">
      {features.map((feature) => (
        <button
          key={feature}
          onClick={() => setActiveFeature(feature)}
          className={`px-3 py-2 sm:px-4 text-sm sm:text-base font-medium rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 ${
            activeFeature === feature
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
          aria-pressed={activeFeature === feature}
        >
          {feature}
        </button>
      ))}
    </nav>
  );
};

export default NavBar;
