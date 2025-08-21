#!/usr/bin/env tsx

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

async function testOdooBasic() {
  console.log('🔄 Testing basic Odoo connectivity...\n');

  const odooUrl = process.env.ODOO_URL!;
  console.log(`Testing connection to: ${odooUrl}`);

  try {
    // Test 1: Basic HTTP connectivity
    console.log('1. Testing basic HTTP connectivity...');
    const response = await fetch(odooUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Odoo-Test-Client'
      }
    });
    
    console.log(`✅ HTTP Status: ${response.status} ${response.statusText}`);
    
    // Test 2: Check if XML-RPC endpoints are accessible
    console.log('\n2. Testing XML-RPC common endpoint...');
    const commonResponse = await fetch(`${odooUrl}/xmlrpc/2/common`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'User-Agent': 'Odoo-Test-Client'
      },
      body: '<?xml version="1.0"?><methodCall><methodName>version</methodName></methodCall>'
    });
    
    console.log(`✅ XML-RPC Common Status: ${commonResponse.status} ${commonResponse.statusText}`);
    
    if (commonResponse.ok) {
      const responseText = await commonResponse.text();
      console.log('Response preview:', responseText.substring(0, 200) + '...');
    }

    // Test 3: Try authentication
    console.log('\n3. Testing authentication...');
    const authXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${process.env.ODOO_DB}</string></value></param>
    <param><value><string>${process.env.ODOO_USER}</string></value></param>
    <param><value><string>${process.env.ODOO_API_KEY}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`;

    const authResponse = await fetch(`${odooUrl}/xmlrpc/2/common`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'User-Agent': 'Odoo-Test-Client'
      },
      body: authXml
    });

    console.log(`Auth Response Status: ${authResponse.status} ${authResponse.statusText}`);
    
    if (authResponse.ok) {
      const authResponseText = await authResponse.text();
      console.log('Auth Response:', authResponseText);
      
      // Extract UID from XML response
      const uidMatch = authResponseText.match(/<int>(\d+)<\/int>/);
      if (uidMatch) {
        console.log(`✅ Authentication successful! UID: ${uidMatch[1]}`);
      } else {
        console.log('❌ Authentication failed - no UID returned');
      }
    }

    console.log('\n🎉 Basic connectivity tests completed!');

  } catch (error) {
    console.error('❌ Connection test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testOdooBasic();
}

export default testOdooBasic;