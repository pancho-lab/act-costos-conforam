import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { db } from './db'

// Usuarios de desarrollo/prueba
const DEMO_USERS = [
  {
    id: "1",
    email: "admin@conforam.demo",
    password: "ConforamAdmin2024!",
    name: "Admin Conforam-Rincon del Aroma",
    role: "ADMIN",
    companyId: 1
  },
  {
    id: "2", 
    email: "viewer@conforam.demo",
    password: "ConforamViewer2024!",
    name: "Viewer Conforam-Rincon del Aroma",
    role: "VIEWER",
    companyId: 1
  }
]

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Email y Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Buscar en usuarios demo para desarrollo
        const demoUser = DEMO_USERS.find(
          user => user.email === credentials.email && user.password === credentials.password
        )

        if (demoUser) {
          // Asegurar que el usuario existe en la DB
          const dbUser = await db.user.upsert({
            where: { email: demoUser.email },
            update: {
              name: demoUser.name,
              role: demoUser.role,
              companyId: demoUser.companyId
            },
            create: {
              email: demoUser.email,
              name: demoUser.name,
              role: demoUser.role,
              companyId: demoUser.companyId
            }
          })

          return {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role,
            companyId: dbUser.companyId
          }
        }

        return null
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        // First time login
        token.role = user.role || 'VIEWER'
        token.companyId = user.companyId
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.companyId = token.companyId as number | undefined
      }
      return session
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          // Check if user exists in our database
          const existingUser = await db.user.findUnique({
            where: { email: user.email! }
          })

          if (!existingUser) {
            // Create new user with default VIEWER role
            await db.user.create({
              data: {
                email: user.email!,
                name: user.name,
                image: user.image,
                role: 'VIEWER'
              }
            })
          }

          return true
        } catch (error) {
          console.error('Error in signIn callback:', error)
          return false
        }
      }
      return true
    },
  },
  debug: process.env.NODE_ENV === 'development',
}

// Types for NextAuth
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: string
      companyId?: number
    }
  }

  interface User {
    role?: string
    companyId?: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    companyId?: number
  }
}