#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { OdooClient } from '../src/lib/odoo';

dotenv.config({ path: '.env.local' });

async function testManualSearch() {
  try {
    const config = {
      url: process.env.ODOO_URL!,
      db: process.env.ODOO_DB!,
      user: process.env.ODOO_USER!,
      apiKey: process.env.ODOO_API_KEY!,
    };

    const client = new OdooClient(config);
    await client.auth();

    // Manually call search_read with exact working format
    console.log('Testing manual search_read call...');
    
    const result = await (client as any).xmlrpcCall('/xmlrpc/2/object', 'execute_kw', [
      config.db,
      6, // UID
      config.apiKey,
      'product.category',
      'search_read',
      [[]],  // domain
      {
        fields: ['id', 'name'],
        limit: 3
      }
    ]);

    console.log('Manual result:', JSON.stringify(result, null, 2));
    console.log('Type:', typeof result);
    console.log('Is array:', Array.isArray(result));

  } catch (error) {
    console.error('Manual test failed:', error);
  }
}

testManualSearch();