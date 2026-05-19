import { BaseExporter } from '../../../../exporters/BaseExporter';
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType, HeadingLevel } from 'docx';

export class AadharConsentWordExporter extends BaseExporter {
  protected applyFormatting(layout: any) {
    if (!layout || !layout.data || layout.data.length === 0) {
      return null;
    }
    const record = layout.data[0];

    return new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: record.ref_number,
                bold: true,
                size: 20
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'AADHAR HOLDER CONSENT FORM',
                bold: true,
                underline: {},
                size: 24
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
            children: [
              new TextRun({
                text: 'Consent for Authentication',
                bold: true,
                size: 22
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.BOTH,
            spacing: { after: 300, line: 360 },
            children: [
              new TextRun({
                text: `I hereby consent to provide my Aadhaar Number, Biometric and/or One Time Pin (OTP) data for Aadhaar based authentication for the purpose of establishing my identity in the company as well as to EPFO or ESIC or any other organisation which is required for my employment to the ${record.company_name} through my Aadhaar number information.`,
                size: 22
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.BOTH,
            spacing: { after: 300, line: 360 },
            children: [
              new TextRun({
                text: `I have no objection in authenticating myself and fully understand that information provided by me shall be used for authenticating my identity through Aadhaar Authentication System for the purpose stated above and no other purpose.`,
                size: 22
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.BOTH,
            spacing: { after: 1200, line: 360 },
            children: [
              new TextRun({
                text: `I also understand that ${record.company_name} shall ensure security / confidentiality of my personal identity data provided for the purpose of Aadhaar based authentication.`,
                size: 22
              })
            ]
          }),
          // Signature Block Table right aligned
          new Table({
            width: { size: 60, type: WidthType.PERCENTAGE },
            alignment: AlignmentType.RIGHT,
            borders: {
              top: { style: BorderStyle.NONE, size: 0 },
              bottom: { style: BorderStyle.NONE, size: 0 },
              left: { style: BorderStyle.NONE, size: 0 },
              right: { style: BorderStyle.NONE, size: 0 },
              insideHorizontal: { style: BorderStyle.NONE, size: 0 },
              insideVertical: { style: BorderStyle.NONE, size: 0 },
            },
            rows: [
              this.createSignatureRow('Signature/Thumb Impression', ''),
              this.createSignatureRow('Name', record.employee_name),
              this.createSignatureRow('Employee Code', record.employee_code),
              this.createSignatureRow('Department', record.department_name),
              this.createSignatureRow('Designation', record.designation_name),
              this.createSignatureRow('Date', record.current_date),
            ]
          })
        ]
      }]
    });
  }

  private createSignatureRow(label: string, value: string) {
    return new TableRow({
      children: [
        new TableCell({
          borders: {
            top: { style: BorderStyle.NONE, size: 0 },
            bottom: { style: BorderStyle.NONE, size: 0 },
            left: { style: BorderStyle.NONE, size: 0 },
            right: { style: BorderStyle.NONE, size: 0 },
          },
          margins: { bottom: 200 },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 22 })] })],
          width: { size: 40, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          borders: {
            top: { style: BorderStyle.NONE, size: 0 },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.NONE, size: 0 },
            right: { style: BorderStyle.NONE, size: 0 },
          },
          margins: { bottom: 200 },
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 22 })] })],
          width: { size: 60, type: WidthType.PERCENTAGE }
        })
      ]
    });
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
