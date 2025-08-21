#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { OdooClient } from '../src/lib/odoo';

dotenv.config({ path: '.env.local' });

class DebugOdooClient extends OdooClient {
  // Expose the private methods for debugging
  public async debugXmlrpcCall(endpoint: string, method: string, params: any[]) {
    const url = `${this.config.url}${endpoint}`;
    
    const xmlData = `<?xml version="1.0"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>
    ${params.map(param => `<param><value>${this.valueToXml(param)}</value></param>`).join('')}
  </params>
</methodCall>`;

    console.log('🔍 REQUEST XML:');
    console.log(xmlData);
    console.log('\n' + '='.repeat(80) + '\n');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'User-Agent': 'Conforama-Costos-Client'
        },
        body: xmlData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('🔍 RESPONSE XML:');
      console.log(responseText);
      console.log('\n' + '='.repeat(80) + '\n');

      const parsed = this.parseXmlResponse(responseText);
      console.log('🔍 PARSED RESULT:');
      console.log(JSON.stringify(parsed, null, 2));
      
      return parsed;
    } catch (error) {
      console.error(`Odoo XMLRPC call failed:`, error);
      throw error;
    }
  }

  // Make these methods public for debugging
  public valueToXml(value: any): string {
    return super['valueToXml'](value);
  }

  public parseXmlResponse(xml: string): any {
    return super['parseXmlResponse'](xml);
  }

  private get config() {
    return super['config'];
  }
}

async function debugOdooResponses() {
  console.log('🔍 Debugging Odoo XML-RPC responses...\n');

  try {
    const config = {
      url: process.env.ODOO_URL!,
      db: process.env.ODOO_DB!,
      user: process.env.ODOO_USER!,
      apiKey: process.env.ODOO_API_KEY!,
    };

    const client = new DebugOdooClient(config);

    console.log('1. Testing authentication...');
    console.log('='.repeat(50));
    const uid = await client.debugXmlrpcCall(
      '/xmlrpc/2/common',
      'authenticate',
      [config.db, config.user, config.apiKey, {}]
    );
    console.log(`✅ UID: ${uid}\n`);

    console.log('2. Testing categories with explicit fields...');
    console.log('='.repeat(50));
    const categoriesResult = await client.debugXmlrpcCall(
      '/xmlrpc/2/object',
      'execute_kw',
      [
        config.db,
        uid,
        config.apiKey,
        'product.category',
        'search_read',
        [[]],
        {
          fields: ['id', 'name', 'parent_id'],
          limit: 3
        }
      ]
    );
    console.log('✅ Categories result received\n');

    console.log('3. Testing products with explicit fields...');
    console.log('='.repeat(50));
    const productsResult = await client.debugXmlrpcCall(
      '/xmlrpc/2/object',
      'execute_kw',
      [
        config.db,
        uid,
        config.apiKey,
        'product.template',
        'search_read',
        [[['active', '=', true]]],
        {
          fields: ['id', 'name', 'default_code', 'standard_price'],
          limit: 2
        }
      ]
    );
    console.log('✅ Products result received\n');

  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  debugOdooResponses();
}

export default debugOdooResponses;