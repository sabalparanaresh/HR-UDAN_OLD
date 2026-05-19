import { BaseExporter } from './BaseExporter';
import { ReportLayout } from './types';
import ExcelJS from 'exceljs';

export class ExcelExporter extends BaseExporter {
  private workbook: ExcelJS.Workbook;

  constructor() {
    super();
    this.workbook = new ExcelJS.Workbook();
  }

  protected applyFormatting(layout: ReportLayout) {
    const worksheet = this.workbook.addWorksheet('Report', {
      pageSetup: { orientation: this.config.orientation }
    });

    // Add company header
    worksheet.addRow([this.config.companyName]);
    if (this.config.headerText) {
      worksheet.addRow([this.config.headerText]);
    }
    
    // Add columns
    worksheet.columns = layout.columns.map(col => ({
      header: col.label,
      key: col.key,
      width: col.width || 15
    }));

    // Add data
    layout.data.forEach(row => {
      worksheet.addRow(row);
    });

    // Handle grouping, summary rows, merged cells logic here

    return this.workbook;
  }

  public async export(fileName: string): Promise<Blob> {
    if (!this.formattedData) {
      throw new Error('Data not formatted for export');
    }

    const buffer = await this.workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}
