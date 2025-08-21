import fetch from 'node-fetch';
import type { OdooCategory, OdooProduct } from '@/types';

export interface OdooConfig {
  url: string;
  db: string;
  user: string;
  apiKey: string;
}

export class OdooWorkingClient {
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

  private parseResponse(xml: string): any {
    // Check for array response
    if (xml.includes('<array>')) {
      const arrayMatch = xml.match(/<array><data>(.*?)<\/data><\/array>/s);
      if (arrayMatch) {
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
            } else if (valueContent.includes('<array>')) {
              // Parse nested array (like parent_id which is [id, "name"])
              const nestedArrayMatch = valueContent.match(/<array><data>(.*?)<\/data><\/array>/s);
              if (nestedArrayMatch) {
                const values: any[] = [];
                const valueRegex = /<value><(int|string|double)>(.*?)<\/\1><\/value>/gs;
                let valueMatch;
                while ((valueMatch = valueRegex.exec(nestedArrayMatch[1])) !== null) {
                  const type = valueMatch[1];
                  const val = valueMatch[2];
                  if (type === 'int') {
                    values.push(parseInt(val));
                  } else if (type === 'double') {
                    values.push(parseFloat(val));
                  } else {
                    values.push(val);
                  }
                }
                item[name] = values;
              } else {
                item[name] = [];
              }
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
    const result = this.parseResponse(responseText);
    
    if (typeof result === 'number' && result > 0) {
      this.uid = result;
      console.log(`Odoo authenticated successfully with UID: ${result}`);
      return result;
    } else {
      throw new Error('Invalid authentication response');
    }
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
    const result = this.parseResponse(responseText);
    return Array.isArray(result) ? result : [];
  }

  async getCategories(limit: number = 50): Promise<OdooCategory[]> {
    const result = await this.searchRead('product.category', [], ['id', 'name', 'parent_id'], { limit, order: 'name asc' });
    return result.map(cat => ({
      id: cat.id,
      name: cat.name,
      parent_id: Array.isArray(cat.parent_id) ? cat.parent_id[0] : cat.parent_id,
      parent_name: Array.isArray(cat.parent_id) ? cat.parent_id[1] : null
    }));
  }

  async getProducts(domain: any[] = [], limit: number = 10): Promise<OdooProduct[]> {
    const baseDomain = [['active', '=', true]];
    const finalDomain = domain.length > 0 ? [...baseDomain, ...domain] : baseDomain;
    const result = await this.searchRead('product.template', finalDomain, ['id', 'name', 'default_code', 'categ_id', 'standard_price'], { limit, order: 'name asc' });
    
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
let odooClient: OdooWorkingClient | null = null;

export function getOdooClient(): OdooWorkingClient {
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

    odooClient = new OdooWorkingClient(config);
  }
  return odooClient;
}