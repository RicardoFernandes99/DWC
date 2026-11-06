import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { FulfilmentMethod, OrderOrigin, OrderStatus } from './order.schema.js';
import type { ProductUnit } from '../products/product.schema.js';

const FONT_PATH = fileURLToPath(
  new URL('./assets/fraunces-regular.ttf', import.meta.url),
);
const MAX_PDF_BYTES = 1_500_000;
const MAX_PAGES = 8;
const PAGE_MARGIN = 52;
const FOREST = '#24563D';
const INK = '#253329';
const MUTED = '#58655B';
const RULE = '#DDE8D8';

export interface PurchaseReceiptData {
  orderId: string;
  checkoutId: string | null;
  auctionId: string | null;
  buyerId: string;
  buyerNameSnapshot: string | null;
  producerId: string;
  producerNameSnapshot: string | null;
  createdAt: Date;
  cancelledAt: Date | null;
  items: Array<{
    productName: string;
    productUnit: ProductUnit;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
  fulfilmentMethod: FulfilmentMethod;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  origin: OrderOrigin;
  status: OrderStatus;
  refundedCents: number;
  refundedAt: Date | null;
}

function cleanLabel(value: string, maxLength = 240): string {
  return Array.from(value.replace(/\p{Cc}/gu, ''))
    .slice(0, maxLength)
    .join('')
    .trim();
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function date(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

function unitLabel(unit: ProductUnit): string {
  const labels: Record<ProductUnit, string> = {
    unit: 'unit',
    bunch: 'bunch',
    box: 'box',
    jar: 'jar',
    bottle: 'bottle',
    bag: 'bag',
    kg: 'kg',
    g_500: '500 g',
    g_250: '250 g',
    l: 'litre',
    ml_500: '500 ml',
  };
  return labels[unit];
}

function reference(id: string): string {
  return id.toUpperCase();
}

export async function renderPurchaseReceipt(
  receipt: PurchaseReceiptData,
): Promise<Buffer> {
  if (receipt.items.length < 1 || receipt.items.length > 50) {
    throw new Error(
      'Purchase receipt line count is outside the supported range.',
    );
  }
  if (
    !Number.isSafeInteger(receipt.refundedCents) ||
    receipt.refundedCents < 0 ||
    receipt.refundedCents > receipt.totalCents
  ) {
    throw new Error(
      'Order refund allocation is inconsistent with the purchase total.',
    );
  }

  const document = new PDFDocument({
    size: 'A4',
    margins: {
      top: PAGE_MARGIN,
      right: PAGE_MARGIN,
      bottom: PAGE_MARGIN,
      left: PAGE_MARGIN,
    },
    bufferPages: true,
    compress: true,
    info: {
      Title: `Purchase receipt ${receipt.orderId.toUpperCase()}`,
      Author: 'Do Campo à Mesa',
      Subject: 'Purchase receipt',
    },
  });
  document.registerFont('Receipt', FONT_PATH);

  const chunks: Buffer[] = [];
  let bytes = 0;
  let sizeExceeded = false;
  const pdf = new Promise<Buffer>((resolve, reject) => {
    document.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_PDF_BYTES && !sizeExceeded) {
        sizeExceeded = true;
        reject(new Error('Purchase receipt exceeded the size limit.'));
        return;
      }
      if (sizeExceeded) return;
      chunks.push(chunk);
    });
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const left = PAGE_MARGIN;
  const width = 595.28 - PAGE_MARGIN * 2;
  document
    .font('Receipt')
    .fillColor(FOREST)
    .fontSize(23)
    .text('Purchase receipt');
  document.moveDown(0.25);
  document.fillColor(MUTED).fontSize(9).text('Do Campo à Mesa');
  document.moveDown(0.7);

  const receiptNumber = `DWC-${reference(receipt.orderId)}`;
  document.fillColor(INK).fontSize(11).text(`Receipt number  ${receiptNumber}`);
  document.fontSize(10).text(`Purchase date  ${date(receipt.createdAt)}`);
  document.moveDown(0.7);

  const buyer = receipt.buyerNameSnapshot
    ? cleanLabel(receipt.buyerNameSnapshot, 100)
    : `Account reference ${receipt.buyerId}`;
  const producer = receipt.producerNameSnapshot
    ? cleanLabel(receipt.producerNameSnapshot, 120)
    : `Account reference ${receipt.producerId}`;
  document.fontSize(10).text(`Buyer  ${buyer}`, { width });
  document.text(`Producer  ${producer}`, { width });
  if (!receipt.buyerNameSnapshot || !receipt.producerNameSnapshot) {
    document
      .fillColor(MUTED)
      .fontSize(9)
      .text('Historical account names were not recorded for this purchase.', {
        width,
      });
  }

  document.moveDown(0.6);
  document
    .fillColor(INK)
    .fontSize(9)
    .text(`Order reference  ${receipt.orderId}`);
  if (receipt.checkoutId) {
    document.text(`Checkout reference  ${receipt.checkoutId}`);
  }
  if (receipt.auctionId) {
    document.text(`Auction reference  ${receipt.auctionId}`);
  }
  document.text(
    `Fulfilment  ${receipt.fulfilmentMethod === FulfilmentMethod.Collection ? 'Collection' : 'Delivery'}`,
  );
  document.moveDown(1.1);

  document.fontSize(15).fillColor(FOREST).text('Items');
  document.moveDown(0.5);
  const nameWidth = 205;
  const quantityX = left + 214;
  const unitX = left + 253;
  const priceX = left + 305;
  const totalX = left + 397;
  const amountWidth = width - (totalX - left);
  const drawTableHeader = () => {
    const headingY = document.y;
    document.fontSize(8).fillColor(MUTED);
    document.text('Item', left, headingY, { width: nameWidth });
    document.text('Qty', quantityX, headingY, { width: 34 });
    document.text('Unit', unitX, headingY, { width: 45 });
    document.text('Unit price', priceX, headingY, {
      width: 82,
      align: 'right',
    });
    document.text('Line total', totalX, headingY, {
      width: amountWidth,
      align: 'right',
    });
    document
      .moveTo(left, headingY + 15)
      .lineTo(left + width, headingY + 15)
      .strokeColor(RULE)
      .stroke();
    document.y = headingY + 22;
  };
  drawTableHeader();

  for (const item of receipt.items) {
    const productName = cleanLabel(item.productName);
    document.font('Receipt').fontSize(9);
    const rowHeight = Math.max(
      18,
      ...[
        document.heightOfString(productName, { width: nameWidth, lineGap: 1 }),
        document.heightOfString(String(item.quantity), { width: 34 }),
        document.heightOfString(unitLabel(item.productUnit), { width: 45 }),
        document.heightOfString(money(item.unitPriceCents), { width: 82 }),
        document.heightOfString(money(item.lineTotalCents), {
          width: amountWidth,
        }),
      ].map((height) => height + 4),
    );
    if (document.y + rowHeight > document.page.height - PAGE_MARGIN - 88) {
      document.addPage();
      document.y = PAGE_MARGIN;
      drawTableHeader();
    }
    const y = document.y;
    document.fontSize(9).fillColor(INK).text(productName, left, y, {
      width: nameWidth,
      lineGap: 1,
    });
    document.fontSize(9).text(String(item.quantity), quantityX, y, {
      width: 34,
    });
    document.text(unitLabel(item.productUnit), unitX, y, {
      width: 45,
    });
    document.text(money(item.unitPriceCents), priceX, y, {
      width: 82,
      align: 'right',
    });
    document.text(money(item.lineTotalCents), totalX, y, {
      width: amountWidth,
      align: 'right',
    });
    document.y = y + rowHeight;
  }

  const summaryRows = [
    ['Subtotal', money(receipt.subtotalCents)],
    [
      receipt.fulfilmentMethod === FulfilmentMethod.Delivery
        ? 'Delivery fee'
        : 'Collection fee',
      money(receipt.deliveryFeeCents),
    ],
    ['Original total paid', money(receipt.totalCents)],
  ];
  document.moveDown(0.8);
  const summaryX = left + 144;
  const summaryWidth = width - 144;
  const summaryAmountWidth = 140;
  const summaryLabelWidth = summaryWidth - summaryAmountWidth - 12;
  const summaryAmountX = summaryX + summaryLabelWidth + 12;

  const refundedCents = receipt.refundedCents;
  const remainingCents = Math.max(0, receipt.totalCents - refundedCents);
  const refundLines = [
    ['Refunded for this order', money(refundedCents)],
    ['Remaining paid amount', money(remainingCents)],
  ];
  if (receipt.cancelledAt) {
    refundLines.unshift(['Cancellation date', date(receipt.cancelledAt)]);
  }
  if (receipt.refundedAt) {
    refundLines.push(['Refund date', date(receipt.refundedAt)]);
  }

  const rowsHeight = (rows: string[][], fontSize: number) =>
    rows.reduce((total, [label, value]) => {
      document.font('Receipt').fontSize(fontSize);
      const labelHeight = document.heightOfString(label, {
        width: summaryLabelWidth,
      });
      const valueHeight = document.heightOfString(value, {
        width: summaryAmountWidth,
        align: 'right',
      });
      return total + Math.max(13, labelHeight, valueHeight) + 5;
    }, 0);
  const auctionNote =
    'Auction winning price is recorded once for the complete lot.';
  const auctionNoteHeight =
    receipt.origin === OrderOrigin.Auction
      ? document.font('Receipt').fontSize(9).heightOfString(auctionNote, {
          width,
        }) + 10
      : 0;
  const summaryHeight =
    rowsHeight(summaryRows, 10) +
    rowsHeight(refundLines, 9) +
    auctionNoteHeight +
    20;
  if (document.y + summaryHeight > document.page.height - PAGE_MARGIN - 92) {
    document.addPage();
    document.y = PAGE_MARGIN;
  }
  for (const [label, amount] of summaryRows) {
    const y = document.y;
    document.fontSize(10).fillColor(INK).text(label, summaryX, y, {
      width: summaryLabelWidth,
    });
    document.text(amount, summaryAmountX, y, {
      width: summaryAmountWidth,
      align: 'right',
    });
    document.y =
      y +
      Math.max(
        13,
        document.heightOfString(label, { width: summaryLabelWidth }),
        document.heightOfString(amount, { width: summaryAmountWidth }),
      ) +
      5;
  }

  document.moveDown(0.2);
  for (const [label, value] of refundLines) {
    const y = document.y;
    document.fontSize(9).fillColor(MUTED).text(label, summaryX, y, {
      width: summaryLabelWidth,
    });
    document.text(value, summaryAmountX, y, {
      width: summaryAmountWidth,
      align: 'right',
    });
    document.y =
      y +
      Math.max(
        13,
        document.heightOfString(label, { width: summaryLabelWidth }),
        document.heightOfString(value, { width: summaryAmountWidth }),
      ) +
      5;
  }

  if (receipt.origin === OrderOrigin.Auction) {
    document.moveDown(0.5);
    document
      .fontSize(9)
      .fillColor(MUTED)
      .text(auctionNote, left, document.y, { width });
  }

  const pages = document.bufferedPageRange();
  if (pages.count > MAX_PAGES) {
    document.end();
    await pdf;
    throw new Error('Purchase receipt exceeded the page limit.');
  }
  for (let index = 0; index < pages.count; index += 1) {
    document.switchToPage(index);
    document
      .font('Receipt')
      .fontSize(8)
      .fillColor(MUTED)
      .text(`${receiptNumber}  |  ${index + 1} / ${pages.count}`, left, 772, {
        width,
        align: 'right',
      });
  }
  document.end();
  return pdf;
}
