#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { OdooClient } from '../src/lib/odoo';

dotenv.config({ path: '.env.local' });

// Extend OdooClient to add debug logging
class DebugOdooClient extends OdooClient {
  async debugSearchRead(model: string, fields: string[]) {
    await this.auth();
    
    const params = [
      this.config.db,
      this.uid,
      this.config.apiKey,
      model,
      'search_read',
      [[]],
      {
        fields: fields,
        limit: 2
      }
    ];

    console.log(`\n🔍 Debugging ${model} search_read...`);
    console.log('Params:', JSON.stringify(params, null, 2));

    try {
      const result = await this.xmlrpcCall('/xmlrpc/2/object', 'execute_kw', params);
      console.log('Raw result:', JSON.stringify(result, null, 2));
      console.log('Result type:', typeof result);
      console.log('Is array:', Array.isArray(result));
      if (Array.isArray(result)) {
        console.log('Array length:', result.length);
        if (result.length > 0) {
          console.log('First item:', JSON.stringify(result[0], null, 2));
          console.log('First item type:', typeof result[0]);
        }
      }
      return result;
    } catch (error) {
      console.error(`Debug error for ${model}:`, error);
      throw error;
    }
  }

  // Access private members
  get config() {
    return (this as any).config;
  }

  get uid() {
    return (this as any).uid;
  }

  xmlrpcCall(endpoint: string, method: string, params: any[]) {
    return (this as any).xmlrpcCall(endpoint, method, params);
  }
}

async function testWithDebug() {
  try {
    const config = {
      url: process.env.ODOO_URL!,
      db: process.env.ODOO_DB!,
      user: process.env.ODOO_USER!,
      apiKey: process.env.ODOO_API_KEY!,
    };

    const client = new DebugOdooClient(config);

    // Test categories
    await client.debugSearchRead('product.category', ['id', 'name']);

    // Test products  
    await client.debugSearchRead('product.template', ['id', 'name', 'default_code', 'standard_price']);

  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

testWithDebug();