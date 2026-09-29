import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicV4 } from '../scripts/url-importer.mjs';
test('URL getirici özel, loopback, link-local ve ayrılmış ağları engeller', () => {
  for (const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','198.18.0.1','::1','::ffff:127.0.0.1']) assert.equal(publicV4(ip), false, ip);
  assert.equal(publicV4('8.8.8.8'), true);
});
