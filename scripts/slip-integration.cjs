/* TEST_DATABASE_URL must point to a disposable database named *_test. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const QRCode = require('qrcode');

if (
  !process.env.TEST_DATABASE_URL ||
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')
)
  throw new Error('Use a dedicated *_test database');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.APP_ORIGIN = 'http://localhost:3010';

const { Test } = require('@nestjs/testing');
const { AppModule } = require('../apps/api/dist/app.module');
const {
  PaymentSlipStorage,
} = require('../apps/api/dist/orders/payment-slip.storage');
const prisma = require('@repo/prisma').default;
const objects = new Map();
const storage = {
  enabled: true,
  async put(scope, buffer) {
    const key = `${scope.tenantId}/${scope.branchId}/${scope.orderId}/${randomUUID()}`;
    objects.set(key, buffer);
    return key;
  },
  async remove(key) {
    objects.delete(key);
  },
  async signedView(key) {
    assert.ok(objects.has(key));
    return `https://private.example/${key}`;
  },
};

async function main() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "AuthSession","BranchUser","PaymentSlip","PaymentClaim","OrderItem","Order","OrderSession","Product","MenuCategory","Menu","ServicePoint","BranchSettings","Subscription","Branch","Tenant","User" CASCADE',
  );
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PaymentSlipStorage)
    .useValue(storage)
    .compile();
  const app = module.createNestApplication({ logger: false });
  await app.init();
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  async function json(path, method = 'GET', body, cookie) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: process.env.APP_ORIGIN,
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }
  async function upload(path, bytes, type = 'image/png') {
    const form = new FormData();
    form.set('file', new Blob([bytes], { type }), 'slip.png');
    const response = await fetch(base + path, {
      method: 'POST',
      headers: { Origin: process.env.APP_ORIGIN },
      body: form,
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    async function restaurant(name) {
      const signup = await json('/auth/signup', 'POST', {
        name,
        slug: name.toLowerCase(),
        branchName: 'Main',
        preset: 'QUICK_SERVICE',
        email: `${name.toLowerCase()}@example.com`,
        password: 'StrongPassword123!',
      });
      assert.equal(signup.status, 201, JSON.stringify(signup));
      const cookie = signup.cookie;
      const category = await json(
        '/admin/categories',
        'POST',
        { name: 'Beer' },
        cookie,
      );
      const product = await json(
        '/admin/products',
        'POST',
        {
          name: 'Leo',
          categoryId: category.body.id,
          price: '80',
        },
        cookie,
      );
      const point = await json(
        '/restaurant/service-points',
        'POST',
        {
          name: 'Counter',
          type: 'PICKUP',
        },
        cookie,
      );
      await json(
        '/restaurant/settings',
        'PATCH',
        {
          qrMode: 'PERMANENT',
          sessionMode: 'SINGLE_ORDER',
          paymentMode: 'PER_ORDER',
          fulfillmentMode: 'PICKUP',
          promptpayId: '0812345678',
        },
        cookie,
      );
      const path = `/public/q/${point.body.qrToken}/orders`;
      async function order() {
        const result = await json(path, 'POST', {
          requestKey: randomUUID(),
          method: 'PROMPTPAY',
          items: [
            { productId: product.body.id, quantity: 1, expectedPrice: '80' },
          ],
        });
        assert.equal(result.status, 201, JSON.stringify(result));
        return result.body;
      }
      return { cookie, path, order };
    }
    const alpha = await restaurant('Alpha');
    const bravo = await restaurant('Bravo');
    const first = await alpha.order();
    const second = await alpha.order();
    const slip = await QRCode.toBuffer('bank-slip-qr-123', { width: 500 });
    const invalid = await upload(
      `${alpha.path}/${first.id}/payment-slip`,
      Buffer.from('%PDF-1.7'),
    );
    assert.equal(invalid.status, 400);
    const uploaded = await upload(
      `${alpha.path}/${first.id}/payment-slip`,
      slip,
    );
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded));
    assert.equal(uploaded.body.paymentStatus, 'PENDING');
    assert.equal(uploaded.body.paymentClaim.status, 'SUBMITTED');
    assert.equal(uploaded.body.paymentSlip.qrReadable, true);
    assert.equal(uploaded.body.paymentSlip.duplicateWarning, false);
    assert.equal(uploaded.body.paymentSlip.objectKey, undefined);
    const objectCount = objects.size;
    const retry = await upload(`${alpha.path}/${first.id}/payment-slip`, slip);
    assert.equal(retry.status, 201);
    assert.equal(retry.body.paymentSlip.id, uploaded.body.paymentSlip.id);
    assert.equal(objects.size, objectCount);
    const duplicate = await upload(
      `${alpha.path}/${second.id}/payment-slip`,
      slip,
    );
    assert.equal(duplicate.body.paymentSlip.duplicateWarning, true);
    const oldSecondKey = [...objects.keys()].find((key) =>
      key.includes(`/${second.id}/`),
    );
    assert.ok(oldSecondKey);
    const rejected = await json(
      `/staff/orders/${second.id}/payment-claim/reject`,
      'POST',
      { reason: 'Duplicate slip' },
      alpha.cookie,
    );
    assert.equal(rejected.status, 201, JSON.stringify(rejected));
    const newSlip = await QRCode.toBuffer('bank-slip-qr-456', { width: 500 });
    const replacement = await upload(
      `${alpha.path}/${second.id}/payment-slip`,
      newSlip,
    );
    assert.equal(replacement.status, 201, JSON.stringify(replacement));
    assert.equal(replacement.body.paymentClaim.status, 'SUBMITTED');
    assert.equal(replacement.body.paymentSlip.duplicateWarning, false);
    assert.equal(objects.has(oldSecondKey), false);
    assert.equal(
      (
        await json(
          `/staff/orders/${first.id}/payment-slip`,
          'GET',
          undefined,
          bravo.cookie,
        )
      ).status,
      404,
    );
    const staffView = await json(
      `/staff/orders/${first.id}/payment-slip`,
      'GET',
      undefined,
      alpha.cookie,
    );
    assert.equal(staffView.status, 200);
    assert.match(staffView.body.url, /^https:\/\/private\.example\//);
    assert.equal(
      (
        await json(
          `/staff/orders/${first.id}/payment`,
          'POST',
          {},
          alpha.cookie,
        )
      ).status,
      400,
    );
    const confirmed = await json(
      `/staff/orders/${first.id}/payment`,
      'POST',
      {
        reference: 'BANK-RECEIVING-REF-1',
      },
      alpha.cookie,
    );
    assert.equal(confirmed.body.paymentStatus, 'PAID');
    assert.equal(
      (await upload(`${alpha.path}/${first.id}/payment-slip`, slip)).status,
      409,
    );
    console.log(
      'PASS slip upload, QR check, duplicate warning, tenant isolation, and manual payment confirmation',
    );
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
