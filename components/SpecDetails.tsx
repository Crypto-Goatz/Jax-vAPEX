import React, { useState } from 'react';

const navData = [
  {
    name: '📁 00_System_Health',
    id: 'health',
    children: [
      { name: '📈 JaxAI - CONFIG', id: 'config' },
      { name: '📈 JaxAI - System_Log', id: 'log' },
    ],
  },
  {
    name: '📁 01_Pipelines',
    id: 'pipelines',
    children: [
      {
        name: '📁 PIPE_LowRisk_Gems',
        id: 'low-risk',
        children: [
          { name: '📈 S1_Radar_LR', id: 'radar' },
          { name: '📈 S2_Staging_LR', id: 'staging' },
          { name: '... (S3, S4, S5)', id: 'stages' },
        ],
      },
    ],
  },
  {
    name: '📁 02_AI_Learning',
    id: 'learning',
    children: [{ name: '📈 Metrics_DB_LR', id: 'metrics' }],
  },
  {
    name: '📁 03_Data_Feeds',
    id: 'feeds',
    children: [
      {
        name: '📁 L1_Live',
        id: 'live',
        children: [{ name: '📈 Live_Pricing_Data', id: 'live-pricing' }],
      },
      {
        name: '📁 L1_Historical',
        id: 'historical',
        children: [
          { name: '📈 Historical_Pricing', id: 'hist-pricing' },
          { name: '📈 Historical_OnChain', id: 'hist-onchain' },
        ],
      },
    ],
  },
];

type NavItemType = {
  name: string;
  id: string;
  children?: NavItemType[];
};

const NavItem: React.FC<{ item: NavItemType; level?: number }> = ({ item, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(level < 1);
  const hasChildren = item.children && item.children.length > 0;

  const handleToggle = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };
  
  const isFolder = item.name.startsWith('📁');

  return (
    <li className="my-1">
      <div
        onClick={handleToggle}
        className={`flex items-center p-2 text-sm rounded-md transition-colors ${
          hasChildren ? 'cursor-pointer hover:bg-gray-700' : 'cursor-default'
        } ${!isFolder && hasChildren === false ? 'hover:bg-gray-700/50' : ''}`}
        style={{ paddingLeft: `${1 + level * 1.5}rem` }}
      >
        <span className="flex-grow text-gray-300 select-none">{item.name}</span>
        {hasChildren && (
          <svg
            className={`w-4 h-4 text-gray-400 transform transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
          </svg>
        )}
      </div>
      {hasChildren && isExpanded && (
        <ul className="transition-all duration-300 ease-in-out">
          {item.children?.map((child) => (
            <NavItem key={child.id} item={child} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
};


export const SpecDetails: React.FC = () => {
    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">System Specification Details</h2>
                <p className="text-sm text-gray-400">Live operational structure of the JaxAI Hub.</p>
            </div>
            <nav className="p-2 overflow-y-auto flex-1">
                <ul>
                    {navData.map((item) => (
                        <NavItem key={item.id} item={item} />
                    ))}
                </ul>
            </nav>
        </div>
    );
};
