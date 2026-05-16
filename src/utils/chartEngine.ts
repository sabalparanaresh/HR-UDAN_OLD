export interface ChartDataset {
  dimensions: string[];
  source: any[];
}

export interface EChartsOption {
  dataset?: ChartDataset | ChartDataset[];
  series: any[];
  xAxis?: any;
  yAxis?: any;
  tooltip?: any;
  legend?: any;
  grid?: any;
  visualMap?: any;
  [key: string]: any;
}

export interface TransformOptions {
  type: 'line' | 'bar' | 'pie' | 'stacked-bar' | 'heatmap' | 'drill-down';
  groupBy?: string; // e.g. 'department'
  categoryField?: string; // e.g. 'month' for time series
  valueFields: string[]; // e.g. ['gross_salary', 'net_payable']
  dynamicHeads?: string[]; // to pivot dynamic salary heads
}

/**
 * Transforms generic datasets into ECharts Options.
 */
export const transformChartData = (
  rawData: any[],
  options: TransformOptions
): EChartsOption => {
  const { type, groupBy, categoryField, valueFields, dynamicHeads } = options;

  if (!rawData || rawData.length === 0) {
    return { series: [] };
  }

  // Base options
  const baseTooltip = {
    trigger: type === 'pie' || type === 'heatmap' ? 'item' : 'axis',
    padding: 12,
    className: 'font-mono text-xs shadow-xl',
    borderRadius: 8,
  };
  
  const baseGrid = { left: '3%', right: '4%', bottom: '3%', containLabel: true };

  switch (type) {
    case 'line':
    case 'bar':
    case 'stacked-bar': {
      if (!categoryField) throw new Error("categoryField is required for line/bar charts");

      // Extract unique categories (X axis)
      const categories = Array.from(new Set(rawData.map(d => d[categoryField])));

      // Extract series names (either value fields or dynamic/grouping)
      let seriesNames: string[] = [];
      let datasetSource: any[] = [];
      const dimensions: string[] = [categoryField];

      if (groupBy) {
        // Grouped/Pivoted data: e.g. X = month, series = departments
        const groups = Array.from(new Set(rawData.map(d => d[groupBy])));
        dimensions.push(...groups.map(String));
        seriesNames = groups.map(String);

        datasetSource = categories.map(cat => {
          const row: any = { [categoryField]: cat };
          groups.forEach(group => {
            const match = rawData.find(d => d[categoryField] === cat && d[groupBy] === group);
            // Default to 0 for missing data points
            row[String(group)] = match ? Number(match[valueFields[0]] || 0) : 0;
          });
          return row;
        });
      } else if (dynamicHeads && dynamicHeads.length > 0) {
        // Pivot dynamic heads
        dimensions.push(...dynamicHeads);
        seriesNames = dynamicHeads;
        
        datasetSource = categories.map(cat => {
           const row: any = { [categoryField]: cat };
           dynamicHeads.forEach(head => {
             const match = rawData.find(d => d[categoryField] === cat); // assuming pre-aggregated or need aggregation
             // Assuming match contains dynamic properties like { "Basic": 1000, "HRA": 500 }
             row[head] = match ? Number(match[head] || 0) : 0;
           });
           return row;
        });
      } else {
        // Simple multiple value fields
        dimensions.push(...valueFields);
        seriesNames = valueFields;
        datasetSource = categories.map(cat => {
          const row: any = { [categoryField]: cat };
          // For each category, we might need to sum up or just take the first match
          // If we assume pre-aggregated:
          const match = rawData.find(d => d[categoryField] === cat);
          valueFields.forEach(field => {
             row[field] = match ? Number(match[field] || 0) : 0;
          });
          return row;
        });
      }

      const series = seriesNames.map(name => ({
         name,
         type: type === 'stacked-bar' ? 'bar' : type,
         stack: type === 'stacked-bar' ? 'total' : undefined,
         smooth: type === 'line' ? true : undefined,
         areaStyle: type === 'line' ? { opacity: 0.1 } : undefined,
      }));

      return {
        tooltip: baseTooltip,
        legend: { bottom: 0, textStyle: { fontSize: 10, fontFamily: 'monospace' } },
        grid: { ...baseGrid, bottom: '10%' },
        dataset: {
          dimensions,
          source: datasetSource,
        },
        xAxis: { type: 'category' },
        yAxis: { type: 'value' },
        series,
      };
    }

    case 'pie': {
       if (!categoryField) throw new Error("categoryField is required for pie charts");
       // For pie, we map categoryField to name, valueField[0] to value
       const valueField = valueFields[0];
       
       const seriesData = rawData.map(d => ({
          name: typeof d[categoryField] === 'string' ? d[categoryField] : String(d[categoryField]),
          value: Number(d[valueField] || 0)
       }));

       return {
         tooltip: baseTooltip,
         legend: { bottom: 0, type: 'scroll', icon: 'circle', textStyle: { fontSize: 10, fontFamily: 'monospace' } },
         series: [{
           type: 'pie',
           radius: ['40%', '70%'],
           itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
           label: { show: false },
           data: seriesData,
           emphasis: {
             itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
           }
         }]
       };
    }

    case 'heatmap': {
       // Expects rawData to have x (e.g. hour), y (e.g. day), and value (e.g. count)
       if (!categoryField || !groupBy) throw new Error("categoryField (x) and groupBy (y) are required for heatmap");
       const valueField = valueFields[0];

       const xCategories = Array.from(new Set(rawData.map(d => d[categoryField])));
       const yCategories = Array.from(new Set(rawData.map(d => d[groupBy])));

       const data = rawData.map(d => {
          const xIndex = xCategories.indexOf(d[categoryField]);
          const yIndex = yCategories.indexOf(d[groupBy]);
          return [xIndex, yIndex, Number(d[valueField] || 0)];
       });

       const maxVal = Math.max(...data.map(d => d[2]));

       return {
         tooltip: { position: 'top', className: 'font-mono text-xs shadow-xl', borderRadius: 8 },
         grid: baseGrid,
         xAxis: { type: 'category', data: xCategories, splitArea: { show: true } },
         yAxis: { type: 'category', data: yCategories, splitArea: { show: true } },
         visualMap: { min: 0, max: maxVal, calculable: true, orient: 'horizontal', left: 'center', bottom: '0%' },
         series: [{
           name: 'Heatmap',
           type: 'heatmap',
           data,
           label: { show: true, fontSize: 10 },
           emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
         }]
       };
    }

    case 'drill-down': {
       // Placeholder for more complex drill-down configurations
       // Let's fallback to standard pie or bar but inject an event hook
       const base = transformChartData(rawData, { ...options, type: 'bar' });
       return {
          ...base,
          // Could add drilldown specific visual cues
       };
    }

    default:
      return { series: [] };
  }
};
