import { BadRequestException } from '@nestjs/common';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { inspectSlip } from './payment-slip.storage';

function upload(buffer: Buffer, mimetype = 'image/png') {
  return { buffer, mimetype } as Express.Multer.File;
}

describe('payment slip initial checks', () => {
  it('rejects files whose declared image type does not match their bytes', async () => {
    const png = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: 'white',
      },
    })
      .png()
      .toBuffer();
    await expect(inspectSlip(upload(png, 'image/jpeg'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      inspectSlip(upload(Buffer.from('%PDF-1.7'), 'image/png')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('decodes a QR and normalizes the stored image without trusting payment status', async () => {
    const png = await QRCode.toBuffer('slip-transaction-reference-123', {
      width: 500,
      margin: 4,
    });
    const checked = await inspectSlip(upload(png));
    expect(checked.qrReadable).toBe(true);
    expect(checked.qrPayloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(checked.contentType).toBe('image/jpeg');
    expect((await sharp(checked.buffer).metadata()).format).toBe('jpeg');
  });

  it('accepts a readable image without a QR for manual review', async () => {
    const png = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: 'white',
      },
    })
      .png()
      .toBuffer();
    const checked = await inspectSlip(upload(png));
    expect(checked.qrReadable).toBe(false);
    expect(checked.qrPayloadHash).toBeNull();
  });
});
