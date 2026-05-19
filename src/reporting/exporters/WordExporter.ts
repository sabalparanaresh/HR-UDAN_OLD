import { BaseExporter } from './BaseExporter';
import { ReportLayout } from './types';
import { Document, Packer, Paragraph, Table, TableRow, TableCell } from 'docx';

export class WordExporter extends BaseExporter {
  protected applyFormatting(layout: ReportLayout) {
    // Build docx Document elements
    const tableRows = [
      new TableRow({
        children: layout.columns.map(c => new TableCell({ children: [new Paragraph(c.label)] }))
      }),
      // Add data rows here
    ];

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: this.config.companyName || 'Report' }),
          new Table({ rows: tableRows })
        ]
      }]
    });

    return doc;
  }

  public async export(fileName: string): Promise<Blob> {
    const doc = this.formattedData as Document;
    if (!doc) {
      throw new Error('Data not formatted for export');
    }

    const blob = await Packer.toBlob(doc);
    return blob;
  }
}
