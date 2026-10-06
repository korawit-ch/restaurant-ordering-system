import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import jsQR from 'jsqr';

export const MAX_SLIP_BYTES = 5 * 1024 * 1024;

export async function inspectSlip(file: Express.Multer.File) {
  if (!file?.buffer?.length || file.buffer.length > MAX_SLIP_BYTES)
    throw new BadRequestException('Choose an image smaller than 5 MB');
  const jpeg = file.buffer
    .subarray(0, 3)
    .equals(Buffer.from([0xff, 0xd8, 0xff]));
  const png = file.buffer
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (
    (!jpeg && !png) ||
    (jpeg && file.mimetype !== 'image/jpeg') ||
    (png && file.mimetype !== 'image/png')
  )
    throw new BadRequestException('Upload a JPEG or PNG bank slip');
  try {
    const image = sharp(file.buffer, {
      limitInputPixels: 12_000_000,
      failOn: 'error',
    });
    const metadata = await image.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      (metadata.pages && metadata.pages !== 1)
    )
      throw new Error('Invalid image');
    // Re-encoding removes EXIF and other metadata before storage.
    const clean = await image
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({
        width: 1800,
        height: 1800,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    const { data, info } = await sharp(clean)
      .resize({
        width: 1200,
        height: 1200,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const qr = jsQR(
      new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
      info.width,
      info.height,
      { inversionAttempts: 'attemptBoth' },
    );
    return {
      buffer: clean,
      contentType: 'image/jpeg',
      sha256: createHash('sha256').update(clean).digest('hex'),
      qrPayloadHash: qr?.data
        ? createHash('sha256').update(qr.data).digest('hex')
        : null,
      qrReadable: Boolean(qr),
    };
  } catch {
    throw new BadRequestException(
      'The image could not be read. Upload a clear JPEG or PNG slip',
    );
  }
}

@Injectable()
export class PaymentSlipStorage {
  private readonly bucket = process.env.PAYMENT_SLIP_S3_BUCKET?.trim();
  private readonly client = this.bucket
    ? new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-1' })
    : null;

  get enabled() {
    return Boolean(this.client && this.bucket);
  }

  private configured() {
    if (!this.client || !this.bucket)
      throw new ServiceUnavailableException('Slip upload is not configured');
    return { client: this.client, bucket: this.bucket };
  }

  async put(
    scope: { tenantId: string; branchId: string; orderId: string },
    buffer: Buffer,
  ) {
    const { client, bucket } = this.configured();
    const key = `payment-slips/${scope.tenantId}/${scope.branchId}/${scope.orderId}/${randomUUID()}.jpg`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg',
        ContentLength: buffer.length,
        ServerSideEncryption: 'AES256',
      }),
    );
    return key;
  }

  async remove(key: string) {
    const { client, bucket } = this.configured();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async signedView(key: string) {
    const { client, bucket } = this.configured();
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentType: 'image/jpeg',
        ResponseContentDisposition: 'inline',
      }),
      { expiresIn: 300 },
    );
  }
}
