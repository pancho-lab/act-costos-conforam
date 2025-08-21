import fetch from 'node-fetch';
import type { OdooCategory, OdooProduct } from '@/types';

export interface OdooConfig {
  url: string;
  db: string;
  user: string;
  apiKey: string;
}

export class OdooClient {
  private uid: number | null = null;
  
  constructor(private config: OdooConfig) {}

  private async xmlrpcCall(endpoint: string, method: string, params: any[]): Promise<any> {
    const url = `${this.config.url}${endpoint}`;
    
    // Crear XML-RPC request
    const xmlData = `<?xml version="1.0"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>
    ${params.map(param => `<param><value>${this.valueToXml(param)}</value></param>`).join('')}
  </params>
</methodCall>`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'User-Agent': 'Odoo Client'
        },
        body: xmlData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      return this.parseXmlResponse(responseText);
    } catch (error) {
      console.error(`Odoo XMLRPC call failed:`, error);
      throw error;
    }
  }

  private valueToXml(value: any): string {
    if (typeof value === 'string') {
      return `<string>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</string>`;
    } else if (typeof value === 'number') {
      return Number.isInteger(value) ? `<int>${value}</int>` : `<double>${value}</double>`;
    } else if (typeof value === 'boolean') {
      return `<boolean>${value ? '1' : '0'}</boolean>`;
    } else if (Array.isArray(value)) {
      return `<array><data>${value.map(v => `<value>${this.valueToXml(v)}</value>`).join('')}</data></array>`;
    } else if (typeof value === 'object' && value !== null) {
      const members = Object.entries(value).map(([k, v]) => 
        `<member><name>${k}</name><value>${this.valueToXml(v)}</value></member>`
      ).join('');
      return `<struct>${members}</struct>`;
    } else {
      return `<string>${String(value)}</string>`;
    }
  }

  private parseXmlResponse(xml: string): any {
    // Simplificada parser - en producción usar un parser XML real
    if (xml.includes('<fault>')) {
      const errorMatch = xml.match(/<string>([^<]+)<\/string>/);
      throw new Error(errorMatch ? errorMatch[1] : 'Odoo error');
    }
    
    if (xml.includes('<int>')) {
      const match = xml.match(/<int>(\d+)<\/int>/);
      return match ? parseInt(match[1]) : null;
    }
    
    if (xml.includes('<boolean>')) {
      const match = xml.match(/<boolean>([01])<\/boolean>/);
      return match ? match[1] === '1' : false;
    }

    // Para arrays complejos, necesitaríamos un parser más sofisticado
    // Por ahora retornamos la respuesta cruda para debugging
    console.log('XML Response:', xml);
    return xml;
  }

  async auth(): Promise<number> {
    if (this.uid) return this.uid;
    
    try {
      const result = await this.xmlrpcCall(
        '/xmlrpc/2/common',
        'authenticate',
        [this.config.db, this.config.user, this.config.apiKey, {}]
      );
      
      if (typeof result === 'number' && result > 0) {
        this.uid = result;
        console.log(`Odoo authenticated successfully with UID: ${result}`);
        return result;
      } else {
        throw new Error('Invalid authentication response');
      }
    } catch (error) {
      console.error('Odoo auth error:', error);
      throw new Error(`Odoo auth failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
let odooClient: OdooClient | null = null;

export function getOdooClient(): OdooClient {
  if (!odooClient) {
    const config = {
      url: process.env.ODOO_URL!,
      db: process.env.ODOO_DB!,
      user: process.env.ODOO_USER!,
      apiKey: process.env.ODOO_API_KEY!,
    };

    // Validar configuración
    if (!config.url || !config.db || !config.user || !config.apiKey) {
      throw new Error('Missing required Odoo configuration. Check ODOO_URL, ODOO_DB, ODOO_USER, and ODOO_API_KEY environment variables.');
    }

    odooClient = new OdooClient(config);
  }
  return odooClient;
}