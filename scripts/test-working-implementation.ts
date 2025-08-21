#!/usr/bin/env tsx

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

async function testWorkingImplementation() {
  const config = {
    url: process.env.ODOO_URL!,
    db: process.env.ODOO_DB!,
    user: process.env.ODOO_USER!,
    apiKey: process.env.ODOO_API_KEY!,
  };

  // Simple value to XML converter - THIS ONE WORKS
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

  // Simple XML response parser
  function parseResponse(xml: string): any {
    console.log('Response XML received:');
    console.log(xml);
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Check for array response
    if (xml.includes('<array>')) {
      const arrayMatch = xml.match(/<array><data>(.*?)<\/data><\/array>/s);
      if (arrayMatch) {
        console.log('Found array in response, parsing...');
        const arrayContent = arrayMatch[1];
        
        // Find all struct values in the array
        const items: any[] = [];
        const structRegex = /<value><struct>(.*?)<\/struct><\/value>/gs;
        let match;
        
        while ((match = structRegex.exec(arrayContent)) !== null) {
          const structContent = match[1];
          const item: any = {};
          
          // Parse each member in the struct
          const memberRegex = /<member>\s*<name>(.*?)<\/name>\s*<value>(.*?)<\/value>\s*<\/member>/gs;
          let memberMatch;
          
          while ((memberMatch = memberRegex.exec(structContent)) !== null) {
            const name = memberMatch[1];
            const valueContent = memberMatch[2];
            
            if (valueContent.includes('<string>')) {
              const stringMatch = valueContent.match(/<string>(.*?)<\/string>/);
              item[name] = stringMatch ? stringMatch[1] : '';
            } else if (valueContent.includes('<int>')) {
              const intMatch = valueContent.match(/<int>(-?\d+)<\/int>/);
              item[name] = intMatch ? parseInt(intMatch[1]) : 0;
            } else if (valueContent.includes('<double>')) {
              const doubleMatch = valueContent.match(/<double>(-?\d*\.?\d+)<\/double>/);
              item[name] = doubleMatch ? parseFloat(doubleMatch[1]) : 0;
            } else {
              item[name] = valueContent.trim();
            }
          }
          
          items.push(item);
        }
        
        return items;
      }
    }
    
    // Check for simple int response (like UID)
    if (xml.includes('<int>')) {
      const match = xml.match(/<int>(\d+)<\/int>/);
      return match ? parseInt(match[1]) : null;
    }
    
    return xml;
  }

  try {
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

    const authResponse = await fetch(`${config.url}/xmlrpc/2/common`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: authXml
    });

    const authText = await authResponse.text();
    const uid = parseResponse(authText);
    console.log(`✅ UID: ${uid}\n`);

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
    <param><value>${valueToXml({ fields: ['id', 'name'], limit: 3 })}</value></param>
  </params>
</methodCall>`;

    const categoriesResponse = await fetch(`${config.url}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: categoriesXml
    });

    const categoriesText = await categoriesResponse.text();
    const categories = parseResponse(categoriesText);
    
    console.log('✅ Categories parsed result:');
    console.log(JSON.stringify(categories, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

testWorkingImplementation();