export type ExportFormat = 'PDF' | 'EXCEL' | 'WORD';

export interface ExportConfig {
  orientation?: 'landscape' | 'portrait';
  headerText?: string;
  footerText?: string;
  companyName?: string;
  showPageNumbers?: boolean;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
  };
}

export interface ReportLayout {
  columns: {
    key: string;
    label: string;
    width?: number;
    type?: 'string' | 'number' | 'currency' | 'date';
    align?: 'left' | 'center' | 'right';
  }[];
  data: any[];
  groupedRows?: {
    groupBy: string;
    aggregates?: Record<string, string>;
  }[];
  summaryRows?: boolean;
  mergedCells?: { rowStart: number; rowEnd: number; colStart: number; colEnd: number }[];
}

export interface IBaseExporter {
  initialize(config: ExportConfig): void;
  formatData(layout: ReportLayout): void;
  export(fileName: string): Promise<Blob | void>;
}
