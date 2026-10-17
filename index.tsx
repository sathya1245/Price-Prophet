import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { 
  LayoutDashboard, 
  Calculator, 
  TrendingUp, 
  Settings2, 
  FileText, 
  BarChart3, 
  Zap, 
  Globe, 
  DollarSign, 
  CheckCircle2,
  ArrowRight,
  Download,
  RefreshCw,
  Target,
  BrainCircuit,
  LineChart as LineChartIcon,
  Printer,
  X,
  Upload,
  Image as ImageIcon
} from "lucide-react";

// --- Types & Interfaces ---

interface ProductInput {
  name: string;
  cost: number;
  currency: string;
  location: string;
  category: string;
  desiredMargin: number;
}

interface Competitor {
  name: string;
  price: number;
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
  trend: 'up' | 'down' | 'stable';
  history: number[]; // Last 6 months prices
}

interface Seasonality {
  signal: string;
  adjustmentFactor: number; // e.g., 1.05 for +5%
  explanation: string;
}

interface PricingResult {
  recommendedPrice: number;
  priceRange: { min: number; suggested: number; premium: number };
  profitMargin: number;
  confidenceScore: number; // 0-100
  explanation: string;
  evidence: string[];
  seasonality: Seasonality;
  competitors: Competitor[];
  strategy: 'Cost-Plus' | 'Competitor-Based' | 'Value-Based';
}

interface ConversionPoint {
  price: number;
  estimatedSales: number;
  revenue: number;
}

interface Scenario {
  id: string;
  name: string;
  shippingIncrease: number; // %
  competitorDrop: number; // %
  demandChange: number; // %
}

interface AutomationRule {
  id: string;
  conditionField: 'margin' | 'competitor_stock' | 'demand';
  operator: '<' | '>' | '=';
  value: number | string;
  action: string;
  active: boolean;
}

interface AppSettings {
  logoUrl: string | null;
  companyName: string;
}

// --- Pricing Engine (runs entirely in the browser, no API key required) ---

// Deterministic PRNG so the same product always produces the same analysis.
const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRandom = (seed: number) => {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const round2 = (value: number) => Math.round(value * 100) / 100;

interface CategoryProfile {
  label: string;
  priceIndex: number;
  strategy: PricingResult['strategy'];
  competitors: string[];
}

const CATEGORY_PROFILES: { match: string[]; profile: CategoryProfile }[] = [
  {
    match: ['electronic', 'phone', 'laptop', 'tablet', 'camera', 'audio', 'headphone', 'tv', 'gadget', 'tech'],
    profile: {
      label: 'Consumer Electronics',
      priceIndex: 1.55,
      strategy: 'Competitor-Based',
      competitors: ['VoltMart', 'Circuit City', 'Nexus Electronics', 'GadgetHub', 'PrimeTech']
    }
  },
  {
    match: ['fashion', 'apparel', 'clothing', 'shoe', 'sneaker', 'bag', 'backpack', 'wear', 'textile'],
    profile: {
      label: 'Fashion & Apparel',
      priceIndex: 1.85,
      strategy: 'Value-Based',
      competitors: ['Urban Threads', 'StyleNest', 'Mode & Co.', 'Fabric House']
    }
  },
  {
    match: ['luxury', 'jewel', 'watch', 'premium', 'designer', 'leather'],
    profile: {
      label: 'Luxury Goods',
      priceIndex: 2.3,
      strategy: 'Value-Based',
      competitors: ['Maison Luxe', 'Atelier Nine', 'The Heritage Co.']
    }
  },
  {
    match: ['home', 'furniture', 'kitchen', 'decor', 'mattress', 'appliance'],
    profile: {
      label: 'Home & Living',
      priceIndex: 1.7,
      strategy: 'Competitor-Based',
      competitors: ['HomeCraft', 'Nest & Co.', 'Urban Living', 'Casa Supply']
    }
  },
  {
    match: ['beauty', 'cosmetic', 'skincare', 'perfume', 'hair', 'grooming'],
    profile: {
      label: 'Beauty & Personal Care',
      priceIndex: 1.95,
      strategy: 'Value-Based',
      competitors: ['GlowBar', 'Pure Ritual', 'Bloom Beauty']
    }
  },
  {
    match: ['food', 'beverage', 'coffee', 'snack', 'grocery', 'drink', 'bakery'],
    profile: {
      label: 'Food & Beverage',
      priceIndex: 1.35,
      strategy: 'Cost-Plus',
      competitors: ['FreshCart', 'Daily Basket', 'Harvest Foods']
    }
  },
  {
    match: ['sport', 'fitness', 'gym', 'outdoor', 'cycling', 'yoga'],
    profile: {
      label: 'Sports & Fitness',
      priceIndex: 1.65,
      strategy: 'Competitor-Based',
      competitors: ['PeakGear', 'Stride Sports', 'Apex Athletics']
    }
  },
  {
    match: ['toy', 'game', 'book', 'stationery', 'craft'],
    profile: {
      label: 'Toys & Leisure',
      priceIndex: 1.5,
      strategy: 'Cost-Plus',
      competitors: ['PlayWorks', 'BrightBox', 'The Game Shelf']
    }
  }
];

const DEFAULT_CATEGORY: CategoryProfile = {
  label: 'General Merchandise',
  priceIndex: 1.6,
  strategy: 'Cost-Plus',
  competitors: ['Northwind Retail', 'MetroMart', 'ValueHub', 'Apex Goods']
};

const LOCATION_INDEX: { match: string[]; index: number }[] = [
  { match: ['new york', 'nyc'], index: 1.25 },
  { match: ['san francisco', 'bay area', 'silicon valley'], index: 1.3 },
  { match: ['los angeles', 'seattle', 'boston'], index: 1.2 },
  { match: ['chicago', 'austin', 'denver'], index: 1.1 },
  { match: ['london'], index: 1.22 },
  { match: ['manchester', 'birmingham'], index: 1.05 },
  { match: ['dubai', 'abu dhabi'], index: 1.12 },
  { match: ['singapore'], index: 1.18 },
  { match: ['tokyo', 'osaka'], index: 1.15 },
  { match: ['sydney', 'melbourne'], index: 1.2 },
  { match: ['toronto', 'vancouver'], index: 1.1 },
  { match: ['berlin', 'munich'], index: 1.1 },
  { match: ['paris'], index: 1.15 },
  { match: ['mumbai'], index: 0.78 },
  { match: ['bengaluru', 'bangalore'], index: 0.8 },
  { match: ['delhi', 'gurugram', 'noida'], index: 0.74 },
  { match: ['hyderabad'], index: 0.76 },
  { match: ['chennai'], index: 0.72 },
  { match: ['kolkata'], index: 0.7 },
  { match: ['pune', 'ahmedabad'], index: 0.73 }
];

const getCategoryProfile = (input: ProductInput): CategoryProfile => {
  const haystack = `${input.name} ${input.category}`.toLowerCase();
  return CATEGORY_PROFILES.find(entry => entry.match.some(keyword => haystack.includes(keyword)))?.profile || DEFAULT_CATEGORY;
};

const getLocationIndex = (location: string) => {
  const normalized = location.trim().toLowerCase();
  return LOCATION_INDEX.find(entry => entry.match.some(keyword => normalized.includes(keyword)))?.index || 1;
};

const getSeasonality = (location: string, random: () => number): Seasonality => {
  const month = new Date().getMonth();
  const india = /india|mumbai|delhi|bengaluru|bangalore|hyderabad|chennai|kolkata|pune|ahmedabad/i.test(location);

  if (month === 9 || month === 10) {
    const factor = india ? 1.14 : 1.1;
    return {
      signal: india ? 'Festive Season Demand Surge' : 'Pre-Holiday Demand Build-Up',
      adjustmentFactor: factor,
      explanation: india
        ? 'Diwali and the festive shopping window lift discretionary demand across most categories, supporting a higher price point.'
        : 'Consumers are starting holiday shopping early, which historically supports a 10% uplift in retail prices through Q4.'
    };
  }

  if (month === 11) {
    return {
      signal: 'Holiday Peak Demand',
      adjustmentFactor: 1.12,
      explanation: 'Peak holiday gifting season concentrates demand into a few weeks, giving sellers room to hold premium prices.'
    };
  }

  if (month === 0) {
    return {
      signal: 'Post-Holiday Slowdown',
      adjustmentFactor: 0.94,
      explanation: 'January demand softens after the holidays, so a slightly defensive price protects conversion volume.'
    };
  }

  if (month >= 4 && month <= 6) {
    return {
      signal: 'Summer Demand Window',
      adjustmentFactor: 1.03 + Number((random() * 0.02).toFixed(2)),
      explanation: 'Warmer months lift category interest and travel-related purchases, allowing a modest seasonal premium.'
    };
  }

  if (month === 7) {
    return {
      signal: 'Late Summer Lull',
      adjustmentFactor: 0.97,
      explanation: 'Late-summer demand is typically flat, so pricing slightly below the seasonal anchor helps maintain volume.'
    };
  }

  return {
    signal: 'Stable Seasonal Demand',
    adjustmentFactor: 1.0,
    explanation: 'No major seasonal event is driving demand this month, so the recommendation leans on cost and competitor signals.'
  };
};

// --- Backend Simulation (Service) ---

const SimulatedBackend = {
  async analyzePrice(input: ProductInput): Promise<PricingResult> {
    // Runs on-device: cost-plus floor, location-adjusted competitor benchmark,
    // and seasonal demand modelling. Same input always yields the same output.
    const random = createRandom(hashString(`${input.name}|${input.cost}|${input.location}|${input.category}`));
    const cost = input.cost > 0 ? input.cost : 10;
    const desiredMargin = Math.min(Math.max(input.desiredMargin || 0, 0), 85);
    const category = getCategoryProfile(input);
    const locationIndex = getLocationIndex(input.location);
    const seasonality = getSeasonality(input.location, random);

    const floor = round2(cost * 1.1);
    const marginPrice = cost / (1 - desiredMargin / 100);
    const marketAnchor = cost * category.priceIndex * locationIndex;
    const seasonalAnchor = marketAnchor * seasonality.adjustmentFactor;

    let recommendedPrice = round2(marginPrice * 0.55 + seasonalAnchor * 0.45);
    recommendedPrice = Math.max(recommendedPrice, floor);

    const competitors: Competitor[] = category.competitors.slice(0, 3).map((name, i) => {
      const competitorRandom = createRandom(hashString(`${name}|${input.location}|${i}`));
      const price = round2(seasonalAnchor * (0.9 + competitorRandom() * 0.24));
      const history = Array.from({ length: 6 }, () =>
        round2(price * (0.92 + competitorRandom() * 0.16))
      );
      history[history.length - 1] = price;
      const trend: Competitor['trend'] =
        history[5] > history[4] * 1.02 ? 'up' : history[5] < history[4] * 0.98 ? 'down' : 'stable';
      const stockRoll = competitorRandom();
      const stockStatus: Competitor['stockStatus'] =
        stockRoll > 0.88 ? 'Out of Stock' : stockRoll > 0.7 ? 'Low Stock' : 'In Stock';

      return { name, price, stockStatus, trend, history };
    });

    const sortedCompetitorPrices = competitors.map(c => c.price).sort((a, b) => a - b);
    const medianCompetitor = sortedCompetitorPrices[Math.floor(sortedCompetitorPrices.length / 2)];
    const competitorSpread = medianCompetitor > 0
      ? ((sortedCompetitorPrices[sortedCompetitorPrices.length - 1] - sortedCompetitorPrices[0]) / medianCompetitor) * 100
      : 0;

    const strategy: PricingResult['strategy'] =
      desiredMargin >= 35 ? 'Value-Based' : competitorSpread > 18 ? 'Competitor-Based' : category.strategy;

    const profitMargin = round2(((recommendedPrice - cost) / recommendedPrice) * 100);
    const confidenceScore = Math.min(
      96,
      Math.round(74 + (input.category ? 4 : 0) + (input.location ? 5 : 0) + (input.name ? 4 : 0) + random() * 5)
    );
    const profitFloor = round2(cost * 1.1);
    const ceiling = round2(recommendedPrice * 1.18);

    return {
      recommendedPrice,
      priceRange: {
        min: Math.max(profitFloor, round2(recommendedPrice * 0.88)),
        suggested: recommendedPrice,
        premium: ceiling
      },
      profitMargin,
      confidenceScore,
      strategy,
      explanation:
        `A ${strategy.toLowerCase()} strategy fits ${input.name || 'this product'} best in ${input.location || 'this market'}. ` +
        `The recommendation blends a ${desiredMargin}% target margin with a ${seasonality.adjustmentFactor.toFixed(2)}x seasonal signal and ` +
        `competitor prices clustering near ${round2(medianCompetitor)} ${input.currency}. ` +
        `It stays comfortably above the ${profitFloor} ${input.currency} margin floor while remaining within ${Math.round(competitorSpread)}% of the local price band.`,
      evidence: [
        `Gross-margin floor of ${profitFloor} ${input.currency} protects at least 10% profit per unit.`,
        `${category.label} competitors sit near ${round2(medianCompetitor)} ${input.currency}, a ${Math.round(competitorSpread)}% spread across the tracked set.`,
        `${seasonality.signal} supports a ${Math.round((seasonality.adjustmentFactor - 1) * 100)}% seasonal adjustment this month.`,
        `Local price index for ${input.location || 'the target market'} is ${locationIndex.toFixed(2)}x the national baseline.`,
        `A ${desiredMargin}% target margin implies a ${round2(marginPrice)} ${input.currency} list price before market adjustment.`
      ],
      seasonality,
      competitors
    };
  },

  calculateConversion(currentPrice: number, cost: number): ConversionPoint[] {
    // Simple elasticity model: Q = Q_max * (1 - P / P_max_willingness)
    const points: ConversionPoint[] = [];
    const range = 5; // +/- 5 steps
    const basePrice = currentPrice > 0 ? currentPrice : Math.max(cost * 1.2, 1);
    const step = Math.max(basePrice * 0.05, 0.01);

    for (let i = -range; i <= range; i++) {
      const p = basePrice + (i * step);
      if (p <= cost) continue; // Ignore prices below cost

      // Hypothetical demand curve logic
      // Assume at the suggested price, demand is 100 (baseline index)
      // Elasticity typically negative. Let's assume -1.5 for standard consumer goods
      const elasticity = 1.5;
      const pctChangePrice = (p - basePrice) / basePrice;
      const pctChangeDemand = -elasticity * pctChangePrice;
      const estimatedSales = Math.max(0, Math.round(100 * (1 + pctChangeDemand)));

      points.push({
        price: round2(p),
        estimatedSales,
        revenue: round2(p * estimatedSales)
      });
    }
    return points;
  }
};
// --- Components ---

const Header = ({ 
  isLanding, 
  onLaunch, 
  onHome,
  settings,
  onOpenSettings
}: { 
  isLanding: boolean, 
  onLaunch: () => void, 
  onHome: () => void,
  settings: AppSettings,
  onOpenSettings?: () => void
}) => (
  <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 h-16 flex items-center px-6 justify-between sticky top-0 z-50 no-print">
    <div 
      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onHome}
    >
      {settings.logoUrl ? (
        <img src={settings.logoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-contain bg-transparent" />
      ) : (
        <div className="bg-indigo-600 p-2 rounded-lg shadow-md shadow-indigo-200">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
      )}
      <span className="text-xl font-bold text-gray-900">{settings.companyName}</span>
    </div>
    
    <div className="flex items-center gap-4">
      {isLanding ? (
        <div className="flex items-center gap-4">
          <button onClick={() => document.getElementById('features')?.scrollIntoView({behavior: 'smooth'})} className="text-gray-600 hover:text-gray-900 font-medium text-sm hidden sm:block">
            Features
          </button>
          <button onClick={onLaunch} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm hover:shadow-md">
            Launch App
          </button>
        </div>
      ) : (
        <>
          <button 
            onClick={onOpenSettings}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
            title="Settings"
          >
            <Settings2 className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-medium border border-indigo-200">
            JD
          </div>
        </>
      )}
    </div>
  </header>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all mb-1
      ${active ? 'bg-indigo-50 text-indigo-700 font-medium shadow-sm ring-1 ring-indigo-200' : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'}`}
  >
    <Icon className="w-5 h-5" />
    <span>{label}</span>
  </button>
);

const MobileTab = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all
      ${active ? 'bg-indigo-50 text-indigo-700 font-medium ring-1 ring-indigo-200' : 'text-gray-600 hover:bg-gray-100'}`}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </button>
);

// --- Shared UI Components ---

const Modal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-fade-in">
    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const SettingsModal = ({ 
  settings, 
  onSave, 
  onClose 
}: { 
  settings: AppSettings, 
  onSave: (s: AppSettings) => void, 
  onClose: () => void 
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Modal title="Platform Settings" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Custom Logo</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden relative group">
              {formData.logoUrl ? (
                <img src={formData.logoUrl} alt="Preview" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm">
                <Upload className="w-4 h-4 mr-2" />
                Upload Image
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
              <p className="text-xs text-gray-500 mt-2">Recommended: Square PNG or JPG</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Platform Name</label>
          <input 
            type="text" 
            value={formData.companyName}
            onChange={e => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        <div className="pt-2">
          <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm">
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
};

// --- Charts (Custom SVG Implementation) ---

const LineChart = ({ data, width = 500, height = 200, color = "#4f46e5" }: { data: number[], width?: number, height?: number, color?: string }) => {
  if (!data || data.length === 0) return null;
  
  const max = Math.max(...data) * 1.1;
  const min = Math.min(...data) * 0.9;
  const range = max - min;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
      />
      {data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return (
          <circle key={i} cx={x} cy={y} r="4" fill="white" stroke={color} strokeWidth="2" />
        );
      })}
    </svg>
  );
};

const RevenueChart = ({ data, currency }: { data: ConversionPoint[], currency: string }) => {
  if (!data.length) return null;
  const width = 600;
  const height = 250;
  const padding = 40;
  
  const maxRev = Math.max(...data.map(d => d.revenue));
  
  return (
    <div className="relative border border-gray-100 rounded-lg p-4 bg-white">
      <h4 className="text-sm font-medium text-gray-500 mb-4 text-center">Projected Revenue vs. Price</h4>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Bars for Revenue */}
        {data.map((d, i) => {
           const barHeight = (d.revenue / maxRev) * (height - padding);
           const barWidth = (width / data.length) * 0.6;
           const x = i * (width / data.length) + padding;
           const y = height - barHeight;
           return (
             <g key={i} className="group hover:opacity-80 transition-opacity cursor-pointer">
               <rect x={x} y={y} width={barWidth} height={barHeight} fill="#818cf8" rx="4" />
               <text x={x + barWidth/2} y={height + 15} textAnchor="middle" fontSize="10" fill="#64748b">{currency}{d.price}</text>
               <text x={x + barWidth/2} y={y - 5} textAnchor="middle" fontSize="10" fill="#4f46e5" fontWeight="bold">{currency}{d.revenue}</text>
             </g>
           )
        })}
      </svg>
    </div>
  )
}

// --- Main Application Views ---

const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  INR: '₹',
  CAD: 'C$',
  AUD: 'A$',
  CNY: '¥'
};

const PricingInputForm = ({ onSubmit, isAnalyzing }: { onSubmit: (data: ProductInput) => void, isAnalyzing: boolean }) => {
  const [formData, setFormData] = useState<ProductInput>({
    name: "",
    cost: 0,
    currency: "USD",
    location: "",
    category: "",
    desiredMargin: 20
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in no-print">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Pricing Analysis</h2>
          <p className="text-gray-500 mt-1">Enter product details to generate data-driven pricing strategies.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                placeholder="e.g. Premium Leather Backpack"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Production Cost</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                </div>
                <input 
                  required
                  type="number" 
                  min="0"
                  step="0.01"
                  className="w-full pl-10 pr-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder:text-gray-400"
                  placeholder="0.00"
                  value={formData.cost || ''}
                  onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
              <select 
                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.currency}
                onChange={e => setFormData({...formData, currency: e.target.value})}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="INR">INR (₹)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="CNY">CNY (¥)</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Market Location</label>
              <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Globe className="h-4 w-4 text-gray-400" />
                </div>
                <input 
                  required
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-400"
                  placeholder="City, Region, or Country"
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category (Optional)</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-400"
                placeholder="e.g. Electronics"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min. Desired Margin (%)</label>
              <input 
                type="number" 
                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-400"
                value={formData.desiredMargin}
                onChange={e => setFormData({...formData, desiredMargin: parseFloat(e.target.value)})}
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={isAnalyzing}
              className={`w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white font-medium bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all
                ${isAnalyzing ? 'opacity-75 cursor-not-allowed' : ''}`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Analyzing Market Signals...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Generate Pricing Strategy
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DashboardResult = ({ result, input, onBack }: { result: PricingResult, input: ProductInput, onBack: () => void }) => {
  const conversionData = SimulatedBackend.calculateConversion(result.recommendedPrice, input.cost);
  
  // Download CSV Handler
  const handleDownloadCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Metric,Value\n"
        + `Product,${input.name}\n`
        + `Recommended Price,${result.recommendedPrice}\n`
        + `Strategy,${result.strategy}\n`
        + `Margin,${result.profitMargin.toFixed(2)}%\n`
        + `Confidence,${result.confidenceScore}/100`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "pricing_report.csv");
    document.body.appendChild(link);
    link.click();
  };

  // Print/PDF Handler
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in print-container">
      {/* Top Bar */}
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center text-gray-600 hover:text-indigo-600 transition-colors">
          <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
          Back to Analysis
        </button>
        <div className="flex gap-2">
           <button onClick={handlePrintPDF} className="flex items-center px-4 py-2 bg-white/50 border border-indigo-100 rounded-lg text-sm font-medium text-indigo-700 hover:bg-indigo-50 backdrop-blur-sm transition-all">
            <Printer className="w-4 h-4 mr-2" />
            Export PDF
          </button>
          <button onClick={handleDownloadCSV} className="flex items-center px-4 py-2 bg-white/50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white backdrop-blur-sm transition-all">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>
      
      {/* Print Header (Visible only in Print) */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900">PriceProphet Strategy Report</h1>
        <p className="text-gray-500">Generated for {input.name} in {input.location}</p>
        <p className="text-gray-400 text-sm mt-1">{new Date().toLocaleDateString()}</p>
      </div>

      {/* Hero Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-indigo-100 p-6 relative overflow-hidden print:border-gray-300">
          <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg print:bg-gray-800 print:text-white">
MODEL CONFIDENCE: {result.confidenceScore}%
          </div>
          
          <div className="mb-4">
            <h3 className="text-gray-500 font-medium text-sm uppercase tracking-wider mb-1">Recommended Selling Price</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-gray-900">{currencySymbols[input.currency] || input.currency} {result.recommendedPrice}</span>
              <span className="text-green-600 font-medium bg-green-50 px-2 py-1 rounded text-sm print:text-black print:bg-transparent print:border print:border-gray-300">
                {result.profitMargin.toFixed(1)}% Margin
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
             <div className="p-3 bg-gray-50 rounded-lg text-center border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Min Price (Floor)</div>
                <div className="font-semibold text-gray-700">{result.priceRange.min}</div>
             </div>
             <div className="p-3 bg-indigo-50 rounded-lg text-center border border-indigo-100 ring-1 ring-indigo-200 print:bg-gray-50 print:ring-gray-300">
                <div className="text-xs text-indigo-600 mb-1 print:text-black">Suggested</div>
                <div className="font-bold text-indigo-700 print:text-black">{result.priceRange.suggested}</div>
             </div>
             <div className="p-3 bg-gray-50 rounded-lg text-center border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Premium</div>
                <div className="font-semibold text-gray-700">{result.priceRange.premium}</div>
             </div>
          </div>

          <p className="text-gray-600 text-sm leading-relaxed border-l-4 border-indigo-300 pl-4 italic">
            "{result.explanation}"
          </p>
        </div>

        {/* Seasonality Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-center print:break-inside-avoid">
          <div className="flex items-center gap-2 mb-4">
             <LayoutDashboard className="w-5 h-5 text-orange-500 print:text-black" />
             <h3 className="font-bold text-gray-900">Seasonality</h3>
          </div>
          <div className="mb-2">
            <span className="text-lg font-semibold block">{result.seasonality.signal}</span>
            <span className={`text-sm font-medium ${result.seasonality.adjustmentFactor > 1 ? 'text-green-600 print:text-black' : 'text-gray-500'}`}>
               Adjustment: x{result.seasonality.adjustmentFactor}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {result.seasonality.explanation}
          </p>
        </div>
      </div>

      {/* Competitor & Conversion Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Competitor Intelligence */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 print:break-inside-avoid">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-red-500 print:text-black" />
            Competitor Intelligence
          </h3>
          <div className="space-y-4">
            {result.competitors.map((comp, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all print:border-gray-200">
                <div>
                  <div className="font-medium text-gray-900">{comp.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      comp.stockStatus === 'In Stock' ? 'bg-green-100 text-green-700' : 
                      comp.stockStatus === 'Low Stock' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    } print:border print:border-gray-300 print:bg-transparent print:text-black`}>
                      {comp.stockStatus}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{currencySymbols[input.currency] || input.currency}{comp.price}</div>
                  <div className="text-xs text-gray-400 mt-1 flex items-center justify-end gap-1">
                     History <LineChart data={comp.history} width={40} height={15} color="#9ca3af" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversion Prediction */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 print:break-inside-avoid">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-500 print:text-black" />
            Conversion Prediction
          </h3>
          <div className="mb-4">
            <RevenueChart data={conversionData} currency={currencySymbols[input.currency] || input.currency} />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-blue-50 p-3 rounded border border-blue-100 print:bg-transparent print:border-gray-300">
               <div className="text-xs text-blue-600 font-semibold uppercase print:text-black">Optimal Revenue</div>
               <div className="text-xl font-bold text-blue-800 print:text-black">
                  {currencySymbols[input.currency] || input.currency}{Math.max(...conversionData.map(d => d.revenue))}
               </div>
             </div>
             <div className="bg-gray-50 p-3 rounded border border-gray-100 print:bg-transparent print:border-gray-300">
               <div className="text-xs text-gray-500 font-semibold uppercase">Vol. at Rec. Price</div>
               <div className="text-xl font-bold text-gray-700">
                 ~{conversionData.find(d => Math.abs(d.price - result.recommendedPrice) < 1)?.estimatedSales || 'N/A'} units
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* Evidence & Rules */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 print:break-inside-avoid">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-500 print:text-black" />
          Market Evidence
        </h3>
        <ul className="space-y-2">
          {result.evidence.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0 print:text-black" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const ScenarioBuilder = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: '1', name: 'Supply Chain Crisis', shippingIncrease: 25, competitorDrop: 0, demandChange: 0 },
    { id: '2', name: 'Holiday Rush', shippingIncrease: 5, competitorDrop: 5, demandChange: 20 },
  ]);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  
  // Creating new scenario state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newScenario, setNewScenario] = useState({
    name: '',
    shippingIncrease: 0,
    competitorDrop: 0,
    demandChange: 0
  });

  const handleCreateScenario = (e: React.FormEvent) => {
    e.preventDefault();
    const scenario: Scenario = {
      id: Math.random().toString(36).substr(2, 9),
      ...newScenario
    };
    setScenarios([...scenarios, scenario]);
    setNewScenario({ name: '', shippingIncrease: 0, competitorDrop: 0, demandChange: 0 });
    setIsModalOpen(false);
  };

  // Mock calculation result
  const activeData = scenarios.find(s => s.id === activeScenario);

  return (
    <div className="space-y-6 animate-fade-in no-print">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-4">Scenario Modeler</h2>
        <p className="text-gray-500 mb-6">Simulate market conditions to see impact on margin.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-3">Select Scenario</h3>
            <div className="space-y-2">
              {scenarios.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveScenario(s.id === activeScenario ? null : s.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all
                    ${activeScenario === s.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="font-medium text-gray-900">{s.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Shipping: +{s.shippingIncrease}% | Demand: {s.demandChange > 0 ? '+' : ''}{s.demandChange}%
                  </div>
                </button>
              ))}
              <button 
                onClick={() => setIsModalOpen(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 text-sm font-medium flex items-center justify-center gap-2 transition-colors hover:bg-white/50"
              >
                + Create Custom Scenario
              </button>
            </div>
          </div>

          <div className="bg-gray-50/50 rounded-lg p-6 border border-gray-200 flex items-center justify-center">
             {activeData ? (
               <div className="w-full space-y-4">
                 <h4 className="font-bold text-gray-900 border-b pb-2">Impact Analysis: {activeData.name}</h4>
                 <div className="flex justify-between items-center">
                   <span className="text-sm text-gray-600">Net Margin Impact</span>
                   <span className={`font-bold ${activeData.shippingIncrease > 10 ? 'text-red-600' : 'text-green-600'}`}>
                     {activeData.shippingIncrease > 10 ? '-4.2%' : '+1.5%'}
                   </span>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-sm text-gray-600">Rec. Price Adjustment</span>
                   <span className="font-bold text-gray-900">
                     {activeData.demandChange > 0 ? '+$5.00' : '$0.00'}
                   </span>
                 </div>
                 <div className="mt-4 p-3 bg-white rounded border border-gray-200 text-sm text-gray-600">
                   Tip: Consider {activeData.shippingIncrease > 15 ? 'switching logistics partners' : 'increasing ad spend'} to mitigate impact.
                 </div>
               </div>
             ) : (
               <div className="text-gray-400 text-center">
                 <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                 Select a scenario to view impact
               </div>
             )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <Modal title="Create Custom Scenario" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleCreateScenario} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scenario Name</label>
              <input
                required
                type="text"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                value={newScenario.name}
                onChange={e => setNewScenario({...newScenario, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Cost Increase (%)</label>
              <input
                type="number"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                value={newScenario.shippingIncrease}
                onChange={e => setNewScenario({...newScenario, shippingIncrease: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Competitor Price Drop (%)</label>
              <input
                type="number"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                value={newScenario.competitorDrop}
                onChange={e => setNewScenario({...newScenario, competitorDrop: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Demand Change (%)</label>
              <input
                type="number"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                value={newScenario.demandChange}
                onChange={e => setNewScenario({...newScenario, demandChange: Number(e.target.value)})}
              />
            </div>
            <div className="pt-2">
              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700">
                Save Scenario
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

const RuleEngine = () => {
  const [rules, setRules] = useState<AutomationRule[]>([
    { id: '1', conditionField: 'margin', operator: '<', value: 15, action: 'Alert User', active: true },
    { id: '2', conditionField: 'competitor_stock', operator: '=', value: 'Out of Stock', action: 'Increase Price 5%', active: true },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRule, setNewRule] = useState<Partial<AutomationRule>>({
    conditionField: 'margin',
    operator: '<',
    value: '',
    action: '',
    active: true
  });

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.conditionField || !newRule.operator || !newRule.value || !newRule.action) return;
    
    const rule: AutomationRule = {
      id: Math.random().toString(36).substr(2, 9),
      conditionField: newRule.conditionField,
      operator: newRule.operator,
      value: newRule.value,
      action: newRule.action,
      active: true
    };
    setRules([...rules, rule]);
    setNewRule({ conditionField: 'margin', operator: '<', value: '', action: '', active: true });
    setIsModalOpen(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fade-in no-print">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Automation Rules</h2>
          <p className="text-sm text-gray-500">Define automatic actions based on market triggers.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm"
        >
          + New Rule
        </button>
      </div>

      <div className="space-y-4">
        {rules.map(rule => (
          <div key={rule.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50/50">
            <div className="flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full ${rule.active ? 'bg-green-500' : 'bg-gray-400'}`} />
              <div>
                <div className="font-medium text-gray-900">
                  If <span className="bg-white px-2 py-0.5 rounded border text-xs font-mono">{rule.conditionField}</span> is {rule.operator} {rule.value}
                </div>
                <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                  Then: <span className="font-semibold text-indigo-600">{rule.action}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => toggleRule(rule.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
              ${rule.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
            >
              {rule.active ? 'Active' : 'Paused'}
            </button>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <Modal title="Create Automation Rule" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleCreateRule} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition Field</label>
                <select
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  value={newRule.conditionField}
                  onChange={e => setNewRule({...newRule, conditionField: e.target.value as any})}
                >
                  <option value="margin">Margin (%)</option>
                  <option value="competitor_stock">Competitor Stock</option>
                  <option value="demand">Demand Index</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
                <select
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  value={newRule.operator}
                  onChange={e => setNewRule({...newRule, operator: e.target.value as any})}
                >
                  <option value="<">Less than (&lt;)</option>
                  <option value=">">Greater than (&gt;)</option>
                  <option value="=">Equals (=)</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Threshold Value</label>
              <input
                required
                type="text"
                placeholder="e.g. 15 or 'Out of Stock'"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                value={newRule.value}
                onChange={e => setNewRule({...newRule, value: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action to Trigger</label>
              <input
                required
                type="text"
                placeholder="e.g. Alert User, Raise Price 5%"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                value={newRule.action}
                onChange={e => setNewRule({...newRule, action: e.target.value})}
              />
            </div>

            <div className="pt-2">
              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700">
                Create Rule
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

// --- Home Page Component ---

const HomePage = ({ onLaunch }: { onLaunch: () => void }) => {
  
  const scrollToFeatures = () => {
    const element = document.getElementById('features');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
        </div>
        
        <div className="mx-auto max-w-3xl py-32 sm:py-48 lg:py-56 text-center animate-fade-in">
          <div className="hidden sm:mb-8 sm:flex sm:justify-center">
            <div className="relative rounded-full px-3 py-1 text-sm leading-6 text-gray-600 ring-1 ring-gray-900/10 hover:ring-gray-900/20 bg-white/50 backdrop-blur-sm">
              Now supported in 100+ countries and currencies.
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Pricing Intelligence that <span className="text-indigo-600">Prints Profit</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Stop guessing your prices. PriceProphet uses advanced AI, competitor tracking, and demand elasticity modeling to find your perfect price point instantly.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <button
              onClick={onLaunch}
              className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all hover:scale-105"
            >
              Launch Platform
            </button>
            <button onClick={scrollToFeatures} className="text-sm font-semibold leading-6 text-gray-900 flex items-center cursor-pointer hover:text-indigo-600 transition-colors">
              View Features <span aria-hidden="true" className="ml-2">→</span>
            </button>
          </div>
        </div>
        
        <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]" aria-hidden="true">
          <div className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"></div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-24 sm:py-32 bg-gray-50/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-indigo-600">Smarter Revenue</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to dominate your market
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Our platform combines three powerful engines into one seamless dashboard.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <div className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {[
                {
                  name: 'AI Pricing Engine',
                  description: 'Real-time analysis of costs, competitors, and seasonality to recommend the perfect price.',
                  icon: BrainCircuit,
                },
                {
                  name: 'Competitor Tracking',
                  description: 'Automatically track competitor prices and stock levels to stay one step ahead.',
                  icon: Target,
                },
                {
                  name: 'Scenario Modeling',
                  description: 'Simulate supply chain shocks or demand spikes to see how they affect your bottom line.',
                  icon: LineChartIcon,
                },
              ].map((feature) => (
                <div key={feature.name} className="flex flex-col bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                    <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col flex-1">
                    <h3 className="text-lg font-semibold leading-8 text-gray-900">{feature.name}</h3>
                    <p className="mt-1 text-base leading-7 text-gray-600 flex-1">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-white py-12 border-t border-gray-200 text-center text-gray-500 text-sm">
        <p>&copy; 2024 PriceProphet Inc. All rights reserved.</p>
      </footer>
    </div>
  );
};

// --- Main App Container ---

const App = () => {
  const [viewMode, setViewMode] = useState<'landing' | 'app'>('landing');
  const [currentView, setCurrentView] = useState<'pricing' | 'scenarios' | 'rules'>('pricing');
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);
  const [lastInput, setLastInput] = useState<ProductInput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>({
    logoUrl: null,
    companyName: "PriceProphet"
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleAnalyze = async (data: ProductInput) => {
    setIsAnalyzing(true);
    setLastInput(data);
    // Simulate network delay for backend feel
    await new Promise(resolve => setTimeout(resolve, 800)); 
    const result = await SimulatedBackend.analyzePrice(data);
    setPricingResult(result);
    setIsAnalyzing(false);
  };

  if (viewMode === 'landing') {
    return (
      <div className="min-h-screen bg-white font-sans text-gray-900">
        <Header 
          isLanding={true} 
          onLaunch={() => setViewMode('app')} 
          onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          settings={settings}
        />
        <HomePage onLaunch={() => setViewMode('app')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-gray-900 animate-fade-in relative isolate overflow-hidden">
      {/* Background Blobs (from Landing Page but fixed for app feel) */}
      <div className="fixed inset-0 -z-10 transform-gpu overflow-hidden blur-3xl pointer-events-none" aria-hidden="true">
         <div className="absolute left-[calc(50%-11rem)] top-0 aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
         <div className="absolute right-[calc(50%-11rem)] top-[20rem] aspect-[1155/678] w-[36.125rem] translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-20 sm:right-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
      </div>

      <Header 
        isLanding={false} 
        onLaunch={() => {}} 
        onHome={() => setViewMode('landing')}
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      {/* Mobile Navigation (the sidebar is hidden below the md breakpoint) */}
      <nav className="md:hidden sticky top-16 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto no-print">
        <MobileTab
          icon={Calculator}
          label="Pricing"
          active={currentView === 'pricing'}
          onClick={() => setCurrentView('pricing')}
        />
        <MobileTab
          icon={BarChart3}
          label="Scenarios"
          active={currentView === 'scenarios'}
          onClick={() => setCurrentView('scenarios')}
        />
        <MobileTab
          icon={Zap}
          label="Rules"
          active={currentView === 'rules'}
          onClick={() => setCurrentView('rules')}
        />
      </nav>

      <div className="flex flex-1 max-w-7xl w-full mx-auto px-6 py-8 gap-8 z-10">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 hidden md:block no-print">
          <div className="sticky top-28 space-y-1 bg-white/50 backdrop-blur-xl p-4 rounded-2xl border border-white/60 shadow-sm">
            <SidebarItem 
              icon={Calculator} 
              label="Pricing Engine" 
              active={currentView === 'pricing'} 
              onClick={() => setCurrentView('pricing')} 
            />
            <SidebarItem 
              icon={BarChart3} 
              label="Scenario Builder" 
              active={currentView === 'scenarios'} 
              onClick={() => setCurrentView('scenarios')} 
            />
            <SidebarItem 
              icon={Zap} 
              label="Automated Rules" 
              active={currentView === 'rules'} 
              onClick={() => setCurrentView('rules')} 
            />
            <div className="pt-6 border-t border-gray-200/60 mt-6">
              <div className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Saved Reports
              </div>
              <div className="px-4 text-sm text-gray-500 hover:text-gray-700 cursor-pointer py-1 truncate">
                Q3 Electronics Strategy
              </div>
              <div className="px-4 text-sm text-gray-500 hover:text-gray-700 cursor-pointer py-1 truncate">
                Competitor Alert: Sony
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {currentView === 'pricing' && (
             !pricingResult ? (
               <PricingInputForm onSubmit={handleAnalyze} isAnalyzing={isAnalyzing} />
             ) : (
               lastInput && <DashboardResult result={pricingResult} input={lastInput} onBack={() => setPricingResult(null)} />
             )
          )}
          
          {currentView === 'scenarios' && <ScenarioBuilder />}
          
          {currentView === 'rules' && <RuleEngine />}
        </main>
      </div>

      {isSettingsOpen && (
        <SettingsModal 
          settings={settings} 
          onSave={setSettings} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);