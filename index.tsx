import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
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
  Package, 
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Download,
  RefreshCw,
  Target,
  BrainCircuit,
  LineChart as LineChartIcon,
  Printer,
  X
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

// --- AI Service Layer ---

const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schema for the AI Pricing Response
const pricingSchema = {
  type: Type.OBJECT,
  properties: {
    recommendedPrice: { type: Type.NUMBER, description: "The specific recommended price point." },
    minPrice: { type: Type.NUMBER, description: "Minimum viable price (floor)." },
    premiumPrice: { type: Type.NUMBER, description: "Premium price point for high demand." },
    strategy: { type: Type.STRING, description: "One of: Cost-Plus, Competitor-Based, Value-Based" },
    explanation: { type: Type.STRING, description: "2-4 sentences explaining the pricing logic." },
    evidence: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }, 
      description: "3-5 bullet points of market evidence." 
    },
    confidenceScore: { type: Type.INTEGER, description: "0-100 confidence score." },
    seasonalitySignal: { type: Type.STRING, description: "Short phrase, e.g., 'High Summer Demand'" },
    seasonalityFactor: { type: Type.NUMBER, description: "Multiplier, e.g., 1.10 for 10% increase." },
    seasonalityExplanation: { type: Type.STRING, description: "Reasoning for seasonality." },
    competitors: {
      type: Type.ARRAY,
      description: "3 hypothetical or estimated competitors.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          price: { type: Type.NUMBER },
          trend: { type: Type.STRING, description: "up, down, or stable" }
        }
      }
    }
  },
  required: ["recommendedPrice", "minPrice", "premiumPrice", "explanation", "evidence", "competitors"]
};

// --- Backend Simulation (Service) ---

const SimulatedBackend = {
  async analyzePrice(input: ProductInput): Promise<PricingResult> {
    // In a real app, this would hit POST /api/suggest-price
    
    const prompt = `
      Act as a Senior Pricing Analyst. Analyze this product for optimal pricing:
      Product: ${input.name}
      Category: ${input.category || "General"}
      Production Cost: ${input.cost} ${input.currency}
      Location: ${input.location}
      Desired Margin: ${input.desiredMargin}%

      Tasks:
      1. Determine the best pricing strategy (Cost-Plus, Competitor, or Value).
      2. Suggest a price respecting a profit floor (Cost + 10%).
      3. Estimate 3 likely competitors and their prices in this location.
      4. Analyze seasonality (assume current month is ${new Date().toLocaleString('default', { month: 'long' })}).
      5. Provide a confidence score.
      
      Output JSON matching the schema.
    `;

    try {
      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: pricingSchema,
          temperature: 0.3 // Low temp for consistent, analytical results
        }
      });

      const data = JSON.parse(response.text || "{}");
      
      // Post-process AI data to fit our internal types and generate history
      const competitors: Competitor[] = (data.competitors || []).map((c: any) => ({
        name: c.name,
        price: c.price,
        stockStatus: Math.random() > 0.8 ? 'Low Stock' : (Math.random() > 0.9 ? 'Out of Stock' : 'In Stock'),
        trend: c.trend || 'stable',
        history: Array.from({ length: 6 }, (_, i) => {
          // Generate slightly random history around the current price
          const variation = (Math.random() - 0.5) * (c.price * 0.1);
          return Number((c.price + variation).toFixed(2));
        }).reverse()
      }));

      return {
        recommendedPrice: data.recommendedPrice,
        priceRange: {
          min: data.minPrice,
          suggested: data.recommendedPrice,
          premium: data.premiumPrice
        },
        profitMargin: ((data.recommendedPrice - input.cost) / data.recommendedPrice) * 100,
        confidenceScore: data.confidenceScore,
        explanation: data.explanation,
        evidence: data.evidence,
        strategy: data.strategy as any,
        seasonality: {
          signal: data.seasonalitySignal,
          adjustmentFactor: data.seasonalityFactor || 1.0,
          explanation: data.seasonalityExplanation
        },
        competitors: competitors
      };

    } catch (error) {
      console.error("AI Error:", error);
      // Fallback for demo if AI fails or API key missing
      const basePrice = input.cost * (1 + (input.desiredMargin / 100));
      return {
        recommendedPrice: Math.round(basePrice * 100) / 100,
        priceRange: { min: basePrice, suggested: basePrice, premium: basePrice * 1.2 },
        profitMargin: input.desiredMargin,
        confidenceScore: 50,
        explanation: "Fallback pricing calculation due to service interruption.",
        evidence: ["Cost basis calculation"],
        strategy: "Cost-Plus",
        seasonality: { signal: "Neutral", adjustmentFactor: 1, explanation: "No data" },
        competitors: []
      };
    }
  },

  calculateConversion(currentPrice: number, cost: number): ConversionPoint[] {
    // Simple elasticity model: Q = Q_max * (1 - P / P_max_willingness)
    const points: ConversionPoint[] = [];
    const range = 5; // +/- 5 steps
    const step = currentPrice * 0.05;
    
    for (let i = -range; i <= range; i++) {
      const p = currentPrice + (i * step);
      if (p <= cost) continue; // Ignore prices below cost
      
      // Hypothetical demand curve logic
      // Assume at currentPrice, demand is 100 (baseline index)
      // Elasticity typically negative. Let's assume -1.5 for standard consumer goods
      const elasticity = 1.5;
      const pctChangePrice = (p - currentPrice) / currentPrice;
      const pctChangeDemand = -elasticity * pctChangePrice;
      const estimatedSales = Math.max(0, Math.round(100 * (1 + pctChangeDemand)));
      
      points.push({
        price: Number(p.toFixed(2)),
        estimatedSales,
        revenue: Number((p * estimatedSales).toFixed(2))
      });
    }
    return points;
  }
};

// --- Components ---

const Header = ({ isLanding, onLaunch, onHome }: { isLanding: boolean, onLaunch: () => void, onHome: () => void }) => (
  <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6 justify-between sticky top-0 z-50 no-print">
    <div 
      className="flex items-center gap-2 cursor-pointer"
      onClick={onHome}
    >
      <div className="bg-indigo-600 p-2 rounded-lg">
        <TrendingUp className="w-5 h-5 text-white" />
      </div>
      <span className="text-xl font-bold text-gray-800">PriceProphet</span>
    </div>
    
    <div className="flex items-center gap-4">
      {isLanding ? (
        <div className="flex items-center gap-4">
          <button onClick={() => document.getElementById('features')?.scrollIntoView({behavior: 'smooth'})} className="text-gray-600 hover:text-gray-900 font-medium text-sm hidden sm:block">
            Features
          </button>
          <button onClick={onLaunch} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Launch App
          </button>
        </div>
      ) : (
        <>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <Settings2 className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-medium">
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
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1
      ${active ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
  >
    <Icon className="w-5 h-5" />
    <span>{label}</span>
  </button>
);

// --- Shared UI Components ---

const Modal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-fade-in">
    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
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

const RevenueChart = ({ data }: { data: ConversionPoint[] }) => {
  if (!data.length) return null;
  const width = 600;
  const height = 250;
  const padding = 40;
  
  const maxRev = Math.max(...data.map(d => d.revenue));
  const maxSales = Math.max(...data.map(d => d.estimatedSales));
  
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
               <text x={x + barWidth/2} y={height + 15} textAnchor="middle" fontSize="10" fill="#64748b">${d.price}</text>
               <text x={x + barWidth/2} y={y - 5} textAnchor="middle" fontSize="10" fill="#4f46e5" fontWeight="bold">${d.revenue}</text>
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
          <p className="text-gray-500 mt-1">Enter product details to generate AI-driven pricing strategies.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="0.00"
                  value={formData.cost || ''}
                  onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
              <select 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. Electronics"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min. Desired Margin (%)</label>
              <input 
                type="number" 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
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
           <button onClick={handlePrintPDF} className="flex items-center px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm font-medium text-indigo-700 hover:bg-indigo-100">
            <Printer className="w-4 h-4 mr-2" />
            Export PDF
          </button>
          <button onClick={handleDownloadCSV} className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
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
            AI CONFIDENCE: {result.confidenceScore}%
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
            <RevenueChart data={conversionData} />
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
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                + Create Custom Scenario
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 flex items-center justify-center">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                value={newScenario.name}
                onChange={e => setNewScenario({...newScenario, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Cost Increase (%)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                value={newScenario.shippingIncrease}
                onChange={e => setNewScenario({...newScenario, shippingIncrease: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Competitor Price Drop (%)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                value={newScenario.competitorDrop}
                onChange={e => setNewScenario({...newScenario, competitorDrop: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Demand Change (%)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
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
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          + New Rule
        </button>
      </div>

      <div className="space-y-4">
        {rules.map(rule => (
          <div key={rule.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
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
            <div className="relative rounded-full px-3 py-1 text-sm leading-6 text-gray-600 ring-1 ring-gray-900/10 hover:ring-gray-900/20">
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
      <div id="features" className="py-24 sm:py-32 bg-gray-50">
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
                <div key={feature.name} className="flex flex-col">
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
        />
        <HomePage onLaunch={() => setViewMode('app')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 animate-fade-in">
      <Header 
        isLanding={false} 
        onLaunch={() => {}} 
        onHome={() => setViewMode('landing')}
      />
      
      <div className="flex flex-1 max-w-7xl w-full mx-auto px-6 py-8 gap-8">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 hidden md:block no-print">
          <div className="sticky top-28 space-y-1">
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
            <div className="pt-6 border-t border-gray-200 mt-6">
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
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);