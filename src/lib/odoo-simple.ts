import fetch from 'node-fetch';
import type { OdooCategory, OdooProduct } from '@/types';

export interface OdooConfig {
  url: string;
  db: string;
  user: string;
  apiKey: string;
}

export class OdooSimpleClient {
  private uid: number | null = null;
  
  constructor(private config: OdooConfig) {}

  private valueToXml(value: any): string {
    if (typeof value === 'string') {
      return `<string>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</string>`;
    } else if (typeof value === 'number') {
      return Number.isInteger(value) ? `<int>${value}</int>` : `<double>${value}</double>`;
    } else if (Array.isArray(value)) {
      return `<array><data>${value.map(v => `<value>${this.valueToXml(v)}</value>`).join('')}</data></array>`;
    } else if (typeof value === 'object' && value !== null) {
      const members = Object.entries(value).map(([k, v]) => 
        `<member><name>${k}</name><value>${this.valueToXml(v)}</value></member>`
      ).join('');
      return `<struct>${members}</struct>`;
    }
    return `<string>${String(value)}</string>`;
  }

  // Simple parser based on the working script
  private parseSimpleResponse(xml: string): any {
    // For boolean responses (write operations)
    if (!xml.includes('<array>') && xml.includes('<boolean>')) {
      const match = xml.match(/<boolean>([01])<\/boolean>/);
      return match ? match[1] === '1' : false;
    }
    
    // For authentication (simple int)
    if (!xml.includes('<array>') && xml.includes('<int>')) {
      const match = xml.match(/<int>(\d+)<\/int>/);
      return match ? parseInt(match[1]) : null;
    }
    
    // For search_read (array of structs)
    if (xml.includes('<array><data>')) {
      const items: any[] = [];
      
      // Extract each complete struct block
      const structBlocks = xml.split('<value><struct>').slice(1); // Skip first empty element
      
      for (const block of structBlocks) {
        const endIndex = block.indexOf('</struct></value>');
        if (endIndex === -1) continue;
        
        const structContent = block.substring(0, endIndex);
        const item: any = {};
        
        // Extract each member
        const memberRegex = /<member>\s*<name>(.*?)<\/name>\s*<value>(.*?)<\/value>\s*<\/member>/gs;
        let match;
        
        while ((match = memberRegex.exec(structContent)) !== null) {
          const name = match[1];
          const valueContent = match[2];
          
          // Parse different value types
          if (valueContent.includes('<string>')) {
            const stringMatch = valueContent.match(/<string>(.*?)<\/string>/);
            item[name] = stringMatch ? stringMatch[1] : '';
          } else if (valueContent.includes('<int>')) {
            const intMatch = valueContent.match(/<int>(-?\d+)<\/int>/);
            item[name] = intMatch ? parseInt(intMatch[1]) : 0;
          } else if (valueContent.includes('<double>')) {
            const doubleMatch = valueContent.match(/<double>(-?\d*\.?\d+)<\/double>/);
            item[name] = doubleMatch ? parseFloat(doubleMatch[1]) : 0.0;
          } else if (valueContent.includes('<boolean>')) {
            const boolMatch = valueContent.match(/<boolean>([01])<\/boolean>/);
            item[name] = boolMatch ? boolMatch[1] === '1' : false;
          } else if (valueContent.includes('<array><data>')) {
            // Handle arrays like parent_id [id, "name"]
            const arrayValues: any[] = [];
            const arrayValueRegex = /<value><(int|string|double|boolean)>(.*?)<\/\1><\/value>/gs;
            let arrayMatch;
            while ((arrayMatch = arrayValueRegex.exec(valueContent)) !== null) {
              const type = arrayMatch[1];
              const val = arrayMatch[2];
              if (type === 'int') {
                arrayValues.push(parseInt(val));
              } else if (type === 'double') {
                arrayValues.push(parseFloat(val));
              } else if (type === 'boolean') {
                arrayValues.push(val === '1');
              } else {
                arrayValues.push(val);
              }
            }
            item[name] = arrayValues;
          }
        }
        
        if (Object.keys(item).length > 0) {
          items.push(item);
        }
      }
      
      return items;
    }
    
    return xml;
  }

  async auth(): Promise<number> {
    if (this.uid) return this.uid;

    const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value>${this.valueToXml(this.config.db)}</value></param>
    <param><value>${this.valueToXml(this.config.user)}</value></param>
    <param><value>${this.valueToXml(this.config.apiKey)}</value></param>
    <param><value>${this.valueToXml({})}</value></param>
  </params>
</methodCall>`;

    const response = await fetch(`${this.config.url}/xmlrpc/2/common`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xml
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    const result = this.parseSimpleResponse(responseText);
    
    if (typeof result === 'number' && result > 0) {
      this.uid = result;
      console.log(`Odoo authenticated successfully with UID: ${result}`);
      return result;
    } else {
      throw new Error('Invalid authentication response');
    }
  }

  async searchCount(model: string, domain: any[] = []): Promise<number> {
    await this.auth();

    const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value>${this.valueToXml(this.config.db)}</value></param>
    <param><value>${this.valueToXml(this.uid)}</value></param>
    <param><value>${this.valueToXml(this.config.apiKey)}</value></param>
    <param><value>${this.valueToXml(model)}</value></param>
    <param><value>${this.valueToXml('search_count')}</value></param>
    <param><value>${this.valueToXml([domain])}</value></param>
  </params>
</methodCall>`;

    const response = await fetch(`${this.config.url}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xml
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    const result = this.parseSimpleResponse(responseText);
    return typeof result === 'number' ? result : 0;
  }

  async searchRead(model: string, domain: any[] = [], fields: string[] = [], options: any = {}): Promise<any[]> {
    await this.auth();

    const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value>${this.valueToXml(this.config.db)}</value></param>
    <param><value>${this.valueToXml(this.uid)}</value></param>
    <param><value>${this.valueToXml(this.config.apiKey)}</value></param>
    <param><value>${this.valueToXml(model)}</value></param>
    <param><value>${this.valueToXml('search_read')}</value></param>
    <param><value>${this.valueToXml([domain])}</value></param>
    <param><value>${this.valueToXml({ 
      fields: fields.length > 0 ? fields : [], 
      limit: options.limit || 10,
      offset: options.offset || 0,
      order: options.order || 'id asc'
    })}</value></param>
  </params>
</methodCall>`;

    const response = await fetch(`${this.config.url}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xml
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    const result = this.parseSimpleResponse(responseText);
    return Array.isArray(result) ? result : [];
  }

  async getCategories(limit: number = 50, offset: number = 0): Promise<OdooCategory[]> {
    const result = await this.searchRead('product.category', [], ['id', 'name', 'parent_id'], { limit, offset, order: 'name asc' });
    return result.map(cat => ({
      id: cat.id,
      name: cat.name,
      parent_id: Array.isArray(cat.parent_id) ? cat.parent_id[0] : cat.parent_id || null,
      parent_name: Array.isArray(cat.parent_id) ? cat.parent_id[1] : null
    }));
  }

  async getProducts(domain: any[] = [], limit: number = 10, offset: number = 0): Promise<OdooProduct[]> {
    const baseDomain = [['active', '=', true], ['type', '=', 'product']];
    const finalDomain = domain.length > 0 ? [...baseDomain, ...domain] : baseDomain;
    const result = await this.searchRead('product.template', finalDomain, ['id', 'name', 'default_code', 'categ_id', 'standard_price'], { limit, offset, order: 'name asc' });
    
    return result.map(prod => ({
      id: prod.id,
      name: prod.name,
      default_code: prod.default_code || null,
      categ_id: Array.isArray(prod.categ_id) ? prod.categ_id[0] : prod.categ_id,
      categ_name: Array.isArray(prod.categ_id) ? prod.categ_id[1] : null,
      standard_price: prod.standard_price || 0,
      active: true
    }));
  }

  async updateProduct(productId: number, values: any): Promise<boolean> {
    if (!this.uid) {
      await this.auth();
    }

    const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value>${this.valueToXml(this.config.db)}</value></param>
    <param><value>${this.valueToXml(this.uid)}</value></param>
    <param><value>${this.valueToXml(this.config.apiKey)}</value></param>
    <param><value>${this.valueToXml('product.template')}</value></param>
    <param><value>${this.valueToXml('write')}</value></param>
    <param><value>${this.valueToXml([[productId], values])}</value></param>
  </params>
</methodCall>`;

    console.log(`🔍 XML being sent to Odoo:`, xml);
    console.log(`🔍 Values being updated:`, values);

    const response = await fetch(`${this.config.url}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xml
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    console.log(`🔍 Odoo response:`, responseText);
    
    const result = this.parseSimpleResponse(responseText);
    console.log(`🔍 Parsed result:`, result);
    
    // Odoo write method returns True on success
    return result === true || result === 1;
  }

  async testConnection(): Promise<{ success: boolean; uid?: number; error?: string }> {
    try {
      const uid = await this.auth();
      return { success: true, uid };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Factory singleton
let odooClient: OdooSimpleClient | null = null;

export function getOdooClient(): OdooSimpleClient {
  if (!odooClient) {
    const config = {
      url: process.env.ODOO_URL!,
      db: process.env.ODOO_DB!,
      user: process.env.ODOO_USER!,
      apiKey: process.env.ODOO_API_KEY!,
    };

    if (!config.url || !config.db || !config.user || !config.apiKey) {
      throw new Error('Missing required Odoo configuration. Check ODOO_URL, ODOO_DB, ODOO_USER, and ODOO_API_KEY environment variables.');
    }

    odooClient = new OdooSimpleClient(config);
  }
  return odooClient;
}