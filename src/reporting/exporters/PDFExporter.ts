import { BaseExporter } from './BaseExporter';
import { ReportLayout } from './types';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

(pdfMake as any).vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfFonts as any).vfs;

export class PDFExporter extends BaseExporter {
  protected applyFormatting(layout: ReportLayout) {
    // Convert layout to pdfMake document definition
    return {
      content: [
        { text: this.config.companyName, style: 'header' },
        { text: this.config.headerText, style: 'subheader' }
      ],
      pageOrientation: this.config.orientation,
      // More dynamic column/row parsing would go here based on grouping/summary
    };
  }

  public async export(fileName: string): Promise<Blob> {
    if (!this.formattedData) {
      throw new Error('Data not formatted for export');
    }

    const docDefinition: TDocumentDefinitions = this.formattedData as TDocumentDefinitions;
    
    return new Promise((resolve, reject) => {
      try {
        const pdfDocGenerator = pdfMake.createPdf(docDefinition);
        pdfDocGenerator.getBlob().then((blob) => {
          resolve(blob);
        }).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }
}
