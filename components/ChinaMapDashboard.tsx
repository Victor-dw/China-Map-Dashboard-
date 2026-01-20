import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import { MapData, GeoJSON, GeoJSONFeature } from '../types';

// --- Constants ---
const MAP_BASE_URL = 'https://geo.datav.aliyun.com/areas_v3/bound';

// Complete Adcode Mapping for Drill Down
const PROVINCE_ADCODES: Record<string, number> = {
  '北京市': 110000, '天津市': 120000, '河北省': 130000, '山西省': 140000, '内蒙古自治区': 150000,
  '辽宁省': 210000, '吉林省': 220000, '黑龙江省': 230000, '上海市': 310000, '江苏省': 320000,
  '浙江省': 330000, '安徽省': 340000, '福建省': 350000, '江西省': 360000, '山东省': 370000,
  '河南省': 410000, '湖北省': 420000, '湖南省': 430000, '广东省': 440000, '广西壮族自治区': 450000,
  '海南省': 460000, '重庆市': 500000, '四川省': 510000, '贵州省': 520000, '云南省': 530000,
  '西藏自治区': 540000, '陕西省': 610000, '甘肃省': 620000, '青海省': 630000, '宁夏回族自治区': 640000,
  '新疆维吾尔自治区': 650000, '台湾省': 710000, '香港特别行政区': 810000, '澳门特别行政区': 820000
};

// Initial default provinces (for fallback or initial calc)
const INITIAL_PROVINCES = Object.keys(PROVINCE_ADCODES);

// --- Helper Functions ---
const getLast7Days = (): string[] => {
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

// Generate random data for a given list of region names
const generateData = (regionNames: string[]): MapData[] => {
  return regionNames.map((name) => ({
    name,
    value: Math.floor(Math.random() * 9000) + 1000, // 1000 ~ 10000
    growth: parseFloat(((Math.random() * 0.4) - 0.2).toFixed(2)) // -0.20 ~ +0.20
  }));
};

const ChinaMapDashboard: React.FC = () => {
  // --- State ---
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Date State
  const [dates] = useState<string[]>(getLast7Days());
  const [selectedDate, setSelectedDate] = useState<string>(getLast7Days()[6]);
  
  // Map Logic State
  const [currentMapName, setCurrentMapName] = useState<string>('china'); // 'china' or province name
  const [currentAdcode, setCurrentAdcode] = useState<number>(100000); // 100000 is China
  const [currentRegionNames, setCurrentRegionNames] = useState<string[]>(INITIAL_PROVINCES);
  
  // --- Refs ---
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  // Cache fetched maps to avoid repeated network requests
  const mapCache = useRef<Map<string, GeoJSON>>(new Map());

  // --- Core Logic: Load Map Data ---
  const loadMap = useCallback(async (adcode: number, mapName: string) => {
    setIsLoading(true);
    setError(null);

    try {
      let geoJson = mapCache.current.get(mapName);

      if (!geoJson) {
        // Fetch if not in cache
        const response = await fetch(`${MAP_BASE_URL}/${adcode}_full.json`);
        if (!response.ok) throw new Error(`Failed to load map data for ${mapName}`);
        geoJson = await response.json() as GeoJSON;
        mapCache.current.set(mapName, geoJson);
      }

      // Register map with ECharts
      echarts.registerMap(mapName, geoJson as any);

      // Extract sub-region names (Cities/Districts) from features for data generation
      const subRegions = geoJson.features.map(f => f.properties.name).filter(Boolean);
      
      // Update State
      setCurrentRegionNames(subRegions);
      setCurrentMapName(mapName);
      setCurrentAdcode(adcode);
      setIsLoading(false);

    } catch (err) {
      console.error(err);
      setError(`Unable to load map for ${mapName}. Please check network or adcode.`);
      setIsLoading(false);
    }
  }, []);

  // --- Effect: Initial Load ---
  useEffect(() => {
    // Initial load is China (100000)
    loadMap(100000, 'china');
  }, [loadMap]);

  // --- Effect: Initialize Chart ---
  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark', {
        renderer: 'canvas',
      });

      // Handle Click for Drill Down
      chartInstance.current.on('click', (params) => {
        if (params.componentType === 'series' && params.name) {
          const provinceName = params.name;
          const adcode = PROVINCE_ADCODES[provinceName];

          if (adcode) {
            console.log(`Entering Province: ${provinceName} (Adcode: ${adcode})`);
            loadMap(adcode, provinceName);
          } else {
            console.log('No adcode found or reached leaf node.');
          }
        }
      });

      // Handle Resize
      const handleResize = () => chartInstance.current?.resize();
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chartInstance.current?.dispose();
      };
    }
  }, [loadMap]);

  // --- Effect: Update Chart Options (Render) ---
  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart || isLoading) return;

    // Generate data matching current visible regions
    const data = generateData(currentRegionNames);

    const option: echarts.EChartsOption = {
      backgroundColor: '#02102b',
      title: {
        text: currentMapName === 'china' ? '全国实盘订单量监控' : `${currentMapName}实盘数据详情`,
        subtext: `Data Date: ${selectedDate}`,
        left: 'center',
        top: 20,
        textStyle: {
          color: '#00eaff',
          fontSize: 24,
          fontWeight: 'bold',
          textShadowColor: '#00eaff',
          textShadowBlur: 10
        },
        subtextStyle: {
          color: '#aaa'
        }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderColor: '#00eaff',
        borderWidth: 1,
        textStyle: {
          color: '#fff'
        },
        formatter: (params: any) => {
          // Robust check: Ensure params.data exists and has a valid value
          if (!params.data || typeof params.data.value !== 'number') return params.name;
          
          const { name, value, growth } = params.data;
          const growthColor = growth >= 0 ? '#ef4444' : '#10b981';
          const arrow = growth >= 0 ? '▲' : '▼';
          
          return `
            <div style="font-weight:bold; font-size: 16px; margin-bottom: 5px;">${name}</div>
            <div style="display:flex; justify-content:space-between; min-width: 150px;">
              <span>订单量:</span>
              <span style="color:#00eaff; font-weight:bold;">${value.toLocaleString()}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top: 5px;">
              <span>环比增长:</span>
              <span style="color:${growthColor}">${arrow} ${(Math.abs(growth) * 100).toFixed(1)}%</span>
            </div>
          `;
        }
      },
      visualMap: {
        min: 1000,
        max: 10000,
        text: ['High', 'Low'],
        realtime: false,
        calculable: true,
        inRange: {
          color: ['#0f375f', '#166088', '#2a8cba', '#3eaecd', '#5fd2e7']
        },
        textStyle: {
          color: '#fff'
        },
        left: 20,
        bottom: 100
      },
      geo: {
        map: currentMapName,
        roam: true, // Enable Zoom/Pan
        layoutCenter: ['50%', '50%'], // FORCE CENTER: Critical fix for drill-down positioning
        layoutSize: '100%',           // Maximize size within the container
        // Note: We removed 'zoom' and 'center' to rely on layoutCenter.
        label: {
          show: true,
          color: '#ccc',
          fontSize: 10
        },
        itemStyle: {
          areaColor: '#091632',
          borderColor: '#1773c3',
          borderWidth: 1.5,
          shadowColor: 'rgba(0, 234, 255, 0.5)',
          shadowBlur: 10
        },
        emphasis: {
          label: {
            color: '#fff',
            show: true
          },
          itemStyle: {
            areaColor: '#1773c3',
            borderColor: '#00eaff',
            borderWidth: 2
          }
        }
      },
      series: [
        {
          name: 'Order Volume',
          type: 'map',
          geoIndex: 0,
          data: data
        }
      ]
    };

    // Use setOption with notMerge=true to ensure a clean state (resets previous zoom/center)
    chart.setOption(option, true);

  }, [currentMapName, currentRegionNames, selectedDate, isLoading]);

  // --- Handlers ---
  const handleBackToNational = () => {
    loadMap(100000, 'china');
  };

  // --- Render ---
  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Header Decorative Lines */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50 z-10"></div>
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-[#02102b]/80 flex flex-col items-center justify-center text-cyan-400 backdrop-blur-sm">
          <svg className="w-12 h-12 mb-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div className="text-xl font-bold tracking-widest">LOADING DATA...</div>
        </div>
      )}

      {/* Error Message */}
      {error && !isLoading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center text-red-500 bg-[#02102b]">
          <div className="text-2xl font-bold bg-red-900/20 p-8 rounded border border-red-500/50 flex flex-col items-center gap-4">
            <span>⚠️ {error}</span>
            <button onClick={handleBackToNational} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500">
              Return to National View
            </button>
          </div>
        </div>
      )}
      
      {/* Chart Container */}
      <div ref={chartRef} className="flex-grow w-full h-full" />

      {/* Drill Down Back Button */}
      {currentMapName !== 'china' && !isLoading && (
        <button
          onClick={handleBackToNational}
          className="absolute top-24 right-10 z-30 px-6 py-2 bg-blue-900/80 border border-cyan-400 text-cyan-400 rounded hover:bg-cyan-500 hover:text-white transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.5)] font-bold tracking-wider"
        >
          ← 返回全国
        </button>
      )}

      {/* Custom Timeline (Bottom) */}
      <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 w-[90%] md:w-[600px] h-16 bg-[#091632]/80 border border-[#1773c3] rounded-full flex items-center justify-around px-4 z-20 backdrop-blur-sm shadow-2xl">
        {dates.map((date) => {
          const isActive = selectedDate === date;
          return (
            <div
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`
                relative cursor-pointer group flex flex-col items-center transition-all duration-300
                ${isActive ? 'scale-110' : 'opacity-60 hover:opacity-100'}
              `}
            >
              {/* Dot */}
              <div
                className={`w-3 h-3 rounded-full mb-2 transition-colors duration-300
                ${isActive ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-gray-500 group-hover:bg-gray-300'}
              `}
              />
              {/* Date Text */}
              <span
                className={`text-xs font-mono transition-colors duration-300
                ${isActive ? 'text-cyan-400 font-bold' : 'text-gray-400'}
              `}
              >
                {date.slice(5)} {/* Show MM-DD */}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChinaMapDashboard;