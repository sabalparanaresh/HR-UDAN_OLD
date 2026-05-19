import { IBaseExporter, ExportConfig, ReportLayout } from './types';

export abstract class BaseExporter implements IBaseExporter {
  protected config: ExportConfig;
  protected layout: ReportLayout | null = null;
  protected formattedData: any = null;

  constructor() {
    this.config = {
      orientation: 'portrait',
      showPageNumbers: true,
      companyName: 'HR-UDAN'
    };
  }

  public initialize(config: ExportConfig): void {
    this.config = { ...this.config, ...config };
  }

  public formatData(layout: ReportLayout): void {
    // Transformer logic common to all exporters
    // E.g., formatting raw data, calculating summary rows, grouping
    this.layout = layout;
    this.formattedData = this.applyFormatting(layout);
  }

  protected abstract applyFormatting(layout: ReportLayout): any;

  public abstract export(fileName: string): Promise<Blob | void>;
}
