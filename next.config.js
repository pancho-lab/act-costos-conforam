/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['xmlrpc']
  },
  // Configuración para Vercel deployment
  env: {
    CUSTOM_KEY: 'my-value'
  }
}

module.exports = nextConfig