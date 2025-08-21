#!/usr/bin/env tsx

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

async function simpleOdooTest() {
  const config = {
    url: process.env.ODOO_URL!,
    db: process.env.ODOO_DB!,
    user: process.env.ODOO_USER!,
    apiKey: process.env.ODOO_API_KEY!,
  };

  // Simple value to XML converter
  function valueToXml(value: any): string {
    if (typeof value === 'string') {
      return `<string>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</string>`;
    } else if (typeof value === 'number') {
      return Number.isInteger(value) ? `<int>${value}</int>` : `<double>${value}</double>`;
    } else if (Array.isArray(value)) {
      return `<array><data>${value.map(v => `<value>${valueToXml(v)}</value>`).join('')}</data></array>`;
    } else if (typeof value === 'object' && value !== null) {
      const members = Object.entries(value).map(([k, v]) => 
        `<member><name>${k}</name><value>${valueToXml(v)}</value></member>`
      ).join('');
      return `<struct>${members}</struct>`;
    }
    return `<string>${String(value)}</string>`;
  }

  // Test authentication first
  console.log('1. Testing authentication...');
  const authXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value>${valueToXml(config.db)}</value></param>
    <param><value>${valueToXml(config.user)}</value></param>
    <param><value>${valueToXml(config.apiKey)}</value></param>
    <param><value>${valueToXml({})}</value></param>
  </params>
</methodCall>`;

  console.log('Request XML:');
  console.log(authXml);

  const authResponse = await fetch(`${config.url}/xmlrpc/2/common`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: authXml
  });

  const authText = await authResponse.text();
  console.log('\nResponse XML:');
  console.log(authText);

  // Extract UID
  const uidMatch = authText.match(/<int>(\d+)<\/int>/);
  const uid = uidMatch ? parseInt(uidMatch[1]) : null;
  console.log(`\nUID: ${uid}\n`);

  // Test categories
  console.log('2. Testing categories...');
  const categoriesXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value>${valueToXml(config.db)}</value></param>
    <param><value>${valueToXml(uid)}</value></param>
    <param><value>${valueToXml(config.apiKey)}</value></param>
    <param><value>${valueToXml('product.category')}</value></param>
    <param><value>${valueToXml('search_read')}</value></param>
    <param><value>${valueToXml([[]])}</value></param>
    <param><value>${valueToXml({ fields: ['id', 'name'], limit: 2 })}</value></param>
  </params>
</methodCall>`;

  console.log('Request XML:');
  console.log(categoriesXml);

  const categoriesResponse = await fetch(`${config.url}/xmlrpc/2/object`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: categoriesXml
  });

  const categoriesText = await categoriesResponse.text();
  console.log('\nResponse XML:');
  console.log(categoriesText);
}

simpleOdooTest().catch(console.error);